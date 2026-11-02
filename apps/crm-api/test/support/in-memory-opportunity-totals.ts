import { OpenOpportunities, OpportunityTotals } from '../../src/modules/business-development/domain/opportunity-totals';
import { InMemoryOpportunities } from './in-memory-opportunities';

/** Totaux des opportunités ouvertes calculés depuis le dépôt en mémoire, devise par devise (montants à deux décimales). */
export class InMemoryOpportunityTotals implements OpportunityTotals {
  constructor(private readonly opportunities: InMemoryOpportunities) {}

  async openByCompany(companyIds: readonly string[]) {
    const result = new Map<string, OpenOpportunities>();
    for (const o of this.opportunities.items.filter((x) => x.status === 'OPEN' && companyIds.includes(x.companyId))) {
      const entry = result.get(o.companyId) ?? { count: 0, totals: [] };
      entry.count += 1;
      const line = entry.totals.find((t) => t.currency === o.currency);
      if (line) line.amount = (Number(line.amount) + Number(o.amount)).toFixed(2);
      else entry.totals.push({ currency: o.currency, amount: Number(o.amount).toFixed(2) });
      entry.totals.sort((a, b) => a.currency.localeCompare(b.currency));
      result.set(o.companyId, entry);
    }
    return result;
  }
}
