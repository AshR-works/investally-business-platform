import { Page } from '../../src/shared-kernel';
import { Company } from '../../src/modules/business-development/domain/company';
import { Offer, OfferStatus } from '../../src/modules/business-development/domain/offer';
import { OfferListItem, OfferRepository } from '../../src/modules/business-development/domain/offer-repository';

/** Dépôt d'offres en mémoire ; il lit les entreprises pour appliquer la portée comme le fait la base. */
export class InMemoryOffers implements OfferRepository {
  readonly items: Offer[] = [];
  private readonly counters = new Map<number, number>();
  constructor(private readonly companies: { items: Company[] }) {}

  async save(offer: Offer) {
    if (!this.items.includes(offer)) this.items.push(offer);
  }
  async findById(id: string) {
    return this.items.find((o) => o.id === id) ?? null;
  }
  async nextReference(year: number) {
    const next = (this.counters.get(year) ?? 0) + 1;
    this.counters.set(year, next);
    return `OFF-${year}-${String(next).padStart(4, '0')}`;
  }
  async list(q: { page: number; pageSize: number; search?: string; companyId?: string; status?: OfferStatus; ownerIds?: readonly string[] }): Promise<Page<OfferListItem>> {
    const rows = this.items
      .map((offer) => ({ offer, company: this.companies.items.find((c) => c.id === offer.companyId)! }))
      .filter((r) => !q.ownerIds || q.ownerIds.includes(r.company.ownerUserId ?? ''))
      .filter((r) => !q.companyId || r.offer.companyId === q.companyId)
      .filter((r) => !q.status || r.offer.status === q.status)
      .filter((r) => !q.search || `${r.offer.reference} ${r.offer.subject}`.toLowerCase().includes(q.search.toLowerCase()));
    const items = rows.slice((q.page - 1) * q.pageSize, q.page * q.pageSize).map((r) => ({ offer: r.offer, companyName: r.company.name.value }));
    return { items, total: rows.length, page: q.page, pageSize: q.pageSize };
  }
}
