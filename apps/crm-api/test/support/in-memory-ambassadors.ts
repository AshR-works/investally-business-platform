import { DomainError, Page } from '../../src/shared-kernel';
import { Ambassador } from '../../src/modules/business-development/domain/ambassador';
import { AmbassadorListItem, AmbassadorListQuery, AmbassadorRepository } from '../../src/modules/business-development/domain/ambassador-repository';
import { Company } from '../../src/modules/business-development/domain/company';

/** Dépôt d'ambassadeurs en mémoire ; il applique la portée (créateur) et l'unicité de l'e-mail comme la base. */
export class InMemoryAmbassadors implements AmbassadorRepository {
  readonly items: Ambassador[] = [];
  constructor(private readonly companies: { items: Company[] } = { items: [] }) {}

  async save(ambassador: Ambassador) {
    if (ambassador.emailKey && this.items.some((a) => a !== ambassador && a.emailKey === ambassador.emailKey)) {
      throw new DomainError('CONFLICT', 'Un ambassadeur porte déjà cette adresse e-mail');
    }
    if (!this.items.includes(ambassador)) this.items.push(ambassador);
  }
  async findById(id: string) {
    return this.items.find((a) => a.id === id) ?? null;
  }
  async findByEmail(emailKey: string, excludeId?: string) {
    return this.items.find((a) => a.emailKey === emailKey && a.id !== excludeId) ?? null;
  }
  async list(q: AmbassadorListQuery): Promise<Page<AmbassadorListItem>> {
    const rows = this.items
      .filter((a) => !q.ownerIds || q.ownerIds.includes(a.ownerUserId))
      .filter((a) => !q.origin || a.origin === q.origin)
      .filter((a) => !q.search || `${a.firstName} ${a.lastName} ${a.email ?? ''}`.toLowerCase().includes(q.search.toLowerCase()))
      .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
    const items = rows.slice((q.page - 1) * q.pageSize, q.page * q.pageSize).map((ambassador) => ({
      ambassador,
      companyName: this.companies.items.find((c) => c.id === ambassador.companyId)?.name.value ?? null,
    }));
    return { items, total: rows.length, page: q.page, pageSize: q.pageSize };
  }
}
