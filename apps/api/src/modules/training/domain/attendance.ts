import { AggregateRoot, DomainError } from '../../../shared-kernel';
import { isWorkingDay } from './session-dates';

/**
 * Présence à une séance (S5.3a, ADR-0016). Une valeur parmi trois, par inscription CONFIRMÉE et par jour de la session : ni heure, ni
 * retard chiffré, ni texte libre (S2). Saisie par le responsable Investudy, jamais par le formateur (externe, sans accès à l'application,
 * FD-11 B). Correction possible tant que la session n'est pas clôturée (figée ensuite, sauf réouverture dédiée, S7).
 */
export enum AttendanceStatus {
  Present = 'PRESENT',
  Late = 'LATE',
  Absent = 'ABSENT',
}

/** Doit rester identique à la liste de l'interface de programmation (vérifié par `attendance.spec.ts`). */
export const ATTENDANCE_STATUSES: readonly AttendanceStatus[] = [AttendanceStatus.Present, AttendanceStatus.Late, AttendanceStatus.Absent];

export function parseAttendanceStatus(raw: string): AttendanceStatus {
  if (!ATTENDANCE_STATUSES.includes(raw as AttendanceStatus)) throw new DomainError('VALIDATION', 'La présence doit être : présent, en retard ou absent');
  return raw as AttendanceStatus;
}

/** Le jour doit être un jour de cours (lundi–vendredi) compris dans la période [start, end] de la session (bornes incluses). */
export function assertDayWithinSession(day: string, start: string, end: string): void {
  if (day < start || day > end) throw new DomainError('VALIDATION', 'Ce jour est hors de la période de la session');
  if (!isWorkingDay(day)) throw new DomainError('VALIDATION', 'Ce jour n\'est pas un jour de cours (du lundi au vendredi)');
}

export interface AttendanceProps {
  id: string;
  enrollmentId: string;
  day: string;
  status: AttendanceStatus;
  recordedByUserId: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export class Attendance extends AggregateRoot {
  private constructor(private props: AttendanceProps) {
    super();
  }

  static record(input: { id: string; enrollmentId: string; day: string; status: string; recordedByUserId: string; now: Date }): Attendance {
    return new Attendance({
      id: input.id, enrollmentId: input.enrollmentId, day: input.day, status: parseAttendanceStatus(input.status), recordedByUserId: input.recordedByUserId,
      createdAt: input.now, updatedAt: input.now, version: 1,
    });
  }

  static rehydrate(props: AttendanceProps): Attendance {
    return new Attendance(props);
  }

  /** Corrige la présence du jour ; l'auteur de la dernière saisie est conservé (pas l'auteur d'origine). */
  change(input: { status: string; by: string; now: Date }): void {
    this.props = { ...this.props, status: parseAttendanceStatus(input.status), recordedByUserId: input.by, updatedAt: input.now };
  }

  get id(): string { return this.props.id; }
  get enrollmentId(): string { return this.props.enrollmentId; }
  get day(): string { return this.props.day; }
  get status(): AttendanceStatus { return this.props.status; }
  get recordedByUserId(): string { return this.props.recordedByUserId; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
  get version(): number { return this.props.version; }
}
