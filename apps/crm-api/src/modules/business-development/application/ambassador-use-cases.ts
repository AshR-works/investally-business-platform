import { Inject, Injectable } from '@nestjs/common';
import { ActorContext, CLOCK, Clock, DomainError, ID_GENERATOR, IdGenerator, Page, UNIT_OF_WORK, UnitOfWork } from '../../../shared-kernel';
import { AUDIT_RECORDER, AuditAction, AuditRecorder } from '../../audit';
import { decideFor } from '../../iam';
import type { AccessContext, Visibility } from '../../iam';
import { Ambassador, AmbassadorOrigin } from '../domain/ambassador';
import { AMBASSADOR_REPOSITORY, AmbassadorRepository } from '../domain/ambassador-repository';
import { Company } from '../domain/company';
import { COMPANY_REPOSITORY, CompanyRepository } from '../domain/company-repository';
import { AmbassadorView, toAmbassadorView } from './ambassador-view';

const NOT_FOUND = 'Ambassadeur introuvable';

/**
 * L'entreprise d'origine d'un ambassadeur doit être visible de l'appelant (on ne rattache pas un ambassadeur à l'entreprise d'un
 * collègue) : sinon « introuvable », même réponse qu'un identifiant inexistant.
 */
async function companyVisible(companies: CompanyRepository, id: string | null | undefined, access: AccessContext): Promise<Company | null> {
  if (!id) return null;
  const company = await companies.findById(id);
  if (!company || !decideFor(access, 'bd.company.read', company.ownerUserId).allowed) throw new DomainError('NOT_FOUND', 'Entreprise introuvable');
  return company;
}

/** Un e-mail n'appartient qu'à un seul ambassadeur : on le signale par un conflit lisible. */
async function assertEmailFree(ambassadors: AmbassadorRepository, ambassador: Ambassador, excludeId?: string): Promise<void> {
  if (!ambassador.emailKey) return;
  const other = await ambassadors.findByEmail(ambassador.emailKey, excludeId);
  if (other) throw new DomainError('CONFLICT', `Un ambassadeur (« ${other.firstName} ${other.lastName} ») porte déjà cette adresse e-mail`);
}

/** L'ambassadeur visible de l'appelant pour cette permission ; sinon « introuvable » (portée : celle de son créateur). */
async function ambassadorInScope(ambassadors: AmbassadorRepository, id: string, access: AccessContext, permission: string): Promise<Ambassador> {
  const ambassador = await ambassadors.findById(id);
  if (!ambassador || !decideFor(access, permission, ambassador.ownerUserId).allowed) throw new DomainError('NOT_FOUND', NOT_FOUND);
  return ambassador;
}

export interface RegisterAmbassadorCommand {
  lastName: string;
  firstName: string;
  origin: string;
  companyId?: string | null;
  email?: string | null;
  phone?: string | null;
  appointedOn: string;
  note?: string | null;
  access: AccessContext;
  actor: ActorContext;
}

/**
 * Créer un ambassadeur : **décision manuelle** du chargé de compte (jamais automatique). Il en devient le responsable ; son entreprise
 * d'origine, si elle est donnée, doit être visible de lui ; un e-mail ne sert qu'une fois ; audit.
 */
