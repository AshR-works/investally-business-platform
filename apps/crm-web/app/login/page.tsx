'use client';

import { FormEvent, useState } from 'react';
import { Gate } from '../../components/gate';
import { ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';

export default function LoginPage() {
  return (
    <Gate allow={['anonymous']}>
      <LoginForm />
    </Gate>
  );
}

function LoginForm() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
        <h1>Investally CRM</h1>
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
        <p className="hint">Un second facteur (application d&apos;authentification) vous sera demandé.</p>
      </form>
    </main>
  );
}
