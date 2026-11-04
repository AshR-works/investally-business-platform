import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../platform/prisma.service';
import { DomainError, Page } from '../../../shared-kernel';
import { CommissionType } from '../domain/commission';
import { CommissionPayout, PayoutStatus } from '../domain/commission-payout';
import { CommissionPayoutRepository, PayoutListItem, PayoutListQuery } from '../domain/commission-payout-repository';

type PayoutRow = Prisma.CommissionPayoutGetPayload<object>;

const day = (date: Date | null): string | null => (date ? date.toISOString().slice(0, 10) : null);

function toDomain(row: PayoutRow): CommissionPayout {
  return CommissionPayout.rehydrate({
    id: row.id,
    companyId: row.companyId,
    facilitatorId: row.facilitatorId,
    approvalId: row.approvalId,
    commissionType: row.commissionType as CommissionType,
    commissionValue: row.commissionValue.toFixed(2),
    commissionCurrency: row.commissionCurrency,
    amount: row.amount ? row.amount.toFixed(2) : null,
    currency: row.currency,
    status: row.status as PayoutStatus,
    holdReason: row.holdReason,
    cancelledReason: row.cancelledReason,
    paidOn: day(row.paidOn),
    createdAt: row.createdAt,
    version: row.version,
  });
}

/** Persistance PostgreSQL des versements de commission (jamais supprimés : on les annule, avec un motif). */
@Injectable()
export class PrismaCommissionPayoutRepository implements CommissionPayoutRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée ou met à jour le versement ; une modification sur une version périmée est un conflit (verrou optimiste). Un second versement pour
   * le même agrément est refusé par la base (clé unique) et devient un conflit lisible.
   */
  async save(payout: CommissionPayout): Promise<void> {
    const data = {
      amount: payout.amount,
      status: payout.status,
      holdReason: payout.holdReason,
      cancelledReason: payout.cancelledReason,
      paidOn: payout.paidOn ? new Date(`${payout.paidOn}T00:00:00Z`) : null,
    };
    const updated = await this.prisma.db.commissionPayout.updateMany({
      where: { id: payout.id, version: payout.version },
      data: { ...data, version: { increment: 1 } },
    });
    if (updated.count === 1) return;
    if ((await this.prisma.db.commissionPayout.count({ where: { id: payout.id } })) > 0) {
      throw new DomainError('CONFLICT', 'La commission a été modifiée par un autre utilisateur : rechargez-la avant de la modifier');
    }
    try {
      await this.prisma.db.commissionPayout.create({
        data: {
          id: payout.id, companyId: payout.companyId, facilitatorId: payout.facilitatorId, approvalId: payout.approvalId,
          commissionType: payout.commissionType, commissionValue: payout.commissionValue, commissionCurrency: payout.commissionCurrency,
          currency: payout.currency, ...data, version: payout.version, createdAt: payout.createdAt,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new DomainError('CONFLICT', 'Cet agrément a déjà son versement de commission');
      }
      throw e;
    }
  }

  async findById(id: string): Promise<CommissionPayout | null> {
    const row = await this.prisma.db.commissionPayout.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findByApproval(approvalId: string): Promise<CommissionPayout | null> {
    const row = await this.prisma.db.commissionPayout.findUnique({ where: { approvalId } });
    return row ? toDomain(row) : null;
  }

  async list(query: PayoutListQuery): Promise<Page<PayoutListItem>> {
    const where: Prisma.CommissionPayoutWhereInput = {
      company: { deletedAt: null, ...(query.ownerIds ? { ownerUserId: { in: [...query.ownerIds] } } : {}) },
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.facilitatorId ? { facilitatorId: query.facilitatorId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.db.commissionPayout.findMany({
        where,
        include: { company: { select: { name: true } }, facilitator: { select: { firstName: true, lastName: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.db.commissionPayout.count({ where }),
    ]);
    return {
      items: rows.map((r) => ({ payout: toDomain(r), companyName: r.company.name, facilitatorName: `${r.facilitator.firstName} ${r.facilitator.lastName}` })),
      total, page: query.page, pageSize: query.pageSize,
    };
  }
}
