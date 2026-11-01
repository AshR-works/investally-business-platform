import { Inject, Injectable } from '@nestjs/common';
import { ActorContext, CLOCK, Clock, DomainError, ID_GENERATOR, IdGenerator, Page, UNIT_OF_WORK, UnitOfWork } from '../../../shared-kernel';
import { AUDIT_RECORDER, AuditAction, AuditRecorder } from '../../audit';
import { decideFor, visibilityFor } from '../../iam';
import type { AccessContext } from '../../iam';
import { Company } from '../domain/company';
import { COMPANY_REPOSITORY, CompanyRepository } from '../domain/company-repository';
import { CompanyStatus } from '../domain/company-status';
import { Opportunity, OpportunityStage, OpportunityStatus } from '../domain/opportunity';
import { DECISION_MAKER_MEETINGS, DecisionMakerMeetings, OPPORTUNITY_REPOSITORY, OpportunityRepository } from '../domain/opportunity-repository';
import { OpportunityView, toOpportunityView } from './opportunity-view';
import { companyInScope } from './offer-use-cases';

const NOT_FOUND = 'Opportunité introuvable';
const STALE = "L'opportunité a été modifiée par un autre utilisateur : rechargez-la avant de la modifier";

function assertWritable(company: Company): void {
  if (company.status === CompanyStatus.Archived) throw new DomainError('INVARIANT_VIOLATION', "L'entreprise est archivée : ses opportunités ne sont plus modifiables");
}

/** Opportunité et entreprise visibles de l'appelant (la visibilité d'une opportunité suit celle de son entreprise). */
async function opportunityInScope(
  opportunities: OpportunityRepository, companies: CompanyRepository, id: string, access: AccessContext, permission: string,
): Promise<{ opportunity: Opportunity; company: Company }> {
  const opportunity = await opportunities.findById(id);
  const company = opportunity ? await companies.findById(opportunity.companyId) : null;
  if (!opportunity || !company || !decideFor(access, permission, company.ownerUserId).allowed) throw new DomainError('NOT_FOUND', NOT_FOUND);
  return { opportunity, company };
}

export interface CreateOpportunityCommand {
  companyId: string;
  title: string;
  amount: string | number;
  currency?: string;
  source: string;
  access: AccessContext;
  actor: ActorContext;
}

/** Créer une opportunité (à « Qualification ») : l'entreprise doit être dans la portée de l'appelant et non archivée ; audit. */
@Injectable()
export class CreateOpportunityUseCase {
  constructor(
    @Inject(OPPORTUNITY_REPOSITORY) private readonly opportunities: OpportunityRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(command: CreateOpportunityCommand): Promise<OpportunityView> {
    return this.unitOfWork.run(async () => {
      const company = await companyInScope(this.companies, command.companyId, command.access, 'bd.opportunity.create');
      assertWritable(company);
      const opportunity = Opportunity.create({ ...command, id: this.ids.next(), now: this.clock.now() });
      await this.opportunities.save(opportunity);
      const view = toOpportunityView(opportunity, company.name.value);
      await this.audit.record({ actor: command.actor, module: 'business-development', entityType: 'Opportunity', entityId: opportunity.id, action: AuditAction.Create, newValue: { ...view } });
      return view;
    });
  }
}

/** Les cas d'usage qui changent une opportunité existante partagent la même séquence : portée, version, règle du domaine, audit. */
abstract class OpportunityChange<C extends { id: string; version: number; access: AccessContext; actor: ActorContext }> {
  constructor(
    protected readonly opportunities: OpportunityRepository,
    protected readonly companies: CompanyRepository,
    protected readonly audit: AuditRecorder,
    protected readonly unitOfWork: UnitOfWork,
  ) {}

  protected abstract permission(command: C): string;
  protected abstract apply(opportunity: Opportunity, command: C, company: Company): Promise<void>;

