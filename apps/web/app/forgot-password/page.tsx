'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { AuthLayout } from '../../components/auth/auth-layout';
import { AuthNotice } from '../../components/auth/auth-notice';
import { Gate } from '../../components/gate';
import { api } from '../../lib/api';
import { authErrorMessage } from '../../lib/auth-errors';

/** Page « Mot de passe oublié » : accessible sans connexion, réservée aux visiteurs non connectés. */
export default function ForgotPasswordPage() {
  return (
    <Gate allow={['anonymous']}>
      <ForgotPasswordForm />
    </Gate>
  );
}

/**
 * Demande un lien de réinitialisation (A08) puis confirme l'envoi (A09). L'interface affiche TOUJOURS le même message de
 * confirmation, que l'adresse corresponde à un compte ou non : elle ne doit rien laisser deviner (aucune énumération).
 */
function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Demande le lien ; affiche toujours la même confirmation, seule une erreur de limitation ou de panne est signalée. */
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const answer = await api<{ message: string }>('/auth/password-reset/request', { method: 'POST', body: { email: email.trim() }, auth: false });
      setMessage(answer.message);
    } catch (e) {
      // Seule la limitation de débit (429) ou une panne sont signalées : jamais le fait qu'un compte existe ou non.
      setError(authErrorMessage(e, 'Demande impossible. Réessayez dans un instant.'));
      setBusy(false);
    }
  }

  const back = <Link href="/login">← Retour à la connexion</Link>;

  if (message) {
    return (
      <AuthLayout title="Vérifiez votre boîte de réception" documentTitle="Mot de passe oublié : e-mail envoyé" footer={back}>
        <AuthNotice tone="ok" role="status">{message}</AuthNotice>
        <ul className="m-0 flex list-none flex-col gap-2 p-0 text-ink-2">
          <li>Le lien est valable <strong>60 minutes</strong> et ne sert <strong>qu’une fois</strong>.</li>
          <li>Pensez à vérifier vos courriers indésirables.</li>
          <li>Vous pouvez fermer cette page.</li>
        </ul>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Mot de passe oublié"
      description="Saisissez l’adresse e-mail de votre compte : un lien pour choisir un nouveau mot de passe vous sera envoyé."
      footer={back}
    >
      <form onSubmit={submit}>
        {error && <AuthNotice tone="bad" role="alert">{error}</AuthNotice>}
        <label>
          Adresse e-mail
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" maxLength={254} required autoFocus />
        </label>
        <button type="submit" disabled={busy || email.trim().length === 0} className="w-full">Envoyer le lien</button>
      </form>
    </AuthLayout>
  );
}
