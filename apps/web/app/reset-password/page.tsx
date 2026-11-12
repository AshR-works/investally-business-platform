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
 * Page ouverte depuis le lien reçu par e-mail (A10 à A12). Le jeton est dans le FRAGMENT de l'URL (jamais envoyé au
 * serveur ni dans le Referer) : il est lu une fois, gardé en mémoire seulement, et effacé de la barre d'adresse et de
 * l'historique.
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
      setError(authErrorMessage(e, 'Réinitialisation impossible. Réessayez.'));
      setBusy(false);
    }
  }

  if (!ready) return <div className="grid min-h-screen place-items-center"><p role="status">Chargement…</p></div>;

  if (done) {
    return (
      <AuthLayout title="Mot de passe modifié">
        <AuthNotice tone="ok" role="status">Votre nouveau mot de passe est enregistré et <strong>toutes vos sessions ont été fermées</strong>.</AuthNotice>
        <p className="text-ink-2">Connectez-vous : votre second facteur vous sera demandé comme d’habitude.</p>
        <Link href="/login" className="inline-block rounded-control bg-brand px-4 py-2 font-semibold text-brand-ink no-underline hover:bg-brand-hover">Aller à la connexion</Link>
      </AuthLayout>
    );
  }

  if (!token.current) {
    return (
      <AuthLayout title="Lien invalide ou expiré" documentTitle="Réinitialisation : lien invalide">
        <AuthNotice tone="warn" role="status">Ce lien est incomplet, a expiré ou a déjà été utilisé.</AuthNotice>
        <p className="text-ink-2">Vous pouvez en demander un nouveau : il sera valable 60 minutes.</p>
        <Link href="/forgot-password" className="inline-block rounded-control bg-brand px-4 py-2 font-semibold text-brand-ink no-underline hover:bg-brand-hover">Demander un nouveau lien</Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Nouveau mot de passe" description="Choisissez un mot de passe que vous n’utilisez nulle part ailleurs.">
      <form onSubmit={submit}>
        {error && <AuthNotice tone="bad" role="alert">{error}</AuthNotice>}
        <NewPasswordFields password={password} confirmation={confirmation} onPassword={setPassword} onConfirmation={setConfirmation} />
        <button type="submit" disabled={busy || hints.length > 0 || password !== confirmation || password.length === 0} className="w-full">Enregistrer</button>
        <p className="mt-4 text-[length:var(--text-sm)] text-ink-2">Vous ne pouvez pas réutiliser l’un de vos 5 derniers mots de passe.</p>
      </form>
    </AuthLayout>
  );
}