  async execute(command: C): Promise<OpportunityView> {
    return this.unitOfWork.run(async () => {
      const { opportunity, company } = await opportunityInScope(this.opportunities, this.companies, command.id, command.access, this.permission(command));
      assertWritable(company);
      if (opportunity.version !== command.version) throw new DomainError('CONFLICT', STALE);
      const before = toOpportunityView(opportunity, company.name.value);
      await this.apply(opportunity, command, company);
      await this.opportunities.save(opportunity);
      const after = toOpportunityView((await this.opportunities.findById(opportunity.id)) ?? opportunity, company.name.value);
      await this.audit.record({ actor: command.actor, module: 'business-development', entityType: 'Opportunity', entityId: opportunity.id, action: AuditAction.Update, oldValue: { ...before }, newValue: { ...after } });
      return after;
    });
  }
}

export interface UpdateOpportunityCommand {
  id: string;
  version: number;
  title?: string;
  amount?: string | number;
  currency?: string;
  source?: string;
  access: AccessContext;
  actor: ActorContext;
}

/** Modifier une opportunité OUVERTE (intitulé, montant, devise, source) : portée, version lue ; audit avant/après. */
@Injectable()
export class UpdateOpportunityUseCase extends OpportunityChange<UpdateOpportunityCommand> {
  constructor(
    @Inject(OPPORTUNITY_REPOSITORY) opportunities: OpportunityRepository,
    @Inject(COMPANY_REPOSITORY) companies: CompanyRepository,
    @Inject(AUDIT_RECORDER) audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) unitOfWork: UnitOfWork,
  ) {
    super(opportunities, companies, audit, unitOfWork);
  }
  protected permission = () => 'bd.opportunity.update';
  protected async apply(opportunity: Opportunity, command: UpdateOpportunityCommand): Promise<void> {
    opportunity.edit(command);
  }
}

export interface AdvanceOpportunityCommand {
  id: string;
  version: number;
  access: AccessContext;
  actor: ActorContext;
}

/**
 * Passer à l'étape suivante (jamais plus loin, jamais en arrière). L'accord de principe exige un rendez-vous décideur tenu sur
 * l'entreprise (agenda) ou une dérogation accordée par le Responsable commercial.
 */
@Injectable()
export class AdvanceOpportunityUseCase extends OpportunityChange<AdvanceOpportunityCommand> {
  constructor(
    @Inject(OPPORTUNITY_REPOSITORY) opportunities: OpportunityRepository,
    @Inject(COMPANY_REPOSITORY) companies: CompanyRepository,
    @Inject(AUDIT_RECORDER) audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) unitOfWork: UnitOfWork,
    @Inject(DECISION_MAKER_MEETINGS) private readonly meetings: DecisionMakerMeetings,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {
    super(opportunities, companies, audit, unitOfWork);
  }
  protected permission = () => 'bd.opportunity.advance';
  protected async apply(opportunity: Opportunity): Promise<void> {
    const needsMeeting = opportunity.nextStage === OpportunityStage.AgreementInPrinciple;
    const held = needsMeeting ? await this.meetings.hasHeld(opportunity.companyId) : false;
    opportunity.advance({ decisionMakerMeetingHeld: held }, this.clock.now());
  }
}

export interface GrantWaiverCommand {
  id: string;
  version: number;
  reason?: string;
  access: AccessContext;
  actor: ActorContext;
}

