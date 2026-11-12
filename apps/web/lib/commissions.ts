import { formatAmount } from './offers';
import { isRealDate, todayIso } from './receipts';
import type { Payout } from './types';

/** États d'un versement de commission, tels que l'API les fournit. */
export const PAYOUT_STATUS: Record<string, { label: string; tone: 'neutral' | 'info' | 'ok' | 'warn' | 'bad' }> = {
  DUE: { label: 'À verser', tone: 'warn' },
  ON_HOLD: { label: 'En attente', tone: 'neutral' },
  RELEASED: { label: 'Fonds débloqués', tone: 'info' },
  PAID: { label: 'Versée', tone: 'ok' },
  CANCELLED: { label: 'Annulée', tone: 'neutral' },
};

/** Filtre par état proposé dans la liste. */
export const PAYOUT_STATUS_OPTIONS: readonly { value: string; label: string }[] = Object.entries(PAYOUT_STATUS).map(([value, s]) => ({ value, label: s.label }));

/** Le montant à verser, ou « À fixer » tant qu'un pourcentage n'a pas de montant d'agrément. */
export function payoutAmountText(p: Pick<Payout, 'amount' | 'currency'>): string {
  return p.amount ? formatAmount(p.amount, p.currency) : 'À fixer';
}

/** La commission telle qu'elle a été définie quand elle est devenue due : « 5 % » ou « 150 000 FCFA ». */
export function payoutDefinitionText(p: Pick<Payout, 'commissionType' | 'commissionValue' | 'commissionCurrency'>): string {
  const value = Number(p.commissionValue);
  if (p.commissionType === 'PERCENT') return `${Number.isInteger(value) ? value : value.toString().replace('.', ',')} %`;
  return formatAmount(p.commissionValue, p.commissionCurrency ?? 'XAF');
}

export type PayoutAction = 'release' | 'hold' | 'pay' | 'cancel' | 'amount';

export const PAYOUT_ACTION_LABEL: Record<PayoutAction, string> = {
  release: 'Débloquer les fonds',
  hold: 'Mettre en attente',
  pay: 'Constater le versement',
  cancel: 'Annuler la commission',
  amount: 'Fixer le montant',
};

export interface PayoutRights {
  release: boolean;
  pay: boolean;
  manage: boolean;
}

/**
 * Les actions proposées sur une commission, selon son état ET les droits (le serveur re-contrôle chaque requête) : la Finance débloque ou
 * suspend ; le chargé de compte verse (fonds débloqués) ; le Responsable commercial annule, ou fixe un montant manquant.
 */
export function payoutActions(payout: Pick<Payout, 'status' | 'amount'>, rights: PayoutRights): PayoutAction[] {
  const actions: PayoutAction[] = [];
  const open = payout.status === 'DUE' || payout.status === 'ON_HOLD';
  if (open && rights.release && payout.amount !== null) actions.push('release');
  if (open && rights.release) actions.push('hold');
  if (payout.status === 'RELEASED' && rights.pay) actions.push('pay');
  if (open && rights.manage && payout.amount === null) actions.push('amount');
  if ((open || payout.status === 'RELEASED') && rights.manage) actions.push('cancel');
  return actions;
}

/** Date de versement : réelle et pas dans le futur (le serveur refait ce contrôle). */
export function validatePaidOn(text: string, today: string = todayIso()): string | null {
  const value = text.trim();
  if (!value) return 'La date de versement est obligatoire.';
  if (!isRealDate(value)) return 'La date de versement n’est pas valide.';
  if (value > today) return 'La date de versement ne peut pas être dans le futur.';
  return null;
}

/** Montant à fixer : nombre positif, deux décimales au plus (le serveur refait ce contrôle). */
export function validatePayoutAmount(text: string): string | null {
  const amount = text.trim().replace(/\s/g, '').replace(',', '.');
  if (!amount) return 'Le montant est obligatoire.';
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) return 'Le montant doit être un nombre positif (deux décimales au plus).';
  return null;
}
