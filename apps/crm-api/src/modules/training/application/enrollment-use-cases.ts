import { Inject, Injectable } from '@nestjs/common';
import { ActorContext, CLOCK, Clock, DomainError, ID_GENERATOR, IdGenerator, Page, UNIT_OF_WORK, UnitOfWork } from '../../../shared-kernel';
import { AUDIT_RECORDER, AuditAction, AuditRecorder } from '../../audit';
import { COMPANY_DIRECTORY } from '../../business-development';
import type { CompanyDirectory } from '../../business-development';
import { decideFor, visibilityFor } from '../../iam';
import type { AccessContext } from '../../iam';
import { ROOM_REPOSITORY, RoomRepository, TRAINING_REPOSITORY, TrainingRepository } from '../domain/catalogue-repositories';
import { assertApprovalCovers, assertApprovalValid } from '../domain/approval-cover';
import { Enrollment, EnrollmentStatus } from '../domain/enrollment';
import { ENROLLMENT_REPOSITORY, EnrollmentRepository, LEARNER_REPOSITORY, LearnerRepository } from '../domain/enrollment-repositories';
import { Learner } from '../domain/learner';
import { amountLabel, toCents } from '../domain/money';
import { SESSION_REPOSITORY, SessionRepository } from '../domain/session-repositories';
import { TrainingSession } from '../domain/training-session';
import { assertVersion, normalizePage } from './catalogue-use-cases';
import { ApprovalOptionView, EnrollmentContext, EnrollmentView, toEnrollmentView } from './enrollment-view';
import { learnerInScope } from './learner-use-cases';

const NOT_FOUND_ENROLLMENT = 'Inscription introuvable';
const NOT_FOUND_SESSION = 'Session introuvable';

/**
 * Compose la vue d'une inscription (certificat, dates et salle de la session, apprenant, entreprise, agrément) : une lecture de chaque objet
 * lié, mémorisée le temps d'un appel.
 */
@Injectable()
export class EnrollmentViews {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(TRAINING_REPOSITORY) private readonly trainings: TrainingRepository,
    @Inject(ROOM_REPOSITORY) private readonly rooms: RoomRepository,
    @Inject(LEARNER_REPOSITORY) private readonly learners: LearnerRepository,
    @Inject(COMPANY_DIRECTORY) private readonly directory: CompanyDirectory,
  ) {}

  async many(enrollments: readonly Enrollment[]): Promise<EnrollmentView[]> {
    const names = await this.learners.namesOf([...new Set(enrollments.map((e) => e.learnerId))]);
    const sessionContext = new Map<string, Promise<Pick<EnrollmentContext, 'trainingTitle' | 'sessionStart' | 'sessionEnd' | 'sessionStatus' | 'roomName'>>>();
    const companyNames = new Map<string, Promise<string>>();
    const approvalLabels = new Map<string, Promise<string>>();

    const sessionOf = (id: string) => {
      let found = sessionContext.get(id);
      if (!found) {
        found = (async () => {
          const session = await this.sessions.findById(id);
          if (!session) return { trainingTitle: '', sessionStart: '', sessionEnd: '', sessionStatus: '', roomName: '' };
          const [training, room] = await Promise.all([this.trainings.findById(session.trainingId), this.rooms.findById(session.roomId)]);
          return { trainingTitle: training?.title ?? '', sessionStart: session.startDate, sessionEnd: session.endDate, sessionStatus: session.status, roomName: room?.name ?? '' };
        })();
        sessionContext.set(id, found);
      }
      return found;
    };
    const companyOf = (id: string) => {
      let found = companyNames.get(id);
      if (!found) {
        found = this.directory.company(id).then((c) => c?.name ?? '');
        companyNames.set(id, found);
      }
      return found;
    };
    const approvalOf = (id: string) => {
      let found = approvalLabels.get(id);
      if (!found) {
        found = this.directory.approval(id).then((a) => {
          if (!a) return '';
          const cover = [a.places !== null ? `${a.places} place${a.places > 1 ? 's' : ''}` : null, a.amount !== null ? `${amountLabel(toCents(a.amount))} ${a.currency}` : null].filter(Boolean).join(' et ');
          return `Agrément ${a.receivedOn ? `du ${a.receivedOn}` : 'demandé'} : ${cover}`;
        });
        approvalLabels.set(id, found);
      }
      return found;
    };

    const views: EnrollmentView[] = [];
    for (const e of enrollments) {
      const [session, companyName, approvalLabel] = await Promise.all([sessionOf(e.sessionId), companyOf(e.companyId), approvalOf(e.approvalId)]);
      views.push(toEnrollmentView(e, { ...session, learnerName: names.get(e.learnerId) ?? '', companyName, approvalLabel }));
    }
    return views;
  }

  async of(enrollment: Enrollment): Promise<EnrollmentView> {
    return (await this.many([enrollment]))[0];
  }
}

