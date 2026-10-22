'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { AuthLayout } from '../../components/auth/auth-layout';
import { AuthNotice } from '../../components/auth/auth-notice';
import { PasswordField } from '../../components/auth/password-field';
import { Gate } from '../../components/gate';
import { Icon } from '../../components/icon';
import { useAuth } from '../../lib/auth-context';
import { authErrorMessage, isRateLimited, RATE_LIMIT_WAIT_SECONDS } from '../../lib/auth-errors';
import { useCooldown } from '../../lib/use-cooldown';

/** Page de connexion, réservée aux visiteurs non connectés. */
export default function LoginPage() {
  return (
    <Gate allow={['anonymous']}>
      <LoginForm />
    </Gate>
  );
}

/**
 * Formulaire de connexion (A01) : adresse et mot de passe, lien « Mot de passe oublié ». Le message d'échec est celui du
 * serveur, identique pour un compte inconnu, mal saisi ou verrouillé (A14) ; une limitation de débit (A15) bloque le
 * bouton pendant un compte à rebours.
 */
function LoginForm() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [limited, setLimited] = useState(false);
  const [busy, setBusy] = useState(false);
  const cooldown = useCooldown();

  /** Tente la connexion ; en cas d'échec affiche le message du serveur et vide le mot de passe. */
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setLimited(false);
    try {
      await login(email.trim(), password);
    } catch (e) {
      setError(authErrorMessage(e, 'Connexion impossible. Réessayez.'));
      if (isRateLimited(e)) {
        setLimited(true);
        cooldown.start(RATE_LIMIT_WAIT_SECONDS);
      }
      setPassword('');
      setBusy(false);
    }
  }

  const waiting = limited && cooldown.remaining > 0;

  return (
    <AuthLayout
      title="Connexion"
      documentTitle="Connexion"
      description="Accédez à votre espace de travail Investally."
      step={{ current: 1, total: 2 }}
      footer={<p className="m-0">Compte verrouillé après plusieurs échecs ? Patientez quelques minutes ou contactez un administrateur.</p>}
    >
      <form onSubmit={submit}>
        {error && (
          <AuthNotice tone={limited ? 'warn' : 'bad'} role="alert" title={limited ? 'Trop de tentatives' : undefined}>
            {limited ? (waiting ? `Patientez avant de réessayer : encore ${cooldown.remaining} s.` : 'Vous pouvez réessayer.') : error}
          </AuthNotice>
        )}
        <label>
          Adresse e-mail
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" maxLength={254} required autoFocus />
        </label>
        <PasswordField label="Mot de passe" value={password} onChange={setPassword} autoComplete="current-password" />
        <p className="-mt-2 mb-5 text-right text-[length:var(--text-sm)]"><Link href="/forgot-password">Mot de passe oublié ?</Link></p>
        <button type="submit" disabled={busy || waiting} className="w-full">{waiting ? `Patientez ${cooldown.remaining} s` : 'Se connecter'}</button>
        <p className="mt-5 flex items-center gap-2 text-[length:var(--text-sm)] text-ink-2">
          <Icon name="user" className="size-4" />
          Un code de votre application d’authentification vous sera demandé ensuite.
        </p>
      </form>
    </AuthLayout>
  );
}
