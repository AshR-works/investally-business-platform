'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { Gate } from '../../components/gate';
import { api, ApiError } from '../../lib/api';

/** Page « Mot de passe oublié » : accessible sans connexion, réservée aux visiteurs non connectés. */
export default function ForgotPasswordPage() {
  return (
    <Gate allow={['anonymous']}>
      <ForgotPasswordForm />
    </Gate>
  );
}

/**
 * Demande un lien de réinitialisation. L'interface affiche TOUJOURS le même message de confirmation, que l'adresse
 * corresponde à un compte ou non : elle ne doit rien laisser deviner (aucune énumération de comptes).
 */
function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /**
   * Demande le lien ; affiche toujours la même confirmation, seule une erreur de limitation ou de panne est signalée.
   */
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const answer = await api<{ message: string }>('/auth/password-reset/request', { method: 'POST', body: { email: email.trim() }, auth: false });
      setMessage(answer.message);
    } catch (e) {
      // Seule la limitation de débit (429) ou une panne sont signalées : jamais le fait qu'un compte existe ou non.
      setError(e instanceof ApiError ? e.message : 'Demande impossible. Réessayez dans un instant.');
      setBusy(false);
    }
  }

  return (
    <main className="center">
      <div className="card">
        <h1>Mot de passe oublié</h1>
        {message ? (
          <>
            <p role="status">{message}</p>
            <p className="hint">Le lien est valable 60 minutes et ne sert qu&apos;une fois. Pensez à vérifier vos courriers indésirables.</p>
          </>
        ) : (
          <form onSubmit={submit}>
            <p>Saisissez l&apos;adresse e-mail de votre compte : un lien pour choisir un nouveau mot de passe vous sera envoyé.</p>
            <label>
              Adresse e-mail
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" maxLength={254} required autoFocus />
            </label>
            {error && <p role="alert" className="error">{error}</p>}
            <button type="submit" disabled={busy || email.trim().length === 0}>Envoyer le lien</button>
          </form>
        )}
        <p className="hint" style={{ marginTop: '1rem' }}><Link href="/login">Retour à la connexion</Link></p>
      </div>
    </main>
  );
}