/**
 * Règles d'admission d'une inscription (D47, D49) : session ouverte, apprenant pas déjà inscrit ni occupé sur une session qui recouvre,
 * place libre (D-INS-3 A), agrément valide et assez large (D-INS-1 A, D-INS-2 A). La session doit avoir été verrouillée par l'appelant.
 */
@Injectable()
export class EnrollmentRules {
  constructor(
    @Inject(ENROLLMENT_REPOSITORY) private readonly enrollments: EnrollmentRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(TRAINING_REPOSITORY) private readonly trainings: TrainingRepository,
    @Inject(COMPANY_DIRECTORY) private readonly directory: CompanyDirectory,
  ) {}

  async admit(session: TrainingSession, learner: Learner, approvalId: string): Promise<{ chargedAmount: string | null }> {
    if (session.status === 'PLANNED') throw new DomainError('INVARIANT_VIOLATION', "La session n'est pas encore ouverte aux inscriptions");
    if (session.status === 'CANCELLED') throw new DomainError('INVARIANT_VIOLATION', 'La session est annulée');
    if (session.status === 'CLOSED') throw new DomainError('INVARIANT_VIOLATION', 'La session est clôturée');
    if (await this.enrollments.hasLive(session.id, learner.id)) throw new DomainError('CONFLICT', `${learner.fullName} est déjà inscrit(e) à cette session`);

    const overlap = await this.enrollments.findOverlap({ learnerId: learner.id, start: session.startDate, end: session.endDate });
    if (overlap) {
      const other = await this.sessions.findById(overlap.enrollment.sessionId);
      const training = other ? await this.trainings.findById(other.trainingId) : null;
      throw new DomainError('CONFLICT', `${learner.fullName} est déjà inscrit(e) à « ${training?.title ?? 'une autre session'} » du ${overlap.sessionStart} au ${overlap.sessionEnd}, qui recouvre cette session`);
    }

    const taken = await this.enrollments.countSeats(session.id);
    if (taken >= session.capacity) throw new DomainError('INVARIANT_VIOLATION', `La session est complète (${taken} place${taken > 1 ? 's' : ''} sur ${session.capacity})`);

    const approval = await this.directory.approval(approvalId);
    if (!approval || approval.companyId !== learner.companyId) throw new DomainError('NOT_FOUND', 'Agrément introuvable');
    await this.directory.lockApproval(approval.id);
    const training = await this.trainings.findById(session.trainingId);
    const pricing = training?.pricing ?? null;
    return assertApprovalCovers(approval, session.startDate, { fullPrice: pricing?.full ?? null, currency: pricing?.currency ?? null }, await this.enrollments.consumptionOf(approval.id));
  }
}

/** Inscription et son apprenant, visibles de l'appelant (la visibilité d'une inscription suit celle de l'entreprise de l'apprenant). */
async function enrollmentInScope(
  enrollments: EnrollmentRepository, directory: CompanyDirectory, id: string, access: AccessContext, permission: string,
): Promise<Enrollment> {
  const enrollment = await enrollments.findById(id);
  const company = enrollment ? await directory.company(enrollment.companyId) : null;
  if (!enrollment || !company || !decideFor(access, permission, company.ownerUserId).allowed) throw new DomainError('NOT_FOUND', NOT_FOUND_ENROLLMENT);
  return enrollment;
}

export interface EnrollCommand { sessionId: string; learnerId: string; approvalId: string; comment?: string | null; access: AccessContext; actor: ActorContext }
export interface ConfirmEnrollmentCommand { id: string; version: number; access: AccessContext; actor: ActorContext }
export interface CancelEnrollmentCommand { id: string; version: number; reason: string; access: AccessContext; actor: ActorContext }
export interface ReplaceEnrollmentCommand { id: string; version: number; sessionId: string; approvalId?: string; comment?: string | null; access: AccessContext; actor: ActorContext }

