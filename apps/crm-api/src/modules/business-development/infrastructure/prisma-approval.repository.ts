import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../platform/prisma.service';
import { DomainError, Page } from '../../../shared-kernel';
import { Approval, ApprovalStatus } from '../domain/approval';
import { ApprovalListItem, ApprovalListQuery, ApprovalRepository } from '../domain/approval-repository';

type ApprovalRow = Prisma.ApprovalGetPayload<object>;

const day = (date: Date | null): string | null => (date ? date.toISOString().slice(0, 10) : null);

function toDomain(row: ApprovalRow): Approval {
  return Approval.rehydrate({
    id: row.id,
    companyId: row.companyId,
    opportunityId: row.opportunityId,
    amount: row.amount ? row.amount.toFixed(2) : null,
    currency: row.currency,
    places: row.places,
    receivedOn: row.receivedOn.toISOString().slice(0, 10),
    validUntil: day(row.validUntil),
    status: row.status as ApprovalStatus,
    closedReason: row.closedReason,
    closedAt: row.closedAt,
    createdAt: row.createdAt,
    version: row.version,
  });
}

/** Persistance PostgreSQL des agréments (jamais supprimés : on les honore, les déclare expirés ou les annule, avec un motif). */
@Injectable()
export class PrismaApprovalRepository implements ApprovalRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée ou met à jour l'agrément ; une modification sur une version périmée est un conflit (verrou optimiste). Un second agrément
   * actif pour la même opportunité est refusé par la base (index unique partiel) et devient un conflit lisible.
   */
  async save(approval: Approval): Promise<void> {
    const data = {
      status: approval.status,
      closedReason: approval.closedReason,
      closedAt: approval.closedAt,
    };
    const updated = await this.prisma.db.approval.updateMany({
      where: { id: approval.id, version: approval.version },
      data: { ...data, version: { increment: 1 } },
    });
    if (updated.count === 1) return;
    if ((await this.prisma.db.approval.count({ where: { id: approval.id } })) > 0) {
      throw new DomainError('CONFLICT', "L'agrément a été modifié par un autre utilisateur : rechargez-le avant de le modifier");
    }
    try {
      await this.prisma.db.approval.create({
        data: {
          id: approval.id, companyId: approval.companyId, opportunityId: approval.opportunityId,
          amount: approval.amount, currency: approval.currency, places: approval.places,
          receivedOn: new Date(`${approval.receivedOn}T00:00:00Z`),
          validUntil: approval.validUntil ? new Date(`${approval.validUntil}T00:00:00Z`) : null,
          ...data, version: approval.version, createdAt: approval.createdAt,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new DomainError('CONFLICT', 'Cette opportunité a déjà un agrément actif');
      }
      throw e;
    }
  }

  async findById(id: string): Promise<Approval | null> {
    const row = await this.prisma.db.approval.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findActiveByOpportunity(opportunityId: string): Promise<Approval | null> {
    const row = await this.prisma.db.approval.findFirst({ where: { opportunityId, status: { in: ['RECEIVED', 'HONORED'] } } });
    return row ? toDomain(row) : null;
  }

  async list(query: ApprovalListQuery): Promise<Page<ApprovalListItem>> {
    const where: Prisma.ApprovalWhereInput = {
      company: { deletedAt: null, ...(query.ownerIds ? { ownerUserId: { in: [...query.ownerIds] } } : {}) },
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.opportunityId ? { opportunityId: query.opportunityId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.db.approval.findMany({
        where,
        include: { company: { select: { name: true } }, opportunity: { select: { title: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.db.approval.count({ where }),
    ]);
    return {
      items: rows.map((r) => ({ approval: toDomain(r), companyName: r.company.name, opportunityTitle: r.opportunity.title })),
      total, page: query.page, pageSize: query.pageSize,
    };
  }
}
