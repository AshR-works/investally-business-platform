import { Page } from '../../src/shared-kernel';
import { Approval, ACTIVE_APPROVAL_STATUSES } from '../../src/modules/business-development/domain/approval';
import { ApprovalListItem, ApprovalListQuery, ApprovalRepository } from '../../src/modules/business-development/domain/approval-repository';
import { Company } from '../../src/modules/business-development/domain/company';
import { Opportunity } from '../../src/modules/business-development/domain/opportunity';
import { DomainError } from '../../src/shared-kernel';

/** Dépôt d'agréments en mémoire ; il lit entreprises et opportunités pour appliquer la portée comme le fait la base, y compris l'unicité de l'agrément actif. */
export class InMemoryApprovals implements ApprovalRepository {
  readonly items: Approval[] = [];
  constructor(private readonly companies: { items: Company[] }, private readonly opportunities: { items: Opportunity[] }) {}

  async save(approval: Approval) {
    if (!this.items.includes(approval)) {
      if (this.items.some((a) => a.opportunityId === approval.opportunityId && ACTIVE_APPROVAL_STATUSES.includes(a.status))) {
        throw new DomainError('CONFLICT', 'Cette opportunité a déjà un agrément actif');
      }
      this.items.push(approval);
    }
  }
  async findById(id: string) {
    return this.items.find((a) => a.id === id) ?? null;
  }
  async findActiveByOpportunity(opportunityId: string) {
    return this.items.find((a) => a.opportunityId === opportunityId && ACTIVE_APPROVAL_STATUSES.includes(a.status)) ?? null;
  }
  async list(q: ApprovalListQuery): Promise<Page<ApprovalListItem>> {
    const rows = this.items
      .filter((a) => !q.ownerIds || q.ownerIds.includes(this.companies.items.find((c) => c.id === a.companyId)?.ownerUserId ?? ''))
      .filter((a) => !q.companyId || a.companyId === q.companyId)
      .filter((a) => !q.opportunityId || a.opportunityId === q.opportunityId)
      .filter((a) => !q.status || a.status === q.status)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const items = rows.slice((q.page - 1) * q.pageSize, q.page * q.pageSize).map((approval) => ({
      approval,
      companyName: this.companies.items.find((c) => c.id === approval.companyId)!.name.value,
      opportunityTitle: this.opportunities.items.find((o) => o.id === approval.opportunityId)!.title,
    }));
    return { items, total: rows.length, page: q.page, pageSize: q.pageSize };
  }
}
