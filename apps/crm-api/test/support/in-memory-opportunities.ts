import { Page } from '../../src/shared-kernel';
import { Company } from '../../src/modules/business-development/domain/company';
import { Opportunity } from '../../src/modules/business-development/domain/opportunity';
import { DecisionMakerMeetings, OpportunityListItem, OpportunityListQuery, OpportunityRepository } from '../../src/modules/business-development/domain/opportunity-repository';

/** Dépôt d'opportunités en mémoire ; il lit les entreprises pour appliquer la portée comme le fait la base. */
export class InMemoryOpportunities implements OpportunityRepository {
  readonly items: Opportunity[] = [];
  constructor(private readonly companies: { items: Company[] }) {}

  async save(opportunity: Opportunity) {
    if (!this.items.includes(opportunity)) this.items.push(opportunity);
  }
  async findById(id: string) {
    return this.items.find((o) => o.id === id) ?? null;
  }
  async list(q: OpportunityListQuery): Promise<Page<OpportunityListItem>> {
    const rows = this.items
      .map((opportunity) => ({ opportunity, company: this.companies.items.find((c) => c.id === opportunity.companyId)! }))
      .filter((r) => !q.ownerIds || q.ownerIds.includes(r.company.ownerUserId ?? ''))
      .filter((r) => !q.companyId || r.opportunity.companyId === q.companyId)
      .filter((r) => !q.status || r.opportunity.status === q.status)
      .filter((r) => !q.stage || r.opportunity.stage === q.stage)
      .filter((r) => !q.search || r.opportunity.title.toLowerCase().includes(q.search.toLowerCase()))
      .sort((a, b) => b.opportunity.updatedAt.getTime() - a.opportunity.updatedAt.getTime());
    const items = rows.slice((q.page - 1) * q.pageSize, q.page * q.pageSize).map((r) => ({ opportunity: r.opportunity, companyName: r.company.name.value }));
    return { items, total: rows.length, page: q.page, pageSize: q.pageSize };
  }
}

/** Rendez-vous décideur tenus, réglables par le test : les entreprises listées en ont un. */
export class FakeDecisionMakerMeetings implements DecisionMakerMeetings {
  /** Entreprises ayant un rendez-vous décideur tenu non lié à une opportunité. */
  readonly held = new Set<string>();
  /** Rendez-vous décideur tenus liés à une opportunité : « entreprise|opportunité ». */
  readonly heldFor = new Set<string>();
  async hasHeld(companyId: string, opportunityId: string) {
    return this.held.has(companyId) || this.heldFor.has(`${companyId}|${opportunityId}`);
  }
}
