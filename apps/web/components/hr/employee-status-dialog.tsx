'use client';

import { useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { type Employee, fullName, validateLeave } from '../../lib/hr';
import { todayIso } from '../../lib/receipts';
import { FormField, fieldProps } from '../form-field';
import { Modal } from '../modal';

const PREFIX = 'employee-status';

/**
 * Sortie du personnel (archivage, date et motif) ou retour d'un employé : **jamais de suppression**, l'action se défait. La sortie rappelle ce qu'elle
 * change : la personne quitte l'annuaire et l'organigramme, sa fiche est gelée ; un responsable qui a encore des collaborateurs en poste ne peut pas sortir.
 */
export function EmployeeStatusDialog({ employee, to, onClose, onDone }: { employee: Employee; to: 'ARCHIVED' | 'ACTIVE'; onClose: () => void; onDone: () => Promise<void> }) {
  const leaving = to === 'ARCHIVED';
  const [leftOn, setLeftOn] = useState(todayIso());
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const problems = leaving ? validateLeave({ leftOn, reason }, employee.hiredOn) : {};
  const shown = submitted ? problems : {};

  async function confirm() {
    setSubmitted(true);
    if (Object.keys(problems).length > 0) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/hr/employees/${employee.id}/status`, {
        method: 'POST',
        body: { version: employee.version, status: to, ...(leaving ? { leftOn: leftOn.trim(), ...(reason.trim() ? { reason: reason.trim() } : {}) } : {}) },
      });
      await onDone();
    } catch (e) {
      setBusy(false);
      setError(e instanceof ApiError ? e.message : 'Changement impossible');
    }
  }

  return (
    <Modal title={leaving ? 'Enregistrer une sortie' : 'Réintégrer l’employé'} onClose={onClose}>
      {leaving ? (
        <p className="m-0 mb-3"><strong>{fullName(employee)}</strong> quittera le personnel : la personne disparaît de l’annuaire et de l’organigramme et sa fiche est gelée. Rien n’est supprimé et vous pourrez la réintégrer à tout moment. L’action est enregistrée dans l’audit.</p>
      ) : (
        <p className="m-0 mb-3"><strong>{fullName(employee)}</strong> revient dans le personnel : la personne réapparaît dans l’annuaire et sa fiche redevient modifiable. L’action est enregistrée dans l’audit.</p>
      )}
      {leaving && (
        <>
          <FormField prefix={PREFIX} name="leftOn" label="Date de sortie" error={shown.leftOn}>
            <input {...fieldProps(PREFIX, 'leftOn', shown.leftOn)} type="date" value={leftOn} min={employee.hiredOn} onChange={(e) => setLeftOn(e.target.value)} required aria-required="true" />
          </FormField>
          <FormField prefix={PREFIX} name="reason" label="Motif (facultatif)" error={shown.reason}>
            <textarea {...fieldProps(PREFIX, 'reason', shown.reason)} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} />
          </FormField>
        </>
      )}
      {error && <p role="alert" className="error">{error}</p>}
      <div className="row end">
        <button type="button" className="secondary" onClick={onClose}>Retour</button>
        <button type="button" disabled={busy} onClick={() => void confirm()}>{leaving ? 'Enregistrer la sortie' : 'Réintégrer'}</button>
      </div>
    </Modal>
  );
}
