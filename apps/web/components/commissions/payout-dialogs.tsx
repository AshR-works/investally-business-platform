'use client';

import { useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { PAYOUT_ACTION_LABEL, payoutAmountText, payoutDefinitionText, type PayoutAction, validatePaidOn, validatePayoutAmount } from '../../lib/commissions';
import { validateReason } from '../../lib/approvals';
import { todayIso } from '../../lib/receipts';
import type { Payout } from '../../lib/types';
import { DocumentsPanel } from '../documents/documents-panel';
import { FormField, fieldProps } from '../form-field';
import { Modal } from '../modal';

const PREFIX = 'payout';

/** Fenêtre ouverte sur une commission : une action, ou son justificatif. */
export type PayoutDialogState = { kind: PayoutAction | 'proof'; payout: Payout };

/** Toutes les fenêtres du cycle d'une commission, rendues UNE fois par la page hôte, hors du tableau. */
export function PayoutDialogs({ dialog, onClose, onDone }: { dialog: PayoutDialogState | null; onClose: () => void; onDone: () => Promise<void> }) {
  if (!dialog) return null;
  if (dialog.kind === 'proof') return <ProofDialog payout={dialog.payout} onClose={onClose} />;
  if (dialog.kind === 'pay') return <PayDialog payout={dialog.payout} onClose={onClose} onDone={onDone} />;
  if (dialog.kind === 'amount') return <AmountDialog payout={dialog.payout} onClose={onClose} onDone={onDone} />;
  return <ReasonOrConfirmDialog payout={dialog.payout} action={dialog.kind} onClose={onClose} onDone={onDone} />;
}

const summary = (p: Payout) => `${payoutAmountText(p)} (${payoutDefinitionText(p)}) pour ${p.facilitatorName}, entreprise ${p.companyName}`;

/** Le justificatif du versement : consultation (liste, téléchargement) et dépôt. */
function ProofDialog({ payout, onClose }: { payout: Payout; onClose: () => void }) {
  return (
    <Modal title="Justificatif du versement" onClose={onClose} size="wide">
      <p className="m-0 mb-3 text-ink-2">{summary(payout)}. Reçu de virement ou ordre de versement, catégorie « Justificatif ».</p>
      <DocumentsPanel ownerType="commission" ownerId={payout.id} />
    </Modal>
  );
}

/** Débloquer (confirmation), mettre en attente ou annuler (motif obligatoire). */
function ReasonOrConfirmDialog({ payout, action, onClose, onDone }: { payout: Payout; action: 'release' | 'hold' | 'cancel'; onClose: () => void; onDone: () => Promise<void> }) {
  const [reason, setReason] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsReason = action !== 'release';
  const problem = needsReason && tried ? validateReason(reason) : null;

  async function confirm() {
    setTried(true);
    if (needsReason && validateReason(reason)) {
      document.getElementById(`${PREFIX}-reason`)?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`/commissions/${payout.id}/${action}`, { method: 'POST', body: needsReason ? { version: payout.version, reason: reason.trim() } : { version: payout.version } });
      await onDone();
    } catch (e) {
      setBusy(false);
      setError(e instanceof ApiError ? e.message : 'Action impossible');
    }
  }

  const intro = action === 'release'
    ? 'sera débloquée : le chargé de compte pourra la verser et déposer son justificatif. Cette décision est enregistrée dans l’audit.'
    : action === 'hold'
      ? 'sera mise en attente : le déblocage est suspendu, le dossier reste ouvert.'
      : 'sera annulée. Cette action est définitive ; le montant dû ne se corrige que par annulation motivée.';
  return (
    <Modal title={PAYOUT_ACTION_LABEL[action]} onClose={onClose}>
      <p className="m-0 mb-3">La commission de {summary(payout)} {intro}</p>
      {needsReason && (
        <FormField prefix={PREFIX} name="reason" label="Motif" error={problem ?? undefined}>
          <textarea {...fieldProps(PREFIX, 'reason', problem ?? undefined)} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} />
        </FormField>
      )}
      {error && <p role="alert" className="error">{error}</p>}
      <div className="row end">
        <button type="button" className="secondary" onClick={onClose}>Retour</button>
        <button type="button" disabled={busy} onClick={() => void confirm()}>{PAYOUT_ACTION_LABEL[action]}</button>
      </div>
    </Modal>
  );
}

