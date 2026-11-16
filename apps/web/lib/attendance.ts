/** Présences aux séances d'une session (S5.3a) : une valeur parmi trois par inscrit confirmé et par jour de cours. Aucune heure, aucun texte libre. */

export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT';

export const STATUS_OPTIONS: { code: AttendanceStatus; label: string; symbol: string }[] = [
  { code: 'PRESENT', label: 'Présent', symbol: '✓' },
  { code: 'LATE', label: 'En retard', symbol: '⏱' },
  { code: 'ABSENT', label: 'Absent', symbol: '✕' },
];

export const statusLabel = (status: string): string => STATUS_OPTIONS.find((s) => s.code === status)?.label ?? status;
export const statusSymbol = (status: string): string => STATUS_OPTIONS.find((s) => s.code === status)?.symbol ?? '?';

export interface AttendanceSheetRow {
  enrollmentId: string;
  learnerId: string;
  learnerName: string;
  entries: { day: string; status: AttendanceStatus }[];
}

export interface AttendanceSheet {
  sessionId: string;
  sessionStatus: string;
  /** Un jour de cours par séance, du début à la fin de la session (lundi–vendredi). */
  days: string[];
  rows: AttendanceSheetRow[];
  /** La session n'est pas clôturée : la saisie reste possible (sinon figée, il faut la rouvrir). */
  canRecord: boolean;
}

export function entryOf(row: AttendanceSheetRow, day: string): AttendanceStatus | null {
  return row.entries.find((e) => e.day === day)?.status ?? null;
}
