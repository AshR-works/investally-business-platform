'use client';

import { useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { CERTIFICATION_KIND_LABEL, type CertificationKind } from '../../lib/certification';
import { Modal } from '../modal';

const KINDS: CertificationKind[] = ['CERTIFICATE', 'ATTESTATION'];
const failure = (e: unknown, fallback: string): string => (e instanceof ApiError || e instanceof Error ? e.message : fallback);

/** Délivrer un certificat ou une attestation à un inscrit confirmé (CU-I-60) : le type choisi doit être couvert par les seuils atteints. */
export function CertificationIssueDialog({ sessionId, learnerName, enrollmentId, onClose, onDone }: {
  sessionId: string;
  learnerName: string;
  enrollmentId: string;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [kind, setKind] = useState<CertificationKind | ''>('');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const missing = submitted && kind === '';

  async function save() {
    setSubmitted(true);
    if (kind === '') return;
    setBusy(true);
    setError(null);
    try {
      await api(`/sessions/${sessionId}/certifications/${enrollmentId}`, { method: 'POST', body: { kind } });
      await onDone();
    } catch (e) {
      setBusy(false);
      setError(failure(e, 'Délivrance impossible'));
    }
  }

  return (
    <Modal title="Délivrer un certificat ou une attestation" onClose={onClose}>
      <p className="m-0 mb-3"><strong>{learnerName}</strong></p>
      <fieldset aria-describedby={missing ? 'certification-kind-error' : undefined} className="m-0 mb-3 border-0 p-0">
        <legend className="mb-2 p-0 font-semibold">Type délivré</legend>
        {KINDS.map((k) => (
          <label key={k} className="mb-2 flex items-center gap-2 font-normal">
            <input type="radio" name="certification-kind" value={k} checked={kind === k} onChange={() => setKind(k)} style={{ width: 'auto', marginTop: 0 }} />
            {CERTIFICATION_KIND_LABEL[k]}
          </label>
        ))}
      </fieldset>
      <p className="m-0 mb-3 text-ink-2">Refusé si les seuils d’éligibilité ne couvrent pas le type choisi (voir la feuille d’évaluation).</p>
      {missing && <p id="certification-kind-error" role="alert" className="error">Choisissez le certificat ou l’attestation.</p>}
      {error && <p role="alert" className="error">{error}</p>}
      <div className="row end">
        <button type="button" className="secondary" onClick={onClose}>Annuler</button>
        <button type="button" disabled={busy} onClick={() => void save()}>Délivrer</button>
      </div>
    </Modal>
  );
}
