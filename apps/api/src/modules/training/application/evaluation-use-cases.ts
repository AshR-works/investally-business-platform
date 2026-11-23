import { Inject, Injectable } from '@nestjs/common';
import { ActorContext, CLOCK, Clock, DomainError, ID_GENERATOR, IdGenerator, UNIT_OF_WORK, UnitOfWork } from '../../../shared-kernel';
import { AUDIT_RECORDER, AuditAction, AuditRecorder } from '../../audit';
import { decideFor } from '../../iam';
import type { AccessContext } from '../../iam';
import { ATTENDANCE_REPOSITORY, AttendanceRepository } from '../domain/attendance-repositories';
import { computeEligibility, Evaluation, validateTrainingThresholds } from '../domain/evaluation';
import { EVALUATION_REPOSITORY, EvaluationRepository, TRAINING_THRESHOLDS_REPOSITORY, TrainingThresholdsRepository } from '../domain/evaluation-repositories';
import { ENROLLMENT_REPOSITORY, EnrollmentRepository, LEARNER_REPOSITORY, LearnerRepository } from '../domain/enrollment-repositories';
import { workingDaysBetween } from '../domain/session-dates';
import { SESSION_REPOSITORY, SessionRepository } from '../domain/session-repositories';
import { EvaluationSheetView, EvaluationView, toEvaluationView, toTrainingThresholdsView, TrainingThresholdsView } from './evaluation-view';

const SESSION_NOT_FOUND = 'Session introuvable';
const ENROLLMENT_NOT_FOUND = 'Inscription introuvable';

export interface RecordEvaluationCommand {
  sessionId: string;
  enrollmentId: string;
  score: number;
  access: AccessContext;
  actor: ActorContext;
}

/**
 * Saisit (ou corrige) la note d'un inscrit confirmé (S5.3b). Jamais le formateur (externe, sans accès à l'application, FD-11 B, même
 * règle que les présences, S1) : la permission `training.evaluation.record` n'est tenue que par le responsable Investudy et le Super
 * administrateur. Figée dès que la session est clôturée (il faut la rouvrir, S7).
 */
@Injectable()
export class RecordEvaluationUseCase {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(ENROLLMENT_REPOSITORY) private readonly enrollments: EnrollmentRepository,
    @Inject(EVALUATION_REPOSITORY) private readonly evaluations: EvaluationRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(command: RecordEvaluationCommand): Promise<EvaluationView> {
    return this.unitOfWork.run(async () => {
      const session = await this.sessions.findById(command.sessionId);
      if (!session) throw new DomainError('NOT_FOUND', SESSION_NOT_FOUND);
      const enrollment = await this.enrollments.findById(command.enrollmentId);
      if (!enrollment || enrollment.sessionId !== session.id) throw new DomainError('NOT_FOUND', ENROLLMENT_NOT_FOUND);
      if (enrollment.status !== 'CONFIRMED') throw new DomainError('INVARIANT_VIOLATION', 'Seuls les inscrits confirmés ont une évaluation');
      if (session.status === 'CLOSED') throw new DomainError('INVARIANT_VIOLATION', 'La session est clôturée : les évaluations sont figées (il faut la rouvrir)');

      const existing = await this.evaluations.find(enrollment.id);
      const now = this.clock.now();
      if (existing) {
        if (existing.score === command.score) return toEvaluationView(existing);
        const before = toEvaluationView(existing);
        existing.change({ score: command.score, by: command.access.actorId, now });
        await this.evaluations.save(existing);
        const after = toEvaluationView(existing);
        await this.audit.record({ actor: command.actor, module: 'training', entityType: 'Evaluation', entityId: existing.id, action: AuditAction.Update, oldValue: { ...before }, newValue: { ...after } });
        return after;
      }
      const created = Evaluation.record({ id: this.ids.next(), enrollmentId: enrollment.id, score: command.score, recordedByUserId: command.access.actorId, now });
      await this.evaluations.save(created);
      const view = toEvaluationView(created);
      await this.audit.record({ actor: command.actor, module: 'training', entityType: 'Evaluation', entityId: created.id, action: AuditAction.Create, newValue: { ...view } });
      return view;
    });
  }
}

/** Taux de présence (S3 : un retard compte comme présent), arrondi à deux décimales ; 0 si la session n'a aucun jour de cours. */
export function attendanceRateOf(entries: readonly { status: string }[], totalDays: number): number {
  if (totalDays === 0) return 0;
  const counted = entries.filter((e) => e.status === 'PRESENT' || e.status === 'LATE').length;
  return Math.round((counted / totalDays) * 10_000) / 100;
}

/**
 * Feuille d'évaluation d'une session (S5.3b) : un inscrit CONFIRMÉ par ligne, sa note (si saisie), son taux de présence et la suggestion
 * d'éligibilité **calculée** (CU-I-60) — jamais délivrée ici (lot c). Lue par le responsable Investudy et la Direction (portée « Tous »).
 */
