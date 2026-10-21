'use client';

import QRCode from 'qrcode';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { Gate } from '../../components/gate';
import { ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';

/** Page du second facteur : vérification d'un code, ou première configuration si le MFA n'est pas encore en place. */
export default function MfaPage() {
  return (
    <Gate allow={['mfa-enroll', 'mfa-verify']}>
      <MfaScreen />
    </Gate>
  );
}

/** Choisit l'écran (configuration ou vérification) selon l'état de la session et permet de changer de compte. */
function MfaScreen() {
  const { status, profile, logout } = useAuth();
  return (
    <main className="center">
      <div className="card wide">
        {status === 'mfa-enroll' ? <Enrollment /> : <Verification />}
        <p className="hint">
          Connecté en tant que {profile?.email}. <button type="button" className="secondary small" onClick={() => void logout()}>Changer de compte</button>
        </p>
      </div>
    </main>
  );
}

/** Saisie du code TOTP ou d'un code de secours à usage unique. */
function Verification() {
  const { verifyMfa } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Envoie le code ; un échec est affiché et le champ vidé (une seule requête par tentative). */
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await verifyMfa(code.trim());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Vérification impossible. Réessayez.');
      setCode('');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <h1>Vérification en deux étapes</h1>
      <p>Saisissez le code à 6 chiffres de votre application d&apos;authentification.</p>
      <label>
        Code de vérification
        <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={32} required autoFocus />
      </label>
      <p className="hint">Téléphone perdu ? Saisissez à la place un de vos codes de secours (usage unique).</p>
      {error && <p role="alert" className="error">{error}</p>}
      <button type="submit" disabled={busy || code.trim().length === 0}>Vérifier</button>
    </form>
  );
}

/** Présente la clé manuelle par groupes de 4 caractères pour la saisir plus facilement. */
function groupSecret(secret: string): string {
  return secret.replace(/(.{4})/g, '$1 ').trim();
}

/**
 * Première configuration du MFA : QR code généré dans le navigateur, clé manuelle, confirmation par un premier code,
 * puis affichage unique des codes de secours.
 */
function Enrollment() {
  const { startEnrollment, confirmEnrollment, refreshState } = useAuth();
  const [secret, setSecret] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    // Les codes de secours ne sont affichés qu'une fois : on prévient avant de quitter ou de recharger la page.
    if (!recoveryCodes) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [recoveryCodes]);

  useEffect(() => {
    // Un seul démarrage : chaque appel génère un nouveau secret et invaliderait le QR déjà affiché.
    if (started.current) return;
    started.current = true;
    void (async () => {
      try {
        const start = await startEnrollment();
        setSecret(start.secret);
        // Le QR est généré dans le navigateur : le secret n'est transmis à aucun service tiers.
        setQr(await QRCode.toDataURL(start.otpauthUri, { margin: 1, width: 220, errorCorrectionLevel: 'M' }));
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Impossible de démarrer la configuration.");
      }
    })();
  }, [startEnrollment]);

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
      setError(e instanceof ApiError ? e.message : 'Confirmation impossible. Réessayez.');
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  if (recoveryCodes) {
    const text = `Investally CRM - codes de secours (usage unique)\n\n${recoveryCodes.join('\n')}\n`;
    return (
      <div>
        <h1>Conservez vos codes de secours</h1>
        <p>
          Chaque code ne sert qu&apos;<strong>une fois</strong> si vous perdez votre téléphone. Ils ne seront <strong>plus jamais affichés</strong> :
          rangez-les dans un endroit sûr (gestionnaire de mots de passe), pas dans un e-mail.
        </p>
        <div className="codes" aria-label="Codes de secours">
          {recoveryCodes.map((c) => <span key={c}>{c}</span>)}
        </div>
        <div className="row">
          <button type="button" className="secondary" onClick={() => void navigator.clipboard?.writeText(text)}>Copier</button>
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
        <label className="inline" style={{ margin: '1rem 0' }}>
          <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
          J&apos;ai conservé ces codes en lieu sûr
        </label>
        <button type="button" disabled={!saved} onClick={() => void refreshState()}>Continuer</button>
      </div>
    );
  }

  return (
    <form onSubmit={confirm}>
      <h1>Configurer le second facteur</h1>
      <p>Le second facteur est obligatoire pour accéder au CRM.</p>
      <ol>
        <li>Installez une application d&apos;authentification (Microsoft Authenticator, Google Authenticator, Aegis…).</li>
        <li>Scannez ce QR code, ou saisissez la clé manuellement.</li>
        <li>Saisissez le code à 6 chiffres affiché pour confirmer.</li>
      </ol>
      {qr ? <img className="qr" src={qr} alt="QR code à scanner avec votre application d'authentification" /> : !error && <p role="status">Préparation…</p>}
      {secret && <p>Clé manuelle : <span className="secret">{groupSecret(secret)}</span></p>}
      <label>
        Code de vérification
        <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={32} required disabled={!secret} />
      </label>
      {error && <p role="alert" className="error">{error}</p>}
      <button type="submit" disabled={busy || !secret || code.trim().length === 0}>Confirmer</button>
    </form>
  );
}
