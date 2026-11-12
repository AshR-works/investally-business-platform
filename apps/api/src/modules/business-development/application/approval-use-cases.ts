import { Inject, Injectable } from '@nestjs/common';
import { ActorContext, CLOCK, Clock, DomainError, ID_GENERATOR, IdGenerator, Page, UNIT_OF_WORK, UnitOfWork } from '../../../shared-kernel';
import { AUDIT_RECORDER, AuditAction, AuditRecorder } from '../../audit';
import { decideFor, visibilityFor } from '../../iam';
import type { AccessContext } from '../../iam';
import { Approval, ApprovalStatus } from '../domain/approval';
import { APPROVAL_REPOSITORY, ApprovalRepository } from '../domain/approval-repository';
import { Company } from '../domain/company';
import { COMPANY_REPOSITORY, CompanyRepository } from '../domain/company-repository';
import { CompanyStatus } from '../domain/company-status';
import { Opportunity, OpportunityStage, OpportunityStatus, STAGE_ORDER } from '../domain/opportunity';
import { OPPORTUNITY_REPOSITORY, OpportunityRepository } from '../domain/opportunity-repository';
import { ApprovalView, toApprovalView } from './approval-view';
import { RegisterCommissionDue } from './commission-payout-use-cases';
import { toCompanyView } from './company-view';

const NOT_FOUND = 'Agrément introuvable';
const STALE = "L'agrément a été modifié par un autre utilisateur : rechargez-le avant de le modifier";

export { ApprovalStatus };

function assertWritable(company: Company): void {
  if (company.status === CompanyStatus.Archived) throw new DomainError('INVARIANT_VIOLATION', "L'entreprise est archivée : ses agréments ne sont plus modifiables");
}

/** L'opportunité et son entreprise, dans la portée de l'appelant pour la permission demandée ; sinon « introuvable ». */
async function opportunityInScope(
  opportunities: OpportunityRepository, companies: CompanyRepository, id: string, access: AccessContext, permission: string,
): Promise<{ opportunity: Opportunity; company: Company }> {
  const opportunity = await opportunities.findById(id);
  const company = opportunity ? await companies.findById(opportunity.companyId) : null;
  if (!opportunity || !company || !decideFor(access, permission, company.ownerUserId).allowed) throw new DomainError('NOT_FOUND', 'Opportunité introuvable');
  return { opportunity, company };
}

/** L'agrément, son opportunité et son entreprise, dans la portée de l'appelant pour la permission demandée ; sinon « introuvable ». */
async function approvalInScope(
  repos: { approvals: ApprovalRepository; opportunities: OpportunityRepository; companies: CompanyRepository },
  id: string, access: AccessContext, permission: string,
): Promise<{ approval: Approval; opportunity: Opportunity; company: Company }> {
  const approval = await repos.approvals.findById(id);
  const opportunity = approval ? await repos.opportunities.findById(approval.opportunityId) : null;
  const company = approval ? await repos.companies.findById(approval.companyId) : null;
  if (!approval || !opportunity || !company || !decideFor(access, permission, company.ownerUserId).allowed) throw new DomainError('NOT_FOUND', NOT_FOUND);
  return { approval, opportunity, company };
}

const contextOf = (company: Company, opportunity: Opportunity) => ({ companyName: company.name.value, opportunityTitle: opportunity.title });

/** L'entreprise devient « Cliente » dès qu'un agrément est reçu (flux C5) ; la modification de l'entreprise est tracée dans l'audit. */
async function promoteToClient(companies: CompanyRepository, audit: AuditRecorder, company: Company, actor: ActorContext): Promise<void> {
  if (company.status === CompanyStatus.Client) return;
  const before = toCompanyView(company);
  company.becomeClient();
  await companies.save(company);
  const after = toCompanyView((await companies.findById(company.id)) ?? company);
  await audit.record({ actor, module: 'business-development', entityType: 'Company', entityId: company.id, action: AuditAction.Update, oldValue: { ...before }, newValue: { ...after } });
}

export interface RegisterApprovalCommand {
  opportunityId: string;
  amount?: string | number | null;
  places?: number | null;
  currency?: string;
  /** Date de réception de la promesse signée ; absente (avec `requested`) pour un agrément seulement demandé. */
  receivedOn?: string;
  /** Vrai : l'agrément est demandé, la promesse n'est pas encore signée (D41, FD-4). */
  requested?: boolean;
  validUntil?: string | null;
  /** Payeur tiers (nom et type) ; absents : le client paie lui-même (D41, FD-3). */
  payerName?: string | null;
  payerType?: string | null;
  access: AccessContext;
  actor: ActorContext;
}

