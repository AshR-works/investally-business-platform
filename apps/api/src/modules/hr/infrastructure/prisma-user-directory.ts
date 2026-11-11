import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma.service';
import { UserDirectory, UserRef } from '../domain/user-directory';

const SELECT = { id: true, displayName: true, status: true, managerId: true } as const;
const toRef = (r: { id: string; displayName: string; status: string; managerId: string | null }): UserRef => ({ id: r.id, displayName: r.displayName, status: r.status, managerUserId: r.managerId });

/** Lecture seule des comptes pour le module RH : existence, nom, statut et responsable du compte (jamais d'e-mail ni de secret). */
@Injectable()
export class PrismaUserDirectory implements UserDirectory {
  constructor(private readonly prisma: PrismaService) {}

  async find(id: string): Promise<UserRef | null> {
    const row = await this.prisma.db.user.findUnique({ where: { id }, select: SELECT });
    return row ? toRef(row) : null;
  }

  async assignable(): Promise<UserRef[]> {
    const rows = await this.prisma.db.user.findMany({ where: { status: { in: ['ACTIVE', 'PENDING'] } }, select: SELECT, orderBy: [{ displayName: 'asc' }, { id: 'asc' }] });
    return rows.map(toRef);
  }

  async findMany(ids: readonly string[]): Promise<UserRef[]> {
    if (ids.length === 0) return [];
    return (await this.prisma.db.user.findMany({ where: { id: { in: [...ids] } }, select: SELECT })).map(toRef);
  }
}
