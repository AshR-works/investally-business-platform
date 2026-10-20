'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { ApiError, api, setAccessToken } from '../lib/api';

/** Demande un code frais du second facteur avant une action sensible (modification de rôles, désactivation, etc.). */
export function StepUpDialog({ onDone }: { onDone: (ok: boolean) => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDone(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDone]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = await api<{ accessToken: string }>('/auth/mfa/verify', { method: 'POST', body: { code: code.trim() } });
      setAccessToken(body.accessToken);
      onDone(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Vérification impossible');
      setBusy(false);
    }
  }

  return (
    <div className="overlay" role="presentation">
      <form className="dialog" role="dialog" aria-modal="true" aria-labelledby="stepup-title" onSubmit={submit}>
        <h2 id="stepup-title">Confirmez votre identité</h2>
        <p>Cette action est sensible. Saisissez le code à 6 chiffres de votre application d&apos;authentification.</p>
        <label>
          Code de vérification
          <input
            ref={input}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={32}
            required
          />
        </label>
        {error && <p role="alert" className="error">{error}</p>}
        <div className="row end">
          <button type="button" className="secondary" onClick={() => onDone(false)}>Annuler</button>
          <button type="submit" disabled={busy || code.trim().length === 0}>Confirmer</button>
        </div>
      </form>
    </div>
  );
}
