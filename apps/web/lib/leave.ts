import type { StatusStyle } from './status';
import { isRealDate } from './receipts';

// ───────────────────────────── Vues de l'API (RH-2a) ─────────────────────────────

/** Demande d'absence. Le motif est libre et facultatif : jamais de diagnostic, jamais de pièce (aucune donnée de santé). */
export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveTypeId: string;
  leaveTypeLabel: string;
  start: string;
  end: string;
  startHalf: boolean;
  endHalf: boolean;
  days: number;
  /** `PENDING`, `APPROVED`, `REJECTED` ou `CANCELLED`. */
  status: string;
  note: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  version: number;
}

export interface LeaveType {
  id: string;
  code: string;
  label: string;
  deductsBalance: boolean;
  requiresApproval: boolean;
  maxDaysPerRequest: number | null;
  active: boolean;
  sortOrder: number;
  version: number;
}

export interface LeaveSettings {
  accrualDaysPerMonth: number;
  countsSaturday: boolean;
  allowHalfDays: boolean;
  allowNegativeBalance: boolean;
  version: number;
}

export interface Holiday {
  id: string;
  day: string;
  label: string;
}

export interface LeaveBalance {
  employeeId: string;
  employeeName: string;
  year: number;
  entitlement: number;
  adjustments: number;
  taken: number;
  pending: number;
  available: number;
}

export interface Adjustment {
  id: string;
  employeeId: string;
  year: number;
  days: number;
  reason: string;
  createdAt: string;
}

export interface CalendarEntry {
  requestId: string;
  employeeId: string;
  employeeName: string;
  department: string;
  start: string;
  end: string;
  startHalf: boolean;
  endHalf: boolean;
  /** Absent pour un collègue : il voit seulement « absent », ni type ni motif. */
  leaveTypeLabel: string | null;
}

export interface TeamCalendar {
  from: string;
  to: string;
  department: string | null;
  entries: CalendarEntry[];
  holidays: Holiday[];
}

// ───────────────────────────── Libellés ─────────────────────────────

export const LEAVE_STATUS: Record<string, StatusStyle> = {
  PENDING: { label: 'En attente', tone: 'warn' },
  APPROVED: { label: 'Validée', tone: 'ok' },
  REJECTED: { label: 'Refusée', tone: 'bad' },
  CANCELLED: { label: 'Annulée', tone: 'neutral' },
};

export const LEAVE_STATUS_FILTERS = [
  { value: '', label: 'Toutes' },
  { value: 'PENDING', label: 'En attente' },
  { value: 'APPROVED', label: 'Validées' },
  { value: 'REJECTED', label: 'Refusées' },
  { value: 'CANCELLED', label: 'Annulées' },
] as const;

/** Les cinq écrans de l'absence et des congés : le menu et la barre d'onglets partagent cette liste. */
export const LEAVE_PAGES = [
  { id: 'mine', label: 'Mes absences', href: '/hr/leave', permission: 'hr.leave.read', allScope: false },
  { id: 'approvals', label: 'À valider', href: '/hr/leave/approvals', permission: 'hr.leave.approve', allScope: false },
  { id: 'calendar', label: 'Calendrier d’équipe', href: '/hr/leave/calendar', permission: 'hr.leave.read', allScope: false },
  { id: 'balances', label: 'Soldes', href: '/hr/leave/balances', permission: 'hr.leave.manage', allScope: true },
  { id: 'settings', label: 'Paramètres RH', href: '/hr/leave/settings', permission: 'hr.leave.manage', allScope: true },
] as const;

// ───────────────────────────── Dates et durées ─────────────────────────────

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

const parts = (iso: string): [number, number, number] => {
  const [y, m, d] = iso.split('-').map(Number);
  return [y!, m!, d!];
};