/** Accorder la dérogation à la règle du rendez-vous décideur (Responsable commercial) : justification obligatoire, tracée. */
@Injectable()
export class GrantWaiverUseCase extends OpportunityChange<GrantWaiverCommand> {
  constructor(
    @Inject(OPPORTUNITY_REPOSITORY) opportunities: OpportunityRepository,
    @Inject(COMPANY_REPOSITORY) companies: CompanyRepository,
    @Inject(AUDIT_RECORDER) audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {
    super(opportunities, companies, audit, unitOfWork);
  }
  protected permission = () => 'bd.opportunity.override';
  protected async apply(opportunity: Opportunity, command: GrantWaiverCommand): Promise<void> {
    opportunity.grantWaiver(command.reason, this.clock.now());
  }
}

export type OpportunityOutcome = 'lost' | 'won';

export interface CloseOpportunityCommand {
  id: string;
  version: number;
  outcome: OpportunityOutcome;
  /** Motif de perte (liste fermée), obligatoire pour « perdue ». */
  reason?: string;
  note?: string | null;
  access: AccessContext;
  actor: ActorContext;
}

/**
 * Clore une opportunité : « perdue » (chargé de compte pour les siennes, motif obligatoire) ou « gagnée » (Responsable commercial
 * seulement, une fois l'accord de principe obtenu) ; décision D28. Une opportunité clôturée est immuable.
 */
@Injectable()
export class CloseOpportunityUseCase extends OpportunityChange<CloseOpportunityCommand> {
  constructor(
    @Inject(OPPORTUNITY_REPOSITORY) opportunities: OpportunityRepository,
    @Inject(COMPANY_REPOSITORY) companies: CompanyRepository,
    @Inject(AUDIT_RECORDER) audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {
    super(opportunities, companies, audit, unitOfWork);
  }
  protected permission = (command: CloseOpportunityCommand) => (command.outcome === 'won' ? 'bd.opportunity.close_won' : 'bd.opportunity.close_lost');
  protected async apply(opportunity: Opportunity, command: CloseOpportunityCommand): Promise<void> {
    if (command.outcome === 'won') opportunity.closeWon(this.clock.now());
    else opportunity.closeLost(command.reason, command.note, this.clock.now());
  }
}

/** Lecture d'une opportunité : hors de la portée de son entreprise, elle est « introuvable ». */
@Injectable()
export class GetOpportunityHandler {
  constructor(
    @Inject(OPPORTUNITY_REPOSITORY) private readonly opportunities: OpportunityRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
  ) {}

  async execute(query: { id: string; access: AccessContext }): Promise<OpportunityView> {
    const { opportunity, company } = await opportunityInScope(this.opportunities, this.companies, query.id, query.access, 'bd.opportunity.read');
    return toOpportunityView(opportunity, company.name.value);
  }
}

const MAX_PAGE_SIZE = 200;
const STATUSES: readonly string[] = Object.values(OpportunityStatus);
const STAGES: readonly string[] = Object.values(OpportunityStage);

/**
 * Liste paginée des opportunités visibles (cartes et vue par étape), la plus récemment modifiée d'abord. Filtrer par entreprise
 * exige qu'elle soit dans la portée (sinon « introuvable »).
 */
@Injectable()
export class ListOpportunitiesHandler {
  constructor(
    @Inject(OPPORTUNITY_REPOSITORY) private readonly opportunities: OpportunityRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
  ) {}

  async execute(query: { page: number; pageSize: number; search?: string; companyId?: string; status?: string; stage?: string; access: AccessContext }): Promise<Page<OpportunityView>> {
    if (query.companyId) await companyInScope(this.companies, query.companyId, query.access, 'bd.opportunity.read');
    const visibility = visibilityFor(query.access, 'bd.opportunity.read');
    const search = query.search?.trim();
    const result = await this.opportunities.list({
      page: Math.max(1, Math.floor(query.page)),
      pageSize: Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(query.pageSize))),
      search: search ? search : undefined,
      companyId: query.companyId,
      status: query.status && STATUSES.includes(query.status) ? (query.status as OpportunityStatus) : undefined,
      stage: query.stage && STAGES.includes(query.stage) ? (query.stage as OpportunityStage) : undefined,
      ownerIds: visibility.unrestricted ? undefined : visibility.ownerIds,
    });
    return { ...result, items: result.items.map((i) => toOpportunityView(i.opportunity, i.companyName)) };
  }
}
