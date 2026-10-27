'use client';

import { ReactNode } from 'react';
import { Icon } from './icon';
import { Modal } from './modal';

/**
 * Fenêtre de confirmation d'une action irréversible (EXD-13). Le focus initial est sur « Annuler » (premier bouton de la
 * fenêtre) : une pression sur Entrée ne confirme jamais l'action. Échap annule.
 */
export function ConfirmDialog({ title, confirmLabel, cancelLabel = 'Annuler', busy = false, onConfirm, onCancel, children }: {
  title: string;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children: ReactNode;
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <div className="mb-4 flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-bad-bg text-bad"><Icon name="alert" /></span>
        <div className="min-w-0">{children}</div>
      </div>
      <div className="row end">
        <button type="button" className="secondary" onClick={onCancel}>{cancelLabel}</button>
        <button type="button" className="danger" disabled={busy} onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}
