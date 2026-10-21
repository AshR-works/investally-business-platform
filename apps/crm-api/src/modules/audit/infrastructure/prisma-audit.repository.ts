import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../platform/prisma.service';
import { AuditAction, AuditEntry } from '../domain/audit-entry';
import { AuditRepository } from '../domain/audit-repository';

/** Convertit une valeur facultative en JSON Prisma (`null` devient NULL en base, pas la chaîne « null »). */
const asJson = (value: Record<string, unknown> | null) =>
  value === null ? Prisma.DbNull : (value as Prisma.InputJsonValue);

/**
 * Écrit et relit le journal d'audit dans PostgreSQL (schéma `audit`). Aucune modification ni suppression : les
 * déclencheurs de la base les refusent.
 */
@Injectable()
export class PrismaAuditRepository implements AuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Ajoute une entrée immuable au journal (acteur, session, IP, appareil, entité, action, avant/après). */
  async append(entry: AuditEntry): Promise<void> {
    await this.prisma.db.auditLog.create({
      data: {
        id: entry.id,
        userId: entry.actor.userId,
        sessionId: entry.actor.sessionId,
        module: entry.module,
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        oldValue: asJson(entry.oldValue),
        newValue: asJson(entry.newValue),
        ipAddress: entry.actor.ipAddress,
        device: entry.actor.device,
        createdAt: entry.createdAt,
      },
    });
  }

  /** Historique d'une entité, du plus ancien au plus récent (500 entrées au plus). */
  async listByEntity(entityType: string, entityId: string): Promise<AuditEntry[]> {
    const rows = await this.prisma.db.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });
    return rows.map((row) => ({
      id: row.id,
      actor: {
        userId: row.userId,
        sessionId: row.sessionId,
        ipAddress: row.ipAddress,
        device: row.device,
      },
      module: row.module,
      entityType: row.entityType,
      entityId: row.entityId,
      action: row.action as AuditAction,
      oldValue: (row.oldValue as Record<string, unknown> | null) ?? null,
      newValue: (row.newValue as Record<string, unknown> | null) ?? null,
      createdAt: row.createdAt,
    }));
  }
}