@Injectable()
export class RegisterAmbassadorUseCase {
  constructor(
    @Inject(AMBASSADOR_REPOSITORY) private readonly ambassadors: AmbassadorRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(command: RegisterAmbassadorCommand): Promise<AmbassadorView> {
    return this.unitOfWork.run(async () => {
      // Le créateur devient responsable : le droit de créer s'évalue donc sur lui-même.
      if (!decideFor(command.access, 'bd.ambassador.create', command.access.actorId).allowed) throw new DomainError('FORBIDDEN', "Vous n'avez pas le droit de créer un ambassadeur");
      const company = await companyVisible(this.companies, command.companyId, command.access);
      const ambassador = Ambassador.register({ ...command, id: this.ids.next(), ownerUserId: command.access.actorId, companyId: company?.id ?? null, now: this.clock.now() });
      await assertEmailFree(this.ambassadors, ambassador);
      await this.ambassadors.save(ambassador);
      const view = toAmbassadorView(ambassador, company?.name.value ?? null);
      await this.audit.record({ actor: command.actor, module: 'business-development', entityType: 'Ambassador', entityId: ambassador.id, action: AuditAction.Create, newValue: { ...view } });
      return view;
    });
  }
}

export interface UpdateAmbassadorCommand {
  id: string;
  version: number;
  lastName?: string;
  firstName?: string;
  companyId?: string | null;
  email?: string | null;
  phone?: string | null;
  appointedOn?: string;
  note?: string | null;
  access: AccessContext;
  actor: ActorContext;
}

/** Modifier un ambassadeur : droit de modification et portée de son créateur, version lue, e-mail libre ; audit avant et après. */
@Injectable()
export class UpdateAmbassadorUseCase {
  constructor(
    @Inject(AMBASSADOR_REPOSITORY) private readonly ambassadors: AmbassadorRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: UpdateAmbassadorCommand): Promise<AmbassadorView> {
    return this.unitOfWork.run(async () => {
      const ambassador = await ambassadorInScope(this.ambassadors, command.id, command.access, 'bd.ambassador.update');
      if (ambassador.version !== command.version) {
        throw new DomainError('CONFLICT', "L'ambassadeur a été modifié par un autre utilisateur : rechargez-le avant de le modifier");
      }
      const beforeCompany = ambassador.companyId ? await this.companies.findById(ambassador.companyId) : null;
      const before = toAmbassadorView(ambassador, beforeCompany?.name.value ?? null);
      const company = command.companyId === undefined ? beforeCompany : await companyVisible(this.companies, command.companyId, command.access);
      ambassador.update({ ...command, companyId: command.companyId === undefined ? undefined : (company?.id ?? null) }, this.clock.now());
      await assertEmailFree(this.ambassadors, ambassador, ambassador.id);
      await this.ambassadors.save(ambassador);
      const saved = (await this.ambassadors.findById(ambassador.id)) ?? ambassador;
      const after = toAmbassadorView(saved, company?.name.value ?? null);
      await this.audit.record({ actor: command.actor, module: 'business-development', entityType: 'Ambassador', entityId: ambassador.id, action: AuditAction.Update, oldValue: { ...before }, newValue: { ...after } });
      return after;
    });
  }
}

/** Lecture d'un ambassadeur : hors de la portée de son créateur, il est « introuvable ». */
@Injectable()
export class GetAmbassadorHandler {
  constructor(
    @Inject(AMBASSADOR_REPOSITORY) private readonly ambassadors: AmbassadorRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
  ) {}

  async execute(query: { id: string; access: AccessContext }): Promise<AmbassadorView> {
    const ambassador = await ambassadorInScope(this.ambassadors, query.id, query.access, 'bd.ambassador.read');
    const company = ambassador.companyId ? await this.companies.findById(ambassador.companyId) : null;
    return toAmbassadorView(ambassador, company?.name.value ?? null);
  }
}

const MAX_PAGE_SIZE = 100;

export interface ListAmbassadorsQuery {
  page: number;
  pageSize: number;
  search?: string;
  origin?: string;
  visibility: Visibility;
}

/** Liste paginée des ambassadeurs visibles : ceux de l'appelant (chargé de compte), de son équipe ou de tous (Responsable commercial, Direction). */
@Injectable()
export class ListAmbassadorsHandler {
  constructor(@Inject(AMBASSADOR_REPOSITORY) private readonly ambassadors: AmbassadorRepository) {}

  async execute(query: ListAmbassadorsQuery): Promise<Page<AmbassadorView>> {
    const origin = query.origin && Object.values(AmbassadorOrigin).includes(query.origin as AmbassadorOrigin) ? (query.origin as AmbassadorOrigin) : undefined;
    const result = await this.ambassadors.list({
      page: Math.max(1, Math.floor(query.page)),
      pageSize: Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(query.pageSize))),
      search: query.search?.trim() || undefined,
      origin,
      ownerIds: query.visibility.unrestricted ? undefined : query.visibility.ownerIds,
    });
    return { ...result, items: result.items.map((i) => toAmbassadorView(i.ambassador, i.companyName)) };
  }
}
