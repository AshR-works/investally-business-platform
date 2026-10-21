'use client';

import { PageHeading } from '../../components/page-heading';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { Gate } from '../../components/gate';
import { ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';

/** Page de connexion, réservée aux visiteurs non connectés. */
export default function LoginPage() {
  return (
    <Gate allow={['anonymous']}>
      <LoginForm />
    </Gate>
  );
}

/** Formulaire de connexion (adresse, mot de passe) avec lien « Mot de passe oublié ». */
function LoginForm() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Tente la connexion ; en cas d'échec affiche le message unique du serveur et vide le mot de passe. */
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Connexion impossible. Réessayez.');
      setPassword('');
      setBusy(false);
    }
  }

  return (
    <main className="center">
      <form className="card" onSubmit={submit}>
        <PageHeading title="Connexion">Investally CRM</PageHeading>
        <label>
          Adresse e-mail
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" maxLength={254} required autoFocus />
        </label>
        <label>
          Mot de passe
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" maxLength={256} required />
        </label>
        {error && <p role="alert" className="error">{error}</p>}
        <button type="submit" disabled={busy}>Se connecter</button>
        <p className="hint"><Link href="/forgot-password">Mot de passe oublié ?</Link></p>
        <p className="hint">Un second facteur (application d&apos;authentification) vous sera demandé.</p>
      </form>
    </main>
  );
}
