import { Page } from '../../src/shared-kernel';
import { Contract, ContractType } from '../../src/modules/hr/domain/contract';
import { ContractListQuery, ContractRepository, ContractTypeRepository } from '../../src/modules/hr/domain/contract-repositories';

/** Contrats en mémoire : mêmes recherches que la base (tri par début décroissant, échéances en jours inclus). Les versions ne sont pas incrémentées (travail de la base). */
export class InMemoryContracts implements ContractRepository {
  readonly items: Contract[] = [];
  /** Employés dont la fiche a été verrouillée (dans l'ordre des appels). */
  readonly locks: string[] = [];

  async save(contract: Contract) {
    if (!this.items.includes(contract)) this.items.push(contract);
  }
  async findById(id: string) { return this.items.find((c) => c.id === id) ?? null; }
  async ofEmployee(employeeId: string) { return this.items.filter((c) => c.employeeId === employeeId).sort((a, b) => b.start.localeCompare(a.start)); }
  async list(q: ContractListQuery): Promise<Page<Contract>> {
    const rows = this.items
      .filter((c) => !q.employeeIds || q.employeeIds.includes(c.employeeId))
      .filter((c) => !q.status || c.status === q.status)
      .sort((a, b) => b.start.localeCompare(a.start) || a.id.localeCompare(b.id));
    return { items: rows.slice((q.page - 1) * q.pageSize, q.page * q.pageSize), total: rows.length, page: q.page, pageSize: q.pageSize };
  }
  async deadlines(from: string, to: string) {
    return this.items.filter((c) => c.isActive && ((c.end !== null && c.end >= from && c.end <= to) || (c.probationEnd !== null && c.probationEnd >= from && c.probationEnd <= to)));
  }
  async lockEmployee(employeeId: string) { this.locks.push(employeeId); }
}

export class InMemoryContractTypes implements ContractTypeRepository {
  readonly list: ContractType[] = [];

  async types(includeInactive: boolean) { return this.list.filter((t) => includeInactive || t.active).sort((a, b) => a.sortOrder - b.sortOrder); }
  async findType(id: string) { return this.list.find((t) => t.id === id) ?? null; }
  async findTypeByCode(code: string) { return this.list.find((t) => t.code === code) ?? null; }
  async findTypes(ids: readonly string[]) { return this.list.filter((t) => ids.includes(t.id)); }
  async saveType(type: ContractType) { if (!this.list.includes(type)) this.list.push(type); }
}
