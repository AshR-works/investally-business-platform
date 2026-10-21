'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, refreshAccessToken, setAccessToken, setSessionLostHandler, setStepUpHandler } from './api';
import type { Profile } from './types';
import { StepUpDialog } from '../components/step-up-dialog';

/**
 * loading        : on vérifie s'il existe une session (cookie de rafraîchissement)
 * anonymous      : personne n'est connecté
 * mfa-enroll     : mot de passe valide, second facteur jamais configuré (obligatoire)
 * mfa-verify     : mot de passe valide, code du second facteur à saisir
 * ready          : mot de passe + second facteur vérifiés
 */
export type AuthStatus = 'loading' | 'anonymous' | 'mfa-enroll' | 'mfa-verify' | 'ready';

export interface EnrollmentStart {
  secret: string;
  otpauthUri: string;
}
export interface EnrollmentConfirmed {
  recoveryCodes: string[];
}

interface AuthContextValue {
  status: AuthStatus;
  profile: Profile | null;
  login(email: string, password: string): Promise<void>;
  verifyMfa(code: string): Promise<void>;
  startEnrollment(): Promise<EnrollmentStart>;
  /** Le jeton vérifié par MFA est installé, mais l'état ne change qu'à l'appel de `refreshState` (le temps d'afficher les codes de secours). */
  confirmEnrollment(code: string): Promise<EnrollmentConfirmed>;
  refreshState(): Promise<void>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return value;
}

interface TokenResponse {
  accessToken: string;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stepUp, setStepUp] = useState<{ resolve: (ok: boolean) => void } | null>(null);
  const started = useRef(false);

  const clear = useCallback(() => {
    setAccessToken(null);
    setProfile(null);
    setStatus('anonymous');
  }, []);

  const refreshState = useCallback(async () => {
    const [me, loaded] = await Promise.all([
      api<{ mfaVerified: boolean }>('/auth/me'),
      api<Profile>('/auth/me/profile'),
    ]);
    setProfile(loaded);
    setStatus(me.mfaVerified ? 'ready' : loaded.mfaEnrolled ? 'mfa-verify' : 'mfa-enroll');
  }, []);

  useEffect(() => {
    setSessionLostHandler(clear);
    setStepUpHandler(() => new Promise<boolean>((resolve) => setStepUp({ resolve })));
    if (!started.current) {
      started.current = true;
      void (async () => {
        if (await refreshAccessToken()) {
          try {
            await refreshState();
            return;
          } catch {
            /* session inutilisable : retour à la connexion */
          }
        }
        clear();
      })();
    }
    return () => {
      setSessionLostHandler(null);
      setStepUpHandler(null);
    };
  }, [clear, refreshState]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      profile,
      async login(email, password) {
        const body = await api<TokenResponse>('/auth/login', { method: 'POST', body: { email, password }, auth: false });
        setAccessToken(body.accessToken);
        await refreshState();
      },
      async verifyMfa(code) {
        const body = await api<TokenResponse>('/auth/mfa/verify', { method: 'POST', body: { code } });
        setAccessToken(body.accessToken);
        await refreshState();
      },
      startEnrollment: () => api<EnrollmentStart>('/auth/mfa/enroll/start', { method: 'POST' }),
      async confirmEnrollment(code) {
        const body = await api<TokenResponse & EnrollmentConfirmed>('/auth/mfa/enroll/confirm', { method: 'POST', body: { code } });
        setAccessToken(body.accessToken);
        return { recoveryCodes: body.recoveryCodes };
      },
      refreshState,
      async logout() {
        try {
          await api('/auth/logout', { method: 'POST' });
        } catch {
          /* la session locale est de toute façon abandonnée */
        }
        clear();
      },
    }),
    [status, profile, refreshState, clear],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      {stepUp && (
        <StepUpDialog
          onDone={(ok) => {
            stepUp.resolve(ok);
            setStepUp(null);
          }}
        />
      )}
    </AuthContext.Provider>
  );
}
