import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma.service';
import { PasswordHistoryRepository } from '../domain/auth-repositories';

@Injectable()
export class PrismaPasswordHistoryRepository implements PasswordHistoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async recentHashes(userId: string, limit: number): Promise<string[]> {
    const rows = await this.prisma.db.passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { passwordHash: true },
    });
    return rows.map((row) => row.passwordHash);
  }

  async add(entry: { id: string; userId: string; passwordHash: string; createdAt: Date }): Promise<void> {
    await this.prisma.db.passwordHistory.create({ data: entry });
  }
}
