import { Attendance } from '../../src/modules/training/domain/attendance';
import { AttendanceRepository } from '../../src/modules/training/domain/attendance-repositories';

/** Présences aux séances en mémoire : une par inscription et par jour. Les versions ne sont pas incrémentées (travail de la base). */
export class InMemoryAttendances implements AttendanceRepository {
  readonly items: Attendance[] = [];

  async save(attendance: Attendance) {
    if (!this.items.includes(attendance)) this.items.push(attendance);
  }
  async find(enrollmentId: string, day: string) { return this.items.find((a) => a.enrollmentId === enrollmentId && a.day === day) ?? null; }
  async bySession(enrollmentIds: readonly string[]) {
    return this.items
      .filter((a) => enrollmentIds.includes(a.enrollmentId))
      .sort((a, b) => a.day.localeCompare(b.day) || a.enrollmentId.localeCompare(b.enrollmentId));
  }
}