/** `2026-12-21` → `21/12/2026`. Les dates d'absence sont des jours civils : aucun fuseau n'entre en jeu. */
export function dayText(iso: string): string {
  const [y, m, d] = parts(iso);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

/** Période lisible : « 21/12/2026 au 24/12/2026 » (ou « le 21/12/2026 » pour un seul jour), avec les demi-journées dites en toutes lettres. */
export function periodLabel(r: Pick<LeaveRequest, 'start' | 'end' | 'startHalf' | 'endHalf'>): string {
  const startNote = r.startHalf ? ' (après-midi)' : '';
  const endNote = r.endHalf ? ' (matin)' : '';
  if (r.start === r.end) {
    return `le ${dayText(r.start)}${r.startHalf ? ' (après-midi)' : r.endHalf ? ' (matin)' : ''}`;
  }
  return `du ${dayText(r.start)}${startNote} au ${dayText(r.end)}${endNote}`;
}

/** « 1 jour », « 2,5 jours » : les demi-journées donnent une virgule. */
export function daysText(days: number): string {
  const text = Number.isInteger(days) ? String(days) : days.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  return `${text} jour${Math.abs(days) > 1 ? 's' : ''}`;
}

/** Jour de la semaine (0 = dimanche) d'un jour civil. */
export const weekdayOf = (iso: string): number => {
  const [y, m, d] = parts(iso);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

export const weekdayName = (iso: string): string => DAYS[weekdayOf(iso)]!;

export const monthName = (month: number): string => MONTHS[month - 1] ?? '';

export function addDays(iso: string, days: number): string {
  const [y, m, d] = parts(iso);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Premier et dernier jour du mois, au format de l'API. */
export function monthBounds(year: number, month: number): { from: string; to: string } {
  const mm = String(month).padStart(2, '0');
  return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${String(daysInMonth(year, month)).padStart(2, '0')}` };
}

/** Mois précédent (`-1`) ou suivant (`+1`), en passant d'une année à l'autre. */
export function shiftMonth(year: number, month: number, by: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + by;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

// ───────────────────────────── Calendrier d'équipe ─────────────────────────────

export type DayMark = 'full' | 'morning' | 'afternoon' | null;

/** Ce qu'une absence occupe un jour donné : la journée, la matinée seule (dernier jour qui s'arrête à midi) ou l'après-midi seul (premier jour qui commence l'après-midi). */
export function markOn(entry: Pick<CalendarEntry, 'start' | 'end' | 'startHalf' | 'endHalf'>, day: string): DayMark {
  if (day < entry.start || day > entry.end) return null;
  if (entry.start === entry.end) return entry.startHalf ? 'afternoon' : entry.endHalf ? 'morning' : 'full';
  if (day === entry.start && entry.startHalf) return 'afternoon';
  if (day === entry.end && entry.endHalf) return 'morning';
  return 'full';
}

export interface CalendarRow {
  employeeId: string;
  employeeName: string;
  department: string;
  entries: CalendarEntry[];
}

/** Une ligne par personne absente sur la période, triées par service puis par nom. */
export function calendarRows(entries: readonly CalendarEntry[]): CalendarRow[] {
  const rows = new Map<string, CalendarRow>();
  for (const e of entries) {
    const row = rows.get(e.employeeId) ?? { employeeId: e.employeeId, employeeName: e.employeeName, department: e.department, entries: [] };
    row.entries.push(e);
    rows.set(e.employeeId, row);
  }
  return [...rows.values()].sort((a, b) => a.department.localeCompare(b.department, 'fr') || a.employeeName.localeCompare(b.employeeName, 'fr'));
}

// ───────────────────────────── Saisie d'une demande ─────────────────────────────

export interface LeaveForm {
  employeeId: string;
  leaveTypeId: string;
  start: string;
  end: string;
  startHalf: boolean;
  endHalf: boolean;
  note: string;
}

export const EMPTY_LEAVE_FORM = (today: string): LeaveForm => ({ employeeId: '', leaveTypeId: '', start: today, end: today, startHalf: false, endHalf: false, note: '' });

export type LeaveFormErrors = Partial<Record<'leaveTypeId' | 'start' | 'end' | 'note' | 'half', string>>;

/**
 * Contrôles de confort avant l'envoi ; le serveur reste seul juge (solde, chevauchement, jours fériés, plafond du type). Une demande dans le passé est réservée à la
 * RH ; une demi-journée n'existe que si la RH l'autorise.
 */
export function validateLeaveForm(form: LeaveForm, rules: { today: string; allowHalfDays: boolean; canBackdate: boolean }): LeaveFormErrors {
  const errors: LeaveFormErrors = {};
  if (!form.leaveTypeId) errors.leaveTypeId = 'Choisissez un type d’absence.';
  if (!form.start) errors.start = 'La date de début est obligatoire.';
  else if (!isRealDate(form.start)) errors.start = 'La date de début n’est pas valide.';
  else if (form.start < rules.today && !rules.canBackdate) errors.start = 'Une demande dans le passé est réservée à la RH.';
  if (!form.end) errors.end = 'La date de fin est obligatoire.';
  else if (!isRealDate(form.end)) errors.end = 'La date de fin n’est pas valide.';
  else if (form.start && isRealDate(form.start) && form.end < form.start) errors.end = 'La date de fin ne peut pas précéder le début.';
  if (!rules.allowHalfDays && (form.startHalf || form.endHalf)) errors.half = 'Les demi-journées ne sont pas autorisées.';
  if (form.note.trim().length > 500) errors.note = 'Le motif ne peut dépasser 500 caractères.';
  return errors;
}

/** Corps envoyé à l'API : le motif vide et l'employé absent ne sont pas transmis (l'employé est alors celui du compte). */
export function leaveBody(form: LeaveForm) {
  return {
    ...(form.employeeId ? { employeeId: form.employeeId } : {}),
    leaveTypeId: form.leaveTypeId,
    start: form.start,
    end: form.end,
    ...(form.startHalf ? { startHalf: true } : {}),
    ...(form.endHalf ? { endHalf: true } : {}),
    ...(form.note.trim() ? { note: form.note.trim() } : {}),
  };
}

/**
 * Actions possibles sur une demande, pour l'affichage seulement (le serveur décide) : l'employé annule une demande en attente ou une validée qui n'a pas commencé ;
 * la RH annule aussi une absence en cours.
 */
export function canCancelRequest(r: Pick<LeaveRequest, 'status' | 'start'>, today: string, isHr: boolean): boolean {
  if (r.status === 'PENDING') return true;
  if (r.status !== 'APPROVED') return false;
  return isHr || r.start > today;
}

/** Un refus exige un motif ; l'annulation d'une demande déjà validée aussi. */
export function validateReason(text: string, required: boolean): string | undefined {
  const reason = text.trim();
  if (required && !reason) return 'Le motif est obligatoire.';
  if (reason.length > 500) return 'Le motif ne peut dépasser 500 caractères.';
  return undefined;
}

// ───────────────────────────── Ajustements et paramètres (RH) ─────────────────────────────

export interface AdjustmentForm {
  days: string;
  reason: string;
}

/** Ajustement de solde : un nombre de jours non nul, par demi-journée, de 60 au plus en valeur absolue ; un motif obligatoire. */
export function validateAdjustment(form: AdjustmentForm): Partial<Record<keyof AdjustmentForm, string>> {
  const errors: Partial<Record<keyof AdjustmentForm, string>> = {};
  const text = form.days.trim().replace(',', '.');
  const days = Number(text);
  if (!text) errors.days = 'Indiquez le nombre de jours.';
  else if (!Number.isFinite(days) || days === 0) errors.days = 'Indiquez un nombre de jours différent de zéro.';
  else if (Math.abs(days) > 60) errors.days = 'Un ajustement ne dépasse pas 60 jours.';
  else if (Math.round(days * 2) !== days * 2) errors.days = 'Les jours s’ajustent par demi-journée.';
  const reason = form.reason.trim();
  if (!reason) errors.reason = 'Le motif est obligatoire.';
  else if (reason.length > 500) errors.reason = 'Le motif ne peut dépasser 500 caractères.';
  return errors;
}

export const parseDays = (text: string): number => Number(text.trim().replace(',', '.'));

export interface SettingsForm {
  accrualDaysPerMonth: string;
  countsSaturday: boolean;
  allowHalfDays: boolean;
  allowNegativeBalance: boolean;
}

export const settingsForm = (s: LeaveSettings): SettingsForm => ({
  accrualDaysPerMonth: String(s.accrualDaysPerMonth).replace('.', ','),
  countsSaturday: s.countsSaturday,
  allowHalfDays: s.allowHalfDays,
  allowNegativeBalance: s.allowNegativeBalance,
});

/** Jours acquis par mois : de 0 à 5, deux décimales au plus. Le total annuel (×12) est affiché à côté pour que la RH vérifie son règlement. */
export function validateSettings(form: SettingsForm): { accrualDaysPerMonth?: string } {
  const value = Number(form.accrualDaysPerMonth.trim().replace(',', '.'));
  if (!form.accrualDaysPerMonth.trim() || !Number.isFinite(value)) return { accrualDaysPerMonth: 'Indiquez un nombre de jours par mois.' };
  if (value < 0 || value > 5) return { accrualDaysPerMonth: 'Entre 0 et 5 jours par mois.' };
  if (Math.abs(value * 100 - Math.round(value * 100)) > 1e-9) return { accrualDaysPerMonth: 'Deux décimales au plus.' };
  return {};
}

export interface TypeForm {
  code: string;
  label: string;
  deductsBalance: boolean;
  requiresApproval: boolean;
  maxDays: string;
  sortOrder: string;
}

export const EMPTY_TYPE_FORM: TypeForm = { code: '', label: '', deductsBalance: false, requiresApproval: true, maxDays: '', sortOrder: '100' };

export const typeForm = (t: LeaveType): TypeForm => ({
  code: t.code, label: t.label, deductsBalance: t.deductsBalance, requiresApproval: t.requiresApproval,
  maxDays: t.maxDaysPerRequest === null ? '' : String(t.maxDaysPerRequest).replace('.', ','), sortOrder: String(t.sortOrder),
});

/** Le code d'un type est fixé à la création (il identifie le type) ; le plafond est facultatif, au demi-jour. */
export function validateTypeForm(form: TypeForm, creating: boolean): Partial<Record<keyof TypeForm, string>> {
  const errors: Partial<Record<keyof TypeForm, string>> = {};
  if (creating) {
    const code = form.code.trim();
    if (!code) errors.code = 'Le code est obligatoire.';
    else if (!/^[A-Z0-9_]{1,30}$/.test(code)) errors.code = 'Majuscules, chiffres et tiret bas, 30 caractères au plus.';
  }
  const label = form.label.trim();
  if (!label) errors.label = 'Le libellé est obligatoire.';
  else if (label.length > 100) errors.label = 'Le libellé ne peut dépasser 100 caractères.';
  if (form.maxDays.trim()) {
    const max = Number(form.maxDays.trim().replace(',', '.'));
    if (!Number.isFinite(max) || max < 0.5 || max > 365) errors.maxDays = 'Entre 0,5 et 365 jours, ou vide pour aucun plafond.';
    else if (Math.round(max * 2) !== max * 2) errors.maxDays = 'Par demi-journée (0,5 ; 1 ; 1,5…).';
  }
  const order = Number(form.sortOrder.trim());
  if (!Number.isInteger(order) || order < 0 || order > 10000) errors.sortOrder = 'Un entier de 0 à 10 000.';
  return errors;
}

export function validateHoliday(day: string, label: string): { day?: string; label?: string } {
  const errors: { day?: string; label?: string } = {};
  if (!day) errors.day = 'La date est obligatoire.';
  else if (!isRealDate(day)) errors.day = 'La date n’est pas valide.';
  if (!label.trim()) errors.label = 'Le libellé est obligatoire.';
  else if (label.trim().length > 100) errors.label = 'Le libellé ne peut dépasser 100 caractères.';
  return errors;
}
