'use client';

import QRCode from 'qrcode';
import { FormEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { AuthLayout } from '../../components/auth/auth-layout';
import { AuthNotice } from '../../components/auth/auth-notice';
import { OtpInput } from '../../components/auth/otp-input';
import { Gate } from '../../components/gate';
import { Icon } from '../../components/icon';
import { useAuth } from '../../lib/auth-context';
import { authErrorMessage, isRateLimited, RATE_LIMIT_WAIT_SECONDS } from '../../lib/auth-errors';
import { OTP_LENGTH } from '../../lib/otp';
import { useCooldown } from '../../lib/use-cooldown';

/** Page du second facteur : vérification d'un code, ou première configuration si le MFA n'est pas encore en place. */
export default function MfaPage() {
  return (
    <Gate allow={['mfa-enroll', 'mfa-verify']}>
      <MfaScreen />
    </Gate>
  );
}

/** Choisit l'écran (configuration ou vérification) selon l'état de la session. */
function MfaScreen() {
  const { status } = useAuth();
  return status === 'mfa-enroll' ? <Enrollment /> : <Verification />;
}

/** Pied des écrans MFA : compte connecté et possibilité d'en changer. */
function AccountFooter() {
  const { profile, logout } = useAuth();
  return (
    <p className="m-0">
      Connecté en tant que {profile?.email}.{' '}
      <button type="button" className="secondary small" onClick={() => void logout()}>Changer de compte</button>
    </p>
  );
}

/**
 * Saisie du code du second facteur (A02) ou d'un code de secours à usage unique (A03). Même route côté serveur ; le
 * champ unique (et non six cases) garde le collage, la saisie automatique et les lecteurs d'écran fonctionnels.
 */
function Verification() {
  const { verifyMfa } = useAuth();
  const [recovery, setRecovery] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [limited, setLimited] = useState(false);
  const [busy, setBusy] = useState(false);
  const cooldown = useCooldown();

  /** Envoie le code ; un échec est affiché et le champ vidé (une seule requête par tentative). */
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setLimited(false);
    try {
      await verifyMfa(code.trim());
    } catch (e) {
      setError(authErrorMessage(e, 'Vérification impossible. Réessayez.'));
      if (isRateLimited(e)) {
        setLimited(true);
        cooldown.start(RATE_LIMIT_WAIT_SECONDS);
      }
      setCode('');
      setBusy(false);
    }
  }

  const waiting = limited && cooldown.remaining > 0;

  return (
    <AuthLayout
      title={recovery ? 'Utiliser un code de secours' : 'Vérification en deux étapes'}
      description={recovery ? 'Saisissez l’un de vos codes de secours (format XXXXX-XXXXX). Chaque code ne sert qu’une fois.' : 'Saisissez les 6 chiffres affichés par votre application d’authentification.'}
      step={{ current: 2, total: 2 }}
      footer={<AccountFooter />}
    >
      <form onSubmit={submit}>
        {error && (
          <AuthNotice tone={limited ? 'warn' : 'bad'} role="alert" title={limited ? 'Trop de tentatives' : undefined}>
            {limited ? (waiting ? `Patientez avant de réessayer : encore ${cooldown.remaining} s.` : 'Vous pouvez réessayer.') : error}
          </AuthNotice>
        )}
        {recovery ? (
          <label>
            Code de secours
            <input value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" maxLength={32} placeholder="XXXXX-XXXXX" required autoFocus />
          </label>
        ) : (
          <OtpInput label="Code de vérification" value={code} onChange={setCode} autoFocus />
        )}
        <button type="submit" disabled={busy || waiting || (recovery ? code.trim().length === 0 : code.length < OTP_LENGTH)} className="w-full">{waiting ? `Patientez ${cooldown.remaining} s` : 'Vérifier'}</button>
        <p className="mb-0 mt-4 text-[length:var(--text-sm)]">
          <button type="button" className="secondary small" onClick={() => { setRecovery(!recovery); setCode(''); setError(null); }}>
            {recovery ? 'Utiliser mon application d’authentification' : 'Téléphone perdu ? Utiliser un code de secours'}
          </button>
        </p>
      </form>
    </AuthLayout>
  );
}

/** Présente la clé manuelle par groupes de 4 caractères pour la saisir plus facilement. */
function groupSecret(secret: string): string {
  return secret.replace(/(.{4})/g, '$1 ').trim();
}

/** Les trois étapes d'activation (A04) : pictogramme, titre, explication. */
const ENROLL_STEPS: { icon: 'cap' | 'search' | 'shield'; title: string; text: ReactNode }[] = [
  { icon: 'cap', title: 'Installez une application d’authentification', text: 'Microsoft Authenticator, Google Authenticator, Aegis…' },
  { icon: 'search', title: 'Scannez le QR code', text: 'Ou saisissez la clé manuellement.' },
  { icon: 'shield', title: 'Confirmez avec le code à 6 chiffres', text: 'Puis conservez vos codes de secours.' },
];