/** Inscrire un apprenant : portée de son entreprise (non archivée), session verrouillée puis contrôlée, agrément verrouillé puis contrôlé ; audit. */
@Injectable()
export class EnrollLearnerUseCase {
  constructor(
    @Inject(ENROLLMENT_REPOSITORY) private readonly enrollments: EnrollmentRepository,
    @Inject(LEARNER_REPOSITORY) private readonly learners: LearnerRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(COMPANY_DIRECTORY) private readonly directory: CompanyDirectory,
    private readonly rules: EnrollmentRules,
    private readonly views: EnrollmentViews,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  execute(command: EnrollCommand): Promise<EnrollmentView> {
    return this.unitOfWork.run(async () => {
      const { learner, company } = await learnerInScope(this.learners, this.directory, command.learnerId, command.access, 'training.enrollment.create');
      if (company.archived) throw new DomainError('INVARIANT_VIOLATION', "L'entreprise est archivée : on ne peut plus y inscrire d'apprenant");
      await this.enrollments.lockSession(command.sessionId);
      const session = await this.sessions.findById(command.sessionId);
      if (!session) throw new DomainError('NOT_FOUND', NOT_FOUND_SESSION);
      const { chargedAmount } = await this.rules.admit(session, learner, command.approvalId);
      const enrollment = Enrollment.create({
        id: this.ids.next(), sessionId: session.id, learnerId: learner.id, companyId: learner.companyId, approvalId: command.approvalId, chargedAmount, comment: command.comment, now: this.clock.now(),
      });
      await this.enrollments.save(enrollment);
      const view = await this.views.of(enrollment);
      await this.audit.record({ actor: command.actor, module: 'training', entityType: 'Enrollment', entityId: enrollment.id, action: AuditAction.Create, newValue: { ...view } });
      return view;
    });
  }
}

/** Confirmer une inscription (Responsable Investudy) : en attente seulement, session ouverte, agrément toujours valide ; audit. */
@Injectable()
export class ConfirmEnrollmentUseCase {
  constructor(
    @Inject(ENROLLMENT_REPOSITORY) private readonly enrollments: EnrollmentRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(COMPANY_DIRECTORY) private readonly directory: CompanyDirectory,
    private readonly views: EnrollmentViews,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  execute(command: ConfirmEnrollmentCommand): Promise<EnrollmentView> {
    return this.unitOfWork.run(async () => {
      const enrollment = await enrollmentInScope(this.enrollments, this.directory, command.id, command.access, 'training.enrollment.update');
      assertVersion(enrollment.version, command.version, "L'inscription");
      await this.enrollments.lockSession(enrollment.sessionId);
      const session = await this.sessions.findById(enrollment.sessionId);
      if (!session) throw new DomainError('NOT_FOUND', NOT_FOUND_SESSION);
      const before = await this.views.of(enrollment);
      enrollment.confirm(this.clock.now());
      if (session.status !== 'OPEN') throw new DomainError('INVARIANT_VIOLATION', 'La session n\'est plus ouverte aux inscriptions');
      const approval = await this.directory.approval(enrollment.approvalId);
      if (!approval) throw new DomainError('NOT_FOUND', 'Agrément introuvable');
      assertApprovalValid(approval, session.startDate);
      await this.enrollments.save(enrollment);
      const after = await this.views.of((await this.enrollments.findById(enrollment.id)) ?? enrollment);
      await this.audit.record({ actor: command.actor, module: 'training', entityType: 'Enrollment', entityId: enrollment.id, action: AuditAction.Update, oldValue: { ...before }, newValue: { ...after } });
      return after;
    });
  }
}

/** Annuler une inscription : motif obligatoire, libère la place et l'agrément ; impossible une fois la session clôturée ; audit. */
@Injectable()
export class CancelEnrollmentUseCase {
  constructor(
    @Inject(ENROLLMENT_REPOSITORY) private readonly enrollments: EnrollmentRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(COMPANY_DIRECTORY) private readonly directory: CompanyDirectory,
    private readonly views: EnrollmentViews,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  execute(command: CancelEnrollmentCommand): Promise<EnrollmentView> {
    return this.unitOfWork.run(async () => {
      const enrollment = await enrollmentInScope(this.enrollments, this.directory, command.id, command.access, 'training.enrollment.cancel');
      assertVersion(enrollment.version, command.version, "L'inscription");
      const session = await this.sessions.findById(enrollment.sessionId);
      if (session?.status === 'CLOSED') throw new DomainError('INVARIANT_VIOLATION', "Une inscription d'une session clôturée ne s'annule pas");
      const before = await this.views.of(enrollment);
      enrollment.cancel(command.reason);
      await this.enrollments.save(enrollment);
      const after = await this.views.of((await this.enrollments.findById(enrollment.id)) ?? enrollment);
      await this.audit.record({ actor: command.actor, module: 'training', entityType: 'Enrollment', entityId: enrollment.id, action: AuditAction.Update, oldValue: { ...before }, newValue: { ...after } });
      return after;
    });
  }
}

/**
 * Replacer une inscription sur une autre session ouverte (V13) : l'ancienne est annulée (elle libère sa place et l'agrément) puis une nouvelle
 * inscription en attente est créée avec les mêmes contrôles qu'une inscription ordinaire ; l'ancienne garde le lien vers la nouvelle. Si un
 * contrôle échoue, rien n'est changé (même transaction).
 */
@Injectable()
export class ReplaceEnrollmentUseCase {
  constructor(
    @Inject(ENROLLMENT_REPOSITORY) private readonly enrollments: EnrollmentRepository,
    @Inject(LEARNER_REPOSITORY) private readonly learners: LearnerRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(COMPANY_DIRECTORY) private readonly directory: CompanyDirectory,
    private readonly rules: EnrollmentRules,
    private readonly views: EnrollmentViews,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  execute(command: ReplaceEnrollmentCommand): Promise<EnrollmentView> {
    return this.unitOfWork.run(async () => {
      const old = await enrollmentInScope(this.enrollments, this.directory, command.id, command.access, 'training.enrollment.cancel');
      assertVersion(old.version, command.version, "L'inscription");
      if (old.status === 'CANCELLED') throw new DomainError('INVARIANT_VIOLATION', "L'inscription est annulée : inscrivez de nouveau l'apprenant");
      if (command.sessionId === old.sessionId) throw new DomainError('VALIDATION', 'Choisissez une autre session que celle de l\'inscription actuelle');
      const learner = await this.learners.findById(old.learnerId);
      if (!learner) throw new DomainError('INVARIANT_VIOLATION', "L'apprenant est supprimé : on ne peut plus le replacer");
      const oldSession = await this.sessions.findById(old.sessionId);
      if (oldSession?.status === 'CLOSED') throw new DomainError('INVARIANT_VIOLATION', "Une inscription d'une session clôturée ne se replace pas");
      await this.enrollments.lockSession(command.sessionId);
      const target = await this.sessions.findById(command.sessionId);
      if (!target) throw new DomainError('NOT_FOUND', NOT_FOUND_SESSION);

      const before = await this.views.of(old);
      old.cancel('Replacée sur une autre session');
      await this.enrollments.save(old);
      const approvalId = command.approvalId ?? old.approvalId;
      const { chargedAmount } = await this.rules.admit(target, learner, approvalId);
      const replacement = Enrollment.create({
        id: this.ids.next(), sessionId: target.id, learnerId: learner.id, companyId: learner.companyId, approvalId, chargedAmount, comment: command.comment, now: this.clock.now(),
      });
      await this.enrollments.save(replacement);
      const cancelled = (await this.enrollments.findById(old.id))!;
      cancelled.linkReplacement(replacement.id);
      await this.enrollments.save(cancelled);

      const afterOld = await this.views.of((await this.enrollments.findById(old.id)) ?? cancelled);
      await this.audit.record({ actor: command.actor, module: 'training', entityType: 'Enrollment', entityId: old.id, action: AuditAction.Update, oldValue: { ...before }, newValue: { ...afterOld } });
      const created = await this.views.of(replacement);
      await this.audit.record({ actor: command.actor, module: 'training', entityType: 'Enrollment', entityId: replacement.id, action: AuditAction.Create, newValue: { ...created, replaces: old.id } });
      return created;
    });
  }
}

/**
 * Les agrément de l'entreprise de l'apprenant qui peuvent (ou non, et pourquoi) couvrir son inscription à cette session : de quoi choisir en
 * connaissance de cause. Le Responsable Investudy n'a pas le droit de lire les agréments du module commercial : c'est ici qu'il les voit, juste
 * pour inscrire.
 */
@Injectable()
export class ListApprovalOptionsHandler {
  constructor(
    @Inject(ENROLLMENT_REPOSITORY) private readonly enrollments: EnrollmentRepository,
    @Inject(LEARNER_REPOSITORY) private readonly learners: LearnerRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(TRAINING_REPOSITORY) private readonly trainings: TrainingRepository,
    @Inject(COMPANY_DIRECTORY) private readonly directory: CompanyDirectory,
  ) {}

