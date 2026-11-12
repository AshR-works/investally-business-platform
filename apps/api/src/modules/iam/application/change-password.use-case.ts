import { Inject, Injectable } from '@nestjs/common';
import {
  ActorContext, CLOCK, Clock, DomainError, ID_GENERATOR, IdGenerator, UNIT_OF_WORK, UnitOfWork,
} from '../../../shared-kernel';
import { AUDIT_RECORDER, AuditAction, AuditRecorder } from '../../audit';
import {
  PASSWORD_HISTORY_REPOSITORY, PasswordHistoryRepository, REFRESH_TOKEN_REPOSITORY, RefreshTokenRepository,
  SESSION_REPOSITORY, SessionRepository, USER_REPOSITORY, UserRepository,
} from '../domain/auth-repositories';
import { checkPasswordPolicy } from '../domain/password-policy';
import { PASSWORD_HASHER, PasswordHasher } from './ports';

/** Nombre de mots de passe passés refusés à la réutilisation (SECURITY.md §2.1). */
export const PASSWORD_HISTORY_DEPTH = 5;

/**
 * Changement de mot de passe par l'utilisateur connecté : ancien mot de passe, nouveau mot de passe et session à
 * conserver.
 */
export interface ChangePasswordCommand {
  userId: string;
  sessionId: string;
  currentPassword: string;
  newPassword: string;
  actor: ActorContext;
}

/** Changement de mot de passe par l'utilisateur connecté. Toutes ses AUTRES sessions sont révoquées. */
@Injectable()
export class ChangePasswordUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HISTORY_REPOSITORY) private readonly history: PasswordHistoryRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokens: RefreshTokenRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  /**
   * Vérifie l'ancien mot de passe, la politique et l'historique des 5 derniers, change le mot de passe, coupe les
   * autres sessions et audite.
   */
  async execute(command: ChangePasswordCommand): Promise<void> {
    const user = await this.users.findById(command.userId);
    if (!user || !user.passwordHash || !(await this.hasher.verify(user.passwordHash, command.currentPassword))) {
      throw new DomainError('FORBIDDEN', 'Mot de passe actuel incorrect');
    }

    const problems = checkPasswordPolicy(command.newPassword, { email: user.email.value, displayName: user.displayName });
    if (problems.length > 0) throw new DomainError('VALIDATION', `Mot de passe refusé : ${problems.join(' ; ')}`);

    // Réutilisation : on compare au mot de passe actuel et aux hachages historiques.
    const past = [user.passwordHash, ...(await this.history.recentHashes(user.id, PASSWORD_HISTORY_DEPTH))];
    for (const hash of new Set(past)) {
      if (await this.hasher.verify(hash, command.newPassword)) {
        throw new DomainError('VALIDATION', `Ce mot de passe a déjà été utilisé (les ${PASSWORD_HISTORY_DEPTH} derniers sont refusés)`);
      }
    }

    const newHash = await this.hasher.hash(command.newPassword);

    await this.unitOfWork.run(async () => {
      const now = this.clock.now();
      const current = await this.users.findById(user.id);
      if (!current) return;
      current.changePassword(newHash, now);
      await this.users.save(current);
      await this.history.add({ id: this.ids.next(), userId: user.id, passwordHash: newHash, createdAt: now });

      const revoked = await this.sessions.revokeAllOfUserExcept(user.id, command.sessionId, now, 'Changement de mot de passe');
      for (const sessionId of revoked) await this.refreshTokens.revokeBySession(sessionId, now);

      await this.audit.record({
        actor: { ...command.actor, userId: user.id, sessionId: command.sessionId },
        module: 'iam',
        entityType: 'User',
        entityId: user.id,
        action: AuditAction.PasswordChange,
        newValue: { otherSessionsRevoked: revoked.length },
      });
    });
  }
}