/**
 * Première configuration du MFA en trois écrans : introduction (A04), QR code et confirmation du premier code
 * (A05, A06), codes de secours à affichage unique (A07). Le secret n'est créé qu'au clic sur « Commencer ».
 */
function Enrollment() {
  const { startEnrollment, confirmEnrollment, refreshState } = useAuth();
  const [stage, setStage] = useState<'intro' | 'setup'>('intro');
  const [secret, setSecret] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    // Les codes de secours ne sont affichés qu'une fois : on prévient avant de quitter ou de recharger la page.
    if (!recoveryCodes) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [recoveryCodes]);

  /** Démarre la configuration (un seul appel : chaque appel génère un nouveau secret et invaliderait le QR affiché). */
  async function begin() {
    if (started.current) return;
    started.current = true;
    setStage('setup');
    try {
      const start = await startEnrollment();
      setSecret(start.secret);
      // Le QR est généré dans le navigateur : le secret n'est transmis à aucun service tiers.
      setQr(await QRCode.toDataURL(start.otpauthUri, { margin: 1, width: 220, errorCorrectionLevel: 'M' }));
    } catch (e) {
      setError(authErrorMessage(e, 'Impossible de démarrer la configuration.'));
    }
  }

  /**
   * Confirme l'enrôlement avec le code saisi ; en cas de succès les codes de secours sont affichés et le secret
   * effacé de la mémoire.
   */
  async function confirm(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await confirmEnrollment(code.trim());
      setSecret(null);
      setQr(null);
      setRecoveryCodes(result.recoveryCodes);
    } catch (e) {
      setError(authErrorMessage(e, 'Confirmation impossible. Réessayez.'));
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  if (recoveryCodes) {
    const text = `Investally CRM - codes de secours (usage unique)\n\n${recoveryCodes.join('\n')}\n`;
    return (
      <AuthLayout
        title="Conservez vos codes de secours"
        step={{ current: 3, total: 3 }}
        description={<>Chaque code ne sert qu’<strong>une fois</strong> si vous perdez votre téléphone. Ils ne seront <strong>plus jamais affichés</strong> : rangez-les dans un endroit sûr (gestionnaire de mots de passe), pas dans un e-mail.</>}
        footer={<AccountFooter />}
      >
        <div className="codes" role="group" aria-label="Codes de secours">
          {recoveryCodes.map((c) => <span key={c}>{c}</span>)}
        </div>
        <div className="row">
          <button
            type="button"
            className="secondary"
            onClick={() => {
              void navigator.clipboard?.writeText(text).then(() => setCopied(true));
            }}
          >
            Copier
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
              const link = document.createElement('a');
              link.href = url;
              link.download = 'investally-codes-de-secours.txt';
              link.click();
              URL.revokeObjectURL(url);
            }}
          >
            Télécharger
          </button>
        </div>
        <p role="status" className="my-2 min-h-5 text-[length:var(--text-sm)] text-ok">{copied ? 'Codes copiés dans le presse-papiers.' : ''}</p>
        <label className="inline" style={{ margin: '1rem 0' }}>
          <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
          J’ai conservé ces codes en lieu sûr
        </label>
        <button type="button" disabled={!saved} onClick={() => void refreshState()} className="w-full">Continuer</button>
      </AuthLayout>
    );
  }

  if (stage === 'intro') {
    return (
      <AuthLayout
        title="Activez la vérification en deux étapes"
        step={{ current: 1, total: 3 }}
        description="Elle est obligatoire pour tous : elle protège votre compte même si votre mot de passe est découvert. Comptez deux minutes."
        footer={<AccountFooter />}
      >
        <ol className="m-0 mb-6 flex list-none flex-col gap-4 p-0">
          {ENROLL_STEPS.map((item, index) => (
            <li key={item.title} className="flex items-start gap-3">
              <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-control bg-brand-soft text-brand-strong"><Icon name={item.icon} /></span>
              <span>
                <strong className="block">{index + 1}. {item.title}</strong>
                <span className="text-[length:var(--text-sm)] text-ink-2">{item.text}</span>
              </span>
            </li>
          ))}
        </ol>
        <button type="button" onClick={() => void begin()} className="w-full">Commencer</button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Scannez le QR code"
      step={{ current: 2, total: 3 }}
      description="Ouvrez votre application d’authentification, scannez le code, puis saisissez les 6 chiffres affichés."
      footer={<AccountFooter />}
    >
      <form onSubmit={confirm}>
        {qr ? <img className="qr" src={qr} alt="QR code à scanner avec votre application d'authentification" /> : !error && <p role="status">Préparation…</p>}
        {secret && <p className="mb-5 text-center text-[length:var(--text-sm)]">Clé manuelle : <span className="secret">{groupSecret(secret)}</span></p>}
        {error && <AuthNotice tone="bad" role="alert">{error}</AuthNotice>}
        <OtpInput label="Code de vérification" value={code} onChange={setCode} disabled={!secret} />
        <button type="submit" disabled={busy || !secret || code.length < OTP_LENGTH} className="w-full">Confirmer</button>
      </form>
    </AuthLayout>
  );
}
