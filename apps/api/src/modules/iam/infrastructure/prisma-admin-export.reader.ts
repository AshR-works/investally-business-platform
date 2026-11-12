import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma.service';
import { AdminExportReader, ExportedSessionRow, ExportedUserRow } from '../application/admin/admin-exports';

/**
 * Lecture des données exportées pour l'audit. **Chaque requête SÉLECTIONNE ses colonnes une à une** : le hachage du mot de passe, le secret du second facteur, le dernier
 * pas TOTP, le compteur d'échecs, les codes de secours et les jetons ne sont jamais lus. Un secret ne peut donc pas se retrouver dans un fichier par oubli d'un filtre.
 */
@Injectable()
export class PrismaAdminExportReader implements AdminExportReader {
  constructor(private readonly prisma: PrismaService) {}

  async users(limit: number): Promise<ExportedUserRow[]> {
    const rows = await this.prisma.db.user.findMany({
      where: { deletedAt: null },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      select: {
        id: true, email: true, displayName: true, status: true, mfaEnabled: true, lastLoginAt: true, createdAt: true,
        manager: { select: { email: true } },
        roles: { select: { role: { select: { code: true } } } },
      },
    });
    return rows.map((r) => ({
      id: r.id, email: r.email, displayName: r.displayName, status: r.status, roles: r.roles.map((x) => x.role.code), managerEmail: r.manager?.email ?? null,
      mfaEnabled: r.mfaEnabled, lastLoginAt: r.lastLoginAt, createdAt: r.createdAt,
    }));
  }

  async sessions(since: Date, limit: number): Promise<ExportedSessionRow[]> {
    const rows = await this.prisma.db.userSession.findMany({
      where: { loggedInAt: { gte: since } },
      orderBy: [{ loggedInAt: 'desc' }, { id: 'asc' }],
      take: limit + 1,
      select: {
        id: true, loggedInAt: true, lastSeenAt: true, expiresAt: true, absoluteExpiresAt: true, loggedOutAt: true, revokedAt: true, revokedReason: true,
        ipAddress: true, device: true, riskLevel: true, mfaVerified: true,
        user: { select: { email: true, displayName: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id, userEmail: r.user.email, userName: r.user.displayName, loggedInAt: r.loggedInAt, lastSeenAt: r.lastSeenAt, expiresAt: r.expiresAt, absoluteExpiresAt: r.absoluteExpiresAt,
      loggedOutAt: r.loggedOutAt, revokedAt: r.revokedAt, revokedReason: r.revokedReason, ipAddress: r.ipAddress, device: r.device, riskLevel: r.riskLevel, mfaVerified: r.mfaVerified,
    }));
  }
}
