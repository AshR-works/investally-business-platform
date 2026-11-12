import { Inject, Injectable } from '@nestjs/common';
import { ActorContext, CLOCK, Clock, DomainError, ID_GENERATOR, IdGenerator, Page, UNIT_OF_WORK, UnitOfWork } from '../../../shared-kernel';
import { AUDIT_RECORDER, AuditAction, AuditRecorder } from '../../audit';
import { COMPANY_DIRECTORY } from '../../business-development';
import type { CompanyDirectory, CompanyRef } from '../../business-development';
import { decideFor, visibilityFor } from '../../iam';
import type { AccessContext } from '../../iam';
import { ENROLLMENT_REPOSITORY, EnrollmentRepository, LEARNER_REPOSITORY, LearnerRepository } from '../domain/enrollment-repositories';
import { Learner, LearnerKind } from '../domain/learner';
import { assertVersion, normalizePage } from './catalogue-use-cases';
import { LearnerView, toLearnerView } from './enrollment-view';

const NOT_FOUND_COMPANY = 'Entreprise introuvable';
const NOT_FOUND_LEARNER = 'Apprenant introuvable';

/** Entreprise visible de l'appelant pour cette permission, sinon « introuvable » (même réponse qu'un identifiant inexistant). */
export async function companyInScope(directory: CompanyDirectory, id: string, access: AccessContext, permission: string): Promise<CompanyRef> {
  const company = await directory.company(id);
  if (!company || !decideFor(access, permission, company.ownerUserId).allowed) throw new DomainError('NOT_FOUND', NOT_FOUND_COMPANY);
  return company;
}

/**
 * Apprenant et entreprise visibles de l'appelant : la visibilité d'un apprenant suit celle de son entreprise. Un étudiant ou un particulier n'a pas d'entreprise ni de
 * responsable commercial : il n'est visible que de ceux dont le droit couvre **tout** (portée Tous), sinon « introuvable » ; `company` est alors absente.
 */
export async function learnerInScope(
  learners: LearnerRepository, directory: CompanyDirectory, id: string, access: AccessContext, permission: string,
): Promise<{ learner: Learner; company: CompanyRef | null }> {
  const learner = await learners.findById(id);
  if (!learner) throw new DomainError('NOT_FOUND', NOT_FOUND_LEARNER);
  if (learner.isIndividual) {
    if (!decideFor(access, permission, null).allowed) throw new DomainError('NOT_FOUND', NOT_FOUND_LEARNER);
    return { learner, company: null };
  }
  const company = await directory.company(learner.companyId!);
  if (!company || !decideFor(access, permission, company.ownerUserId).allowed) throw new DomainError('NOT_FOUND', NOT_FOUND_LEARNER);
  return { learner, company };
}

function assertWritable(company: CompanyRef | null): void {
  if (company?.archived) throw new DomainError('INVARIANT_VIOLATION', "L'entreprise est archivée : ses apprenants ne sont plus modifiables");
}

async function assertContactOfCompany(directory: CompanyDirectory, contactId: string | null | undefined, companyId: string): Promise<void> {
  if (contactId && !(await directory.contactBelongsTo(contactId, companyId))) {
    throw new DomainError('VALIDATION', "Le contact choisi n'appartient pas à l'entreprise de l'apprenant");
  }
}

/** Un doublon probable (même entreprise, même nom ou même e-mail) est signalé par un conflit ; `allowDuplicate` permet de créer quand même. */
const DUPLICATE_SCOPE = (learner: Learner): string => (learner.companyId ? 'dans cette entreprise' : 'parmi les étudiants et les particuliers');

async function assertNoDuplicate(learners: LearnerRepository, learner: Learner, allowDuplicate: boolean | undefined, excludeId?: string): Promise<void> {
  if (allowDuplicate) return;
  const duplicates = await learners.findDuplicates({ companyId: learner.companyId, nameKey: learner.nameKey, emailKey: learner.emailKey, excludeId });
  if (duplicates.length > 0) {
    throw new DomainError('CONFLICT', `Un apprenant « ${duplicates[0].fullName} » existe déjà ${DUPLICATE_SCOPE(learner)} (même nom ou même e-mail)`);
  }
}

export interface RegisterLearnerCommand {
  /** Absent : un apprenant d'une entreprise (`COMPANY`) ; `STUDENT` ou `INDIVIDUAL` : sans entreprise. */
  kind?: LearnerKind; companyId?: string | null; lastName: string; firstName: string; email?: string | null; phone?: string | null; contactId?: string | null; allowDuplicate?: boolean;
  access: AccessContext; actor: ActorContext;
}
export interface UpdateLearnerCommand {
  id: string; version: number; lastName?: string; firstName?: string; email?: string | null; phone?: string | null; contactId?: string | null; allowDuplicate?: boolean;
  access: AccessContext; actor: ActorContext;
}

/**
 * Créer un apprenant : l'entreprise doit être dans la portée de l'appelant et non archivée ; contact de la même entreprise ; doublon signalé ; audit.
 * Un étudiant ou un particulier n'a ni entreprise ni contact : seuls ceux dont le droit couvre tout (portée Tous) l'inscrivent.
 */
