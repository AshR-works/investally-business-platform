import { DomainError, Page } from '../../src/shared-kernel';
import { Employee, EmployeeStatus } from '../../src/modules/hr/domain/employee';
import { EmployeeListQuery, EmployeeRepository } from '../../src/modules/hr/domain/employee-repository';
import { UserDirectory, UserRef } from '../../src/modules/hr/domain/user-directory';

const byName = (a: Employee, b: Employee) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName);
const matches = (e: Employee, search: string | undefined) =>
  !search || [e.lastName, e.firstName, e.jobTitle, e.department, e.workEmail ?? '', e.matricule ?? ''].join(' ').toLowerCase().includes(search.toLowerCase());

/** Dépôt d'employés en mémoire : applique la portée (compte lié) et les unicités (matricule, e-mail, compte) comme la base. Les versions ne sont pas incrémentées (c'est le travail de la base). */
export class InMemoryEmployees implements EmployeeRepository {
  readonly items: Employee[] = [];

  async save(e: Employee) {
    const clash = this.items.find((o) => o !== e && ((e.matricule && o.matricule === e.matricule) || (e.workEmail && o.workEmail === e.workEmail) || (e.userId && o.userId === e.userId)));
    if (clash) throw new DomainError('CONFLICT', 'Un employé porte déjà ce matricule, cette adresse e-mail professionnelle ou ce compte');
    if (!this.items.includes(e)) this.items.push(e);
  }
  async findById(id: string) { return this.items.find((e) => e.id === id) ?? null; }
  async findByIds(ids: readonly string[]) { return this.items.filter((e) => ids.includes(e.id)); }
  async findByMatricule(matricule: string, excludeId?: string) { return this.items.find((e) => e.matricule === matricule && e.id !== excludeId) ?? null; }
  async findByWorkEmail(emailKey: string, excludeId?: string) { return this.items.find((e) => e.workEmail === emailKey && e.id !== excludeId) ?? null; }
  async findByUserId(userId: string, excludeId?: string) { return this.items.find((e) => e.userId === userId && e.id !== excludeId) ?? null; }

  async linkedUserIds() { return this.items.flatMap((e) => (e.userId ? [e.userId] : [])); }

  async list(q: EmployeeListQuery): Promise<Page<Employee>> {
    const rows = this.items
      .filter((e) => !q.userIds || (e.userId !== null && q.userIds.includes(e.userId)))
      .filter((e) => !q.status || e.status === q.status)
      .filter((e) => !q.department || e.department.toLowerCase() === q.department.toLowerCase())
      .filter((e) => matches(e, q.search))
      .sort(byName);
    return { items: rows.slice((q.page - 1) * q.pageSize, q.page * q.pageSize), total: rows.length, page: q.page, pageSize: q.pageSize };
  }
  async listActive(q: { search?: string; department?: string; page?: number; pageSize?: number }): Promise<Page<Employee>> {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 50;
    const rows = this.items.filter((e) => e.status === EmployeeStatus.Active && (!q.department || e.department.toLowerCase() === q.department.toLowerCase()) && matches(e, q.search)).sort(byName);
    return { items: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize };
  }
  async allActive(limit: number) { return this.items.filter((e) => e.status === EmployeeStatus.Active).sort(byName).slice(0, limit); }
}

/** Annuaire de comptes en mémoire, déclarés par le test. */
export class InMemoryUsers implements UserDirectory {
  readonly users = new Map<string, UserRef>();
  add(id: string, displayName: string, managerUserId: string | null = null, status = 'ACTIVE') { this.users.set(id, { id, displayName, status, managerUserId }); }
  async find(id: string) { return this.users.get(id) ?? null; }
  async assignable() { return [...this.users.values()].filter((u) => u.status === 'ACTIVE' || u.status === 'PENDING').sort((a, b) => a.displayName.localeCompare(b.displayName)); }
  async findMany(ids: readonly string[]) { return ids.flatMap((id) => (this.users.has(id) ? [this.users.get(id)!] : [])); }
}
