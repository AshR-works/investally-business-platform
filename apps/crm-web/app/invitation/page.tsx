'use client';

import { PageHeading } from '../../components/page-heading';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { parseInvitationFragment } from '../../lib/invitation';
import { passwordHints } from '../../lib/password';

/**
 * Page d'activation d'un compte invité : lit le jeton dans le fragment de l'URL, l'efface de l'adresse, puis laisse
 * choisir le mot de passe.
 */
export default function InvitationPage() {
  // Le jeton n'est gardé qu'en mémoire : le fragment est effacé de l'adresse et de l'historique dès la lecture.
  const token = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    token.current = parseInvitationFragment(window.location.hash);
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname);
    setReady(true);
  }, []);

  const hints = passwordHints(password);
  const mismatch = confirmation.length > 0 && confirmation !== password;

  /**
   * Envoie le jeton et le mot de passe ; un refus (lien invalide, mot de passe refusé) est affiché et le lien reste
   * utilisable si c'est le mot de passe qui est en cause.
   */
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!token.current) return;
    setBusy(true);
    setError(null);
    try {
      await api('/auth/invitation/accept', { method: 'POST', body: { token: token.current, password }, auth: false });
      token.current = null;
      setPassword('');
      setConfirmation('');
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Activation impossible. Réessayez.');
      setBusy(false);
    }
  }

  if (!ready) return <div className="center"><p role="status">Chargement…</p></div>;

  if (done) {
    return (
      <main className="center">
        <div className="card">
          <PageHeading>Compte activé</PageHeading>
          <p>Votre mot de passe est enregistré. Connectez-vous : vous configurerez ensuite votre application d&apos;authentification.</p>
          <a href="/login">Aller à la connexion</a>
        </div>
      </main>
    );
  }

  if (!token.current) {
    return (
      <main className="center">
        <div className="card">
          <PageHeading title="Invitation : lien invalide">Lien invalide</PageHeading>
          <p>Ce lien d&apos;invitation est incomplet ou a déjà été utilisé. Demandez un nouveau lien à un administrateur.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="center">
      <form className="card" onSubmit={submit}>
        <PageHeading>Activer votre compte</PageHeading>
        <p>Choisissez votre mot de passe. Il n&apos;est connu que de vous.</p>
        <label>
          Nouveau mot de passe
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" maxLength={256} required autoFocus />
        </label>
        {password.length > 0 && hints.map((h) => <p key={h} className="hint bad">{h}</p>)}
        <label>
          Confirmez le mot de passe
          <input type="password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} autoComplete="new-password" maxLength={256} required />
        </label>
        {mismatch && <p className="hint bad">Les deux mots de passe sont différents</p>}
        {error && <p role="alert" className="error">{error}</p>}
        <button type="submit" disabled={busy || hints.length > 0 || password !== confirmation || password.length === 0}>Activer mon compte</button>
      </form>
    </main>
  );
}
