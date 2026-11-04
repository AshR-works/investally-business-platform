import { Inject, Injectable } from '@nestjs/common';
import { ActorContext, CLOCK, Clock, DomainError, ID_GENERATOR, IdGenerator, Page, UNIT_OF_WORK, UnitOfWork } from '../../../shared-kernel';
import { AUDIT_RECORDER, AuditAction, AuditRecorder } from '../../audit';
import { DOCUMENT_PRESENCE } from '../../documents';
import type { DocumentPresence } from '../../documents';
import { decideFor, visibilityFor } from '../../iam';
import type { AccessContext } from '../../iam';
import { Approval } from '../domain/approval';
import { Company } from '../domain/company';
import { COMPANY_REPOSITORY, CompanyRepository } from '../domain/company-repository';
import { CommissionType } from '../domain/commission';
import { CompanyStatus } from '../domain/company-status';
import { CommissionPayout, PayoutStatus } from '../domain/commission-payout';
import { COMMISSION_PAYOUT_REPOSITORY, CommissionPayoutRepository } from '../domain/commission-payout-repository';
import { FACILITATOR_REPOSITORY, FacilitatorRepository } from '../domain/facilitator-repository';
import { PayoutView, toPayoutView } from './commission-payout-view';

const NOT_FOUND = 'Commission introuvable';
const STALE = 'La commission a été modifiée par un autre utilisateur : rechargez-la avant de la modifier';

export { PayoutStatus };

/** Type d'objet propriétaire déclaré au module Documents pour les versements (le justificatif) et catégorie attendue. */
export const PAYOUT_OWNER_TYPE = 'commission';
export const PROOF_CATEGORY = 'JUSTIFICATIF';

function assertWritable(company: Company): void {
  if (company.status === CompanyStatus.Archived) throw new DomainError('INVARIANT_VIOLATION', "L'entreprise est archivée : ses commissions ne sont plus modifiables");
}

/**
 * Crée le versement d'une commission quand un agrément est honoré (D41, FD-1 B) : seulement si l'entreprise a un facilitateur avec une
 * commission définie ; une seule fois par agrément. Appelé DANS la transaction du constat du paiement : pas de transaction propre.
 */
