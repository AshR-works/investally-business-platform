import type { Commission } from './types';

/** Façons de prendre contact via le facilitateur (codes de l'API → libellés). */
export const CONTACT_METHODS = [
  { value: 'WHATSAPP_MESSAGE', label: 'Message WhatsApp' },
  { value: 'PHONE_CALL', label: 'Appel téléphonique' },
  { value: 'EMAIL', label: 'E-mail' },
  { value: 'MEETING', label: 'Rencontre' },
  { value: 'OTHER', label: 'Autre' },
] as const;

export const contactMethodLabel = (value: string): string => CONTACT_METHODS.find((m) => m.value === value)?.label ?? value;

export const COMMISSION_TYPES = [
  { value: 'PERCENT', label: 'Pourcentage' },
  { value: 'FIXED', label: 'Montant fixe' },
] as const;

/** Ce que l'utilisateur saisit dans la fenêtre de création d'une entreprise. */
export interface CompanyForm {
  name: string;
  sector: string;
  email: string;
  phone: string;
  /** `none` : sans facilitateur ; `existing` : un facilitateur déjà enregistré ; `new` : à créer maintenant. */
  facilitatorMode: 'none' | 'existing' | 'new';
  facilitatorId: string;
  facilitatorLastName: string;
  facilitatorFirstName: string;
  facilitatorPhone: string;
  facilitatorComment: string;
  contactMethod: string;
  isCompanyEmployee: boolean;
  /** `''` : pas de commission. */
  commissionType: '' | 'PERCENT' | 'FIXED';
  commissionValue: string;
  commissionCurrency: string;
}

export const EMPTY_COMPANY_FORM: CompanyForm = {
  name: '', sector: '', email: '', phone: '',
  facilitatorMode: 'none', facilitatorId: '',
  facilitatorLastName: '', facilitatorFirstName: '', facilitatorPhone: '', facilitatorComment: '',
  contactMethod: 'WHATSAPP_MESSAGE', isCompanyEmployee: false,
  commissionType: '', commissionValue: '', commissionCurrency: '',
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[0-9+().\- ]+$/;
const phoneOk = (value: string): boolean => PHONE.test(value) && value.replace(/\D/g, '').length >= 6;

/** Contrôles de saisie rapides (le serveur refait tous les contrôles) ; renvoie un message par problème, dans l'ordre de la fiche. */
export function validateCompanyForm(form: CompanyForm): string[] {
  const errors: string[] = [];
  if (!form.name.trim()) errors.push("Le nom de l'entreprise est obligatoire.");
  if (form.email.trim() && !EMAIL.test(form.email.trim())) errors.push("L'adresse e-mail de l'entreprise n'est pas valide.");
  if (form.phone.trim() && !phoneOk(form.phone.trim())) errors.push("Le numéro de téléphone de l'entreprise n'est pas valide.");
  if (form.facilitatorMode === 'existing' && !form.facilitatorId) errors.push('Choisissez un facilitateur dans la liste.');
  if (form.facilitatorMode === 'new') {
    if (!form.facilitatorLastName.trim()) errors.push('Le nom du facilitateur est obligatoire.');
    if (!form.facilitatorFirstName.trim()) errors.push('Le prénom du facilitateur est obligatoire.');
    if (!form.facilitatorPhone.trim()) errors.push('Le téléphone du facilitateur est obligatoire.');
    else if (!phoneOk(form.facilitatorPhone.trim())) errors.push('Le téléphone du facilitateur n’est pas valide.');
  }
  if (form.facilitatorMode !== 'none' && form.commissionType) {
    const value = Number(form.commissionValue.trim().replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) errors.push('La commission doit être un nombre positif.');
    else if (form.commissionType === 'PERCENT' && value > 100) errors.push('Un pourcentage de commission ne peut dépasser 100.');
    if (form.commissionType === 'FIXED' && !/^[A-Za-z]{3}$/.test(form.commissionCurrency.trim())) {
      errors.push('Indiquez la devise du montant sur trois lettres (par exemple XAF ou EUR).');
    }
  }
  return errors;
}

/** Corps de la requête de création : les champs vides sont omis ; sans facilitateur, aucune facilitation ni commission n'est envoyée. */
export function buildCompanyBody(form: CompanyForm): Record<string, unknown> {
  const body: Record<string, unknown> = { name: form.name.trim() };
  if (form.sector.trim()) body.sector = form.sector.trim();
  if (form.email.trim()) body.email = form.email.trim();
  if (form.phone.trim()) body.phone = form.phone.trim();
  if (form.facilitatorMode === 'none') return body;

  const facilitation: Record<string, unknown> = { contactMethod: form.contactMethod, isCompanyEmployee: form.isCompanyEmployee };
  if (form.facilitatorMode === 'existing') {
    facilitation.facilitatorId = form.facilitatorId;
  } else {
    facilitation.newFacilitator = {
      lastName: form.facilitatorLastName.trim(),
      firstName: form.facilitatorFirstName.trim(),
      phone: form.facilitatorPhone.trim(),
      ...(form.facilitatorComment.trim() ? { comment: form.facilitatorComment.trim() } : {}),
    };
  }
  if (form.commissionType) {
    facilitation.commission = {
      type: form.commissionType,
      value: form.commissionValue.trim().replace(',', '.'),
      ...(form.commissionType === 'FIXED' ? { currency: form.commissionCurrency.trim().toUpperCase() } : {}),
    };
  }
  body.facilitation = facilitation;
  return body;
}

/** « 7,50 % » ou « 1 500,00 XAF » (format français). */
export function formatCommission(commission: Commission): string {
  const number = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(commission.value));
  return commission.type === 'PERCENT' ? `${number} %` : `${number} ${commission.currency ?? ''}`.trim();
}
