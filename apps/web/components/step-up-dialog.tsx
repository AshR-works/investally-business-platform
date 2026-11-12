'use client';

import { FormEvent, useState } from 'react';
import { ApiError, api, setAccessToken } from '../lib/api';
import { OTP_LENGTH } from '../lib/otp';
import { OtpInput } from './auth/otp-input';
import { Modal } from './modal';

/**
 * Demande un code frais du second facteur avant une action sensible (modification de rôles, désactivation, changement de responsable, etc.).
 * Même fenêtre que les autres (en-tête, croix, marges) et même saisie du code que la connexion : six cases, ou un code de secours.
 */
export function StepUpDialog({ onDone }: { onDone: (ok: boolean) => void }) {
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Vérifie le code ; en cas de succès le nouveau jeton remplace l'ancien et l'action sensible est rejouée. */
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
      setCode('');
      setBusy(false);
    }
  }

  const complete = recovery ? code.trim().length > 0 : code.length === OTP_LENGTH;

  return (
    <Modal title="Confirmez votre identité" onClose={() => onDone(false)}>
      <form onSubmit={submit}>
        <p>{recovery ? 'Saisissez l’un de vos codes de secours (format XXXXX-XXXXX). Chaque code ne sert qu’une fois.' : 'Cette action est sensible. Saisissez le code à 6 chiffres de votre application d’authentification.'}</p>
        {recovery ? (
          <label>
            Code de secours
            <input value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" maxLength={32} placeholder="XXXXX-XXXXX" required autoFocus />
          </label>
        ) : (
          <OtpInput label="Code de vérification" value={code} onChange={setCode} autoFocus disabled={busy} />
        )}
        {error && <p role="alert" className="error">{error}</p>}
        <p className="mt-0">
          <button type="button" className="secondary small" onClick={() => { setRecovery(!recovery); setCode(''); setError(null); }}>
            {recovery ? 'Utiliser mon application d’authentification' : 'Téléphone perdu ? Utiliser un code de secours'}
          </button>
        </p>
        <div className="row end">
          <button type="button" className="secondary" onClick={() => onDone(false)}>Annuler</button>
          <button type="submit" disabled={busy || !complete}>Confirmer</button>
        </div>
      </form>
    </Modal>
  );
}
