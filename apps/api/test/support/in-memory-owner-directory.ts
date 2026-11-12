import { OwnerDirectory, OwnerSummary } from '../../src/modules/business-development/domain/owner-directory';

/** Annuaire des propriétaires en mémoire : les personnes données sont toutes des candidats actifs. */
export class InMemoryOwnerDirectory implements OwnerDirectory {
  constructor(readonly people: OwnerSummary[] = []) {}

  async candidates(ids?: readonly string[]) {
    return this.people.filter((p) => !ids || ids.includes(p.id)).sort((a, b) => a.name.localeCompare(b.name));
  }
  async names(ids: readonly string[]) {
    return new Map(this.people.filter((p) => ids.includes(p.id)).map((p) => [p.id, p.name] as [string, string]));
  }
}
