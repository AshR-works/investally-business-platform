import { DomainError } from '../../../shared-kernel';

/** Fonctions PURES de calendrier pour les absences : dates « AAAA-MM-JJ » (jamais de fuseau), jours décomptés, demi-journées, chevauchements, droits annuels. */

const DAY_MS = 86_400_000;
/** Une demande couvre au plus un an : au-delà, c'est presque sûrement une faute de saisie. */
export const MAX_LEAVE_SPAN_DAYS = 366;

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Vrai si le texte est une date réelle « AAAA-MM-JJ ». */
export function isIsoDate(text: string): boolean {
  const m = DATE.exec(text);
  return m !== null && new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!)).toISOString().slice(0, 10) === text;
}

/** Numéro de jour (jours écoulés depuis 1970) d'une date « AAAA-MM-JJ » valide. */
export function dayOrdinal(iso: string): number {
  const m = DATE.exec(iso)!;
  return Math.round(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!) / DAY_MS);
}

export const isoOfOrdinal = (ordinal: number): string => new Date(ordinal * DAY_MS).toISOString().slice(0, 10);

/** Jour de la semaine : 0 = dimanche … 6 = samedi. */
export const weekdayOf = (iso: string): number => new Date(dayOrdinal(iso) * DAY_MS).getUTCDay();

export interface CalendarRules {
  /** Faux : jours ouvrés du lundi au vendredi ; vrai : le samedi compte aussi. Le dimanche ne compte jamais. */
  countsSaturday: boolean;
  /** Jours fériés « AAAA-MM-JJ » : jamais décomptés. */
  holidays: ReadonlySet<string>;
}

/** Vrai pour un jour qui consomme une absence : ni dimanche, ni samedi (sauf règle contraire), ni jour férié. */
export function isWorkingDay(iso: string, rules: CalendarRules): boolean {
  const weekday = weekdayOf(iso);
  if (weekday === 0) return false;
  if (weekday === 6 && !rules.countsSaturday) return false;
  return !rules.holidays.has(iso);
}

export interface LeavePeriod {
  start: string;
  end: string;
  /** La première journée commence l'après-midi. */
  startHalf: boolean;
  /** La dernière journée s'arrête à midi. */
  endHalf: boolean;
}

/** Valide la forme d'une période : dates réelles, ordre, durée raisonnable, demi-journées cohérentes. */
export function assertPeriod(period: LeavePeriod): void {
  if (!isIsoDate(period.start)) throw new DomainError('VALIDATION', 'La date de début doit être une date valide (AAAA-MM-JJ)');
  if (!isIsoDate(period.end)) throw new DomainError('VALIDATION', 'La date de fin doit être une date valide (AAAA-MM-JJ)');
  if (period.end < period.start) throw new DomainError('VALIDATION', 'La date de fin ne peut pas précéder la date de début');
  if (dayOrdinal(period.end) - dayOrdinal(period.start) + 1 > MAX_LEAVE_SPAN_DAYS) throw new DomainError('VALIDATION', `Une demande ne peut pas dépasser ${MAX_LEAVE_SPAN_DAYS} jours`);
  if (period.start === period.end && period.startHalf && period.endHalf) {
    throw new DomainError('VALIDATION', "Une seule journée ne peut pas commencer l'après-midi et s'arrêter à midi : choisissez la matinée, l'après-midi ou la journée");
  }
}

/**
 * Nombre de jours décomptés : chaque jour ouvré compte 1 ; une première journée qui commence l'après-midi ou une dernière qui s'arrête à midi retirent 0,5 si
 * cette journée est ouvrée (une demi-journée posée sur un jour férié ou un dimanche ne retire rien : il n'y avait rien à décompter).
 */
export function leaveDays(period: LeavePeriod, rules: CalendarRules): number {
  assertPeriod(period);
  const first = dayOrdinal(period.start);
  const last = dayOrdinal(period.end);
  let days = 0;
  for (let ordinal = first; ordinal <= last; ordinal += 1) if (isWorkingDay(isoOfOrdinal(ordinal), rules)) days += 1;
  if (period.startHalf && isWorkingDay(period.start, rules)) days -= 0.5;
  if (period.endHalf && isWorkingDay(period.end, rules)) days -= 0.5;
  return days;
}

/** Demi-journées occupées, numérotées : 2 × jour pour la matinée, 2 × jour + 1 pour l'après-midi ; bornes incluses. */
export function slotRange(period: LeavePeriod): { first: number; last: number } {
  return { first: dayOrdinal(period.start) * 2 + (period.startHalf ? 1 : 0), last: dayOrdinal(period.end) * 2 + (period.endHalf ? 0 : 1) };
}

/** Deux périodes se chevauchent si elles partagent au moins une demi-journée (une matinée et l'après-midi du même jour ne se chevauchent pas). */
export function periodsOverlap(a: LeavePeriod, b: LeavePeriod): boolean {
  const x = slotRange(a);
  const y = slotRange(b);
  return x.first <= y.last && y.first <= x.last;
}

/** Ajoute des mois à une date en gardant le jour si possible, sinon le dernier jour du mois (31 janvier + 1 mois = fin février). */
function addMonths(iso: string, months: number): string {
  const m = DATE.exec(iso)!;
  const index = +m[1]! * 12 + (+m[2]! - 1) + months;
  const year = Math.floor(index / 12);
  const month = index % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return `${String(year).padStart(4, '0')}-${String(month + 1).padStart(2, '0')}-${String(Math.min(+m[3]!, lastDay)).padStart(2, '0')}`;
}

/**
 * Mois de service complets dans une année civile : de la date d'entrée (ou du 1er janvier) à la date de sortie (ou au 31 décembre) incluse. Un employé présent
 * toute l'année a 12 mois ; entré le 15 janvier, 11 mois ; le mois d'entrée entamé ne compte qu'une fois complet (proratisation).
 */
export function monthsOfService(hiredOn: string, leftOn: string | null, year: number): number {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const start = hiredOn > yearStart ? hiredOn : yearStart;
  const lastDay = leftOn !== null && leftOn < yearEnd ? leftOn : yearEnd;
  if (start > lastDay) return 0;
  const endExclusive = isoOfOrdinal(dayOrdinal(lastDay) + 1);
  let months = 0;
  while (addMonths(start, months + 1) <= endExclusive) months += 1;
  return months;
}

/** Jours de congé annuel acquis pour une année : mois de service × jours par mois (au centième). */
export function annualEntitlement(hiredOn: string, leftOn: string | null, year: number, accrualPerMonth: number): number {
  return Math.round(monthsOfService(hiredOn, leftOn, year) * accrualPerMonth * 100) / 100;
}

export interface LeaveBalance {
  year: number;
  /** Jours acquis pour l'année (mois de service × jours par mois). */
  entitlement: number;
  /** Total des ajustements de la RH pour l'année (reports, corrections). */
  adjustments: number;
  /** Jours des demandes validées de l'année. */
  taken: number;
  /** Jours des demandes en attente de l'année (réservés). */
  pending: number;
  /** Ce qu'il reste : acquis + ajustements − pris − en attente. */
  available: number;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** Solde d'une année : jamais calculé à partir de la date du jour, donc reproductible. */
export function computeBalance(input: { year: number; entitlement: number; adjustments: number; taken: number; pending: number }): LeaveBalance {
  return { ...input, available: round2(input.entitlement + input.adjustments - input.taken - input.pending) };
}
