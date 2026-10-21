import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma.service';
import { LoginAttemptRepository, LoginOutcome } from '../domain/auth-repositories';

/** Journal des tentatives de connexion, y compris pour des adresses inconnues (aucune clé étrangère). */
@Injectable()
export class PrismaLoginAttemptRepository implements LoginAttemptRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Enregistre une tentative (adresse tronquée, IP, issue) ; sert au calcul du risque et aux enquêtes. */
  async record(attempt: { id: string; emailKey: string; userId: string | null; ipAddress: string; outcome: LoginOutcome; createdAt: Date }): Promise<void> {
    await this.prisma.db.loginAttempt.create({
      data: {
        id: attempt.id,
        emailKey: attempt.emailKey.slice(0, 254),
        userId: attempt.userId,
        ipAddress: attempt.ipAddress.slice(0, 64),
        outcome: attempt.outcome,
        createdAt: attempt.createdAt,
      },
    });
  }

  /** Nombre d'échecs (hors succès) pour cette adresse depuis `since`. */
  async countRecentFailures(emailKey: string, since: Date): Promise<number> {
    return this.prisma.db.loginAttempt.count({
      where: { emailKey, outcome: { not: LoginOutcome.Success }, createdAt: { gte: since } },
    });
  }
}
