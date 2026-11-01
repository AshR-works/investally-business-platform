import { Page } from '../../src/shared-kernel';
import { Company } from '../../src/modules/business-development/domain/company';
import { Followup, FollowupStatus } from '../../src/modules/business-development/domain/followup';
import { FollowupDue, FollowupListItem, FollowupRepository } from '../../src/modules/business-development/domain/followup-repository';
import { Offer } from '../../src/modules/business-development/domain/offer';

/** Dépôt de relances en mémoire ; il lit les offres et les entreprises pour appliquer la portée comme le fait la base. */
export class InMemoryFollowups implements FollowupRepository {
  readonly items: Followup[] = [];
  constructor(private readonly offers: { items: Offer[] }, private readonly companies: { items: Company[] }) {}

  async save(followup: Followup) {
    if (!this.items.includes(followup)) this.items.push(followup);
  }
  async findById(id: string) {
    return this.items.find((f) => f.id === id) ?? null;
  }
  async listByOffer(offerId: string) {
    return this.items.filter((f) => f.offerId === offerId).reverse();
  }
  async countActiveByOffer(offerId: string) {
    return this.items.filter((f) => f.offerId === offerId && f.status !== FollowupStatus.Cancelled).length;
  }
  async listPlannedByOffer(offerId: string) {
    return this.items.filter((f) => f.offerId === offerId && f.status === FollowupStatus.Planned);
  }
  async list(q: { page: number; pageSize: number; status?: FollowupStatus; due?: FollowupDue; today: string; offerId?: string; ownerIds?: readonly string[] }): Promise<Page<FollowupListItem>> {
    const rows = this.items
      .map((followup) => {
        const offer = this.offers.items.find((o) => o.id === followup.offerId)!;
        return { followup, offer, company: this.companies.items.find((c) => c.id === offer.companyId)! };
      })
      .filter((r) => !q.ownerIds || q.ownerIds.includes(r.company.ownerUserId ?? ''))
      .filter((r) => !q.offerId || r.followup.offerId === q.offerId)
      .filter((r) => !q.status || r.followup.status === q.status)
      .filter((r) => {
        if (!q.due) return true;
        if (r.followup.status !== FollowupStatus.Planned) return false;
        return q.due === 'overdue' ? r.followup.dueOn < q.today : q.due === 'today' ? r.followup.dueOn === q.today : r.followup.dueOn > q.today;
      })
      .sort((a, b) => a.followup.dueOn.localeCompare(b.followup.dueOn) || a.followup.createdAt.getTime() - b.followup.createdAt.getTime());
    const items = rows.slice((q.page - 1) * q.pageSize, q.page * q.pageSize).map((r) => ({
      followup: r.followup, offerReference: r.offer.reference, companyId: r.company.id, companyName: r.company.name.value,
    }));
    return { items, total: rows.length, page: q.page, pageSize: q.pageSize };
  }
}
