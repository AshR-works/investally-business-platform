/**
 * Présences déclaratives du personnel (RH-4b, D69). Une valeur parmi trois par employé et par jour : aucune heure, aucun lieu, aucun retard, aucun texte libre.
 * Les fenêtres de saisie reprennent celles du serveur ; le serveur reste juge.
 */
export type PresenceMode = 'ON_SITE' | 'REMOTE' | 'TRAVEL';

export const MODE_OPTIONS: { code: PresenceMode; label: string; symbol: string }[] = [
  { code: 'ON_SITE', label: 'Sur site', symbol: '■' },
  { code: 'REMOTE', label: 'Télétravail', symbol: '⌂' },
  { code: 'TRAVEL', label: 'Déplacement', symbol: '→' },
];
export const modeLabel = (mode: string): string => MODE_OPTIONS.find((m) => m.code === mode)?.label ?? mode;
export const modeSymbol = (mode: string): string => MODE_OPTIONS.find((m) => m.code === mode)?.symbol ?? '?';

/** Fenêtres de saisie, en jours autour d'aujourd'hui (celles du serveur). */
export const SELF_WINDOW = { past: 7, future: 30 } as const;
export const HR_WINDOW = { past: 90, future: 90 } as const;

export interface PresenceRow {
  employeeId: string;
  employeeName: string;
  department: string;
  entries: { day: string; mode: PresenceMode }[];
  /** Jours couverts en entier par une absence validée. */
  leaveDays: string[];
}

export interface PresenceBoard {
  from: string;
  to: string;
  department: string | null;
  viewerEmployeeId: string | null;
  canDeclareForAll: boolean;
  rows: PresenceRow[];
}

export interface PresenceView {
  id: string;
  employeeId: string;
  day: string;
  mode: PresenceMode;
}

const DAY_MS = 86_400_000;
const ordinal = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
};
export const addDays = (iso: string, days: number): string => new Date((ordinal(iso) + days) * DAY_MS).toISOString().slice(0, 10);
/** Jour de la semaine : 0 = dimanche … 6 = samedi. */
const weekday = (iso: string): number => new Date(ordinal(iso) * DAY_MS).getUTCDay();

/** Le lundi de la semaine qui contient ce jour. */
export const weekStart = (iso: string): string => addDays(iso, -((weekday(iso) + 6) % 7));
export const weekDays = (start: string): string[] => Array.from({ length: 7 }, (_, i) => addDays(start, i));
export const shiftWeek = (start: string, weeks: number): string => addDays(start, weeks * 7);
export const isWeekend = (iso: string): boolean => weekday(iso) === 0 || weekday(iso) === 6;
export const WEEKDAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
export const WEEKDAY_NAMES = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
export const weekdayName = (iso: string): string => WEEKDAY_NAMES[(weekday(iso) + 6) % 7]!;

/** Le jour est dans la fenêtre de saisie de celui qui déclare (courte pour soi, plus large pour la RH). */
export function inWindow(day: string, today: string, forAll: boolean): boolean {
  const window = forAll ? HR_WINDOW : SELF_WINDOW;
  const offset = ordinal(day) - ordinal(today);
  return offset >= -window.past && offset <= window.future;
}

/** Peut-on saisir ou modifier cette case ? Soi-même ou, pour la RH, n'importe qui ; jamais sur un jour d'absence validée ; dans la fenêtre de saisie. */
export function canEditCell(board: Pick<PresenceBoard, 'viewerEmployeeId' | 'canDeclareForAll'>, row: Pick<PresenceRow, 'employeeId' | 'leaveDays'>, day: string, today: string): boolean {
  const mine = board.viewerEmployeeId !== null && board.viewerEmployeeId === row.employeeId;
  if (!mine && !board.canDeclareForAll) return false;
  if (row.leaveDays.includes(day)) return false;
  return inWindow(day, today, board.canDeclareForAll);
}

export type Cell = { kind: 'leave' } | { kind: 'mode'; mode: PresenceMode } | { kind: 'none' };
export function cellOf(row: Pick<PresenceRow, 'entries' | 'leaveDays'>, day: string): Cell {
  // Un week-end au milieu d'une absence n'est pas une journée d'absence (comme dans le calendrier des absences) : la case reste neutre.
  if (row.leaveDays.includes(day) && !isWeekend(day)) return { kind: 'leave' };
  const entry = row.entries.find((e) => e.day === day);
  return entry ? { kind: 'mode', mode: entry.mode } : { kind: 'none' };
}

/** Pour chaque jour, combien de personnes sont sur site, en télétravail, en déplacement, absentes. */
export function dayTotals(rows: readonly PresenceRow[], day: string): Record<PresenceMode | 'LEAVE', number> {
  const totals = { ON_SITE: 0, REMOTE: 0, TRAVEL: 0, LEAVE: 0 };
  for (const row of rows) {
    const cell = cellOf(row, day);
    if (cell.kind === 'leave') totals.LEAVE += 1;
    else if (cell.kind === 'mode') totals[cell.mode] += 1;
  }
  return totals;
}