  async execute(query: { learnerId: string; sessionId: string; access: AccessContext }): Promise<ApprovalOptionView[]> {
    const { learner } = await learnerInScope(this.learners, this.directory, query.learnerId, query.access, 'training.enrollment.create');
    const session = await this.sessions.findById(query.sessionId);
    if (!session) throw new DomainError('NOT_FOUND', NOT_FOUND_SESSION);
    const pricing = (await this.trainings.findById(session.trainingId))?.pricing ?? null;
    const options: ApprovalOptionView[] = [];
    for (const approval of await this.directory.approvalsOf(learner.companyId)) {
      let reason: string | null = null;
      try {
        assertApprovalCovers(approval, session.startDate, { fullPrice: pricing?.full ?? null, currency: pricing?.currency ?? null }, await this.enrollments.consumptionOf(approval.id));
      } catch (error) {
        if (!(error instanceof DomainError)) throw error;
        reason = error.message;
      }
      const cover = [approval.places !== null ? `${approval.places} place${approval.places > 1 ? 's' : ''}` : null, approval.amount !== null ? `${amountLabel(toCents(approval.amount))} ${approval.currency}` : null].filter(Boolean).join(' et ');
      options.push({
        id: approval.id, label: `Agrément ${approval.receivedOn ? `du ${approval.receivedOn}` : 'demandé'} : ${cover}`, status: approval.status, places: approval.places, amount: approval.amount,
        currency: approval.currency, validUntil: approval.validUntil, receivedOn: approval.receivedOn, payerName: approval.payerName, eligible: reason === null, reason,
      });
    }
    return options;
  }
}

@Injectable()
export class GetEnrollmentHandler {
  constructor(
    @Inject(ENROLLMENT_REPOSITORY) private readonly enrollments: EnrollmentRepository,
    @Inject(COMPANY_DIRECTORY) private readonly directory: CompanyDirectory,
    private readonly views: EnrollmentViews,
  ) {}

