import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../platform/prisma.service';
import { DomainError, Page } from '../../../shared-kernel';
import { UserRepository } from '../domain/auth-repositories';
import { Email } from '../domain/email';
import { RoleCode } from '../domain/roles';
import { User, UserStatus } from '../domain/user';

type UserRow = Prisma.UserGetPayload<object>;

/** Reconstruit un utilisateur du domaine à partir d'une ligne de base de données. */
function toDomain(row: UserRow): User {
  return User.rehydrate({
    id: row.id,
    email: Email.of(row.email),
    displayName: row.displayName,
    status: row.status as UserStatus,
    passwordHash: row.passwordHash,
    passwordChangedAt: row.passwordChangedAt,
    failedLoginCount: row.failedLoginCount,
    lockedUntil: row.lockedUntil,
    mfaEnabled: row.mfaEnabled,
    mfaSecretEnc: row.mfaSecretEnc,
    mfaLastUsedStep: row.mfaLastUsedStep === null ? null : Number(row.mfaLastUsedStep),
    managerId: row.managerId,
    lastLoginAt: row.lastLoginAt,
    version: row.version,
    createdAt: row.createdAt,
  });
}

/**
 * Persistance PostgreSQL des utilisateurs et de leurs rôles (suppression logique, verrou optimiste sur la version).
 */
