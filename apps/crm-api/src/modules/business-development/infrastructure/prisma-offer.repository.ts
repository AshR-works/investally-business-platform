import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../platform/prisma.service';
import { DomainError, Page } from '../../../shared-kernel';
import { Offer, OfferStatus } from '../domain/offer';
import { OfferListItem, OfferRepository } from '../domain/offer-repository';

type OfferRow = Prisma.OfferGetPayload<object>;

function toDomain(row: OfferRow): Offer {
  return Offer.rehydrate({
    id: row.id,
    reference: row.reference,
    companyId: row.companyId,
    subject: row.subject,
    amount: row.amount.toFixed(2),
    currency: row.currency,
    status: row.status as OfferStatus,
    note: row.note,
    submittedAt: row.submittedAt,
    decidedAt: row.decidedAt,
    withdrawnReason: row.withdrawnReason,
    createdAt: row.createdAt,
    version: row.version,
  });
}

/** Persistance PostgreSQL des offres (jamais supprimées : on les retire). */
@Injectable()
export class PrismaOfferRepository implements OfferRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Crée ou met à jour l'offre ; une modification sur une version périmée est un conflit (verrou optimiste). */
  async save(offer: Offer): Promise<void> {
    const data = {
      companyId: offer.companyId,
      subject: offer.subject,
      amount: offer.amount,
      currency: offer.currency,
      status: offer.status,
      note: offer.note,
      submittedAt: offer.submittedAt,
      decidedAt: offer.decidedAt,
      withdrawnReason: offer.withdrawnReason,
    };
    const updated = await this.prisma.db.offer.updateMany({
      where: { id: offer.id, version: offer.version },
      data: { ...data, version: { increment: 1 } },
    });
    if (updated.count === 1) return;
    if ((await this.prisma.db.offer.count({ where: { id: offer.id } })) > 0) {
      throw new DomainError('CONFLICT', "L'offre a été modifiée par un autre utilisateur : rechargez-la avant de la modifier");
    }
    await this.prisma.db.offer.create({ data: { id: offer.id, reference: offer.reference, ...data, version: offer.version, createdAt: offer.createdAt } });
  }

  async findById(id: string): Promise<Offer | null> {
    const row = await this.prisma.db.offer.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  /** Incrémente le compteur de l'année dans la transaction en cours : deux créations simultanées ne partagent jamais un numéro. */
  async nextReference(year: number): Promise<string> {
    const counter = await this.prisma.db.offerCounter.upsert({
      where: { year },
      create: { year, last: 1 },
      update: { last: { increment: 1 } },
    });
    return `OFF-${year}-${String(counter.last).padStart(4, '0')}`;
  }

  async list(query: { page: number; pageSize: number; search?: string; companyId?: string; status?: OfferStatus; ownerIds?: readonly string[] }): Promise<Page<OfferListItem>> {
    const where: Prisma.OfferWhereInput = {
      company: { deletedAt: null, ...(query.ownerIds ? { ownerUserId: { in: [...query.ownerIds] } } : {}) },
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? { OR: [{ reference: { contains: query.search, mode: 'insensitive' } }, { subject: { contains: query.search, mode: 'insensitive' } }] }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.db.offer.findMany({
        where,
        include: { company: { select: { name: true } }, followups: { where: { status: 'PLANNED' }, orderBy: { dueOn: 'asc' }, take: 1, select: { dueOn: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.db.offer.count({ where }),
    ]);
    return { items: rows.map((r) => ({ offer: toDomain(r), companyName: r.company.name, nextFollowupOn: r.followups[0]?.dueOn.toISOString().slice(0, 10) ?? null })), total, page: query.page, pageSize: query.pageSize };
  }
}