@Injectable()
export class RegisterLearnerUseCase {
  constructor(
    @Inject(LEARNER_REPOSITORY) private readonly learners: LearnerRepository,
    @Inject(COMPANY_DIRECTORY) private readonly directory: CompanyDirectory,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  execute(command: RegisterLearnerCommand): Promise<LearnerView> {
    return this.unitOfWork.run(async () => {
      const kind = command.kind ?? 'COMPANY';
      let company: CompanyRef | null = null;
      if (kind === 'COMPANY') {
        if (!command.companyId) throw new DomainError('VALIDATION', "L'entreprise de l'apprenant est obligatoire");
        company = await companyInScope(this.directory, command.companyId, command.access, 'training.learner.create');
        assertWritable(company);
      } else if (command.companyId) {
        throw new DomainError('VALIDATION', "Un étudiant ou un particulier n'a pas d'entreprise");
      } else if (!decideFor(command.access, 'training.learner.create', null).allowed) {
        throw new DomainError('FORBIDDEN', "Seuls les profils qui gèrent tous les apprenants peuvent inscrire un étudiant ou un particulier");
      }
      const learner = Learner.create({ ...command, kind, companyId: company?.id ?? null, id: this.ids.next(), now: this.clock.now() });
      if (company) await assertContactOfCompany(this.directory, learner.contactId, company.id);
      await assertNoDuplicate(this.learners, learner, command.allowDuplicate);
      await this.learners.save(learner);
      const view = toLearnerView(learner, company?.name ?? '');
      await this.audit.record({ actor: command.actor, module: 'training', entityType: 'Learner', entityId: learner.id, action: AuditAction.Create, newValue: { ...view } });
      return view;
    });
  }
}

/** Modifier un apprenant : portée de son entreprise, version lue, doublon ; l'entreprise ne change pas ; audit avant/après. */
@Injectable()
export class UpdateLearnerUseCase {
  constructor(
    @Inject(LEARNER_REPOSITORY) private readonly learners: LearnerRepository,
    @Inject(COMPANY_DIRECTORY) private readonly directory: CompanyDirectory,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  execute(command: UpdateLearnerCommand): Promise<LearnerView> {
    return this.unitOfWork.run(async () => {
      const { learner, company } = await learnerInScope(this.learners, this.directory, command.id, command.access, 'training.learner.update');
      assertWritable(company);
      assertVersion(learner.version, command.version, "L'apprenant");
      const before = toLearnerView(learner, company?.name ?? '');
      learner.update(command);
      if (company) await assertContactOfCompany(this.directory, command.contactId, company.id);
      await assertNoDuplicate(this.learners, learner, command.allowDuplicate, learner.id);
      await this.learners.save(learner);
      const after = toLearnerView((await this.learners.findById(learner.id)) ?? learner, company?.name ?? '');
      await this.audit.record({ actor: command.actor, module: 'training', entityType: 'Learner', entityId: learner.id, action: AuditAction.Update, oldValue: { ...before }, newValue: { ...after } });
      return after;
    });
  }
}

/** Supprimer un apprenant (suppression logique, D-SESS-7 B) : refusée avec une inscription confirmée ; audit. */
@Injectable()
export class DeleteLearnerUseCase {
  constructor(
    @Inject(LEARNER_REPOSITORY) private readonly learners: LearnerRepository,
    @Inject(ENROLLMENT_REPOSITORY) private readonly enrollments: EnrollmentRepository,
    @Inject(COMPANY_DIRECTORY) private readonly directory: CompanyDirectory,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  execute(command: { id: string; version: number; access: AccessContext; actor: ActorContext }): Promise<void> {
    return this.unitOfWork.run(async () => {
      const { learner, company } = await learnerInScope(this.learners, this.directory, command.id, command.access, 'training.learner.delete');
      assertVersion(learner.version, command.version, "L'apprenant");
      if (await this.enrollments.hasConfirmed(learner.id)) {
        throw new DomainError('INVARIANT_VIOLATION', "L'apprenant a une inscription confirmée : annulez-la avant de le supprimer");
      }
      const before = toLearnerView(learner, company?.name ?? '');
      learner.markDeleted(this.clock.now());
      await this.learners.save(learner);
      await this.audit.record({ actor: command.actor, module: 'training', entityType: 'Learner', entityId: learner.id, action: AuditAction.Delete, oldValue: { ...before } });
    });
  }
}

@Injectable()
export class GetLearnerHandler {
  constructor(@Inject(LEARNER_REPOSITORY) private readonly learners: LearnerRepository, @Inject(COMPANY_DIRECTORY) private readonly directory: CompanyDirectory) {}

  async execute(query: { id: string; access: AccessContext }): Promise<LearnerView> {
    const { learner, company } = await learnerInScope(this.learners, this.directory, query.id, query.access, 'training.learner.read');
    return toLearnerView(learner, company?.name ?? '');
  }
}

/** Liste paginée des apprenants visibles ; filtrer par entreprise exige que cette entreprise soit dans la portée (sinon « introuvable »). */
@Injectable()
export class ListLearnersHandler {
  constructor(@Inject(LEARNER_REPOSITORY) private readonly learners: LearnerRepository, @Inject(COMPANY_DIRECTORY) private readonly directory: CompanyDirectory) {}

  async execute(query: { page: number; pageSize: number; search?: string; companyId?: string; kind?: LearnerKind; access: AccessContext }): Promise<Page<LearnerView>> {
    if (query.companyId) await companyInScope(this.directory, query.companyId, query.access, 'training.learner.read');
    const visibility = visibilityFor(query.access, 'training.learner.read');
    const result = await this.learners.list({
      ...normalizePage(query), search: query.search?.trim() || undefined, companyId: query.companyId, kind: query.kind, companyIds: visibility.unrestricted ? undefined : await this.directory.companyIdsOwnedBy(visibility.ownerIds),
    });
    const names = new Map<string, string>();
    for (const learner of result.items) {
      if (learner.companyId && !names.has(learner.companyId)) names.set(learner.companyId, (await this.directory.company(learner.companyId))?.name ?? '');
    }
    return { ...result, items: result.items.map((l) => toLearnerView(l, l.companyId ? names.get(l.companyId) ?? '' : '')) };
  }
}
