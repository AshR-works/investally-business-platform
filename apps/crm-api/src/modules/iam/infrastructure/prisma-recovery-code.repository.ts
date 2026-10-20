import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma.service';
import { RecoveryCodeRepository } from '../application/mfa-ports';

@Injectable()
export class PrismaRecoveryCodeRepository implements RecoveryCodeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async replaceAll(userId: string, hashes: { id: string; hash: string }[], now: Date): Promise<void> {
    await this.prisma.db.mfaRecoveryCode.deleteMany({ where: { userId } });
    await this.prisma.db.mfaRecoveryCode.createMany({
      data: hashes.map((entry) => ({ id: entry.id, userId, codeHash: entry.hash, createdAt: now })),
    });
  }

  async deleteAll(userId: string): Promise<void> {
    await this.prisma.db.mfaRecoveryCode.deleteMany({ where: { userId } });
  }

  async listUnused(userId: string): Promise<{ id: string; hash: string }[]> {
    const rows = await this.prisma.db.mfaRecoveryCode.findMany({ where: { userId, usedAt: null }, orderBy: { createdAt: 'asc' } });
    return rows.map((row) => ({ id: row.id, hash: row.codeHash }));
  }

  /** Compare-and-set atomique : un code de secours ne sert qu'une fois, même sous requêtes simultanées. */
  async consume(id: string, now: Date): Promise<boolean> {
    const result = await this.prisma.db.mfaRecoveryCode.updateMany({ where: { id, usedAt: null }, data: { usedAt: now } });
    return result.count === 1;
  }

  async countUnused(userId: string): Promise<number> {
    return this.prisma.db.mfaRecoveryCode.count({ where: { userId, usedAt: null } });
  }
}
