import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../platform/prisma.service';
import { KnownFingerprints, SessionRepository } from '../domain/auth-repositories';
import { deviceFingerprint, networkRangeOf } from '../domain/network';
import { RiskLevel } from '../domain/session-risk';
import { UserSession } from '../domain/user-session';

type SessionRow = Prisma.UserSessionGetPayload<object>;

/** Nombre de sessions passées examinées pour reconnaître un appareil ou un réseau déjà vu. */
const FINGERPRINT_HISTORY = 100;

/** Reconstruit une session du domaine à partir d'une ligne de base de données. */
function toDomain(row: SessionRow): UserSession {
  return UserSession.rehydrate({
    id: row.id,
    userId: row.userId,
    ipAddress: row.ipAddress,
    device: row.device,
    riskLevel: row.riskLevel as RiskLevel,
    mfaVerified: row.mfaVerified,
    mfaVerifiedAt: row.mfaVerifiedAt,
    loggedInAt: row.loggedInAt,
    lastSeenAt: row.lastSeenAt,
    expiresAt: row.expiresAt,
    absoluteExpiresAt: row.absoluteExpiresAt,
    loggedOutAt: row.loggedOutAt,
    revokedAt: row.revokedAt,
    revokedReason: row.revokedReason,
  });
}

/** Persistance des sessions de connexion (PostgreSQL). */
@Injectable()
export class PrismaSessionRepository implements SessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Crée la session, ou met à jour ses champs variables (risque, MFA, activité, échéance, révocation). */
  async save(session: UserSession): Promise<void> {
    const mutable = {
      riskLevel: session.riskLevel,
      mfaVerified: session.mfaVerified,
      mfaVerifiedAt: session.mfaVerifiedAt,
      lastSeenAt: session.lastSeenAt,
      expiresAt: session.expiresAt,
      loggedOutAt: session.loggedOutAt,
      revokedAt: session.revokedAt,
      revokedReason: session.revokedReason,
    };
    await this.prisma.db.userSession.upsert({
      where: { id: session.id },
      create: {
        id: session.id,
        userId: session.userId,
        ipAddress: session.ipAddress,
        device: session.device,
        loggedInAt: session.loggedInAt,
        absoluteExpiresAt: session.absoluteExpiresAt,
        ...mutable,
      },
      update: mutable,
    });
  }

  /** Retrouve une session par identifiant, ou `null`. */
  async findById(id: string): Promise<UserSession | null> {
    const row = await this.prisma.db.userSession.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  /** Plages réseau et appareils des dernières sessions du compte (calcul du risque d'une nouvelle connexion). */
  async knownFingerprints(userId: string): Promise<KnownFingerprints> {
    const rows = await this.prisma.db.userSession.findMany({
      where: { userId },
      orderBy: { loggedInAt: 'desc' },
      take: FINGERPRINT_HISTORY,
      select: { ipAddress: true, device: true },
    });
    return {
      networks: new Set(rows.map((row) => networkRangeOf(row.ipAddress))),
      devices: new Set(rows.map((row) => deviceFingerprint(row.device))),
    };
  }

  /**
   * Révoque les sessions actives du compte, sauf celle à conserver ; renvoie les identifiants révoqués (pour couper
   * aussi leurs jetons).
   */
  async revokeAllOfUserExcept(userId: string, keepSessionId: string | null, now: Date, reason: string): Promise<string[]> {
    const active = await this.prisma.db.userSession.findMany({
      where: {
        userId,
        loggedOutAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
        absoluteExpiresAt: { gt: now },
        ...(keepSessionId ? { id: { not: keepSessionId } } : {}),
      },
      select: { id: true },
    });
    if (active.length === 0) return [];
    const ids = active.map((row) => row.id);
    await this.prisma.db.userSession.updateMany({
      where: { id: { in: ids }, revokedAt: null },
      data: { revokedAt: now, revokedReason: reason.slice(0, 200) },
    });
    return ids;
  }

  /** Sessions encore valides du compte (ni déconnectées, ni révoquées, ni expirées), la plus récente d'abord. */
  async listActiveOf(userId: string, now: Date): Promise<UserSession[]> {
    const rows = await this.prisma.db.userSession.findMany({
      where: { userId, loggedOutAt: null, revokedAt: null, expiresAt: { gt: now }, absoluteExpiresAt: { gt: now } },
      orderBy: { loggedInAt: 'desc' },
      take: 100,
    });
    return rows.map(toDomain);
  }
}
