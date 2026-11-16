import { Inject, Injectable } from '@nestjs/common';
import { ActorContext, CLOCK, Clock, DomainError, ID_GENERATOR, IdGenerator, UNIT_OF_WORK, UnitOfWork } from '../../../shared-kernel';
import { AUDIT_RECORDER, AuditAction, AuditRecorder } from '../../audit';
import type { AccessContext } from '../../iam';
import { Attendance, assertDayWithinSession } from '../domain/attendance';
import { ATTENDANCE_REPOSITORY, AttendanceRepository } from '../domain/attendance-repositories';
import { ENROLLMENT_REPOSITORY, EnrollmentRepository, LEARNER_REPOSITORY, LearnerRepository } from '../domain/enrollment-repositories';
import { workingDaysBetween } from '../domain/session-dates';
import { SESSION_REPOSITORY, SessionRepository } from '../domain/session-repositories';
import { AttendanceSheetView, AttendanceView, toAttendanceView } from './attendance-view';

const SESSION_NOT_FOUND = 'Session introuvable';
const ENROLLMENT_NOT_FOUND = 'Inscription introuvable';

export interface RecordAttendanceCommand {
  sessionId: string;
  enrollmentId: string;
  day: string;
  status: string;
  access: AccessContext;
  actor: ActorContext;
}

/**
 * Saisit (ou corrige) la présence d'un inscrit confirmé pour un jour de la session (S5.3a). Jamais le formateur (externe, sans accès à
 * l'application, FD-11 B) : la permission `training.attendance.record` n'est tenue que par le responsable Investudy et le Super
 * administrateur. Figée dès que la session est clôturée (il faut la rouvrir, S7).
 */
@Injectable()
export class RecordAttendanceUseCase {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(ENROLLMENT_REPOSITORY) private readonly enrollments: EnrollmentRepository,
    @Inject(ATTENDANCE_REPOSITORY) private readonly attendances: AttendanceRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(command: RecordAttendanceCommand): Promise<AttendanceView> {
    return this.unitOfWork.run(async () => {
      const session = await this.sessions.findById(command.sessionId);
      if (!session) throw new DomainError('NOT_FOUND', SESSION_NOT_FOUND);
      const enrollment = await this.enrollments.findById(command.enrollmentId);
      if (!enrollment || enrollment.sessionId !== session.id) throw new DomainError('NOT_FOUND', ENROLLMENT_NOT_FOUND);
      if (enrollment.status !== 'CONFIRMED') throw new DomainError('INVARIANT_VIOLATION', "Seuls les inscrits confirmés ont une feuille de présence");
      if (session.status === 'CLOSED') throw new DomainError('INVARIANT_VIOLATION', 'La session est clôturée : les présences sont figées (il faut la rouvrir)');
      assertDayWithinSession(command.day, session.startDate, session.endDate);

      const existing = await this.attendances.find(enrollment.id, command.day);
      const now = this.clock.now();
      if (existing) {
        if (existing.status === command.status) return toAttendanceView(existing);
        const before = toAttendanceView(existing);
        existing.change({ status: command.status, by: command.access.actorId, now });
        await this.attendances.save(existing);
        const after = toAttendanceView(existing);
        await this.audit.record({ actor: command.actor, module: 'training', entityType: 'Attendance', entityId: existing.id, action: AuditAction.Update, oldValue: { ...before }, newValue: { ...after } });
        return after;
      }
      const created = Attendance.record({ id: this.ids.next(), enrollmentId: enrollment.id, day: command.day, status: command.status, recordedByUserId: command.access.actorId, now });
      await this.attendances.save(created);
      const view = toAttendanceView(created);
      await this.audit.record({ actor: command.actor, module: 'training', entityType: 'Attendance', entityId: created.id, action: AuditAction.Create, newValue: { ...view } });
      return view;
    });
  }
}

/**
 * Feuille de présence d'une session : un inscrit CONFIRMÉ par ligne, une colonne par séance (jour de cours entre le début et la fin de la
 * session). Les jours sans entrée n'ont pas encore été saisis. Lue par le responsable Investudy et la Direction (portée « Tous »).
 */
@Injectable()
export class GetAttendanceSheetHandler {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(ENROLLMENT_REPOSITORY) private readonly enrollments: EnrollmentRepository,
    @Inject(LEARNER_REPOSITORY) private readonly learners: LearnerRepository,
    @Inject(ATTENDANCE_REPOSITORY) private readonly attendances: AttendanceRepository,
  ) {}

  async execute(query: { sessionId: string }): Promise<AttendanceSheetView> {
    const session = await this.sessions.findById(query.sessionId);
    if (!session) throw new DomainError('NOT_FOUND', SESSION_NOT_FOUND);
    const confirmed = await this.enrollments.listConfirmed(session.id);
    const names = await this.learners.namesOf(confirmed.map((e) => e.learnerId));
    const entries = await this.attendances.bySession(confirmed.map((e) => e.id));

    const rows = confirmed.map((enrollment) => ({
      enrollmentId: enrollment.id,
      learnerId: enrollment.learnerId,
      learnerName: names.get(enrollment.learnerId) ?? '',
      entries: entries.filter((a) => a.enrollmentId === enrollment.id).map((a) => ({ day: a.day, status: a.status })),
    }));
    rows.sort((a, b) => a.learnerName.localeCompare(b.learnerName, 'fr') || a.enrollmentId.localeCompare(b.enrollmentId));

    return { sessionId: session.id, sessionStatus: session.status, days: workingDaysBetween(session.startDate, session.endDate), rows, canRecord: session.status !== 'CLOSED' };
  }
}
