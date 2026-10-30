import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma.service';
import { CompanyOverview, CompanyOverviewReader } from '../domain/company-overview-reader';
import { CompanyStatus } from '../domain/company-status';
import { companyWhere } from './prisma-company.repository';

/** Synthèse PostgreSQL : compteurs par statut (recherche, pays, secteur appliqués) et valeurs de filtre de la portée. */
@Injectable()
export class PrismaCompanyOverviewReader implements CompanyOverviewReader {
  constructor(private readonly prisma: PrismaService) {}

  async overview(query: { ownerIds?: readonly string[]; search?: string; country?: string; sector?: string }): Promise<CompanyOverview> {
    const scope = companyWhere({ ownerIds: query.ownerIds });
    const [grouped, countries, sectors] = await Promise.all([
      this.prisma.db.company.groupBy({ by: ['status'], where: companyWhere(query), _count: { _all: true } }),
      this.prisma.db.company.findMany({ where: { ...scope, country: { not: null } }, select: { country: true }, distinct: ['country'], orderBy: { country: 'asc' } }),
      this.prisma.db.company.findMany({ where: { ...scope, sector: { not: null } }, select: { sector: true }, distinct: ['sector'], orderBy: { sector: 'asc' } }),
    ]);
    const statusCounts = Object.fromEntries(Object.values(CompanyStatus).map((s) => [s, 0])) as Record<string, number>;
    for (const row of grouped) statusCounts[row.status] = row._count._all;
    return {
      statusCounts,
      countries: countries.map((c) => c.country as string),
      sectors: sectors.map((s) => s.sector as string),
    };
  }
}
