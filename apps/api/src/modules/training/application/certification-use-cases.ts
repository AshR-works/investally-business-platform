import { Inject, Injectable } from '@nestjs/common';
import { ActorContext, CLOCK, Clock, DomainError, ID_GENERATOR, IdGenerator, UNIT_OF_WORK, UnitOfWork } from '../../../shared-kernel';
import { AUDIT_RECORDER, AuditAction, AuditRecorder } from '../../audit';
import { COMPANY_DIRECTORY } from '../../business-development';
import type { CompanyDirectory } from '../../business-development';
import { visibilityFor } from '../../iam';
import type { AccessContext } from '../../iam';
import { ATTENDANCE_REPOSITORY, AttendanceRepository } from '../domain/attendance-repositories';
import { AmbassadorSuggestion } from '../domain/ambassador-suggestion';
import { AMBASSADOR_SUGGESTION_REPOSITORY, AmbassadorSuggestionRepository, CERTIFICATION_REPOSITORY, CertificationRepository } from '../domain/certification-repositories';
import { Certification } from '../domain/certification';
import { computeEligibility } from '../domain/evaluation';
import { EVALUATION_REPOSITORY, EvaluationRepository, TRAINING_THRESHOLDS_REPOSITORY, TrainingThresholdsRepository } from '../domain/evaluation-repositories';
import { ENROLLMENT_REPOSITORY, EnrollmentRepository, LEARNER_REPOSITORY, LearnerRepository } from '../domain/enrollment-repositories';
import { workingDaysBetween } from '../domain/session-dates';
import { SESSION_REPOSITORY, SessionRepository } from '../domain/session-repositories';
import { TRAINER_REPOSITORY, TrainerRepository } from '../domain/catalogue-repositories';
import { attendanceRateOf } from './evaluation-use-cases';
import { AmbassadorSuggestionView, CertificationSheetView, CertificationView, toAmbassadorSuggestionView, toCertificationView } from './certification-view';

const SESSION_NOT_FOUND = 'Session introuvable';
const ENROLLMENT_NOT_FOUND = 'Inscription introuvable';
const CERTIFICATION_NOT_FOUND = 'Délivrance introuvable';

export interface IssueCertificationCommand {
  sessionId: string;
  enrollmentId: string;
  kind: string;
  access: AccessContext;
  actor: ActorContext;
}

/**
 * Délivre un certificat ou une attestation à un inscrit confirmé (CU-I-60, S5.3c). Seulement une fois la session **clôturée** ; le
 * type délivré doit être couvert par les seuils atteints (jamais un certificat sans la note, jamais rien sans la présence) ;
 * **suggéré puis délivré à la main**, jamais automatique (S6). Une délivrance à un apprenant d'entreprise crée une suggestion
 * d'ambassadeur pour le chargé de compte (CU-I-62) — jamais de lecture des certifications pour lui (S8).
 */
