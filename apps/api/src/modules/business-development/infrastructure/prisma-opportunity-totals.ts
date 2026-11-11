import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma.service';
import { OpenOpportunities, OpportunityTotals } from '../domain/opportunity-totals';

/** Somme des opportunités ouvertes par entreprise et par devise, calculée par la base (une requête, quel que soit le nombre d'entreprises). */
@Injectable()
export class PrismaOpportunityTotals implements OpportunityTotals {
  constructor(private readonly prisma: PrismaService) {}

  async openByCompany(companyIds: readonly string[]): Promise<ReadonlyMap<string, OpenOpportunities>> {
    const result = new Map<string, OpenOpportunities>();
    if (companyIds.length === 0) return result;
    const rows = await this.prisma.db.opportunity.groupBy({
      by: ['companyId', 'currency'],
      where: { status: 'OPEN', companyId: { in: [...companyIds] } },
      _sum: { amount: true },
      _count: { _all: true },
    });
    for (const row of rows.sort((a, b) => a.currency.localeCompare(b.currency))) {
      const entry = result.get(row.companyId) ?? { count: 0, totals: [] };
      entry.count += row._count._all;
      entry.totals.push({ currency: row.currency, amount: row._sum.amount?.toFixed(2) ?? '0.00' });
      result.set(row.companyId, entry);
    }
    return result;
  }
}
