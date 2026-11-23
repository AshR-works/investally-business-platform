'use client';

import { useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { parseScoreInput } from '../../lib/evaluation';
import { Modal } from '../modal';

const failure = (e: unknown, fallback: string): string => (e instanceof ApiError || e instanceof Error ? e.message : fallback);

/** Saisir ou corriger la note d'un inscrit (S5.3b) : un nombre sur 20, sans commentaire libre. */
export function EvaluationDialog({ sessionId, learnerName, enrollmentId, current, onClose, onDone }: {
  sessionId: string;
  learnerName: string;
  enrollmentId: string;
  current: number | null;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [raw, setRaw] = useState(current === null ? '' : String(current));
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const score = parseScoreInput(raw);
  const invalid = submitted && score === null;

  async function save() {
    setSubmitted(true);
    if (score === null) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/sessions/${sessionId}/evaluations/${enrollmentId}`, { method: 'PUT', body: { score } });
      await onDone();
    } catch (e) {
      setBusy(false);
      setError(failure(e, 'Enregistrement impossible'));
    }
  }

  return (
    <Modal title="Note de l’apprenant" onClose={onClose}>
      <p className="m-0 mb-3"><strong>{learnerName}</strong></p>
      <label className="mb-2 block font-semibold" htmlFor="evaluation-score">Note sur 20</label>
      <input
        id="evaluation-score"
        inputMode="decimal"
        aria-describedby={invalid ? 'evaluation-error' : undefined}
        aria-invalid={invalid || undefined}
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        style={{ maxWidth: '8rem' }}
      />
      {invalid && <p id="evaluation-error" role="alert" className="error">Indiquez une note entre 0 et 20 (deux décimales au plus).</p>}
      {error && <p role="alert" className="error">{error}</p>}
      <div className="row end mt-3">
        <button type="button" className="secondary" onClick={onClose}>Annuler</button>
        <button type="button" disabled={busy} onClick={() => void save()}>Enregistrer</button>
      </div>
    </Modal>
  );
}
