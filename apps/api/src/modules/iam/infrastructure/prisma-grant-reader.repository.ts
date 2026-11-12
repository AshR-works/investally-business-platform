import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma.service';
import { RoleView, RoleCatalogReader } from '../application/admin/user-view';
import { GrantReader } from '../domain/auth-repositories';
import { ResolvedGrant, Scope } from '../domain/roles';

/** Droits d'un utilisateur lus en base à chaque requête (union des permissions de tous ses rôles). */
@Injectable()
export class PrismaGrantReader implements GrantReader {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Droits d'un utilisateur : union des droits de ses rôles, la portée la plus large l'emportant. Relus en base à
   * chaque requête.
   */
  async grantsOf(userId: string): Promise<ResolvedGrant[]> {
    const rows = await this.prisma.db.rolePermission.findMany({
      where: { role: { users: { some: { userId } } } },
      include: { permission: { select: { code: true } } },
    });
    const unique = new Map<string, ResolvedGrant>();
    for (const row of rows) unique.set(`${row.permission.code}:${row.scope}`, { permission: row.permission.code, scope: row.scope as Scope });
    return [...unique.values()];
  }

  /** Identifiants des subordonnés directs (portée Équipe) ; les comptes supprimés sont exclus. */
  async teamMemberIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.db.user.findMany({ where: { managerId: userId, deletedAt: null }, select: { id: true } });
    return rows.map((row) => row.id);
  }
}

/** Lecture du catalogue des rôles et de leurs permissions tels qu'enregistrés en base (écran d'administration). */
@Injectable()
export class PrismaRoleCatalogReader implements RoleCatalogReader {
  constructor(private readonly prisma: PrismaService) {}

  /** Liste les rôles avec leurs permissions et portées, par code. */
  async list(): Promise<RoleView[]> {
    const roles = await this.prisma.db.role.findMany({
      orderBy: { code: 'asc' },
      include: { permissions: { include: { permission: { select: { code: true } } } } },
    });
    return roles.map((role) => ({
      code: role.code,
      label: role.label,
      description: role.description,
      mfaRequired: role.mfaRequired,
      permissions: role.permissions
        .map((entry) => ({ code: entry.permission.code, scope: entry.scope as string }))
        .sort((a, b) => a.code.localeCompare(b.code)),
    }));
  }
}