/**
 * Enregistrer l'agrément d'une opportunité : portée de son entreprise, entreprise non archivée, opportunité qui a franchi l'accord
 * de principe et n'est pas perdue, un seul agrément actif par opportunité. Reçu, il rend l'entreprise « Cliente » (flux C5) ; seulement
 * demandé (D41), il n'a pas de date de réception et l'entreprise ne change pas. Les écritures et leurs traces d'audit sont dans la
 * même transaction.
 */
@Injectable()
export class RegisterApprovalUseCase {
  constructor(
    @Inject(APPROVAL_REPOSITORY) private readonly approvals: ApprovalRepository,
    @Inject(OPPORTUNITY_REPOSITORY) private readonly opportunities: OpportunityRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(command: RegisterApprovalCommand): Promise<ApprovalView> {
    return this.unitOfWork.run(async () => {
      const { opportunity, company } = await opportunityInScope(this.opportunities, this.companies, command.opportunityId, command.access, 'bd.approval.create');
      assertWritable(company);
      if (opportunity.status === OpportunityStatus.Lost) throw new DomainError('INVARIANT_VIOLATION', "L'opportunité est perdue : on n'enregistre plus d'agrément pour elle");
      if (STAGE_ORDER.indexOf(opportunity.stage) < STAGE_ORDER.indexOf(OpportunityStage.AgreementInPrinciple)) {
        throw new DomainError('INVARIANT_VIOLATION', "L'agrément exige l'accord de principe : faites d'abord avancer l'opportunité");
      }
      if (await this.approvals.findActiveByOpportunity(opportunity.id)) throw new DomainError('CONFLICT', 'Cette opportunité a déjà un agrément actif');
      const now = this.clock.now();
      const common = {
        id: this.ids.next(), companyId: company.id, opportunityId: opportunity.id, amount: command.amount, places: command.places,
        currency: command.currency, validUntil: command.validUntil, payerName: command.payerName, payerType: command.payerType, now,
      };
      if (command.requested && command.receivedOn) throw new DomainError('VALIDATION', "Un agrément demandé n'a pas encore de date de réception");
      const approval = command.requested ? Approval.request(common) : Approval.register({ ...common, receivedOn: command.receivedOn ?? '' });
      await this.approvals.save(approval);
      const view = toApprovalView(approval, contextOf(company, opportunity), now);
      await this.audit.record({ actor: command.actor, module: 'business-development', entityType: 'Approval', entityId: approval.id, action: AuditAction.Create, newValue: { ...view } });
      if (approval.status === ApprovalStatus.Received) await promoteToClient(this.companies, this.audit, company, command.actor);
      return view;
    });
  }
}

export interface ReceiveApprovalCommand {
  id: string;
  version: number;
  receivedOn: string;
  access: AccessContext;
  actor: ActorContext;
}

/**
 * La promesse de paiement est signée : l'agrément demandé devient reçu (D41, FD-4). Mêmes règles de portée que l'enregistrement
 * (droit de création), version lue, entreprise non archivée ; l'entreprise devient « Cliente ». Audit avant et après.
 */
@Injectable()
export class ReceiveApprovalUseCase {
  constructor(
    @Inject(APPROVAL_REPOSITORY) private readonly approvals: ApprovalRepository,
    @Inject(OPPORTUNITY_REPOSITORY) private readonly opportunities: OpportunityRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: ReceiveApprovalCommand): Promise<ApprovalView> {
    return this.unitOfWork.run(async () => {
      const { approval, opportunity, company } = await approvalInScope(
        { approvals: this.approvals, opportunities: this.opportunities, companies: this.companies }, command.id, command.access, 'bd.approval.create',
      );
      assertWritable(company);
      if (approval.version !== command.version) throw new DomainError('CONFLICT', STALE);
      const now = this.clock.now();
      const before = toApprovalView(approval, contextOf(company, opportunity), now);
      approval.receive(command.receivedOn, now);
      await this.approvals.save(approval);
      const saved = (await this.approvals.findById(approval.id)) ?? approval;
      const after = toApprovalView(saved, contextOf(company, opportunity), now);
      await this.audit.record({ actor: command.actor, module: 'business-development', entityType: 'Approval', entityId: approval.id, action: AuditAction.Update, oldValue: { ...before }, newValue: { ...after } });
      await promoteToClient(this.companies, this.audit, company, command.actor);
      return after;
    });
  }
}

export type ApprovalAction = 'honor' | 'expire' | 'cancel';

export interface CloseApprovalCommand {
  id: string;
  version: number;
  action: ApprovalAction;
  /** Motif : obligatoire pour déclarer expiré ou annuler ; sans objet pour honorer. */
  reason?: string;
  access: AccessContext;
  actor: ActorContext;
}

/**
 * Honorer (le paiement a eu lieu, constaté par la finance), déclarer expiré ou annuler un agrément (reçu, ou demandé pour l'annuler) : portée, version lue, entreprise non archivée ; le
 * droit d'honorer est distinct de celui d'annuler ou d'expirer ; expirer et annuler exigent un motif. Audit avant et après.
 */
@Injectable()
export class CloseApprovalUseCase {
  constructor(
    @Inject(APPROVAL_REPOSITORY) private readonly approvals: ApprovalRepository,
    @Inject(OPPORTUNITY_REPOSITORY) private readonly opportunities: OpportunityRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly commissionDue: RegisterCommissionDue,
  ) {}