@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Retrouve un utilisateur non supprimé, ou `null`. */
  async findById(id: string): Promise<User | null> {
    const row = await this.prisma.db.user.findFirst({ where: { id, deletedAt: null } });
    return row ? toDomain(row) : null;
  }

  /**
   * Charge l'utilisateur par adresse ET verrouille sa ligne jusqu'à la fin de la transaction : les opérations
   * parallèles sur un même compte passent à la suite.
   */
  async lockByEmailKey(emailKey: string): Promise<User | null> {
    // Verrou de ligne tenu jusqu'à la fin de la transaction : les connexions parallèles d'un même compte s'exécutent à la suite.
    const locked = await this.prisma.db.$queryRaw<{ id: string }[]>`
      SELECT id::text AS id FROM iam.users WHERE email_key = ${emailKey} AND deleted_at IS NULL FOR UPDATE`;
    if (locked.length === 0) return null;
    const row = await this.prisma.db.user.findUnique({ where: { id: locked[0].id } });
    return row ? toDomain(row) : null;
  }

  /** Comme `lockByEmailKey`, par identifiant. */
  async lockById(id: string): Promise<User | null> {
    const locked = await this.prisma.db.$queryRaw<{ id: string }[]>`
      SELECT id::text AS id FROM iam.users WHERE id = ${id}::uuid AND deleted_at IS NULL FOR UPDATE`;
    if (locked.length === 0) return null;
    const row = await this.prisma.db.user.findUnique({ where: { id: locked[0].id } });
    return row ? toDomain(row) : null;
  }

  /** Vrai si un compte non supprimé utilise déjà cette adresse. */
  async emailExists(emailKey: string): Promise<boolean> {
    return (await this.prisma.db.user.count({ where: { emailKey, deletedAt: null } })) > 0;
  }

  /** Verrou optimiste sur `version` : une modification concurrente non sérialisée est refusée, jamais écrasée. */
  async save(user: User): Promise<void> {
    const data = {
      email: user.email.value,
      emailKey: user.email.key,
      displayName: user.displayName,
      status: user.status,
      passwordHash: user.passwordHash,
      passwordChangedAt: user.passwordChangedAt,
      failedLoginCount: user.failedLoginCount,
      lockedUntil: user.lockedUntil,
      mfaEnabled: user.mfaEnabled,
      mfaSecretEnc: user.mfaSecretEnc,
      mfaLastUsedStep: user.mfaLastUsedStep,
      managerId: user.managerId,
      lastLoginAt: user.lastLoginAt,
    };
    try {
      const updated = await this.prisma.db.user.updateMany({
        where: { id: user.id, version: user.version, deletedAt: null },
        data: { ...data, version: { increment: 1 } },
      });
      if (updated.count === 1) return;
      if ((await this.prisma.db.user.count({ where: { id: user.id } })) > 0) {
        throw new DomainError('CONFLICT', "Le compte a été modifié par une autre opération");
      }
      await this.prisma.db.user.create({ data: { id: user.id, ...data, version: user.version, createdAt: user.createdAt } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new DomainError('CONFLICT', 'Un compte existe déjà pour cette adresse e-mail');
      }
      throw error;
    }
  }

  /** Codes des rôles de l'utilisateur. */
  async roleCodesOf(userId: string): Promise<RoleCode[]> {
    const rows = await this.prisma.db.userRole.findMany({ where: { userId }, include: { role: { select: { code: true } } } });
    return rows.map((row) => row.role.code as RoleCode);
  }

  /** Ajoute les rôles à l'utilisateur ; un rôle absent de la base (seed non exécuté) est une erreur. */
  async assignRoles(userId: string, roles: readonly RoleCode[], assignedBy: string | null): Promise<void> {
    const found = await this.prisma.db.role.findMany({ where: { code: { in: [...roles] } }, select: { id: true, code: true } });
    const missing = roles.filter((code) => !found.some((row) => row.code === code));
    if (missing.length > 0) {
      throw new DomainError('INVARIANT_VIOLATION', `Rôles inconnus (seed Core non exécuté ?) : ${missing.join(', ')}`);
    }
    await this.prisma.db.userRole.createMany({
      data: found.map((role) => ({ userId, roleId: role.id, assignedBy })),
      skipDuplicates: true,
    });
  }

  /** Liste paginée pour l'administration, avec recherche (nom ou adresse) et filtre de statut. */
  async list(query: { page: number; pageSize: number; search?: string; status?: UserStatus }): Promise<Page<User>> {
    const search = query.search?.toLowerCase();
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(search ? { OR: [{ emailKey: { contains: search } }, { displayName: { contains: query.search, mode: 'insensitive' } }] } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.db.user.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.db.user.count({ where }),
    ]);
    return { items: rows.map(toDomain), total, page: query.page, pageSize: query.pageSize };
  }

  /** Rôles de plusieurs utilisateurs en une seule requête (évite une requête par ligne de liste). */
  async rolesOfMany(userIds: readonly string[]): Promise<Map<string, RoleCode[]>> {
    const result = new Map<string, RoleCode[]>();
    if (userIds.length === 0) return result;
    const rows = await this.prisma.db.userRole.findMany({
      where: { userId: { in: [...userIds] } },
      include: { role: { select: { code: true } } },
    });
    for (const row of rows) result.set(row.userId, [...(result.get(row.userId) ?? []), row.role.code as RoleCode]);
    return result;
  }

  /** Remplace l'ensemble des rôles de l'utilisateur. */
  async replaceRoles(userId: string, roles: readonly RoleCode[], assignedBy: string | null): Promise<void> {
    await this.prisma.db.userRole.deleteMany({ where: { userId } });
    await this.assignRoles(userId, roles, assignedBy);
  }

  /**
   * Prend le verrou qui sérialise toute opération pouvant retirer un SuperAdmin : deux administrateurs ne peuvent pas
   * retirer en même temps les deux derniers.
   */
  async lockSuperAdminInvariant(): Promise<void> {
    // Toute opération qui peut retirer un SuperAdmin prend d'abord ce verrou : elles s'exécutent à la suite.
    await this.prisma.db.$queryRaw`SELECT id FROM iam.roles WHERE code = 'SUPER_ADMIN' FOR UPDATE`;
  }

  /** Nombre de SuperAdmin actifs (il doit toujours en rester au moins un). */
  async countActiveSuperAdmins(): Promise<number> {
    return this.prisma.db.user.count({
      where: { deletedAt: null, status: 'ACTIVE', roles: { some: { role: { code: 'SUPER_ADMIN' } } } },
    });
  }

  /** Chaîne des responsables au-dessus de l'utilisateur, bornée en profondeur (détection de cycle hiérarchique). */
  async managerChainOf(userId: string, maxDepth: number): Promise<string[]> {
    const chain: string[] = [];
    let current: string | null = userId;
    while (chain.length < maxDepth) {
      const row: { managerId: string | null } | null = await this.prisma.db.user.findUnique({ where: { id: current }, select: { managerId: true } });
      const next: string | null = row?.managerId ?? null;
      if (next === null || chain.includes(next)) break; // fin de chaîne, ou cycle déjà présent en base
      chain.push(next);
      current = next;
    }
    return chain;
  }
}
