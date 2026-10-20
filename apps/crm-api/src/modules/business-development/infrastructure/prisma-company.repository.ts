import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../platform/prisma.service';
import { DomainError, Page } from '../../../shared-kernel';
import { Company } from '../domain/company';
import { CompanyName } from '../domain/company-name';
import { CompanyRepository } from '../domain/company-repository';
import { CompanyStatus } from '../domain/company-status';

type CompanyRow = Prisma.CompanyGetPayload<object>;

function toDomain(row: CompanyRow): Company {
  return Company.rehydrate({
    id: row.id,
    name: CompanyName.of(row.name),
    status: row.status as CompanyStatus,
    sector: row.sector,
    country: row.country,
    createdAt: row.createdAt,
    version: row.version,
  });
}

@Injectable()
export class PrismaCompanyRepository implements CompanyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(company: Company): Promise<void> {
    const data = {
      name: company.name.value,
      nameKey: company.name.normalized,
      status: company.status,
      sector: company.sector,
      country: company.country,
    };
    try {
      const updated = await this.prisma.db.company.updateMany({
        where: { id: company.id, version: company.version, deletedAt: null },
        data: { ...data, version: { increment: 1 } },
      });
      if (updated.count === 1) return;

      if ((await this.prisma.db.company.count({ where: { id: company.id } })) > 0) {
        throw new DomainError('CONFLICT', "L'entreprise a été modifiée par un autre utilisateur");
      }
      await this.prisma.db.company.create({
        data: { id: company.id, ...data, version: company.version, createdAt: company.createdAt },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new DomainError('CONFLICT', `Une entreprise nommée « ${company.name.value} » existe déjà`);
      }
      throw error;
    }
  }

  async findById(id: string): Promise<Company | null> {
    const row = await this.prisma.db.company.findFirst({ where: { id, deletedAt: null } });
    return row ? toDomain(row) : null;
  }

  async existsByName(name: CompanyName): Promise<boolean> {
    return (await this.prisma.db.company.count({ where: { nameKey: name.normalized, deletedAt: null } })) > 0;
  }

  async list(query: { page: number; pageSize: number; search?: string }): Promise<Page<Company>> {
    const where: Prisma.CompanyWhereInput = {
      deletedAt: null,
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.db.company.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.db.company.count({ where }),
    ]);
    return { items: rows.map(toDomain), total, page: query.page, pageSize: query.pageSize };
  }
}
