import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../platform/prisma.service';
import { DomainError } from '../../../shared-kernel';
import { UserRepository } from '../domain/auth-repositories';
import { Email } from '../domain/email';
import { RoleCode } from '../domain/roles';
import { User, UserStatus } from '../domain/user';

type UserRow = Prisma.UserGetPayload<object>;

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
    managerId: row.managerId,
    lastLoginAt: row.lastLoginAt,
    version: row.version,
    createdAt: row.createdAt,
  });
}

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    const row = await this.prisma.db.user.findFirst({ where: { id, deletedAt: null } });
    return row ? toDomain(row) : null;
  }

  async lockByEmailKey(emailKey: string): Promise<User | null> {
    // Verrou de ligne tenu jusqu'à la fin de la transaction : les connexions parallèles d'un même compte s'exécutent à la suite.
    const locked = await this.prisma.db.$queryRaw<{ id: string }[]>`
      SELECT id::text AS id FROM iam.users WHERE email_key = ${emailKey} AND deleted_at IS NULL FOR UPDATE`;
    if (locked.length === 0) return null;
    const row = await this.prisma.db.user.findUnique({ where: { id: locked[0].id } });
    return row ? toDomain(row) : null;
  }

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

  async roleCodesOf(userId: string): Promise<RoleCode[]> {
    const rows = await this.prisma.db.userRole.findMany({ where: { userId }, include: { role: { select: { code: true } } } });
    return rows.map((row) => row.role.code as RoleCode);
  }

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
}