@Injectable()
export class IssueCertificationUseCase {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(ENROLLMENT_REPOSITORY) private readonly enrollments: EnrollmentRepository,
    @Inject(EVALUATION_REPOSITORY) private readonly evaluations: EvaluationRepository,
    @Inject(ATTENDANCE_REPOSITORY) private readonly attendances: AttendanceRepository,
    @Inject(TRAINING_THRESHOLDS_REPOSITORY) private readonly thresholds: TrainingThresholdsRepository,
    @Inject(CERTIFICATION_REPOSITORY) private readonly certifications: CertificationRepository,
    @Inject(AMBASSADOR_SUGGESTION_REPOSITORY) private readonly suggestions: AmbassadorSuggestionRepository,
    @Inject(COMPANY_DIRECTORY) private readonly directory: CompanyDirectory,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(command: IssueCertificationCommand): Promise<CertificationView> {
    return this.unitOfWork.run(async () => {
      const session = await this.sessions.findById(command.sessionId);
      if (!session) throw new DomainError('NOT_FOUND', SESSION_NOT_FOUND);
      if (session.status !== 'CLOSED') throw new DomainError('INVARIANT_VIOLATION', 'La session doit être clôturée avant de délivrer un certificat ou une attestation');
      const enrollment = await this.enrollments.findById(command.enrollmentId);
      if (!enrollment || enrollment.sessionId !== session.id) throw new DomainError('NOT_FOUND', ENROLLMENT_NOT_FOUND);
      if (enrollment.status !== 'CONFIRMED') throw new DomainError('INVARIANT_VIOLATION', 'Seuls les inscrits confirmés peuvent recevoir un certificat ou une attestation');
      if (await this.certifications.find(enrollment.id)) throw new DomainError('INVARIANT_VIOLATION', 'Une délivrance existe déjà pour cette inscription (la révoquer avant d’en délivrer une autre)');

      const [evaluation, attendanceEntries] = await Promise.all([
        this.evaluations.find(enrollment.id),
        this.attendances.bySession([enrollment.id]),
      ]);
      const totalDays = workingDaysBetween(session.startDate, session.endDate).length;
      const attendanceRatePercent = attendanceRateOf(attendanceEntries, totalDays);
      const eligibility = computeEligibility({ attendanceRatePercent, score: evaluation?.score ?? null, thresholds: await this.thresholds.get() });
      if (eligibility === 'NONE' || (command.kind === 'CERTIFICATE' && eligibility !== 'CERTIFICATE')) {
        throw new DomainError('INVARIANT_VIOLATION', 'Les seuils d’éligibilité ne sont pas atteints pour ce type de délivrance (voir la feuille d’évaluation)');
      }

      const now = this.clock.now();
      const created = Certification.issue({
        id: this.ids.next(), enrollmentId: enrollment.id, kind: command.kind, referenceNumber: await this.certifications.nextReferenceNumber(), issuedByUserId: command.access.actorId, now,
      });
      await this.certifications.save(created);
      const view = toCertificationView(created);
      await this.audit.record({ actor: command.actor, module: 'training', entityType: 'Certification', entityId: created.id, action: AuditAction.Create, newValue: { ...view } });

      if (enrollment.companyId) {
        const company = await this.directory.company(enrollment.companyId);
        if (company?.ownerUserId) {
          const suggestion = AmbassadorSuggestion.create({ id: this.ids.next(), enrollmentId: enrollment.id, learnerId: enrollment.learnerId, companyId: enrollment.companyId, ownerUserId: company.ownerUserId, now });
          await this.suggestions.save(suggestion);
          await this.audit.record({ actor: command.actor, module: 'training', entityType: 'AmbassadorSuggestion', entityId: suggestion.id, action: AuditAction.Create, newValue: { ...toAmbassadorSuggestionView(suggestion) } });
        }
      }
      return view;
    });
  }
}

export interface RevokeCertificationCommand {
  sessionId: string;
  enrollmentId: string;
  reason: string;
  access: AccessContext;
  actor: ActorContext;
}

/** Révoque une délivrance, avec justification obligatoire (CU-I-61) : le document reste consultable, marqué révoqué. */
@Injectable()
export class RevokeCertificationUseCase {
  constructor(
    @Inject(CERTIFICATION_REPOSITORY) private readonly certifications: CertificationRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: RevokeCertificationCommand): Promise<CertificationView> {
    return this.unitOfWork.run(async () => {
      const certification = await this.certifications.find(command.enrollmentId);
      if (!certification) throw new DomainError('NOT_FOUND', CERTIFICATION_NOT_FOUND);
      const before = toCertificationView(certification);
      certification.revoke({ reason: command.reason, by: command.access.actorId, now: this.clock.now() });
      await this.certifications.save(certification);
      const after = toCertificationView(certification);
      await this.audit.record({ actor: command.actor, module: 'training', entityType: 'Certification', entityId: certification.id, action: AuditAction.Update, oldValue: { ...before }, newValue: { ...after } });
      return after;
    });
  }
}

