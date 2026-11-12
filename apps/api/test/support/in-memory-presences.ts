import { PresenceDeclaration } from '../../src/modules/hr/domain/presence';
import { PresenceRepository } from '../../src/modules/hr/domain/presence-repositories';

/** Présences en mémoire : mêmes recherches que la base (une par employé et par jour, bornes incluses, tri par jour puis employé). Les versions ne sont pas incrémentées (travail de la base). */
export class InMemoryPresences implements PresenceRepository {
  readonly items: PresenceDeclaration[] = [];

  async save(declaration: PresenceDeclaration) {
    if (!this.items.includes(declaration)) this.items.push(declaration);
  }
  async find(employeeId: string, day: string) { return this.items.find((d) => d.employeeId === employeeId && d.day === day) ?? null; }
  async remove(employeeId: string, day: string) {
    const index = this.items.findIndex((d) => d.employeeId === employeeId && d.day === day);
    if (index >= 0) this.items.splice(index, 1);
  }
  async between(from: string, to: string, employeeIds: readonly string[]) {
    return this.items
      .filter((d) => d.day >= from && d.day <= to && employeeIds.includes(d.employeeId))
      .sort((a, b) => a.day.localeCompare(b.day) || a.employeeId.localeCompare(b.employeeId));
  }
}
