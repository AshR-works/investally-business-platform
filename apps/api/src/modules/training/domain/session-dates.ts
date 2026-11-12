import { DomainError } from '../../../shared-kernel';
import { Rhythm } from './rhythms';

/** Date calendaire sans heure, « AAAA-MM-JJ » : les dates d'une session n'ont pas de fuseau (les comparer en texte suffit). */
export type IsoDate = string;

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

/** Lit une date « AAAA-MM-JJ » (jour réel du calendrier, sinon erreur de validation). */
export function parseIsoDate(raw: unknown, label: string): IsoDate {
  const text = typeof raw === 'string' ? raw.trim() : '';
  const match = ISO.exec(text);
  if (!match) throw new DomainError('VALIDATION', `${label} doit être une date au format AAAA-MM-JJ`);
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (toIsoDate(date) !== text) throw new DomainError('VALIDATION', `${label} n'est pas une date du calendrier`);
  return text;
}

export function toIsoDate(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

const dateOf = (iso: IsoDate): Date => new Date(`${iso}T00:00:00.000Z`);

/** Jour de cours possible : du lundi au vendredi (les jours fériés ne sont pas pris en compte, D147). */
export function isWorkingDay(iso: IsoDate): boolean {
  const day = dateOf(iso).getUTCDay();
  return day >= 1 && day <= 5;
}

/** Dernier jour de la session : on compte les jours de cours (lundi–vendredi) du rythme à partir du début, inclus. */
export function endDateFor(start: IsoDate, rhythm: Rhythm): IsoDate {
  let remaining = rhythm.weeks * rhythm.daysPerWeek - 1;
  let cursor = dateOf(start);
  while (remaining > 0) {
    cursor = new Date(cursor.getTime() + DAY_MS);
    const day = cursor.getUTCDay();
    if (day >= 1 && day <= 5) remaining -= 1;
  }
  return toIsoDate(cursor);
}

/** Deux périodes (bornes incluses) se recouvrent-elles ? */
export function overlaps(aStart: IsoDate, aEnd: IsoDate, bStart: IsoDate, bEnd: IsoDate): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}
