import { Page } from '../../src/shared-kernel';
import { Facilitator } from '../../src/modules/business-development/domain/facilitator';
import { FacilitatorRepository } from '../../src/modules/business-development/domain/facilitator-repository';

/** Dépôt de facilitateurs en mémoire, pour les tests de cas d'usage et de portée. */
export class InMemoryFacilitators implements FacilitatorRepository {
  readonly items: Facilitator[] = [];
  async save(facilitator: Facilitator) {
    this.items.push(facilitator);
  }
  async findById(id: string) {
    return this.items.find((f) => f.id === id) ?? null;
  }
  async list(q: { page: number; pageSize: number; search?: string; ownerIds?: readonly string[] }): Promise<Page<Facilitator>> {
    const filtered = this.items
      .filter((f) => !q.ownerIds || q.ownerIds.includes(f.ownerUserId))
      .filter((f) => !q.search || `${f.firstName} ${f.lastName}`.toLowerCase().includes(q.search.toLowerCase()));
    return { items: filtered.slice((q.page - 1) * q.pageSize, q.page * q.pageSize), total: filtered.length, page: q.page, pageSize: q.pageSize };
  }
}
