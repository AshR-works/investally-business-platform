import { phoneProblem } from './phone';
import { isRealDate, todayIso } from './receipts';
import type { Ambassador } from './types';

/** D'où vient l'ambassadeur (codes de l'API → libellés). */
export const AMBASSADOR_ORIGINS = [
  { value: 'CLIENT', label: 'Client' },
  { value: 'LEARNER', label: 'Apprenant' },
] as const;

export const originLabel = (value: string): string => AMBASSADOR_ORIGINS.find((o) => o.value === value)?.label ?? value;

/** Ce que l'utilisateur saisit dans la fenêtre d'un ambassadeur. */
export interface AmbassadorForm {
  lastName: string;
  firstName: string;
  origin: string;
  companyId: string;
  email: string;
  phone: string;
  appointedOn: string;
  note: string;
}

export const EMPTY_AMBASSADOR_FORM = (now: Date = new Date()): AmbassadorForm => ({
  lastName: '', firstName: '', origin: 'CLIENT', companyId: '', email: '', phone: '', appointedOn: todayIso(now), note: '',
});

export type AmbassadorField = keyof AmbassadorForm;
export type AmbassadorErrors = Partial<Record<AmbassadorField, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Contrôles de saisie rapides, champ par champ, dans l'ordre de la page (le serveur refait tous les contrôles) : nom et prénom,
 * entreprise obligatoire pour un client, e-mail et téléphone valides s'ils sont donnés, date de début réelle et pas dans le futur,
 * note de 500 caractères au plus.
 */
export function validateAmbassadorFields(form: AmbassadorForm, context: { today: string }): AmbassadorErrors {
  const errors: AmbassadorErrors = {};
  if (!form.lastName.trim()) errors.lastName = 'Le nom est obligatoire.';
  else if (form.lastName.trim().length > 100) errors.lastName = 'Le nom ne peut dépasser 100 caractères.';
  if (!form.firstName.trim()) errors.firstName = 'Le prénom est obligatoire.';
  else if (form.firstName.trim().length > 100) errors.firstName = 'Le prénom ne peut dépasser 100 caractères.';
  if (!AMBASSADOR_ORIGINS.some((o) => o.value === form.origin)) errors.origin = 'Choisissez l’origine.';
  if (form.origin === 'CLIENT' && !form.companyId) errors.companyId = 'Un ambassadeur client est rattaché à son entreprise.';
  if (form.email.trim() && !EMAIL.test(form.email.trim())) errors.email = 'L’adresse e-mail n’est pas valide.';
  if (form.phone.trim()) {
    const problem = phoneProblem(form.phone);
    if (problem) errors.phone = problem;
  }
  const date = form.appointedOn.trim();
  if (!date) errors.appointedOn = 'La date de début est obligatoire.';
  else if (!isRealDate(date)) errors.appointedOn = 'La date de début n’est pas valide.';
  else if (date > context.today) errors.appointedOn = 'La date de début ne peut pas être dans le futur.';
  if (form.note.trim().length > 500) errors.note = 'La note ne peut dépasser 500 caractères.';
  return errors;
}

/** Formulaire prérempli avec l'ambassadeur à modifier. */
export function formFromAmbassador(a: Ambassador): AmbassadorForm {
  return {
    lastName: a.lastName, firstName: a.firstName, origin: a.origin, companyId: a.companyId ?? '', email: a.email ?? '', phone: a.phone ?? '',
    appointedOn: a.appointedOn, note: a.note ?? '',
  };
}

/**
 * Corps de la création (origine incluse) ou de la modification (la version lue, jamais l'origine : un client reste un client). À la
 * création, un champ facultatif vide est omis ; à la modification, il est envoyé vide pour être effacé, et une entreprise retirée part
 * en `null` (apprenant seulement : un client garde la sienne).
 */
export function buildAmbassadorBody(form: AmbassadorForm, options: { version?: number } = {}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    lastName: form.lastName.trim(),
    firstName: form.firstName.trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
    appointedOn: form.appointedOn.trim(),
    note: form.note.trim(),
  };
  if (options.version === undefined) {
    body.origin = form.origin;
    if (form.companyId) body.companyId = form.companyId;
    for (const key of ['email', 'phone', 'note'] as const) if (!form[key].trim()) delete body[key];
  } else {
    body.version = options.version;
    body.companyId = form.companyId || null;
  }
  return body;
}

/** « Depuis » : mois et année de la date de début, comme dans le tableau du design (ex. « 03/2026 »). */
export const sinceLabel = (appointedOn: string): string => `${appointedOn.slice(5, 7)}/${appointedOn.slice(0, 4)}`;
