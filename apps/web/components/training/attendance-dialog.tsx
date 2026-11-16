'use client';

import { useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { STATUS_OPTIONS, type AttendanceStatus } from '../../lib/attendance';
import { dateText } from '../../lib/sessions';
import { Modal } from '../modal';

const failure = (e: unknown, fallback: string): string => (e instanceof ApiError || e instanceof Error ? e.message : fallback);

/** Saisir ou corriger la présence d'un inscrit pour une séance : une valeur parmi trois, ni heure ni texte libre. */
export function AttendanceDialog({ sessionId, learnerName, enrollmentId, day, current, onClose, onDone }: {
  sessionId: string;
  learnerName: string;
  enrollmentId: string;
  day: string;
  current: AttendanceStatus | null;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [status, setStatus] = useState<AttendanceStatus | ''>(current ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const missing = submitted && status === '';

  async function save() {
    setSubmitted(true);
    if (status === '') return;
    setBusy(true);
    setError(null);
    try {
      await api(`/sessions/${sessionId}/attendance/${enrollmentId}/${day}`, { method: 'PUT', body: { status } });
      await onDone();
    } catch (e) {
      setBusy(false);
      setError(failure(e, 'Enregistrement impossible'));
    }
  }

  return (
    <Modal title="Présence de la séance" onClose={onClose}>
      <p className="m-0 mb-3"><strong>{learnerName}</strong>, {dateText(day)}</p>
      <fieldset aria-describedby={missing ? 'attendance-error' : undefined} className="m-0 mb-3 border-0 p-0">
        <legend className="mb-2 p-0 font-semibold">Présence à cette séance</legend>
        {STATUS_OPTIONS.map((option) => (
          <label key={option.code} className="mb-2 flex items-center gap-2 font-normal">
            <input type="radio" name="attendance-status" value={option.code} checked={status === option.code} onChange={() => setStatus(option.code)} style={{ width: 'auto', marginTop: 0 }} />
            {option.label}
          </label>
        ))}
      </fieldset>
      {missing && <p id="attendance-error" role="alert" className="error">Choisissez une des trois possibilités.</p>}
      {error && <p role="alert" className="error">{error}</p>}
      <div className="row end">
        <button type="button" className="secondary" onClick={onClose}>Annuler</button>
        <button type="button" disabled={busy} onClick={() => void save()}>Enregistrer</button>
      </div>
    </Modal>
  );
}
