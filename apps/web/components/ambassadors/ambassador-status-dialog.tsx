'use client';

import { useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { archiveReasonProblem } from '../../lib/ambassadors';
import type { Ambassador } from '../../lib/types';
import { FormField, fieldProps } from '../form-field';
import { Modal } from '../modal';

const PREFIX = 'ambassador-status';

/**
 * Archivage (réversible, motif facultatif) ou réactivation d'un ambassadeur : jamais de suppression. L'archivage rappelle ce qu'il
 * change (l'ambassadeur n'est plus modifiable tant qu'il n'est pas réactivé) et que l'action se défait.
 */
export function AmbassadorStatusDialog({ ambassador, to, onClose, onDone }: { ambassador: Ambassador; to: 'ARCHIVED' | 'ACTIVE'; onClose: () => void; onDone: () => Promise<void> }) {
  const archiving = to === 'ARCHIVED';
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const problem = archiving ? archiveReasonProblem(reason) : null;
  const name = `${ambassador.firstName} ${ambassador.lastName}`;

  async function confirm() {
    setSubmitted(true);
    if (problem) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/ambassadors/${ambassador.id}/status`, { method: 'POST', body: { version: ambassador.version, status: to, ...(archiving && reason.trim() ? { reason: reason.trim() } : {}) } });
      await onDone();
    } catch (e) {
      setBusy(false);
      setError(e instanceof ApiError ? e.message : 'Changement impossible');
    }
  }

  return (
    <Modal title={archiving ? 'Archiver l’ambassadeur' : 'Réactiver l’ambassadeur'} onClose={onClose}>
      {archiving ? (
        <p className="m-0 mb-3"><strong>{name}</strong> sera archivé : il quitte la liste courante et n’est plus modifiable. Rien n’est supprimé et vous pourrez le réactiver à tout moment. L’action est enregistrée dans l’audit.</p>
      ) : (
        <p className="m-0 mb-3"><strong>{name}</strong> redevient ambassadeur actif et modifiable. L’action est enregistrée dans l’audit.</p>
      )}
      {archiving && (
        <FormField prefix={PREFIX} name="reason" label="Motif (facultatif)" error={submitted ? problem ?? undefined : undefined}>
          <textarea {...fieldProps(PREFIX, 'reason', submitted ? problem ?? undefined : undefined)} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} />
        </FormField>
      )}
      {error && <p role="alert" className="error">{error}</p>}
      <div className="row end">
        <button type="button" className="secondary" onClick={onClose}>Retour</button>
        <button type="button" disabled={busy} onClick={() => void confirm()}>{archiving ? 'Archiver' : 'Réactiver'}</button>
      </div>
    </Modal>
  );
}