  async execute(query: { id: string; access: AccessContext }): Promise<EnrollmentView> {
    return this.views.of(await enrollmentInScope(this.enrollments, this.directory, query.id, query.access, 'training.enrollment.read'));
  }
}

export interface ListEnrollmentsQuery {
  page: number; pageSize: number; sessionId?: string; learnerId?: string; companyId?: string; status?: EnrollmentStatus; access: AccessContext;
}

/** Liste paginée des inscriptions visibles ; filtrer par entreprise ou par apprenant exige qu'ils soient dans la portée (sinon « introuvable »). */
@Injectable()
export class ListEnrollmentsHandler {
  constructor(
    @Inject(ENROLLMENT_REPOSITORY) private readonly enrollments: EnrollmentRepository,
    @Inject(LEARNER_REPOSITORY) private readonly learners: LearnerRepository,
    @Inject(COMPANY_DIRECTORY) private readonly directory: CompanyDirectory,
    private readonly views: EnrollmentViews,
  ) {}

  async execute(query: ListEnrollmentsQuery): Promise<Page<EnrollmentView>> {
    if (query.companyId) {
      const company = await this.directory.company(query.companyId);
      if (!company || !decideFor(query.access, 'training.enrollment.read', company.ownerUserId).allowed) throw new DomainError('NOT_FOUND', 'Entreprise introuvable');
    }
    if (query.learnerId) await learnerInScope(this.learners, this.directory, query.learnerId, query.access, 'training.enrollment.read');
    const visibility = visibilityFor(query.access, 'training.enrollment.read');
    const result = await this.enrollments.list({
      ...normalizePage(query), sessionId: query.sessionId, learnerId: query.learnerId, companyId: query.companyId, status: query.status,
      ownerIds: visibility.unrestricted ? undefined : visibility.ownerIds,
    });
    return { ...result, items: await this.views.many(result.items) };
  }
}
