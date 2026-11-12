import { DomainError } from '../../../shared-kernel';
import { isIsoDate } from './leave-calendar';

/** Règles de congés (une seule ligne) : valeurs de départ « à confirmer » (D64), modifiables par la RH avec trace. */
export interface LeaveSettings {
  /** Jours acquis par mois de service. */
  accrualDaysPerMonth: number;
  /** Faux : jours ouvrés du lundi au vendredi ; vrai : le samedi compte aussi. */
  countsSaturday: boolean;
  allowHalfDays: boolean;
  allowNegativeBalance: boolean;
  version: number;
}

export const DEFAULT_LEAVE_SETTINGS: LeaveSettings = { accrualDaysPerMonth: 1.5, countsSaturday: false, allowHalfDays: true, allowNegativeBalance: false, version: 1 };

/** Valide des règles de congés : un nombre de jours par mois entre 0 et 5, au centième. */
export function validateLeaveSettings(input: { accrualDaysPerMonth: number; countsSaturday: boolean; allowHalfDays: boolean; allowNegativeBalance: boolean }): void {
  const value = input.accrualDaysPerMonth;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 5 || Math.round(value * 100) !== value * 100) {
    throw new DomainError('VALIDATION', 'Les jours acquis par mois doivent être un nombre entre 0 et 5, au centième');
  }
}

export interface LeaveTypeProps {
  id: string;
  code: string;
  label: string;
  deductsBalance: boolean;
  requiresApproval: boolean;
  maxDaysPerRequest: number | null;
  active: boolean;
  sortOrder: number;
  version: number;
  createdAt: Date;
}

const CODE = /^[A-Z][A-Z0-9_]{1,29}$/;

function labelOf(raw: string | undefined): string {
  const value = (raw ?? '').trim().replace(/\s+/g, ' ');
  if (!value) throw new DomainError('VALIDATION', "Le libellé du type d'absence est obligatoire");
  if (value.length > 100) throw new DomainError('VALIDATION', 'Le libellé ne peut dépasser 100 caractères');
  return value;
}

function maxDaysOf(raw: number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0 || raw > 365 || raw * 2 !== Math.round(raw * 2)) {
    throw new DomainError('VALIDATION', 'La durée maximale est un nombre de jours positif, par demi-journée, de 365 au plus');
  }
  return raw;
}

/** Type d'absence paramétrable : jamais supprimé (il se désactive). Seul un type qui « décompte le solde » consomme les jours de congé annuel. */
export class LeaveType {
  private constructor(private props: LeaveTypeProps) {}

  static create(input: { id: string; code: string; label: string; deductsBalance?: boolean; requiresApproval?: boolean; maxDaysPerRequest?: number | null; sortOrder?: number; now: Date }): LeaveType {
    const code = (input.code ?? '').trim().toUpperCase();
    if (!CODE.test(code)) throw new DomainError('VALIDATION', 'Le code comporte des lettres majuscules, des chiffres et _ (2 à 30 caractères, commence par une lettre)');
    return new LeaveType({
      id: input.id, code, label: labelOf(input.label), deductsBalance: input.deductsBalance ?? false, requiresApproval: input.requiresApproval ?? true,
      maxDaysPerRequest: maxDaysOf(input.maxDaysPerRequest), active: true, sortOrder: input.sortOrder ?? 100, version: 1, createdAt: input.now,
    });
  }

  static rehydrate(props: LeaveTypeProps): LeaveType {
    return new LeaveType(props);
  }

  /** Modifie le type (absent = inchangé ; `maxDaysPerRequest` à `null` = plus de plafond). Le code ne change jamais. */
  update(changes: { label?: string; deductsBalance?: boolean; requiresApproval?: boolean; maxDaysPerRequest?: number | null; active?: boolean; sortOrder?: number }): void {
    const next = { ...this.props };
    if (changes.label !== undefined) next.label = labelOf(changes.label);
    if (changes.deductsBalance !== undefined) next.deductsBalance = changes.deductsBalance;
    if (changes.requiresApproval !== undefined) next.requiresApproval = changes.requiresApproval;
    if (changes.maxDaysPerRequest !== undefined) next.maxDaysPerRequest = maxDaysOf(changes.maxDaysPerRequest);
    if (changes.active !== undefined) next.active = changes.active;
    if (changes.sortOrder !== undefined) {
      if (!Number.isInteger(changes.sortOrder) || changes.sortOrder < 0 || changes.sortOrder > 10_000) throw new DomainError('VALIDATION', "L'ordre d'affichage est un entier entre 0 et 10 000");
      next.sortOrder = changes.sortOrder;
    }
    this.props = next;
  }

  get id(): string { return this.props.id; }
  get code(): string { return this.props.code; }
  get label(): string { return this.props.label; }
  get deductsBalance(): boolean { return this.props.deductsBalance; }
  get requiresApproval(): boolean { return this.props.requiresApproval; }
  get maxDaysPerRequest(): number | null { return this.props.maxDaysPerRequest; }
  get active(): boolean { return this.props.active; }
  get sortOrder(): number { return this.props.sortOrder; }
  get version(): number { return this.props.version; }
  get createdAt(): Date { return this.props.createdAt; }
}

export interface PublicHoliday {
  id: string;
  /** « AAAA-MM-JJ ». */
  day: string;
  label: string;
}

/** Valide un jour férié saisi par la RH : date réelle, libellé non vide de 100 caractères au plus. */
export function validateHoliday(input: { day: string; label: string }): { day: string; label: string } {
  if (!isIsoDate((input.day ?? '').trim())) throw new DomainError('VALIDATION', 'La date doit être une date valide (AAAA-MM-JJ)');
  const label = (input.label ?? '').trim().replace(/\s+/g, ' ');
  if (!label) throw new DomainError('VALIDATION', 'Le libellé du jour férié est obligatoire');
  if (label.length > 100) throw new DomainError('VALIDATION', 'Le libellé ne peut dépasser 100 caractères');
  return { day: input.day.trim(), label };
}

/** Ajustement de solde : ajout seul (jamais modifié ni supprimé), motif obligatoire. */
export interface LeaveAdjustment {
  id: string;
  employeeId: string;
  year: number;
  days: number;
  reason: string;
  createdByUserId: string;
  createdAt: Date;
}

/** Valide un ajustement : année réaliste, jours non nuls (±60 au plus, par demi-journée), motif obligatoire. */
export function validateAdjustment(input: { year: number; days: number; reason: string }): { year: number; days: number; reason: string } {
  if (!Number.isInteger(input.year) || input.year < 2000 || input.year > 2100) throw new DomainError('VALIDATION', "L'année doit être comprise entre 2000 et 2100");
  if (typeof input.days !== 'number' || !Number.isFinite(input.days) || input.days === 0 || Math.abs(input.days) > 60 || input.days * 2 !== Math.round(input.days * 2)) {
    throw new DomainError('VALIDATION', 'Le nombre de jours est non nul, par demi-journée, de 60 au plus en valeur absolue');
  }
  const reason = (input.reason ?? '').trim();
  if (!reason) throw new DomainError('VALIDATION', "Le motif de l'ajustement est obligatoire");
  if (reason.length > 500) throw new DomainError('VALIDATION', 'Le motif ne peut dépasser 500 caractères');
  return { year: input.year, days: input.days, reason };
}
