'use client';

import { useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { formatAmount, type OfferAction } from '../../lib/offers';
import type { Offer } from '../../lib/types';
import { ConfirmDialog } from '../confirm-dialog';
import { Modal } from '../modal';
import { OfferDialog } from './offer-dialog';
import { ReceiptDialog } from './receipt-dialog';
import { DocumentsPanel } from '../documents/documents-panel';

/** Fenêtre ouverte sur une offre ou pour en créer une. */
export type OfferDialogState =
  | { kind: 'create'; company?: { id: string; name: string } }
  | { kind: Exclude<OfferAction, 'followups'>; offer: Offer };

const SENTENCE: Record<Exclude<OfferAction, 'edit' | 'withdraw' | 'receipt' | 'documents' | 'followups'>, { title: string; confirm: string; text: string; path: string }> = {
  submit: { title: 'Déposer l’offre', confirm: 'Déposer', text: 'sera déposée chez l’entreprise : elle ne pourra plus être modifiée.', path: 'submit' },
  accept: { title: 'Enregistrer l’acceptation', confirm: 'Enregistrer l’acceptation', text: 'sera marquée comme acceptée par l’entreprise. Cet état est définitif.', path: 'accept' },
  refuse: { title: 'Enregistrer le refus', confirm: 'Enregistrer le refus', text: 'sera marquée comme refusée par l’entreprise. Cet état est définitif.', path: 'refuse' },
};

/**
 * Toutes les fenêtres du cycle d'une offre (créer, modifier, déposer, accepter, refuser, retirer), rendues UNE fois par l'écran
 * hôte, hors des lignes d'un tableau (un clic dans une fenêtre ne doit pas basculer la sélection d'une ligne). Les changements
 * d'état sont confirmés à l'écran ; le retrait demande un motif.
 */
export function OfferDialogs({ dialog, onClose, onDone, onRefresh }: {
  dialog: OfferDialogState | null;
  onClose: () => void;
  /** Après une action terminée : l'écran hôte ferme la fenêtre et recharge. */
  onDone: () => Promise<void>;
  /** Recharge la liste SANS fermer la fenêtre (la fenêtre de décharge reste ouverte pour montrer le résultat). */
  onRefresh?: () => Promise<void>;
}) {
  if (!dialog) return null;
  if (dialog.kind === 'create') return <OfferDialog company={dialog.company} onClose={onClose} onDone={onDone} />;
  if (dialog.kind === 'edit') return <OfferDialog offer={dialog.offer} onClose={onClose} onDone={onDone} />;
  if (dialog.kind === 'withdraw') return <WithdrawDialog offer={dialog.offer} onClose={onClose} onDone={onDone} />;
  if (dialog.kind === 'receipt') return <ReceiptDialog offer={dialog.offer} onClose={onClose} onChanged={onRefresh ?? (async () => {})} />;
  if (dialog.kind === 'documents') return <OfferDocumentsDialog offer={dialog.offer} onClose={onClose} />;
  return <TransitionDialog offer={dialog.offer} action={dialog.kind} onClose={onClose} onDone={onDone} />;
}

function TransitionDialog({ offer, action, onClose, onDone }: { offer: Offer; action: Exclude<OfferAction, 'edit' | 'withdraw' | 'receipt' | 'documents' | 'followups'>; onClose: () => void; onDone: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentence = SENTENCE[action];
  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await api(`/offers/${offer.id}/${sentence.path}`, { method: 'POST', body: { version: offer.version } });
      await onDone();
    } catch (e) {
      setBusy(false);
      setError(e instanceof ApiError ? e.message : 'Action impossible');
    }
  }
  return (
    <ConfirmDialog title={sentence.title} confirmLabel={sentence.confirm} busy={busy} onConfirm={() => void confirm()} onCancel={onClose}>
      <p className="m-0">L’offre <strong>{offer.reference}</strong> ({formatAmount(offer.amount, offer.currency)}, {offer.companyName}) {sentence.text} Cette action est enregistrée dans l’audit.</p>
      {error && <p role="alert" className="error mt-3">{error}</p>}
    </ConfirmDialog>
  );
}

function WithdrawDialog({ offer, onClose, onDone }: { offer: Offer; onClose: () => void; onDone: () => Promise<void> }) {
  const [reason, setReason] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const invalid = reason.trim().length < 3;
  async function confirm() {
    setTried(true);
    if (invalid) {
      document.getElementById('offer-withdraw-reason')?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`/offers/${offer.id}/withdraw`, { method: 'POST', body: { version: offer.version, reason: reason.trim() } });
      await onDone();
    } catch (e) {
      setBusy(false);
      setError(e instanceof ApiError ? e.message : 'Retrait impossible');
    }
  }
  const showError = tried && invalid;
  return (
    <Modal title="Retirer l’offre" onClose={onClose}>
      <p className="m-0 mb-3">Retirer l’offre <strong>{offer.reference}</strong> ({offer.companyName}) ? Le retrait est définitif et enregistré dans l’audit.</p>
      <div className="field">
        <label htmlFor="offer-withdraw-reason">Motif du retrait</label>
        <textarea
          id="offer-withdraw-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
          rows={3}
          required
          aria-required="true"
          aria-invalid={showError ? true : undefined}
          aria-describedby={showError ? 'offer-withdraw-reason-error' : undefined}
        />
        {showError && <p id="offer-withdraw-reason-error" className="field-error">Le motif du retrait est obligatoire (3 caractères au moins).</p>}
      </div>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="row end">
        <button type="button" className="secondary" onClick={onClose}>Annuler</button>
        <button type="button" className="danger" disabled={busy} onClick={() => void confirm()}>Retirer l’offre</button>
      </div>
    </Modal>
  );
}

/** Documents d'une offre (par exemple le fichier envoyé au client) : le panneau des documents, dans une fenêtre. */
function OfferDocumentsDialog({ offer, onClose }: { offer: Offer; onClose: () => void }) {
  return (
    <Modal title={`Documents de l’offre ${offer.reference}`} onClose={onClose} size="wide">
      <p className="m-0 mb-3 text-ink-2">{offer.companyName} · {offer.subject}</p>
      <DocumentsPanel ownerType="offer" ownerId={offer.id} />
      <div className="row end"><button type="button" className="secondary" onClick={onClose}>Fermer</button></div>
    </Modal>
  );
}
