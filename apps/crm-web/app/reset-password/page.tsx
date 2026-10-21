'use client';

import { PageHeading } from '../../components/page-heading';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { parseInvitationFragment } from '../../lib/invitation';
import { passwordHints } from '../../lib/password';

/**
 * Page ouverte depuis le lien reçu par e-mail. Le jeton est dans le FRAGMENT de l'URL (jamais envoyé au serveur ni dans
 * le Referer) : il est lu une fois, gardé en mémoire seulement, et effacé de la barre d'adresse et de l'historique.
 */
export default function ResetPasswordPage() {
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
   * Envoie le jeton et le nouveau mot de passe ; le serveur coupe toutes les sessions, l'utilisateur doit se
   * reconnecter avec son second facteur.
   */
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!token.current) return;
    setBusy(true);
    setError(null);
    try {
      await api('/auth/password-reset/accept', { method: 'POST', body: { token: token.current, password }, auth: false });
      token.current = null;
      setPassword('');
      setConfirmation('');
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Réinitialisation impossible. Réessayez.');
      setBusy(false);
    }
  }

  if (!ready) return <div className="center"><p role="status">Chargement…</p></div>;

  if (done) {
    return (
      <main className="center">
        <div className="card">
          <PageHeading>Mot de passe modifié</PageHeading>
          <p>Votre nouveau mot de passe est enregistré et toutes vos sessions ont été fermées. Connectez-vous : votre second facteur vous sera demandé comme d&apos;habitude.</p>
          <a href="/login">Aller à la connexion</a>
        </div>
      </main>
    );
  }

  if (!token.current) {
    return (
      <main className="center">
        <div className="card">
          <PageHeading title="Réinitialisation : lien invalide">Lien invalide</PageHeading>
          <p>Ce lien est incomplet ou a déjà été utilisé. Vous pouvez en demander un nouveau depuis la page de connexion (« Mot de passe oublié ? »).</p>
          <a href="/forgot-password">Demander un nouveau lien</a>
        </div>
      </main>
    );
  }

  return (
    <main className="center">
      <form className="card" onSubmit={submit}>
        <PageHeading>Nouveau mot de passe</PageHeading>
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
        <button type="submit" disabled={busy || hints.length > 0 || password !== confirmation || password.length === 0}>Enregistrer</button>
        <p className="hint">Vous ne pouvez pas réutiliser l&apos;un de vos 5 derniers mots de passe.</p>
      </form>
    </main>
  );
}