@Injectable()
export class GetEvaluationSheetHandler {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(ENROLLMENT_REPOSITORY) private readonly enrollments: EnrollmentRepository,
    @Inject(LEARNER_REPOSITORY) private readonly learners: LearnerRepository,
    @Inject(EVALUATION_REPOSITORY) private readonly evaluations: EvaluationRepository,
    @Inject(ATTENDANCE_REPOSITORY) private readonly attendances: AttendanceRepository,
    @Inject(TRAINING_THRESHOLDS_REPOSITORY) private readonly thresholds: TrainingThresholdsRepository,
  ) {}

  async execute(query: { sessionId: string }): Promise<EvaluationSheetView> {
    const session = await this.sessions.findById(query.sessionId);
    if (!session) throw new DomainError('NOT_FOUND', SESSION_NOT_FOUND);
    const confirmed = await this.enrollments.listConfirmed(session.id);
    const names = await this.learners.namesOf(confirmed.map((e) => e.learnerId));
    const evaluations = await this.evaluations.bySession(confirmed.map((e) => e.id));
    const attendanceEntries = await this.attendances.bySession(confirmed.map((e) => e.id));
    const totalDays = workingDaysBetween(session.startDate, session.endDate).length;
    const thresholds = await this.thresholds.get();

    const rows = confirmed.map((enrollment) => {
      const evaluation = evaluations.find((e) => e.enrollmentId === enrollment.id) ?? null;
      const attendanceRatePercent = attendanceRateOf(attendanceEntries.filter((a) => a.enrollmentId === enrollment.id), totalDays);
      const score = evaluation?.score ?? null;
      return {
        enrollmentId: enrollment.id, learnerId: enrollment.learnerId, learnerName: names.get(enrollment.learnerId) ?? '',
        score, attendanceRatePercent, suggestion: computeEligibility({ attendanceRatePercent, score, thresholds }),
      };
    });
    rows.sort((a, b) => a.learnerName.localeCompare(b.learnerName, 'fr') || a.enrollmentId.localeCompare(b.enrollmentId));

    return { sessionId: session.id, sessionStatus: session.status, rows, canRecord: session.status !== 'CLOSED' };
  }
}

/** Portée accordée pour une permission (aucun objet précis), `null` si elle n'est pas accordée. */
function scopeOf(access: AccessContext, permission: string): string | null {
  const decision = decideFor(access, permission, undefined);
  return decision.allowed ? decision.scope : null;
}

const requireManage = (access: AccessContext): void => {
  if (scopeOf(access, 'training.evaluation.manage') === null) throw new DomainError('FORBIDDEN', "Vous n'avez pas le droit de modifier les seuils d'éligibilité");
};

/** Lecture des seuils d'éligibilité (S5, D31) : valeurs de départ « à confirmer », paramétrables. */
@Injectable()
export class GetTrainingThresholdsHandler {
  constructor(@Inject(TRAINING_THRESHOLDS_REPOSITORY) private readonly thresholds: TrainingThresholdsRepository) {}

  async execute(query: { access: AccessContext }): Promise<TrainingThresholdsView> {
    if (scopeOf(query.access, 'training.evaluation.read') === null) throw new DomainError('FORBIDDEN', "Vous n'avez pas le droit de voir les seuils d'éligibilité");
    return toTrainingThresholdsView(await this.thresholds.get());
  }
}

/** Modifie les seuils d'éligibilité, avec verrou optimiste et trace d'audit (comme les réglages de congés). */
@Injectable()
export class UpdateTrainingThresholdsUseCase {
  constructor(
    @Inject(TRAINING_THRESHOLDS_REPOSITORY) private readonly thresholds: TrainingThresholdsRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: { version: number; attendanceThresholdPercent: number; scoreThreshold: number; access: AccessContext; actor: ActorContext }): Promise<TrainingThresholdsView> {
    return this.unitOfWork.run(async () => {
      requireManage(command.access);
      validateTrainingThresholds(command);
      const current = await this.thresholds.get();
      if (current.version !== command.version) throw new DomainError('CONFLICT', "Les seuils d'éligibilité ont été modifiés par un autre utilisateur : rechargez-les");
      await this.thresholds.save({ attendanceThresholdPercent: command.attendanceThresholdPercent, scoreThreshold: command.scoreThreshold, version: current.version });
      const after = toTrainingThresholdsView(await this.thresholds.get());
      await this.audit.record({ actor: command.actor, module: 'training', entityType: 'TrainingThresholds', entityId: '1', action: AuditAction.Update, oldValue: { ...toTrainingThresholdsView(current) }, newValue: { ...after } });
      return after;
    });
  }
}
