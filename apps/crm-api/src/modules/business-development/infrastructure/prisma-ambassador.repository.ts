import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../platform/prisma.service';
import { DomainError, Page } from '../../../shared-kernel';
import { Ambassador, AmbassadorOrigin } from '../domain/ambassador';
import { AmbassadorListItem, AmbassadorListQuery, AmbassadorRepository } from '../domain/ambassador-repository';

type AmbassadorRow = Prisma.AmbassadorGetPayload<object>;

function toDomain(row: AmbassadorRow): Ambassador {
  return Ambassador.rehydrate({
    id: row.id,
    ownerUserId: row.ownerUserId,
    lastName: row.lastName,
    firstName: row.firstName,
    origin: row.origin as AmbassadorOrigin,
    companyId: row.companyId,
    email: row.email,
    phone: row.phone,
    appointedOn: row.appointedOn.toISOString().slice(0, 10),
    note: row.note,
    createdAt: row.createdAt,
    version: row.version,
  });
}

/** Persistance PostgreSQL des ambassadeurs (jamais supprimés dans cette version). */
@Injectable()
export class PrismaAmbassadorRepository implements AmbassadorRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée ou met à jour l'ambassadeur ; une modification sur une version périmée est un conflit (verrou optimiste). Un e-mail déjà pris
   * est refusé par la base (index unique) et devient un conflit lisible.
   */
  async save(ambassador: Ambassador): Promise<void> {
    const data = {
      lastName: ambassador.lastName,
      firstName: ambassador.firstName,
      companyId: ambassador.companyId,
      email: ambassador.email,
      phone: ambassador.phone,
      appointedOn: new Date(`${ambassador.appointedOn}T00:00:00Z`),
      note: ambassador.note,
    };
    try {
      const updated = await this.prisma.db.ambassador.updateMany({
        where: { id: ambassador.id, version: ambassador.version },
        data: { ...data, version: { increment: 1 } },
      });
      if (updated.count === 1) return;
      if ((await this.prisma.db.ambassador.count({ where: { id: ambassador.id } })) > 0) {
        throw new DomainError('CONFLICT', "L'ambassadeur a été modifié par un autre utilisateur : rechargez-le avant de le modifier");
      }
      await this.prisma.db.ambassador.create({
        data: { id: ambassador.id, ownerUserId: ambassador.ownerUserId, origin: ambassador.origin, ...data, version: ambassador.version, createdAt: ambassador.createdAt },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new DomainError('CONFLICT', 'Un ambassadeur porte déjà cette adresse e-mail');
      }
      throw e;
    }
  }

  async findById(id: string): Promise<Ambassador | null> {
    const row = await this.prisma.db.ambassador.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findByEmail(emailKey: string, excludeId?: string): Promise<Ambassador | null> {
    const row = await this.prisma.db.ambassador.findFirst({ where: { email: emailKey, ...(excludeId ? { id: { not: excludeId } } : {}) } });
    return row ? toDomain(row) : null;
  }

  async list(query: AmbassadorListQuery): Promise<Page<AmbassadorListItem>> {
    const where: Prisma.AmbassadorWhereInput = {
      ...(query.ownerIds ? { ownerUserId: { in: [...query.ownerIds] } } : {}),
      ...(query.origin ? { origin: query.origin } : {}),
      ...(query.search
        ? {
            OR: [
              { lastName: { contains: query.search, mode: 'insensitive' } },
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.db.ambassador.findMany({
        where,
        include: { company: { select: { name: true } } },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.db.ambassador.count({ where }),
    ]);
    return { items: rows.map((r) => ({ ambassador: toDomain(r), companyName: r.company?.name ?? null })), total, page: query.page, pageSize: query.pageSize };
  }
}
