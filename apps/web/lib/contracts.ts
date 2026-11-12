import { daysBetweenIso } from './journeys-dates';

/**
 * Contrats du personnel (RH-3, D67) : types, contrats, échéances. Aucun salaire, aucun document, aucun texte libre. Ces règles de saisie reprennent celles du serveur pour
 * guider l'utilisateur ; le serveur reste juge (un refus est affiché tel quel).
 */
export interface ContractType {
  id: string;
  code: string;
  label: string;
  fixedTerm: boolean;
  active: boolean;
  sortOrder: number;
  version: number;
}

export type ContractStatus = 'ACTIVE' | 'ENDED';

export interface Contract {
  id: string;
  employeeId: string;
  employeeName: string;
  contractTypeId: string;
  contractTypeLabel: string;
  fixedTerm: boolean;
  start: string;
  end: string | null;
  probationEnd: string | null;
  status: ContractStatus;
  endedOn: string | null;
  endReason: string | null;
  endReasonLabel: string | null;
  createdAt: string;
  version: number;
}

export interface Deadline {
  contractId: string;
  employeeId: string;
  employeeName: string;
  contractTypeLabel: string;
  kind: 'CONTRACT_END' | 'PROBATION_END';
  date: string;
  daysLeft: number;
}

/** Motifs de fin : liste fermée, identique à celle du serveur (jamais un texte libre). */
export const END_REASONS = [
  { code: 'FIXED_TERM_END', label: 'Fin du contrat à durée déterminée' },
  { code: 'PROBATION_END', label: 'Fin de la période d’essai' },
  { code: 'RESIGNATION', label: 'Démission' },
  { code: 'MISSION_END', label: 'Fin de mission' },
  { code: 'OTHER', label: 'Autre' },
] as const;

export const CONTRACT_STATE_FILTERS = [
  { value: '', label: 'Tous' },
  { value: 'ACTIVE', label: 'En cours' },
  { value: 'ENDED', label: 'Terminés' },
] as const;

export const DEADLINE_WINDOWS = [30, 60, 90, 180, 365] as const;
export const DEFAULT_DEADLINE_DAYS = 60;

