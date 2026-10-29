import type { Commission, Company } from './types';

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
  /** Pays auquel l'entreprise est affiliée (saisie libre avec suggestions). */
  country: string;
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

/** Devise par défaut : franc CFA d'Afrique centrale (le serveur applique la même). */
export const DEFAULT_CURRENCY = 'XAF';

export const EMPTY_COMPANY_FORM: CompanyForm = {
  name: '', sector: '', country: '', email: '', phone: '',
  facilitatorMode: 'none', facilitatorId: '',
  facilitatorLastName: '', facilitatorFirstName: '', facilitatorPhone: '', facilitatorComment: '',
  contactMethod: 'WHATSAPP_MESSAGE', isCompanyEmployee: false,
  commissionType: '', commissionValue: '', commissionCurrency: DEFAULT_CURRENCY,
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[0-9+().\- ]+$/;
const phoneOk = (value: string): boolean => PHONE.test(value) && value.replace(/\D/g, '').length >= 6;

/** Champs de la fiche qui peuvent porter une erreur, dans l'ordre de la page. */
export type FieldName =
  | 'name' | 'country' | 'email' | 'phone' | 'facilitatorId' | 'facilitatorLastName' | 'facilitatorFirstName'
  | 'facilitatorPhone' | 'commissionValue' | 'commissionCurrency';
export type FieldErrors = Partial<Record<FieldName, string>>;

/**
 * Contrôles de saisie rapides, champ par champ, pour mettre en évidence ce qui n'est pas conforme (le serveur refait tous
 * les contrôles). L'ordre des clés est celui de la page : le premier champ en erreur reçoit le focus.
 */
export function validateCompanyFields(form: CompanyForm): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.name.trim()) errors.name = "Le nom de l'entreprise est obligatoire.";
  if (form.country.trim().length > 100) errors.country = 'Le pays ne peut dépasser 100 caractères.';
  if (form.email.trim() && !EMAIL.test(form.email.trim())) errors.email = "L'adresse e-mail de l'entreprise n'est pas valide.";
  if (form.phone.trim() && !phoneOk(form.phone.trim())) errors.phone = "Le numéro de téléphone de l'entreprise n'est pas valide.";
  if (form.facilitatorMode === 'existing' && !form.facilitatorId) errors.facilitatorId = 'Choisissez un facilitateur dans la liste.';
  if (form.facilitatorMode === 'new') {
    if (!form.facilitatorLastName.trim()) errors.facilitatorLastName = 'Le nom du facilitateur est obligatoire.';
    if (!form.facilitatorFirstName.trim()) errors.facilitatorFirstName = 'Le prénom du facilitateur est obligatoire.';
    if (!form.facilitatorPhone.trim()) errors.facilitatorPhone = 'Le téléphone du facilitateur est obligatoire.';
    else if (!phoneOk(form.facilitatorPhone.trim())) errors.facilitatorPhone = 'Le téléphone du facilitateur n’est pas valide.';
  }
  if (form.facilitatorMode !== 'none' && form.commissionType) {
    const value = Number(form.commissionValue.trim().replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) errors.commissionValue = 'La commission doit être un nombre positif.';
    else if (form.commissionType === 'PERCENT' && value > 100) errors.commissionValue = 'Un pourcentage de commission ne peut dépasser 100.';
    if (form.commissionType === 'FIXED' && !/^([A-Za-z]{3}|FCFA|fcfa)?$/.test(form.commissionCurrency.trim())) {
      errors.commissionCurrency = 'La devise doit comporter trois lettres (par exemple XAF ou EUR), ou FCFA.';
    }
  }
  return errors;
}

/** Les mêmes contrôles sous forme de liste de messages (récapitulatif annoncé avant l'envoi). */
export function validateCompanyForm(form: CompanyForm): string[] {
  return Object.values(validateCompanyFields(form));
}

/** Corps de la requête de création : les champs vides sont omis ; sans facilitateur, aucune facilitation ni commission n'est envoyée. */
export function buildCompanyBody(form: CompanyForm): Record<string, unknown> {
  const body: Record<string, unknown> = { name: form.name.trim() };
  if (form.sector.trim()) body.sector = form.sector.trim();
  if (form.country.trim()) body.country = form.country.trim();
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
      ...(form.commissionType === 'FIXED' ? { currency: normalizeCurrency(form.commissionCurrency) } : {}),
    };
  }
  body.facilitation = facilitation;
  return body;
}