@Injectable()
export class RegisterCommissionDue {
  constructor(
    @Inject(COMMISSION_PAYOUT_REPOSITORY) private readonly payouts: CommissionPayoutRepository,
    @Inject(FACILITATOR_REPOSITORY) private readonly facilitators: FacilitatorRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(input: { approval: Approval; company: Company; actor: ActorContext }): Promise<PayoutView | null> {
    const link = input.company.facilitation;
    if (!link?.commission) return null;
    if (await this.payouts.findByApproval(input.approval.id)) return null;
    const payout = CommissionPayout.due({
      id: this.ids.next(), companyId: input.company.id, facilitatorId: link.facilitatorId, approvalId: input.approval.id,
      commission: { type: link.commission.type as CommissionType, value: link.commission.value, currency: link.commission.currency },
      approvalAmount: input.approval.amount, approvalCurrency: input.approval.currency, now: this.clock.now(),
    });
    await this.payouts.save(payout);
    const facilitator = await this.facilitators.findById(link.facilitatorId);
    const view = toPayoutView(payout, { companyName: input.company.name.value, facilitatorName: facilitator ? `${facilitator.firstName} ${facilitator.lastName}` : '—' });
    await this.audit.record({ actor: input.actor, module: 'business-development', entityType: 'CommissionPayout', entityId: payout.id, action: AuditAction.Create, newValue: { ...view } });
    return view;
  }
}

/** Le versement, son entreprise et le nom du facilitateur, dans la portée de l'appelant pour la permission demandée ; sinon « introuvable ». */
async function payoutInScope(
  repos: { payouts: CommissionPayoutRepository; companies: CompanyRepository; facilitators: FacilitatorRepository },
  id: string, access: AccessContext, permission: string,
): Promise<{ payout: CommissionPayout; company: Company; facilitatorName: string }> {
  const payout = await repos.payouts.findById(id);
  const company = payout ? await repos.companies.findById(payout.companyId) : null;
  if (!payout || !company || !decideFor(access, permission, company.ownerUserId).allowed) throw new DomainError('NOT_FOUND', NOT_FOUND);
  const facilitator = await repos.facilitators.findById(payout.facilitatorId);
  return { payout, company, facilitatorName: facilitator ? `${facilitator.firstName} ${facilitator.lastName}` : '—' };
}

export type PayoutAction = 'release' | 'hold' | 'pay' | 'cancel' | 'amount';

export interface PayoutActionCommand {
  id: string;
  version: number;
  action: PayoutAction;
  /** Motif : obligatoire pour mettre en attente ou annuler. */
  reason?: string;
  /** Date du versement (« AAAA-MM-JJ ») pour constater le versement. */
  paidOn?: string;
  /** Montant à fixer (pourcentage d'un agrément sans montant). */
  amount?: string | number;
  access: AccessContext;
  actor: ActorContext;
}

const PERMISSION: Record<PayoutAction, string> = {
  release: 'bd.commission.release',
  hold: 'bd.commission.release',
  pay: 'bd.commission.pay',
  cancel: 'bd.commission.manage',
  amount: 'bd.commission.manage',
};

/**
 * Change l'état d'un versement : débloquer ou mettre en attente (la Finance), constater le versement (le chargé de compte, avec son
 * justificatif déposé), annuler ou fixer le montant (le Responsable commercial). Chaque action a son droit ; portée de l'entreprise,
 * version lue, entreprise non archivée ; audit avant et après dans la même transaction.
 */
@Injectable()
export class ChangePayoutUseCase {
  constructor(
    @Inject(COMMISSION_PAYOUT_REPOSITORY) private readonly payouts: CommissionPayoutRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
    @Inject(FACILITATOR_REPOSITORY) private readonly facilitators: FacilitatorRepository,
    @Inject(DOCUMENT_PRESENCE) private readonly documents: DocumentPresence,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: PayoutActionCommand): Promise<PayoutView> {
    return this.unitOfWork.run(async () => {
      const { payout, company, facilitatorName } = await payoutInScope(
        { payouts: this.payouts, companies: this.companies, facilitators: this.facilitators }, command.id, command.access, PERMISSION[command.action],
      );
      assertWritable(company);
      if (payout.version !== command.version) throw new DomainError('CONFLICT', STALE);
      const context = { companyName: company.name.value, facilitatorName };
      const before = toPayoutView(payout, context);
      switch (command.action) {
        case 'release': payout.release(); break;
        case 'hold': payout.hold(command.reason); break;
        case 'cancel': payout.cancel(command.reason); break;
        case 'amount': payout.fixAmount(command.amount ?? ''); break;
        case 'pay': payout.pay(command.paidOn ?? '', await this.documents.has(PAYOUT_OWNER_TYPE, payout.id, PROOF_CATEGORY), this.clock.now()); break;
      }
      await this.payouts.save(payout);
      const saved = (await this.payouts.findById(payout.id)) ?? payout;
      const after = toPayoutView(saved, context);
      await this.audit.record({ actor: command.actor, module: 'business-development', entityType: 'CommissionPayout', entityId: payout.id, action: AuditAction.Update, oldValue: { ...before }, newValue: { ...after } });
      return after;
    });
  }
}

/** Lecture d'un versement : hors de la portée de son entreprise, il est « introuvable ». */
@Injectable()
export class GetPayoutHandler {
  constructor(
    @Inject(COMMISSION_PAYOUT_REPOSITORY) private readonly payouts: CommissionPayoutRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
    @Inject(FACILITATOR_REPOSITORY) private readonly facilitators: FacilitatorRepository,
  ) {}

  async execute(query: { id: string; access: AccessContext }): Promise<PayoutView> {
    const { payout, company, facilitatorName } = await payoutInScope({ payouts: this.payouts, companies: this.companies, facilitators: this.facilitators }, query.id, query.access, 'bd.commission.read');
    return toPayoutView(payout, { companyName: company.name.value, facilitatorName });
  }
}

const MAX_PAGE_SIZE = 100;
const STATUSES: readonly string[] = Object.values(PayoutStatus);

export interface ListPayoutsQuery {
  page: number;
  pageSize: number;
  status?: string;
  companyId?: string;
  facilitatorId?: string;
  access: AccessContext;
}

/**
 * Les versements visibles de l'appelant, le plus récent d'abord. La portée est celle de l'entreprise ; filtrer par entreprise exige
 * qu'elle soit dans la portée, sinon « introuvable ».
 */
@Injectable()
export class ListPayoutsHandler {
  constructor(
    @Inject(COMMISSION_PAYOUT_REPOSITORY) private readonly payouts: CommissionPayoutRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
  ) {}

  async execute(query: ListPayoutsQuery): Promise<Page<PayoutView>> {
    if (query.companyId) {
      const company = await this.companies.findById(query.companyId);
      if (!company || !decideFor(query.access, 'bd.commission.read', company.ownerUserId).allowed) throw new DomainError('NOT_FOUND', 'Entreprise introuvable');
    }
    const visibility = visibilityFor(query.access, 'bd.commission.read');
    const result = await this.payouts.list({
      page: Math.max(1, Math.floor(query.page)),
      pageSize: Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(query.pageSize))),
      status: query.status && STATUSES.includes(query.status) ? (query.status as PayoutStatus) : undefined,
      companyId: query.companyId,
      facilitatorId: query.facilitatorId,
      ownerIds: visibility.unrestricted ? undefined : visibility.ownerIds,
    });
    return { ...result, items: result.items.map((i) => toPayoutView(i.payout, { companyName: i.companyName, facilitatorName: i.facilitatorName })) };
  }
}
