import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma.service';
import { InvitationRepository } from '../domain/auth-repositories';
import { InvitationPurposeName, UserInvitationRecord } from '../domain/invitation';

/** Persistance des liens à usage unique (invitation, réinitialisation) ; seule l'empreinte du jeton est écrite. */
@Injectable()
export class PrismaInvitationRepository implements InvitationRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Enregistre un nouveau lien. */
  async save(record: UserInvitationRecord): Promise<void> {
    await this.prisma.db.userInvitation.create({ data: record });
  }

  /** Retrouve un lien par l'empreinte du jeton présenté, ou `null`. */
  async findByHash(tokenHash: string): Promise<UserInvitationRecord | null> {
    const row = await this.prisma.db.userInvitation.findUnique({ where: { tokenHash } });
    // La base garantit (CHECK) que `purpose` est l'une des deux valeurs connues.
    return row ? { ...row, purpose: row.purpose as InvitationPurposeName } : null;
  }

  /** Compare-and-set atomique : deux acceptations simultanées du même lien, une seule voit `count = 1`. */
  async consume(tokenHash: string, now: Date): Promise<boolean> {
    const result = await this.prisma.db.userInvitation.updateMany({
      where: { tokenHash, usedAt: null, revokedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    return result.count === 1;
  }

  /** Révoque tous les liens encore valides de l'utilisateur (un nouveau lien remplace les précédents). */
  async revokeAllOfUser(userId: string, now: Date): Promise<void> {
    await this.prisma.db.userInvitation.updateMany({ where: { userId, usedAt: null, revokedAt: null }, data: { revokedAt: now } });
  }

  /** Nombre de liens d'un usage donné émis depuis `since` (plafond de demandes « mot de passe oublié »). */
  async countCreatedSince(userId: string, purpose: string, since: Date): Promise<number> {
    return this.prisma.db.userInvitation.count({ where: { userId, purpose, createdAt: { gte: since } } });
  }
}
