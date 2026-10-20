import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma.service';
import { InvitationRepository } from '../domain/auth-repositories';
import { UserInvitationRecord } from '../domain/invitation';

@Injectable()
export class PrismaInvitationRepository implements InvitationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(record: UserInvitationRecord): Promise<void> {
    await this.prisma.db.userInvitation.create({ data: record });
  }

  async findByHash(tokenHash: string): Promise<UserInvitationRecord | null> {
    return this.prisma.db.userInvitation.findUnique({ where: { tokenHash } });
  }

  /** Compare-and-set atomique : deux acceptations simultanées du même lien, une seule voit `count = 1`. */
  async consume(tokenHash: string, now: Date): Promise<boolean> {
    const result = await this.prisma.db.userInvitation.updateMany({
      where: { tokenHash, usedAt: null, revokedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    return result.count === 1;
  }

  async revokeAllOfUser(userId: string, now: Date): Promise<void> {
    await this.prisma.db.userInvitation.updateMany({ where: { userId, usedAt: null, revokedAt: null }, data: { revokedAt: now } });
  }
}