/** Devise saisie → code : vide ou « FCFA » = XAF (franc CFA d'Afrique centrale), sinon les trois lettres en majuscules. */
export function normalizeCurrency(raw: string): string {
  const value = raw.trim().toUpperCase();
  return value === '' || value === 'FCFA' ? DEFAULT_CURRENCY : value;
}

/** « 7,50 % » ou « 1 500,00 XAF » (format français). */
export function formatCommission(commission: Commission): string {
  const number = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(commission.value));
  if (commission.type === 'PERCENT') return `${number} %`;
  return `${number} ${commission.currency === DEFAULT_CURRENCY ? 'FCFA' : (commission.currency ?? '')}`.trim();
}

/** Ce que l'utilisateur a le droit de modifier dans la mise en relation (le serveur re-contrôle chaque droit). */
export interface EditCapabilities {
  /** `true` : la fiche a un facilitateur que l'utilisateur ne voit pas : la mise en relation reste inchangée. */
  facilitationLocked: boolean;
  /** Droit `bd.commission.manage`, et commission lisible dans la fiche. */
  canSetCommission: boolean;
}

/** Capacités d'édition d'une fiche existante, d'après ce que l'API a fourni (les clés absentes disent ce qu'on ne voit pas). */
export function editCapabilities(company: Company, canManageCommission: boolean): EditCapabilities {
  const link = company.facilitation;
  return {
    facilitationLocked: Boolean(link && !link.facilitator),
    canSetCommission: canManageCommission && (!link || link.commission !== undefined),
  };
}

/** Formulaire prérempli avec la fiche à modifier. */
export function formFromCompany(company: Company): CompanyForm {
  const link = company.facilitation;
  const form: CompanyForm = {
    ...EMPTY_COMPANY_FORM,
    name: company.name,
    sector: company.sector ?? '',
    country: company.country ?? '',
    email: company.email ?? '',
    phone: company.phone ?? '',
  };
  if (!link || !link.facilitator) return form;
  const commission = link.commission;
  return {
    ...form,
    facilitatorMode: 'existing',
    facilitatorId: link.facilitatorId,
    contactMethod: link.contactMethod,
    isCompanyEmployee: link.isCompanyEmployee,
    commissionType: commission && (commission.type === 'PERCENT' || commission.type === 'FIXED') ? commission.type : '',
    commissionValue: commission ? commission.value : '',
    commissionCurrency: commission?.currency ?? DEFAULT_CURRENCY,
  };
}

/**
 * Corps de la modification : la version lue (verrou optimiste) et les champs de la fiche (une zone vidée est envoyée vide,
 * pour être effacée). Pour la mise en relation : omise si elle n'est pas modifiable ; `null` si on a choisi « Aucun
 * facilitateur » ; le facilitateur n'est renvoyé que s'il a changé ; la commission n'est envoyée que par qui peut la définir.
 */
export function buildCompanyUpdateBody(form: CompanyForm, company: Company, caps: EditCapabilities): Record<string, unknown> {
  const body: Record<string, unknown> = {
    version: company.version,
    name: form.name.trim(),
    sector: form.sector.trim(),
    country: form.country.trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
  };
  if (caps.facilitationLocked) return body;
  const link = company.facilitation;
  if (form.facilitatorMode === 'none') {
    if (link) body.facilitation = null;
    return body;
  }
  const facilitation: Record<string, unknown> = { contactMethod: form.contactMethod, isCompanyEmployee: form.isCompanyEmployee };
  if (form.facilitatorMode === 'existing') {
    if (form.facilitatorId !== link?.facilitatorId) facilitation.facilitatorId = form.facilitatorId;
  } else {
    facilitation.newFacilitator = {
      lastName: form.facilitatorLastName.trim(),
      firstName: form.facilitatorFirstName.trim(),
      phone: form.facilitatorPhone.trim(),
      ...(form.facilitatorComment.trim() ? { comment: form.facilitatorComment.trim() } : {}),
    };
  }
  if (caps.canSetCommission) {
    if (form.commissionType) {
      facilitation.commission = {
        type: form.commissionType,
        value: form.commissionValue.trim().replace(',', '.'),
        ...(form.commissionType === 'FIXED' ? { currency: normalizeCurrency(form.commissionCurrency) } : {}),
      };
    } else if (link?.commission) {
      facilitation.commission = null;
    }
  }
  body.facilitation = facilitation;
  return body;
}

