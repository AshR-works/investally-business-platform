import { formatAmount } from './offers';
import { isRealDate, todayIso } from './receipts';
import type { Approval, Opportunity } from './types';

/** États d'un agrément, tels que l'API les fournit. */
export const APPROVAL_STATUS: Record<string, { label: string; tone: 'neutral' | 'info' | 'ok' | 'warn' | 'bad' }> = {
  RECEIVED: { label: 'Reçu', tone: 'info' },
  HONORED: { label: 'Honoré', tone: 'ok' },
  EXPIRED: { label: 'Expiré', tone: 'neutral' },
  CANCELLED: { label: 'Annulé', tone: 'neutral' },
};

/** Étapes à partir desquelles un agrément peut être enregistré (l'accord de principe a été obtenu). */
const APPROVABLE_STAGES = ['AGREEMENT_IN_PRINCIPLE', 'ACCREDITATION'];

/** Opportunités d'une entreprise pour lesquelles on peut enregistrer un agrément : accord de principe obtenu, pas perdue (le serveur reste juge). */
export const eligibleOpportunities = (items: readonly Opportunity[]): Opportunity[] =>
  items.filter((o) => APPROVABLE_STAGES.includes(o.stage) && o.status !== 'LOST');

/** Ce que l'utilisateur saisit pour enregistrer un agrément ; le document signé s'ajoute à part. */
export interface ApprovalForm {
  opportunityId: string;
  amount: string;
  places: string;
  currency: string;
  receivedOn: string;
  validUntil: string;
}

export type ApprovalField = keyof ApprovalForm;
export type ApprovalErrors = Partial<Record<ApprovalField, string>>;

export const EMPTY_APPROVAL_FORM = (defaults: Partial<ApprovalForm> = {}, now: Date = new Date()): ApprovalForm => ({
  opportunityId: '', amount: '', places: '', currency: 'XAF', receivedOn: todayIso(now), validUntil: '', ...defaults,
});

/**
 * Contrôles de saisie rapides, champ par champ (le serveur refait tous les contrôles) : opportunité choisie, montant et/ou places
 * (au moins l'un des deux, positifs), devise de trois lettres, date de réception réelle et pas dans le futur, fin de validité
 * réelle et pas avant la réception.
 */
export function validateApprovalFields(form: ApprovalForm, context: { today: string }): ApprovalErrors {
  const errors: ApprovalErrors = {};
  if (!form.opportunityId) errors.opportunityId = 'Choisissez l’opportunité.';
  const amount = form.amount.trim().replace(/\s/g, '').replace(',', '.');
  const places = form.places.trim();
  if (amount && (!/^\d{1,12}(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0)) errors.amount = 'Le montant doit être un nombre positif (deux décimales au plus).';
  if (places && (!/^\d{1,6}$/.test(places) || Number(places) < 1 || Number(places) > 100000)) errors.places = 'Le nombre de places doit être un entier positif.';
  if (!amount && !places) {
    errors.amount = 'Indiquez le montant couvert, le nombre de places, ou les deux.';
  }
  const currency = form.currency.trim().toUpperCase();
  if (currency && currency !== 'FCFA' && !/^[A-Z]{3}$/.test(currency)) errors.currency = 'La devise comporte trois lettres (ex. XAF, EUR).';
  const received = form.receivedOn.trim();
  if (!received) errors.receivedOn = 'La date de réception est obligatoire.';
  else if (!isRealDate(received)) errors.receivedOn = 'La date de réception n’est pas valide.';
  else if (received > context.today) errors.receivedOn = 'La date de réception ne peut pas être dans le futur.';
  const until = form.validUntil.trim();
  if (until) {
    if (!isRealDate(until)) errors.validUntil = 'La fin de validité n’est pas valide.';
    else if (isRealDate(received) && until < received) errors.validUntil = 'La fin de validité ne peut pas précéder la réception.';
  }
  return errors;
}

/** Corps de l'enregistrement d'un agrément : seuls les champs renseignés partent. */
export function buildApprovalBody(form: ApprovalForm): Record<string, unknown> {
  const body: Record<string, unknown> = { opportunityId: form.opportunityId, receivedOn: form.receivedOn.trim() };
  const amount = form.amount.trim();
  if (amount) body.amount = amount;
  const places = form.places.trim();
  if (places) body.places = Number(places);
  const currency = form.currency.trim();
  if (currency) body.currency = currency;
  const until = form.validUntil.trim();
  if (until) body.validUntil = until;
  return body;
}

/** Ce que couvre l'agrément : « 12 500 000 FCFA · 8 places » (l'un ou l'autre, ou les deux). */
export function coverageText(a: Pick<Approval, 'amount' | 'currency' | 'places'>): string {
  const parts: string[] = [];
  if (a.amount) parts.push(formatAmount(a.amount, a.currency));
  if (a.places) parts.push(`${a.places} place${a.places > 1 ? 's' : ''}`);
  return parts.join(' · ');
}

export type ApprovalAction = 'honor' | 'expire' | 'cancel';
export const APPROVAL_ACTION_LABEL: Record<ApprovalAction, string> = { honor: 'Honorer', expire: 'Déclarer expiré', cancel: 'Annuler l’agrément' };

export interface ApprovalRights {
  honor: boolean;
  cancel: boolean;
}

/** Les actions proposées sur un agrément : seul un agrément « reçu » se clôt ; honorer et annuler ont chacun leur droit. */
export function approvalActions(approval: Pick<Approval, 'status'>, rights: ApprovalRights): ApprovalAction[] {
  if (approval.status !== 'RECEIVED') return [];
  const actions: ApprovalAction[] = [];
  if (rights.honor) actions.push('honor');
  if (rights.cancel) actions.push('expire', 'cancel');
  return actions;
}

/** Motif obligatoire pour déclarer expiré ou annuler : trois caractères au moins, 500 au plus. */
export function validateReason(text: string): string | null {
  const reason = text.trim();
  if (reason.length < 3) return 'Le motif est obligatoire.';
  if (reason.length > 500) return 'Le motif ne peut dépasser 500 caractères.';
  return null;
}
