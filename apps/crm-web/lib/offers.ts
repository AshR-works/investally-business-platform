import type { Offer } from './types';

/** Actions possibles sur une offre ; la disponibilité dépend de son état ET des droits (le serveur re-contrôle tout). */
export type OfferAction = 'edit' | 'submit' | 'receipt' | 'followups' | 'accept' | 'refuse' | 'withdraw' | 'documents';

export const OFFER_ACTION_LABEL: Record<OfferAction, string> = {
  edit: 'Modifier',
  submit: 'Déposer chez l’entreprise',
  receipt: 'Décharge signée',
  followups: 'Relances',
  accept: 'Enregistrer l’acceptation',
  refuse: 'Enregistrer le refus',
  withdraw: 'Retirer l’offre',
  documents: 'Documents de l’offre',
};

/** Droits de l'utilisateur sur les offres, leurs décharges et leurs documents. */
export interface OfferRights {
  update: boolean;
  withdraw: boolean;
  receiptRead?: boolean;
  followupRead?: boolean;
  documentsRead?: boolean;
}

/**
 * Actions proposées pour un état donné : un brouillon se modifie, se dépose ou se retire ; une offre déposée (ou dont la décharge
 * est reçue) attend la réponse du client ou se retire, et sa décharge se consulte, s'enregistre ou s'annule ; acceptée, refusée et
 * retirée sont définitives (on ne peut plus que consulter la décharge et les documents).
 */
export function availableActions(status: string, rights: OfferRights): OfferAction[] {
  const actions: OfferAction[] = [];
  const open = status === 'SUBMITTED' || status === 'RECEIPT_RECEIVED';
  if (status === 'DRAFT' && rights.update) actions.push('edit', 'submit');
  if (['SUBMITTED', 'RECEIPT_RECEIVED', 'ACCEPTED', 'REFUSED', 'WITHDRAWN'].includes(status) && rights.receiptRead) actions.push('receipt');
  if (['SUBMITTED', 'RECEIPT_RECEIVED', 'ACCEPTED', 'REFUSED', 'WITHDRAWN'].includes(status) && rights.followupRead) actions.push('followups');
  if (open && rights.update) actions.push('accept', 'refuse');
  if ((status === 'DRAFT' || open) && rights.withdraw) actions.push('withdraw');
  if (rights.documentsRead) actions.push('documents');
  return actions;
}

/** Montant lisible : « 4 500 000 FCFA » (XAF s'écrit FCFA), deux décimales seulement si elles existent. */
export function formatAmount(amount: string, currency: string): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) return '—';
  const text = value.toLocaleString('fr-FR', { minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 });
  return `${text} ${currency === 'XAF' ? 'FCFA' : currency}`;
}

/** Ce que l'utilisateur saisit dans la fenêtre d'une offre. */
export interface OfferForm {
  companyId: string;
  subject: string;
  amount: string;
  currency: string;
  note: string;
}

export const EMPTY_OFFER_FORM: OfferForm = { companyId: '', subject: '', amount: '', currency: 'XAF', note: '' };

export type OfferField = keyof OfferForm;
export type OfferErrors = Partial<Record<OfferField, string>>;

/** Montant saisi → texte décimal sans espaces, virgule remplacée par un point (« 4 500 000,5 » → « 4500000.5 »). */
export const normalizeAmount = (raw: string): string => raw.replace(/\s/g, '').replace(',', '.');

/** Montant valide : positif, douze chiffres au plus, deux décimales au plus. */
export function isValidAmount(raw: string): boolean {
  const text = normalizeAmount(raw);
  return /^\d{1,12}(\.\d{1,2})?$/.test(text) && Number(text) > 0;
}

/** Contrôles de saisie rapides, champ par champ, dans l'ordre de la page (le serveur refait tous les contrôles). */
export function validateOfferFields(form: OfferForm): OfferErrors {
  const errors: OfferErrors = {};
  if (!form.companyId) errors.companyId = 'Choisissez l’entreprise de l’offre.';
  if (!form.subject.trim()) errors.subject = 'L’objet de l’offre est obligatoire.';
  else if (form.subject.trim().length > 200) errors.subject = 'L’objet ne peut dépasser 200 caractères.';
  if (!form.amount.trim()) errors.amount = 'Le montant est obligatoire.';
  else if (!isValidAmount(form.amount)) errors.amount = 'Le montant doit être un nombre positif (deux décimales au plus).';
  const currency = form.currency.trim().toUpperCase();
  if (currency && currency !== 'FCFA' && !/^[A-Z]{3}$/.test(currency)) errors.currency = 'La devise comporte trois lettres (ex. XAF, EUR).';
  if (form.note.length > 1000) errors.note = 'La note ne peut dépasser 1000 caractères.';
  return errors;
}

/** Formulaire prérempli avec l'offre à modifier. */
export function formFromOffer(offer: Offer): OfferForm {
  return { companyId: offer.companyId, subject: offer.subject, amount: offer.amount, currency: offer.currency, note: offer.note ?? '' };
}

/**
 * Corps de la création (l'entreprise est incluse, les champs vides omis) ou de la modification (la version lue, jamais
 * l'entreprise ; une note vidée est envoyée vide pour être effacée).
 */
export function buildOfferBody(form: OfferForm, options: { version?: number } = {}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    subject: form.subject.trim(),
    amount: normalizeAmount(form.amount),
    currency: form.currency.trim().toUpperCase() || 'XAF',
    note: form.note.trim(),
  };
  if (options.version === undefined) {
    body.companyId = form.companyId;
    if (!form.note.trim()) delete body.note;
  } else {
    body.version = options.version;
  }
  return body;
}
