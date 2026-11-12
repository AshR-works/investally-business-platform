import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma.service';
import { OwnerDirectory, OwnerSummary } from '../domain/owner-directory';

/** Rôles qui portent des entreprises : chargé de compte, Responsable commercial, administrateur. */
const OWNER_ROLE_CODES = ['ACCOUNT_MANAGER', 'HEAD_OF_SALES', 'SUPER_ADMIN'];

/** Annuaire des propriétaires, lu dans la table des utilisateurs (jamais d'e-mail ni de secret exposé). */
@Injectable()
export class PrismaOwnerDirectory implements OwnerDirectory {
  constructor(private readonly prisma: PrismaService) {}

  async candidates(ids?: readonly string[]): Promise<OwnerSummary[]> {
    if (ids && ids.length === 0) return [];
    const rows = await this.prisma.db.user.findMany({
      where: {
        status: 'ACTIVE',
        ...(ids ? { id: { in: [...ids] } } : {}),
        roles: { some: { role: { code: { in: OWNER_ROLE_CODES } } } },
      },
      select: { id: true, displayName: true },
      orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
    });
    return rows.map((r) => ({ id: r.id, name: r.displayName }));
  }

  async names(ids: readonly string[]): Promise<ReadonlyMap<string, string>> {
    if (ids.length === 0) return new Map();
    const rows = await this.prisma.db.user.findMany({ where: { id: { in: [...new Set(ids)] } }, select: { id: true, displayName: true } });
    return new Map(rows.map((r) => [r.id, r.displayName]));
  }
}