  async execute(command: CloseApprovalCommand): Promise<ApprovalView> {
    return this.unitOfWork.run(async () => {
      const permission = command.action === 'honor' ? 'bd.approval.honor' : 'bd.approval.cancel';
      const { approval, opportunity, company } = await approvalInScope(
        { approvals: this.approvals, opportunities: this.opportunities, companies: this.companies }, command.id, command.access, permission,
      );
      assertWritable(company);
      if (approval.version !== command.version) throw new DomainError('CONFLICT', STALE);
      const now = this.clock.now();
      const before = toApprovalView(approval, contextOf(company, opportunity), now);
      if (command.action === 'honor') approval.honor(now);
      else if (command.action === 'expire') approval.expire(command.reason, now);
      else approval.cancel(command.reason, now);
      await this.approvals.save(approval);
      const saved = (await this.approvals.findById(approval.id)) ?? approval;
      const after = toApprovalView(saved, contextOf(company, opportunity), now);
      await this.audit.record({ actor: command.actor, module: 'business-development', entityType: 'Approval', entityId: approval.id, action: AuditAction.Update, oldValue: { ...before }, newValue: { ...after } });
      // Le paiement constaté rend la commission du facilitateur due (D41, FD-1 B), dans la même transaction.
      if (command.action === 'honor') await this.commissionDue.execute({ approval: saved, company, actor: command.actor });
      return after;
    });
  }
}

/** Lecture d'un agrément : hors de la portée de son entreprise, il est « introuvable ». */
@Injectable()
export class GetApprovalHandler {
  constructor(
    @Inject(APPROVAL_REPOSITORY) private readonly approvals: ApprovalRepository,
    @Inject(OPPORTUNITY_REPOSITORY) private readonly opportunities: OpportunityRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(query: { id: string; access: AccessContext }): Promise<ApprovalView> {
    const { approval, opportunity, company } = await approvalInScope(
      { approvals: this.approvals, opportunities: this.opportunities, companies: this.companies }, query.id, query.access, 'bd.approval.read',
    );
    return toApprovalView(approval, contextOf(company, opportunity), this.clock.now());
  }
}

const MAX_PAGE_SIZE = 100;
const STATUSES: readonly string[] = Object.values(ApprovalStatus);

export interface ListApprovalsQuery {
  page: number;
  pageSize: number;
  companyId?: string;
  opportunityId?: string;
  status?: string;
  access: AccessContext;
}

/**
 * Les agréments visibles de l'appelant, le plus récent d'abord. La portée est celle de l'entreprise ; filtrer par entreprise ou par
 * opportunité exige qu'elle soit dans la portée, sinon « introuvable ».
 */
@Injectable()
export class ListApprovalsHandler {
  constructor(
    @Inject(APPROVAL_REPOSITORY) private readonly approvals: ApprovalRepository,
    @Inject(OPPORTUNITY_REPOSITORY) private readonly opportunities: OpportunityRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(query: ListApprovalsQuery): Promise<Page<ApprovalView>> {
    if (query.companyId) {
      const company = await this.companies.findById(query.companyId);
      if (!company || !decideFor(query.access, 'bd.approval.read', company.ownerUserId).allowed) throw new DomainError('NOT_FOUND', 'Entreprise introuvable');
    }
    if (query.opportunityId) await opportunityInScope(this.opportunities, this.companies, query.opportunityId, query.access, 'bd.approval.read');
    const visibility = visibilityFor(query.access, 'bd.approval.read');
    const now = this.clock.now();
    const result = await this.approvals.list({
      page: Math.max(1, Math.floor(query.page)),
      pageSize: Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(query.pageSize))),
      companyId: query.companyId,
      opportunityId: query.opportunityId,
      status: query.status && STATUSES.includes(query.status) ? (query.status as ApprovalStatus) : undefined,
      ownerIds: visibility.unrestricted ? undefined : visibility.ownerIds,
    });
    return { ...result, items: result.items.map((i) => toApprovalView(i.approval, { companyName: i.companyName, opportunityTitle: i.opportunityTitle }, now)) };
  }
}
