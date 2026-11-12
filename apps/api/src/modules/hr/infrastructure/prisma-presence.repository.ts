import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../platform/prisma.service';
import { DomainError } from '../../../shared-kernel';
import { PresenceDeclaration, PresenceMode } from '../domain/presence';
import { PresenceRepository } from '../domain/presence-repositories';

const iso = (value: Date): string => value.toISOString().slice(0, 10);
const date = (text: string): Date => new Date(`${text}T00:00:00Z`);

const toDeclaration = (row: Prisma.PresenceDeclarationGetPayload<object>): PresenceDeclaration =>
  PresenceDeclaration.rehydrate({
    id: row.id, employeeId: row.employeeId, day: iso(row.day), mode: row.mode as PresenceMode, declaredByUserId: row.declaredByUserId,
    createdAt: row.createdAt, updatedAt: row.updatedAt, version: row.version,
  });

/** Persistance PostgreSQL des présences déclaratives : un enregistrement par employé et par jour (unicité garantie par la base). */
@Injectable()
export class PrismaPresenceRepository implements PresenceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(declaration: PresenceDeclaration): Promise<void> {
    try {
      const updated = await this.prisma.db.presenceDeclaration.updateMany({
        where: { id: declaration.id }, data: { mode: declaration.mode, declaredByUserId: declaration.declaredByUserId, version: { increment: 1 } },
      });
      if (updated.count === 1) return;
      await this.prisma.db.presenceDeclaration.create({
        data: {
          id: declaration.id, employeeId: declaration.employeeId, day: date(declaration.day), mode: declaration.mode, declaredByUserId: declaration.declaredByUserId,
          version: declaration.version, createdAt: declaration.createdAt,
        },
      });
    } catch (e) {
      // Unicité (employé, jour) : deux saisies simultanées du même jour.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new DomainError('CONFLICT', 'Une présence est déjà déclarée ce jour-là : rechargez la page');
      throw e;
    }
  }

  async find(employeeId: string, day: string): Promise<PresenceDeclaration | null> {
    const row = await this.prisma.db.presenceDeclaration.findUnique({ where: { employeeId_day: { employeeId, day: date(day) } } });
    return row ? toDeclaration(row) : null;
  }

  async remove(employeeId: string, day: string): Promise<void> {
    await this.prisma.db.presenceDeclaration.deleteMany({ where: { employeeId, day: date(day) } });
  }

  async between(from: string, to: string, employeeIds: readonly string[]): Promise<PresenceDeclaration[]> {
    if (employeeIds.length === 0) return [];
    const rows = await this.prisma.db.presenceDeclaration.findMany({
      where: { employeeId: { in: [...employeeIds] }, day: { gte: date(from), lte: date(to) } }, orderBy: [{ day: 'asc' }, { employeeId: 'asc' }],
    });
    return rows.map(toDeclaration);
  }
}