/** Feuille des délivrances d'une session (S5.3c) : un inscrit CONFIRMÉ par ligne, sa certification si elle existe. */
@Injectable()
export class GetCertificationSheetHandler {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(ENROLLMENT_REPOSITORY) private readonly enrollments: EnrollmentRepository,
    @Inject(LEARNER_REPOSITORY) private readonly learners: LearnerRepository,
    @Inject(CERTIFICATION_REPOSITORY) private readonly certifications: CertificationRepository,
    @Inject(TRAINER_REPOSITORY) private readonly trainers: TrainerRepository,
    @Inject(COMPANY_DIRECTORY) private readonly directory: CompanyDirectory,
  ) {}

  /**
   * Hors portée = « introuvable » pour la session elle-même (formateur Own, une session qui n'est pas la sienne, comme pour la lecture
   * d'une session) ; pour une portée par entreprise (ex. Responsable commercial, Équipe), un inscrit hors portée est simplement absent
   * de la feuille, jamais un « introuvable » global — la session reste visible (`training.session.read` l'est déjà pour ces rôles).
   */
  async execute(query: { sessionId: string; access: AccessContext }): Promise<CertificationSheetView> {
    const session = await this.sessions.findById(query.sessionId);
    if (!session) throw new DomainError('NOT_FOUND', SESSION_NOT_FOUND);
    const visibility = visibilityFor(query.access, 'training.certification.read');
    let confirmed = await this.enrollments.listConfirmed(session.id);
    if (!visibility.unrestricted) {
      const trainer = await this.trainers.findById(session.trainerId);
      const trainerLinked = Boolean(trainer?.userId) && visibility.ownerIds.includes(trainer!.userId!);
      if (!trainerLinked) {
        const sessionVisibility = visibilityFor(query.access, 'training.session.read');
        if (!sessionVisibility.unrestricted) {
          const sessionTrainerLinked = Boolean(trainer?.userId) && sessionVisibility.ownerIds.includes(trainer!.userId!);
          if (!sessionTrainerLinked) throw new DomainError('NOT_FOUND', SESSION_NOT_FOUND);
        }
        const ownedCompanyIds = new Set(await this.directory.companyIdsOwnedBy(visibility.ownerIds));
        confirmed = confirmed.filter((e) => e.companyId && ownedCompanyIds.has(e.companyId));
      }
    }
    const names = await this.learners.namesOf(confirmed.map((e) => e.learnerId));
    const certifications = await this.certifications.bySession(confirmed.map((e) => e.id));

    const rows = confirmed.map((enrollment) => ({
      enrollmentId: enrollment.id, learnerId: enrollment.learnerId, learnerName: names.get(enrollment.learnerId) ?? '',
      certification: (() => { const c = certifications.find((x) => x.enrollmentId === enrollment.id); return c ? toCertificationView(c) : null; })(),
    }));
    rows.sort((a, b) => a.learnerName.localeCompare(b.learnerName, 'fr') || a.enrollmentId.localeCompare(b.enrollmentId));

    return { sessionId: session.id, sessionStatus: session.status, rows, canIssue: session.status === 'CLOSED' };
  }
}

/** Suggestions d'ambassadeur du chargé de compte (CU-I-62, S8) : jamais de lecture des certifications depuis cette liste. */
@Injectable()
export class GetAmbassadorSuggestionsHandler {
  constructor(@Inject(AMBASSADOR_SUGGESTION_REPOSITORY) private readonly suggestions: AmbassadorSuggestionRepository) {}

  async execute(query: { access: AccessContext }): Promise<AmbassadorSuggestionView[]> {
    const visibility = visibilityFor(query.access, 'bd.ambassador.read');
    if (!visibility.unrestricted && visibility.ownerIds.length === 0) throw new DomainError('FORBIDDEN', "Vous n'avez pas le droit de voir les suggestions d'ambassadeur");
    const rows = await this.suggestions.forOwners(visibility.unrestricted ? 'all' : visibility.ownerIds);
    return rows.map(toAmbassadorSuggestionView);
  }
}
