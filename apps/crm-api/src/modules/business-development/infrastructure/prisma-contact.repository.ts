import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../platform/prisma.service';
import { DomainError, Page } from '../../../shared-kernel';
import { Contact, ContactRole } from '../domain/contact';
import { ContactListItem, ContactRepository } from '../domain/contact-repository';

type ContactRow = Prisma.ContactGetPayload<object>;

function toDomain(row: ContactRow): Contact {
  return Contact.rehydrate({
    id: row.id,
    companyId: row.companyId,
    lastName: row.lastName,
    firstName: row.firstName,
    role: row.role as ContactRole,
    email: row.email,
    phone: row.phone,
    createdAt: row.createdAt,
    version: row.version,
  });
}

/** Persistance PostgreSQL des contacts (suppression logique). */
@Injectable()
export class PrismaContactRepository implements ContactRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Crée ou met à jour le contact ; une modification sur une version périmée est un conflit (verrou optimiste). */
  async save(contact: Contact): Promise<void> {
    const data = {
      companyId: contact.companyId,
      lastName: contact.lastName,
      firstName: contact.firstName,
      nameKey: contact.nameKey,
      role: contact.role,
      email: contact.email,
      emailKey: contact.emailKey,
      phone: contact.phone,
    };
    const updated = await this.prisma.db.contact.updateMany({
      where: { id: contact.id, version: contact.version, deletedAt: null },
      data: { ...data, version: { increment: 1 } },
    });
    if (updated.count === 1) return;
    if ((await this.prisma.db.contact.count({ where: { id: contact.id } })) > 0) {
      throw new DomainError('CONFLICT', 'Le contact a été modifié par un autre utilisateur : rechargez-le avant de le modifier');
    }
    await this.prisma.db.contact.create({ data: { id: contact.id, ...data, version: contact.version, createdAt: contact.createdAt } });
  }

  async findById(id: string): Promise<Contact | null> {
    const row = await this.prisma.db.contact.findFirst({ where: { id, deletedAt: null } });
    return row ? toDomain(row) : null;
  }

  async remove(id: string): Promise<void> {
    await this.prisma.db.contact.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: new Date() } });
  }

  async findDuplicates(query: { companyId: string; nameKey: string; emailKey: string | null; excludeId?: string }): Promise<Contact[]> {
    const rows = await this.prisma.db.contact.findMany({
      where: {
        companyId: query.companyId,
        deletedAt: null,
        ...(query.excludeId ? { id: { not: query.excludeId } } : {}),
        OR: [{ nameKey: query.nameKey }, ...(query.emailKey ? [{ emailKey: query.emailKey }] : [])],
      },
    });
    return rows.map(toDomain);
  }

  async list(query: { page: number; pageSize: number; search?: string; companyId?: string; role?: ContactRole; ownerIds?: readonly string[] }): Promise<Page<ContactListItem>> {
    const where: Prisma.ContactWhereInput = {
      deletedAt: null,
      company: { deletedAt: null, ...(query.ownerIds ? { ownerUserId: { in: [...query.ownerIds] } } : {}) },
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.role ? { role: query.role } : {}),
      ...(query.search
        ? { OR: [{ lastName: { contains: query.search, mode: 'insensitive' } }, { firstName: { contains: query.search, mode: 'insensitive' } }, { email: { contains: query.search, mode: 'insensitive' } }] }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.db.contact.findMany({
        where,
        include: { company: { select: { name: true } } },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.db.contact.count({ where }),
    ]);
    return { items: rows.map((r) => ({ contact: toDomain(r), companyName: r.company.name })), total, page: query.page, pageSize: query.pageSize };
  }
}
