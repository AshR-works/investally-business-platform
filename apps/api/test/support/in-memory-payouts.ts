import { DomainError, Page } from '../../src/shared-kernel';
import { Company } from '../../src/modules/business-development/domain/company';
import { CommissionPayout } from '../../src/modules/business-development/domain/commission-payout';
import { CommissionPayoutRepository, PayoutListItem, PayoutListQuery } from '../../src/modules/business-development/domain/commission-payout-repository';
import { Facilitator } from '../../src/modules/business-development/domain/facilitator';

/** Dépôt de versements de commission en mémoire ; il lit entreprises et facilitateurs pour appliquer la portée comme le fait la base (un versement par agrément). */
export class InMemoryPayouts implements CommissionPayoutRepository {
  readonly items: CommissionPayout[] = [];
  constructor(private readonly companies: { items: Company[] }, private readonly facilitators: { items: Facilitator[] }) {}

  async save(payout: CommissionPayout) {
    if (!this.items.includes(payout)) {
      if (this.items.some((p) => p.approvalId === payout.approvalId)) throw new DomainError('CONFLICT', 'Cet agrément a déjà son versement de commission');
      this.items.push(payout);
    }
  }
  async findById(id: string) {
    return this.items.find((p) => p.id === id) ?? null;
  }
  async findByApproval(approvalId: string) {
    return this.items.find((p) => p.approvalId === approvalId) ?? null;
  }
  async list(q: PayoutListQuery): Promise<Page<PayoutListItem>> {
    const rows = this.items
      .filter((p) => !q.ownerIds || q.ownerIds.includes(this.companies.items.find((c) => c.id === p.companyId)?.ownerUserId ?? ''))
      .filter((p) => !q.companyId || p.companyId === q.companyId)
      .filter((p) => !q.facilitatorId || p.facilitatorId === q.facilitatorId)
      .filter((p) => !q.status || p.status === q.status)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const items = rows.slice((q.page - 1) * q.pageSize, q.page * q.pageSize).map((payout) => {
      const facilitator = this.facilitators.items.find((f) => f.id === payout.facilitatorId);
      return {
        payout,
        companyName: this.companies.items.find((c) => c.id === payout.companyId)!.name.value,
        facilitatorName: facilitator ? `${facilitator.firstName} ${facilitator.lastName}` : '—',
      };
    });
    return { items, total: rows.length, page: q.page, pageSize: q.pageSize };
  }
}