/** Fixe le montant d'un pourcentage dont l'agrément n'avait pas de montant (une seule fois). */
function AmountDialog({ payout, onClose, onDone }: { payout: Payout; onClose: () => void; onDone: () => Promise<void> }) {
  const [amount, setAmount] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const problem = tried ? validatePayoutAmount(amount) : null;

  async function confirm() {
    setTried(true);
    if (validatePayoutAmount(amount)) {
      document.getElementById(`${PREFIX}-amount`)?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`/commissions/${payout.id}/amount`, { method: 'POST', body: { version: payout.version, amount: amount.trim().replace(/\s/g, '') } });
      await onDone();
    } catch (e) {
      setBusy(false);
      setError(e instanceof ApiError ? e.message : 'Action impossible');
    }
  }

  return (
    <Modal title={PAYOUT_ACTION_LABEL.amount} onClose={onClose}>
      <p className="m-0 mb-3">La commission de {payout.facilitatorName} ({payoutDefinitionText(payout)}), entreprise {payout.companyName}, s’applique à un agrément sans montant. Indiquez le montant à verser en {payout.currency} : il sera ensuite figé.</p>
      <FormField prefix={PREFIX} name="amount" label={`Montant à verser (${payout.currency})`} error={problem ?? undefined}>
        <input {...fieldProps(PREFIX, 'amount', problem ?? undefined)} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </FormField>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="row end">
        <button type="button" className="secondary" onClick={onClose}>Retour</button>
        <button type="button" disabled={busy} onClick={() => void confirm()}>{PAYOUT_ACTION_LABEL.amount}</button>
      </div>
    </Modal>
  );
}

/** Constate le versement : justificatif déposé (catégorie « Justificatif ») puis date du versement. */
function PayDialog({ payout, onClose, onDone }: { payout: Payout; onClose: () => void; onDone: () => Promise<void> }) {
  const [paidOn, setPaidOn] = useState(() => todayIso());
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const problem = tried ? validatePaidOn(paidOn) : null;

  async function confirm() {
    setTried(true);
    if (validatePaidOn(paidOn)) {
      document.getElementById(`${PREFIX}-paidOn`)?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`/commissions/${payout.id}/pay`, { method: 'POST', body: { version: payout.version, paidOn: paidOn.trim() } });
      await onDone();
    } catch (e) {
      setBusy(false);
      setError(e instanceof ApiError ? e.message : 'Action impossible');
    }
  }

  return (
    <Modal title={PAYOUT_ACTION_LABEL.pay} onClose={onClose} size="wide">
      <p className="m-0 mb-3">Versement de {summary(payout)}. <strong>1.</strong> Déposez le justificatif (reçu de virement ou ordre de versement, catégorie « Justificatif »). <strong>2.</strong> Indiquez la date du versement. Sans justificatif, le versement est refusé.</p>
      <DocumentsPanel ownerType="commission" ownerId={payout.id} />
      <FormField prefix={PREFIX} name="paidOn" label="Date du versement" error={problem ?? undefined}>
        <input {...fieldProps(PREFIX, 'paidOn', problem ?? undefined)} type="date" value={paidOn} max={todayIso()} onChange={(e) => setPaidOn(e.target.value)} required aria-required="true" />
      </FormField>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="row end">
        <button type="button" className="secondary" onClick={onClose}>Retour</button>
        <button type="button" disabled={busy} onClick={() => void confirm()}>{PAYOUT_ACTION_LABEL.pay}</button>
      </div>
    </Modal>
  );
}
