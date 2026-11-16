import { Attendance } from './attendance';

/** Port de persistance des présences aux séances (une par inscription et par jour). */
export interface AttendanceRepository {
  /** Crée ou met à jour ; une seconde saisie du même jour (même inscription) est un conflit : la base garantit l'unicité. */
  save(attendance: Attendance): Promise<void>;
  find(enrollmentId: string, day: string): Promise<Attendance | null>;
  /** Toutes les présences saisies pour ces inscriptions (une session entière). Tri : jour, puis inscription. */
  bySession(enrollmentIds: readonly string[]): Promise<Attendance[]>;
}

export const ATTENDANCE_REPOSITORY = Symbol('AttendanceRepository');
