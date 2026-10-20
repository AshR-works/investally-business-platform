import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma.service';
import { LoginAttemptRepository, LoginOutcome } from '../domain/auth-repositories';

@Injectable()
export class PrismaLoginAttemptRepository implements LoginAttemptRepository {
  constructor(private readonly prisma: PrismaService) {}

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

  async countRecentFailures(emailKey: string, since: Date): Promise<number> {
    return this.prisma.db.loginAttempt.count({
      where: { emailKey, outcome: { not: LoginOutcome.Success }, createdAt: { gte: since } },
    });
  }
}
