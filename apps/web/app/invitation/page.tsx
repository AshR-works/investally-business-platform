'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { AuthLayout } from '../../components/auth/auth-layout';
import { AuthNotice } from '../../components/auth/auth-notice';
import { NewPasswordFields } from '../../components/auth/new-password-fields';
import { api } from '../../lib/api';
import { authErrorMessage } from '../../lib/auth-errors';
import { parseInvitationFragment } from '../../lib/invitation';
import { passwordHints } from '../../lib/password';

/**
 * Page d'activation d'un compte invité (A13) : lit le jeton dans le fragment de l'URL, l'efface de l'adresse, puis laisse
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
      setError(authErrorMessage(e, 'Activation impossible. Réessayez.'));
      setBusy(false);
    }
  }

  if (!ready) return <div className="grid min-h-screen place-items-center"><p role="status">Chargement…</p></div>;

  if (done) {
    return (
      <AuthLayout title="Compte activé">
        <AuthNotice tone="ok" role="status">Votre mot de passe est enregistré.</AuthNotice>
        <p className="text-ink-2">Connectez-vous : vous configurerez ensuite votre application d’authentification (obligatoire).</p>
        <Link href="/login" className="inline-block rounded-control bg-brand px-4 py-2 font-semibold text-brand-ink no-underline hover:bg-brand-hover">Aller à la connexion</Link>
      </AuthLayout>
    );
  }

  if (!token.current) {
    return (
      <AuthLayout title="Lien invalide ou expiré" documentTitle="Invitation : lien invalide">
        <AuthNotice tone="warn" role="status">Ce lien d’invitation est incomplet, a expiré ou a déjà été utilisé.</AuthNotice>
        <p className="text-ink-2">Demandez un nouveau lien à un administrateur.</p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Activer votre compte" description="Choisissez votre mot de passe. Il n’est connu que de vous.">
      <form onSubmit={submit}>
        {error && <AuthNotice tone="bad" role="alert">{error}</AuthNotice>}
        <NewPasswordFields password={password} confirmation={confirmation} onPassword={setPassword} onConfirmation={setConfirmation} />
        <button type="submit" disabled={busy || hints.length > 0 || password !== confirmation || password.length === 0} className="w-full">Activer mon compte</button>
      </form>
    </AuthLayout>
  );
}
