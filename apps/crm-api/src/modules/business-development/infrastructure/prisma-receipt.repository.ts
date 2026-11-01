import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../platform/prisma.service';
import { DomainError } from '../../../shared-kernel';
import { Receipt, ReceiptStatus } from '../domain/receipt';
import { ReceiptRepository } from '../domain/receipt-repository';

type ReceiptRow = Prisma.ReceiptGetPayload<object>;

function toDomain(row: ReceiptRow): Receipt {
  return Receipt.rehydrate({
    id: row.id,
    offerId: row.offerId,
    receivedOn: row.receivedOn.toISOString().slice(0, 10),
    receivedBy: row.receivedBy,
    status: row.status as ReceiptStatus,
    cancelledReason: row.cancelledReason,
    cancelledAt: row.cancelledAt,
    createdAt: row.createdAt,
    version: row.version,
  });
}

/** Persistance PostgreSQL des décharges (jamais supprimées : on les annule, avec un motif). */
@Injectable()
export class PrismaReceiptRepository implements ReceiptRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée ou met à jour la décharge ; une modification sur une version périmée est un conflit (verrou optimiste). Une seconde
   * décharge valide pour la même offre est refusée par la base (index unique partiel) et devient un conflit lisible.
   */
  async save(receipt: Receipt): Promise<void> {
    const data = {
      receivedOn: new Date(`${receipt.receivedOn}T00:00:00Z`),
      receivedBy: receipt.receivedBy,
      status: receipt.status,
      cancelledReason: receipt.cancelledReason,
      cancelledAt: receipt.cancelledAt,
    };
    const updated = await this.prisma.db.receipt.updateMany({
      where: { id: receipt.id, version: receipt.version },
      data: { ...data, version: { increment: 1 } },
    });
    if (updated.count === 1) return;
    if ((await this.prisma.db.receipt.count({ where: { id: receipt.id } })) > 0) {
      throw new DomainError('CONFLICT', 'La décharge a été modifiée par un autre utilisateur : rechargez-la avant de la modifier');
    }
    try {
      await this.prisma.db.receipt.create({ data: { id: receipt.id, offerId: receipt.offerId, ...data, version: receipt.version, createdAt: receipt.createdAt } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new DomainError('CONFLICT', 'Cette offre a déjà une décharge valide');
      }
      throw e;
    }
  }

  async findById(id: string): Promise<Receipt | null> {
    const row = await this.prisma.db.receipt.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async listByOffer(offerId: string): Promise<Receipt[]> {
    const rows = await this.prisma.db.receipt.findMany({ where: { offerId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
    return rows.map(toDomain);
  }
}
