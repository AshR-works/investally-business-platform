import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma.service';
import { RefreshTokenRepository } from '../domain/auth-repositories';
import { RefreshTokenRecord } from '../domain/refresh-token';

@Injectable()
export class PrismaRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(record: RefreshTokenRecord): Promise<void> {
    await this.prisma.db.refreshToken.create({
      data: {
        id: record.id,
        sessionId: record.sessionId,
        familyId: record.familyId,
        tokenHash: record.tokenHash,
        issuedAt: record.issuedAt,
        expiresAt: record.expiresAt,
        usedAt: record.usedAt,
        revokedAt: record.revokedAt,
      },
    });
  }

  async findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const row = await this.prisma.db.refreshToken.findUnique({ where: { tokenHash } });
    return row
      ? {
          id: row.id, sessionId: row.sessionId, familyId: row.familyId, tokenHash: row.tokenHash,
          issuedAt: row.issuedAt, expiresAt: row.expiresAt, usedAt: row.usedAt, revokedAt: row.revokedAt,
        }
      : null;
  }

  /**
   * Compare-and-set atomique : une seule requête peut passer le jeton de « non utilisé » à « utilisé ».
   * Deux rafraîchissements simultanés avec le même jeton : l'un voit `count = 1`, l'autre `count = 0`.
   */
  async consume(tokenHash: string, now: Date): Promise<boolean> {
    const result = await this.prisma.db.refreshToken.updateMany({
      where: { tokenHash, usedAt: null, revokedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    return result.count === 1;
  }

  async revokeFamily(familyId: string, now: Date): Promise<void> {
    await this.prisma.db.refreshToken.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: now } });
  }

  async revokeBySession(sessionId: string, now: Date): Promise<void> {
    await this.prisma.db.refreshToken.updateMany({ where: { sessionId, revokedAt: null }, data: { revokedAt: now } });
  }
}
