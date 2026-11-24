'use client';

import { useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { Modal } from '../modal';

const failure = (e: unknown, fallback: string): string => (e instanceof ApiError || e instanceof Error ? e.message : fallback);

/** Révoquer une délivrance (CU-I-61) : justification obligatoire ; le document reste consultable, marqué révoqué. */
export function CertificationRevokeDialog({ sessionId, learnerName, enrollmentId, onClose, onDone }: {
  sessionId: string;
  learnerName: string;
  enrollmentId: string;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const missing = submitted && !reason.trim();

  async function save() {
    setSubmitted(true);
    if (!reason.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/sessions/${sessionId}/certifications/${enrollmentId}/revoke`, { method: 'POST', body: { reason: reason.trim() } });
      await onDone();
    } catch (e) {
      setBusy(false);
      setError(failure(e, 'Révocation impossible'));
    }
  }

  return (
    <Modal title="Révoquer la délivrance" onClose={onClose}>
      <p className="m-0 mb-3"><strong>{learnerName}</strong></p>
      <label className="mb-2 block font-semibold" htmlFor="certification-revoke-reason">Justification (obligatoire)</label>
      <textarea
        id="certification-revoke-reason"
        aria-describedby={missing ? 'certification-revoke-error' : undefined}
        aria-invalid={missing || undefined}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        maxLength={500}
      />
      {missing && <p id="certification-revoke-error" role="alert" className="error">La justification est obligatoire.</p>}
      {error && <p role="alert" className="error">{error}</p>}
      <div className="row end mt-3">
        <button type="button" className="secondary" onClick={onClose}>Annuler</button>
        <button type="button" disabled={busy} onClick={() => void save()}>Révoquer</button>
      </div>
    </Modal>
  );
}
