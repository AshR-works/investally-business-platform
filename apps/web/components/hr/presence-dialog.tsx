'use client';

import { useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { dayText } from '../../lib/leave';
import { MODE_OPTIONS, type PresenceMode, weekdayName } from '../../lib/presences';
import { Modal } from '../modal';

const failure = (e: unknown, fallback: string): string => (e instanceof ApiError || e instanceof Error ? e.message : fallback);

/**
 * Déclarer, changer ou retirer la présence d'un jour : trois choix (sur site, télétravail, déplacement), ni heure ni lieu. L'employé déclare pour lui ; la RH peut
 * déclarer pour n'importe qui (la saisie est alors marquée « par un autre »). Une absence validée sur la journée entière interdit la déclaration : la case n'est pas
 * proposée, et le serveur refuse de toute façon.
 */
export function PresenceDialog({ employeeId, employeeName, day, current, onClose, onDone }: {
  employeeId: string;
  employeeName: string;
  day: string;
  current: PresenceMode | null;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [mode, setMode] = useState<PresenceMode | ''>(current ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const missing = submitted && mode === '';
  const path = `/hr/presences/${day}?employeeId=${employeeId}`;

  async function save() {
    setSubmitted(true);
    if (mode === '') return;
    setBusy(true);
    setError(null);
    try {
      await api(path, { method: 'PUT', body: { mode } });
      await onDone();
    } catch (e) {
      setBusy(false);
      setError(failure(e, 'Enregistrement impossible'));
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await api(path, { method: 'DELETE' });
      await onDone();
    } catch (e) {
      setBusy(false);
      setError(failure(e, 'Suppression impossible'));
    }
  }

  return (
    <Modal title="Présence du jour" onClose={onClose}>
      <p className="m-0 mb-3">
        <strong>{employeeName}</strong>, {weekdayName(day)} {dayText(day)}
      </p>
      <fieldset aria-describedby={missing ? 'presence-error' : undefined} className="m-0 mb-3 border-0 p-0">
        <legend className="mb-2 p-0 font-semibold">Où travaillez-vous ce jour-là ?</legend>
        {MODE_OPTIONS.map((option) => (
          <label key={option.code} className="mb-2 flex items-center gap-2 font-normal">
            <input type="radio" name="presence-mode" value={option.code} checked={mode === option.code} onChange={() => setMode(option.code)} style={{ width: 'auto', marginTop: 0 }} />
            {option.label}
          </label>
        ))}
      </fieldset>
      {missing && <p id="presence-error" role="alert" className="error">Choisissez une des trois possibilités.</p>}
      <p className="m-0 mb-3 text-ink-2">Aucune heure ni aucun lieu n’est enregistré : seulement l’une de ces trois possibilités.</p>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="row end">
        {current !== null && <button type="button" className="secondary" disabled={busy} onClick={() => void remove()}>Retirer la déclaration</button>}
        <button type="button" className="secondary" onClick={onClose}>Annuler</button>
        <button type="button" disabled={busy} onClick={() => void save()}>Enregistrer</button>
      </div>
    </Modal>
  );
}
