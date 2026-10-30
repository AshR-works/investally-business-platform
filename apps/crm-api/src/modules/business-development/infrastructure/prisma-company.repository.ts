import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../platform/prisma.service';
import { DomainError, Page } from '../../../shared-kernel';
import { Commission } from '../domain/commission';
import { Company } from '../domain/company';
import { CompanyName } from '../domain/company-name';
import { CompanyListQuery, CompanyRepository, CompanySortField } from '../domain/company-repository';
import { CompanyStatus } from '../domain/company-status';
import { Facilitation } from '../domain/facilitation';

const withFacilitation = { facilitation: true } satisfies Prisma.CompanyInclude;
type CompanyRow = Prisma.CompanyGetPayload<{ include: typeof withFacilitation }>;

/** Reconstruit une entreprise du domaine à partir d'une ligne de base de données. */
function toDomain(row: CompanyRow): Company {
  const link = row.facilitation;
  return Company.rehydrate({
    id: row.id,
    name: CompanyName.of(row.name),
    status: row.status as CompanyStatus,
    ownerUserId: row.ownerUserId,
    sector: row.sector,
    country: row.country,
    email: row.email,
    phone: row.phone,
    facilitation: link
      ? Facilitation.of({
          facilitatorId: link.facilitatorId,
          contactMethod: link.contactMethod,
          isCompanyEmployee: link.isCompanyEmployee,
          commission: link.commissionType
            ? Commission.of({ type: link.commissionType, value: link.commissionValue!.toString(), currency: link.commissionCurrency })
            : null,
        })
      : null,
    createdAt: row.createdAt,
    version: row.version,
  });
}

/** Persistance PostgreSQL des entreprises (suppression logique : une entreprise supprimée est ignorée partout). */
@Injectable()
export class PrismaCompanyRepository implements CompanyRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée ou met à jour l'entreprise (clé de nom normalisée pour l'unicité). Le lien avec le facilitateur est écrit à
   * la création ; il n'est pas modifiable par cette opération.
   */
  async save(company: Company): Promise<void> {
    const data = {
      name: company.name.value,
      nameKey: company.name.normalized,
      status: company.status,
      ownerUserId: company.ownerUserId,
      sector: company.sector,
      country: company.country,
      email: company.email,
      phone: company.phone,
    };
    try {
      const updated = await this.prisma.db.company.updateMany({
        where: { id: company.id, version: company.version, deletedAt: null },
        data: { ...data, version: { increment: 1 } },
      });
      if (updated.count === 1) {
        await this.syncFacilitation(company);
        return;
      }

      if ((await this.prisma.db.company.count({ where: { id: company.id } })) > 0) {
        throw new DomainError('CONFLICT', "L'entreprise a été modifiée par un autre utilisateur");
      }
      const link = company.facilitation;
      await this.prisma.db.company.create({
        data: {
          id: company.id,
          ...data,
          version: company.version,
          createdAt: company.createdAt,
          ...(link
            ? {
                facilitation: {
                  create: {
                    facilitatorId: link.facilitatorId,
                    contactMethod: link.contactMethod,
                    isCompanyEmployee: link.isCompanyEmployee,
                    commissionType: link.commission?.type ?? null,
                    commissionValue: link.commission?.value ?? null,
                    commissionCurrency: link.commission?.currency ?? null,
                  },
                },
              }
            : {}),
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new DomainError('CONFLICT', `Une entreprise nommée « ${company.name.value} » existe déjà`);
      }
      throw error;
    }
  }

  /** Aligne le lien avec le facilitateur sur l'entreprise : créé, remplacé ou retiré (modification d'une fiche existante). */
  private async syncFacilitation(company: Company): Promise<void> {
    const link = company.facilitation;
    if (!link) {
      await this.prisma.db.companyFacilitation.deleteMany({ where: { companyId: company.id } });
      return;
    }
    const data = {
      facilitatorId: link.facilitatorId,
      contactMethod: link.contactMethod,
      isCompanyEmployee: link.isCompanyEmployee,
      commissionType: link.commission?.type ?? null,
      commissionValue: link.commission?.value ?? null,
      commissionCurrency: link.commission?.currency ?? null,
    };
    await this.prisma.db.companyFacilitation.upsert({ where: { companyId: company.id }, create: { companyId: company.id, ...data }, update: data });
  }

  /** Retrouve une entreprise non supprimée, ou `null`. */
  async findById(id: string): Promise<Company | null> {
    const row = await this.prisma.db.company.findFirst({ where: { id, deletedAt: null }, include: withFacilitation });
    return row ? toDomain(row) : null;
  }

  /** Vrai si une entreprise non supprimée porte déjà ce nom (comparaison sans casse). */
  async existsByName(name: CompanyName): Promise<boolean> {
    return (await this.prisma.db.company.count({ where: { nameKey: name.normalized, deletedAt: null } })) > 0;
  }

  /**
   * Liste paginée, la plus récente d'abord ; `ownerIds` restreint aux propriétaires autorisés (liste vide = aucune
   * entreprise), absent = aucune restriction.
   */
  async list(query: CompanyListQuery): Promise<Page<Company>> {
    const where = companyWhere(query);
    const direction = query.direction ?? 'desc';
    const [rows, total] = await Promise.all([
      this.prisma.db.company.findMany({
        where,
        include: withFacilitation,
        orderBy: [...orderFor(query.sort ?? 'createdAt', direction), { id: direction }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.db.company.count({ where }),
    ]);
    return { items: rows.map(toDomain), total, page: query.page, pageSize: query.pageSize };
  }
}

/** Filtre commun à la liste et à la synthèse : suppression logique, portée, recherche, pays et secteur (statut en plus pour la liste). */
export function companyWhere(query: { ownerIds?: readonly string[]; search?: string; status?: CompanyStatus; country?: string; sector?: string }): Prisma.CompanyWhereInput {
  return {
    deletedAt: null,
    ...(query.ownerIds ? { ownerUserId: { in: [...query.ownerIds] } } : {}),
    ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.country ? { country: { equals: query.country, mode: 'insensitive' } } : {}),
    ...(query.sector ? { sector: { equals: query.sector, mode: 'insensitive' } } : {}),
  };
}

/** Tri demandé ; les valeurs absentes (pays, secteur) passent toujours en dernier. */
function orderFor(field: CompanySortField, direction: 'asc' | 'desc'): Prisma.CompanyOrderByWithRelationInput[] {
  if (field === 'country' || field === 'sector') return [{ [field]: { sort: direction, nulls: 'last' } }];
  return [{ [field]: direction }];
}
