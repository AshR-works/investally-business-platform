import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../platform/prisma.service';
import { Page } from '../../../shared-kernel';
import { Facilitator } from '../domain/facilitator';
import { FacilitatorRepository } from '../domain/facilitator-repository';

type FacilitatorRow = Prisma.FacilitatorGetPayload<object>;

function toDomain(row: FacilitatorRow): Facilitator {
  return Facilitator.rehydrate({
    id: row.id,
    lastName: row.lastName,
    firstName: row.firstName,
    phone: row.phone,
    comment: row.comment,
    ownerUserId: row.ownerUserId,
    createdAt: row.createdAt,
    version: row.version,
  });
}

/** Persistance PostgreSQL des facilitateurs. */
@Injectable()
export class PrismaFacilitatorRepository implements FacilitatorRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Crée le facilitateur (aucune modification n'existe encore : seule la création est possible). */
  async save(facilitator: Facilitator): Promise<void> {
    await this.prisma.db.facilitator.create({
      data: {
        id: facilitator.id,
        lastName: facilitator.lastName,
        firstName: facilitator.firstName,
        phone: facilitator.phone,
        comment: facilitator.comment,
        ownerUserId: facilitator.ownerUserId,
        version: facilitator.version,
        createdAt: facilitator.createdAt,
      },
    });
  }

  async findById(id: string): Promise<Facilitator | null> {
    const row = await this.prisma.db.facilitator.findFirst({ where: { id, deletedAt: null } });
    return row ? toDomain(row) : null;
  }

  /** Liste paginée, la plus récente d'abord ; `ownerIds` restreint aux propriétaires autorisés. */
  async list(query: { page: number; pageSize: number; search?: string; ownerIds?: readonly string[] }): Promise<Page<Facilitator>> {
    const where: Prisma.FacilitatorWhereInput = {
      deletedAt: null,
      ...(query.ownerIds ? { ownerUserId: { in: [...query.ownerIds] } } : {}),
      ...(query.search
        ? {
            OR: [
              { lastName: { contains: query.search, mode: 'insensitive' } },
              { firstName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.db.facilitator.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.db.facilitator.count({ where }),
    ]);
    return { items: rows.map(toDomain), total, page: query.page, pageSize: query.pageSize };
  }
}
