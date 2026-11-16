import { DomainError } from '../../../shared-kernel';
import { ATTENDANCE_STATUSES, Attendance, AttendanceStatus, assertDayWithinSession, parseAttendanceStatus } from './attendance';

const NOW = new Date('2026-11-06T09:00:00.000Z');

const expectError = (fn: () => unknown, code: string, message: RegExp) => {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe(code);
    expect((error as DomainError).message).toMatch(message);
    return;
  }
  throw new Error('une erreur de domaine était attendue');
};

describe('Statut de présence', () => {
  it('ne connaît que trois valeurs', () => {
    expect(ATTENDANCE_STATUSES).toEqual([AttendanceStatus.Present, AttendanceStatus.Late, AttendanceStatus.Absent]);
    expect(parseAttendanceStatus('PRESENT')).toBe(AttendanceStatus.Present);
    expectError(() => parseAttendanceStatus('EN_RETARD'), 'VALIDATION', /présent, en retard ou absent/);
  });
});

describe('Jour de la séance dans la session', () => {
  it('refuse un jour hors période ou un week-end', () => {
    expectError(() => assertDayWithinSession('2026-11-15', '2026-11-16', '2026-11-20'), 'VALIDATION', /hors de la période/);
    expectError(() => assertDayWithinSession('2026-11-21', '2026-11-16', '2026-11-20'), 'VALIDATION', /hors de la période/);
    expectError(() => assertDayWithinSession('2026-11-14', '2026-11-09', '2026-11-20'), 'VALIDATION', /jour de cours/); // samedi, dans la période
    expect(() => assertDayWithinSession('2026-11-18', '2026-11-16', '2026-11-20')).not.toThrow();
  });
});

describe('Présence à une séance', () => {
  it('se saisit, version 1, puis se corrige en gardant le dernier auteur', () => {
    const a = Attendance.record({ id: 'a1', enrollmentId: 'e1', day: '2026-11-18', status: 'PRESENT', recordedByUserId: 'u1', now: NOW });
    expect(a).toMatchObject({ enrollmentId: 'e1', day: '2026-11-18', status: AttendanceStatus.Present, recordedByUserId: 'u1', version: 1 });
    const later = new Date('2026-11-18T18:00:00Z');
    a.change({ status: 'LATE', by: 'u2', now: later });
    expect(a).toMatchObject({ status: AttendanceStatus.Late, recordedByUserId: 'u2', updatedAt: later });
  });

  it('refuse un statut hors liste, à la saisie comme à la correction', () => {
    expectError(() => Attendance.record({ id: 'a1', enrollmentId: 'e1', day: '2026-11-18', status: 'RETARD', recordedByUserId: 'u1', now: NOW }), 'VALIDATION', /présent, en retard ou absent/);
    const a = Attendance.record({ id: 'a1', enrollmentId: 'e1', day: '2026-11-18', status: 'PRESENT', recordedByUserId: 'u1', now: NOW });
    expectError(() => a.change({ status: 'RETARD', by: 'u1', now: NOW }), 'VALIDATION', /présent, en retard ou absent/);
  });
});