/** Les écrans des contrats que le profil peut ouvrir (onglets). */
export const CONTRACT_PAGES = [
  { id: 'contracts', label: 'Contrats', href: '/hr/contracts', permission: 'hr.contract.read', allScope: false },
  { id: 'deadlines', label: 'À échéance', href: '/hr/contracts/deadlines', permission: 'hr.contract.manage', allScope: true },
] as const;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
export const isIsoDate = (value: string): boolean => {
  if (!ISO.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

export const statusLabel = (status: ContractStatus): string => (status === 'ACTIVE' ? 'En cours' : 'Terminé');
export const statusTone = (status: ContractStatus): 'ok' | 'neutral' => (status === 'ACTIVE' ? 'ok' : 'neutral');

/** Actions proposées sur un contrat : seulement s'il est en cours et si le profil gère les contrats (le serveur re-contrôle). */
export function contractActions(contract: Pick<Contract, 'status'>, canManage: boolean): ('adjust' | 'end')[] {
  return canManage && contract.status === 'ACTIVE' ? ['adjust', 'end'] : [];
}

/** Libellé d'une échéance : « Fin du contrat » ou « Fin de la période d'essai ». */
export const deadlineKindLabel = (kind: Deadline['kind']): string => (kind === 'CONTRACT_END' ? 'Fin du contrat' : 'Fin de la période d’essai');

/** Teinte d'une échéance selon les jours restants : à traiter cette semaine (rouge), ce mois-ci (orange), sinon neutre. */
export function deadlineTone(daysLeft: number): 'bad' | 'warn' | 'neutral' {
  if (daysLeft <= 7) return 'bad';
  if (daysLeft <= 30) return 'warn';
  return 'neutral';
}

export function daysLeftText(daysLeft: number): string {
  if (daysLeft === 0) return 'Aujourd’hui';
  if (daysLeft === 1) return 'Demain';
  return `Dans ${daysLeft} jours`;
}

// ─────────────────────────────── Formulaires ───────────────────────────────

export interface ContractForm {
  employeeId: string;
  contractTypeId: string;
  start: string;
  end: string;
  probationEnd: string;
}
export type ContractErrors = Partial<Record<keyof ContractForm, string>>;

export const EMPTY_CONTRACT_FORM = (today: string): ContractForm => ({ employeeId: '', contractTypeId: '', start: today, end: '', probationEnd: '' });

/** Règles de dates d'un contrat (celles du serveur) : fin obligatoire pour une durée déterminée, interdite sinon, jamais avant le début ; essai dans le contrat. */
export function validateDates(input: { start: string; end: string; probationEnd: string }, fixedTerm: boolean | null): ContractErrors {
  const errors: ContractErrors = {};
  if (!isIsoDate(input.start)) errors.start = 'Indiquez une date de début valide.';
  if (input.end && !isIsoDate(input.end)) errors.end = 'Indiquez une date de fin valide.';
  if (input.probationEnd && !isIsoDate(input.probationEnd)) errors.probationEnd = 'Indiquez une date de fin d’essai valide.';
  if (errors.start || errors.end || errors.probationEnd) return errors;
  if (fixedTerm === true && !input.end) errors.end = 'Ce type de contrat est à durée déterminée : la date de fin est obligatoire.';
  if (fixedTerm === false && input.end) errors.end = 'Ce type de contrat est à durée indéterminée : il n’a pas de date de fin.';
  if (input.end && input.end < input.start) errors.end = 'La date de fin ne peut pas précéder la date de début.';
  if (input.probationEnd) {
    if (input.probationEnd < input.start) errors.probationEnd = 'La fin de la période d’essai ne peut pas précéder le début.';
    else if (input.end && input.probationEnd > input.end) errors.probationEnd = 'La fin de la période d’essai ne peut pas dépasser la fin du contrat.';
  }
  return errors;
}

export function validateContractForm(form: ContractForm, type: Pick<ContractType, 'fixedTerm'> | null): ContractErrors {
  const errors = validateDates(form, type ? type.fixedTerm : null);
  if (!form.employeeId) errors.employeeId = 'Choisissez l’employé.';
  if (!form.contractTypeId) errors.contractTypeId = 'Choisissez le type de contrat.';
  return errors;
}

export const contractBody = (form: ContractForm): Record<string, unknown> => ({
  employeeId: form.employeeId,
  contractTypeId: form.contractTypeId,
  start: form.start,
  ...(form.end ? { end: form.end } : {}),
  ...(form.probationEnd ? { probationEnd: form.probationEnd } : {}),
});

export interface AdjustForm {
  end: string;
  probationEnd: string;
}

export const adjustFormOf = (c: Pick<Contract, 'end' | 'probationEnd'>): AdjustForm => ({ end: c.end ?? '', probationEnd: c.probationEnd ?? '' });

export function validateAdjust(form: AdjustForm, contract: Pick<Contract, 'start' | 'fixedTerm'>): ContractErrors {
  return validateDates({ start: contract.start, end: form.end, probationEnd: form.probationEnd }, contract.fixedTerm);
}

/** Corps de l'ajustement : `null` efface une date (l'essai) ; la fin n'est envoyée que pour un contrat à durée déterminée. */
export function adjustBody(form: AdjustForm, contract: Pick<Contract, 'version' | 'fixedTerm'>): Record<string, unknown> {
  return { version: contract.version, ...(contract.fixedTerm ? { end: form.end } : {}), probationEnd: form.probationEnd || null };
}

export interface EndForm {
  endedOn: string;
  reason: string;
}
export type EndErrors = Partial<Record<keyof EndForm, string>>;

export function validateEnd(form: EndForm, contract: Pick<Contract, 'start' | 'end'>): EndErrors {
  const errors: EndErrors = {};
  if (!isIsoDate(form.endedOn)) errors.endedOn = 'Indiquez la date de fin effective.';
  else if (form.endedOn < contract.start) errors.endedOn = 'La date de fin effective ne peut pas précéder le début du contrat.';
  else if (contract.end && form.endedOn > contract.end) errors.endedOn = 'La date de fin effective ne peut pas dépasser la fin prévue : prolongez d’abord le contrat.';
  if (!END_REASONS.some((r) => r.code === form.reason)) errors.reason = 'Choisissez un motif dans la liste.';
  return errors;
}

export interface TypeForm {
  code: string;
  label: string;
  fixedTerm: boolean;
  sortOrder: string;
}
export type TypeErrors = Partial<Record<keyof TypeForm, string>>;

export const EMPTY_TYPE_FORM: TypeForm = { code: '', label: '', fixedTerm: false, sortOrder: '100' };
export const typeFormOf = (t: ContractType): TypeForm => ({ code: t.code, label: t.label, fixedTerm: t.fixedTerm, sortOrder: String(t.sortOrder) });

export function validateTypeForm(form: TypeForm, options: { creating: boolean }): TypeErrors {
  const errors: TypeErrors = {};
  if (options.creating && !/^[A-Z][A-Z0-9_]{1,29}$/.test(form.code.trim().toUpperCase())) errors.code = 'Majuscules, chiffres et _ (2 à 30 caractères), en commençant par une lettre.';
  const label = form.label.trim();
  if (!label) errors.label = 'Le libellé est obligatoire.';
  else if (label.length > 100) errors.label = 'Le libellé ne peut dépasser 100 caractères.';
  const order = Number(form.sortOrder);
  if (!/^\d+$/.test(form.sortOrder.trim()) || !Number.isInteger(order) || order < 0 || order > 10_000) errors.sortOrder = 'Un entier entre 0 et 10 000.';
  return errors;
}

/** Jours restants avant une date, par rapport à aujourd'hui (négatif si passée). */
export const daysUntil = (date: string, today: string): number => daysBetweenIso(today, date);
