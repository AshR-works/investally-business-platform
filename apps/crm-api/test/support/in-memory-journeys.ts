import { Page } from '../../src/shared-kernel';
import { Journey, JourneyKind, JourneyTemplate } from '../../src/modules/hr/domain/journey';
import { JourneyListQuery, JourneyRepository, JourneyTemplateRepository } from '../../src/modules/hr/domain/journey-repositories';

/** Parcours en mémoire : mêmes recherches que la base (tri par création décroissante, un seul en cours par employé et nature). Les versions ne sont pas incrémentées (travail de la base). */
export class InMemoryJourneys implements JourneyRepository {
  readonly items: Journey[] = [];
  /** Employés dont la fiche a été verrouillée (dans l'ordre des appels). */
  readonly locks: string[] = [];

  async save(journey: Journey) {
    if (!this.items.includes(journey)) this.items.push(journey);
  }
  async findById(id: string) { return this.items.find((j) => j.id === id) ?? null; }
  async activeOf(employeeId: string, kind: JourneyKind) { return this.items.find((j) => j.employeeId === employeeId && j.kind === kind && j.isActive) ?? null; }
  async list(q: JourneyListQuery): Promise<Page<Journey>> {
    const rows = this.items
      .filter((j) => !q.employeeIds || q.employeeIds.includes(j.employeeId))
      .filter((j) => !q.kind || j.kind === q.kind)
      .filter((j) => !q.status || j.status === q.status)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || a.id.localeCompare(b.id));
    return { items: rows.slice((q.page - 1) * q.pageSize, q.page * q.pageSize), total: rows.length, page: q.page, pageSize: q.pageSize };
  }
  async lockEmployee(employeeId: string) { this.locks.push(employeeId); }
}

export class InMemoryJourneyTemplates implements JourneyTemplateRepository {
  readonly list: JourneyTemplate[] = [];
  async all() { return [...this.list]; }
  async get(kind: JourneyKind) { return this.list.find((t) => t.kind === kind) ?? null; }
  async save(template: JourneyTemplate) { if (!this.list.includes(template)) this.list.push(template); }
}
