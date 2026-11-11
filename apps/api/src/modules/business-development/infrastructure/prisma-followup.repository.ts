import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../platform/prisma.service';
import { DomainError, Page } from '../../../shared-kernel';
import { Followup, FollowupChannel, FollowupStatus } from '../domain/followup';
import { FollowupDue, FollowupListItem, FollowupRepository } from '../domain/followup-repository';

type FollowupRow = Prisma.FollowupGetPayload<object>;

function toDomain(row: FollowupRow): Followup {
  return Followup.rehydrate({
    id: row.id,
    offerId: row.offerId,
    dueOn: row.dueOn.toISOString().slice(0, 10),
    channel: row.channel as FollowupChannel,
    note: row.note,
    status: row.status as FollowupStatus,
    resultNote: row.resultNote,
    closedAt: row.closedAt,
    createdAt: row.createdAt,
    version: row.version,
  });
}

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** Persistance PostgreSQL des relances (jamais supprimées : on les termine ou on les annule, avec un texte). */
@Injectable()
export class PrismaFollowupRepository implements FollowupRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Crée ou met à jour la relance ; une modification sur une version périmée est un conflit (verrou optimiste). */
  async save(followup: Followup): Promise<void> {
    const data = {
      dueOn: day(followup.dueOn),
      channel: followup.channel,
      note: followup.note,
      status: followup.status,
      resultNote: followup.resultNote,
      closedAt: followup.closedAt,
    };
    const updated = await this.prisma.db.followup.updateMany({
      where: { id: followup.id, version: followup.version },
      data: { ...data, version: { increment: 1 } },
    });
    if (updated.count === 1) return;
    if ((await this.prisma.db.followup.count({ where: { id: followup.id } })) > 0) {
      throw new DomainError('CONFLICT', 'La relance a été modifiée par un autre utilisateur : rechargez-la avant de la modifier');
    }
    await this.prisma.db.followup.create({ data: { id: followup.id, offerId: followup.offerId, ...data, version: followup.version, createdAt: followup.createdAt } });
  }

  async findById(id: string): Promise<Followup | null> {
    const row = await this.prisma.db.followup.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async listByOffer(offerId: string): Promise<Followup[]> {
    const rows = await this.prisma.db.followup.findMany({ where: { offerId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
    return rows.map(toDomain);
  }

  async countActiveByOffer(offerId: string): Promise<number> {
    return this.prisma.db.followup.count({ where: { offerId, status: { in: ['PLANNED', 'DONE'] } } });
  }

  async listPlannedByOffer(offerId: string): Promise<Followup[]> {
    const rows = await this.prisma.db.followup.findMany({ where: { offerId, status: 'PLANNED' }, orderBy: { dueOn: 'asc' } });
    return rows.map(toDomain);
  }

  async list(query: { page: number; pageSize: number; status?: FollowupStatus; due?: FollowupDue; today: string; offerId?: string; companyId?: string; ownerIds?: readonly string[] }): Promise<Page<FollowupListItem>> {
    const today = day(query.today);
    const dueFilter: Prisma.FollowupWhereInput =
      query.due === 'overdue' ? { status: 'PLANNED', dueOn: { lt: today } }
      : query.due === 'today' ? { status: 'PLANNED', dueOn: today }
      : query.due === 'upcoming' ? { status: 'PLANNED', dueOn: { gt: today } }
      : {};
    const where: Prisma.FollowupWhereInput = {
      offer: { ...(query.companyId ? { companyId: query.companyId } : {}), company: { deletedAt: null, ...(query.ownerIds ? { ownerUserId: { in: [...query.ownerIds] } } : {}) } },
      ...(query.offerId ? { offerId: query.offerId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...dueFilter,
    };
    const [rows, total] = await Promise.all([
      this.prisma.db.followup.findMany({
        where,
        include: { offer: { select: { reference: true, companyId: true, company: { select: { name: true } } } } },
        orderBy: [{ dueOn: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.db.followup.count({ where }),
    ]);
    return {
      items: rows.map((r) => ({ followup: toDomain(r), offerReference: r.offer.reference, companyId: r.offer.companyId, companyName: r.offer.company.name })),
      total, page: query.page, pageSize: query.pageSize,
    };
  }
}
