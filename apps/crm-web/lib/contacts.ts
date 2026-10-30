import type { Contact } from './types';

/** Fonction du contact dans l'entreprise (codes de l'API → libellés). */
export const CONTACT_ROLES = [
  { value: 'FINANCE_DIRECTOR', label: 'DAF' },
  { value: 'DECISION_MAKER', label: 'Décideur' },
  { value: 'OTHER', label: 'Autre' },
] as const;

export const contactRoleLabel = (value: string): string => CONTACT_ROLES.find((r) => r.value === value)?.label ?? value;

/** Ce que l'utilisateur saisit dans la fenêtre d'un contact. */
export interface ContactForm {
  companyId: string;
  lastName: string;
  firstName: string;
  role: string;
  email: string;
  phone: string;
}

export const EMPTY_CONTACT_FORM: ContactForm = { companyId: '', lastName: '', firstName: '', role: 'OTHER', email: '', phone: '' };

export type ContactField = keyof ContactForm;
export type ContactErrors = Partial<Record<ContactField, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[0-9+().\- ]+$/;

/** Contrôles de saisie rapides, champ par champ, dans l'ordre de la page (le serveur refait tous les contrôles). */
export function validateContactFields(form: ContactForm): ContactErrors {
  const errors: ContactErrors = {};
  if (!form.companyId) errors.companyId = 'Choisissez l’entreprise du contact.';
  if (!form.lastName.trim()) errors.lastName = 'Le nom est obligatoire.';
  else if (form.lastName.trim().length > 100) errors.lastName = 'Le nom ne peut dépasser 100 caractères.';
  if (!form.firstName.trim()) errors.firstName = 'Le prénom est obligatoire.';
  else if (form.firstName.trim().length > 100) errors.firstName = 'Le prénom ne peut dépasser 100 caractères.';
  if (form.email.trim() && !EMAIL.test(form.email.trim())) errors.email = 'L’adresse e-mail n’est pas valide.';
  if (form.phone.trim() && (!PHONE.test(form.phone.trim()) || form.phone.replace(/\D/g, '').length < 6)) errors.phone = 'Le numéro de téléphone n’est pas valide.';
  return errors;
}

/** Formulaire prérempli avec le contact à modifier. */
export function formFromContact(contact: Contact): ContactForm {
  return { companyId: contact.companyId, lastName: contact.lastName, firstName: contact.firstName, role: contact.role, email: contact.email ?? '', phone: contact.phone ?? '' };
}

/**
 * Corps de la création (l'entreprise est incluse) ou de la modification (la version lue, jamais l'entreprise : un contact ne
 * change pas d'entreprise ici). Une zone vidée est envoyée vide pour être effacée. `allowDuplicate` : l'utilisateur a vu l'avertissement.
 */
export function buildContactBody(form: ContactForm, options: { version?: number; allowDuplicate?: boolean } = {}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    lastName: form.lastName.trim(),
    firstName: form.firstName.trim(),
    role: form.role,
    email: form.email.trim(),
    phone: form.phone.trim(),
  };
  if (options.version === undefined) {
    body.companyId = form.companyId;
    // À la création, un champ vide est simplement omis.
    if (!form.email.trim()) delete body.email;
    if (!form.phone.trim()) delete body.phone;
  } else {
    body.version = options.version;
  }
  if (options.allowDuplicate) body.allowDuplicate = true;
  return body;
}

/** Vrai si l'erreur de l'API est un doublon probable (conflit « existe déjà »), pas une modification concurrente. */
export const isDuplicateConflict = (status: number, message: string): boolean => status === 409 && /existe déjà/i.test(message);
