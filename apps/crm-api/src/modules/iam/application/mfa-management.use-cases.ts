import { Inject, Injectable } from '@nestjs/common';
import {
  ActorContext, CLOCK, Clock, DomainError, ID_GENERATOR, IdGenerator, UNIT_OF_WORK, UnitOfWork,
} from '../../../shared-kernel';
import { AUDIT_RECORDER, AuditAction, AuditRecorder } from '../../audit';
import {
  REFRESH_TOKEN_REPOSITORY, RefreshTokenRepository, SESSION_REPOSITORY, SessionRepository, USER_REPOSITORY, UserRepository,
} from '../domain/auth-repositories';
import { RECOVERY_CODE_COUNT, formatRecoveryCode } from '../domain/recovery-codes';
import {
  RECOVERY_CODE_GENERATOR, RECOVERY_CODE_REPOSITORY, RecoveryCodeGenerator, RecoveryCodeRepository,
} from './mfa-ports';
import { PASSWORD_HASHER, PasswordHasher } from './ports';

/** Régénère les 10 codes de secours (les anciens deviennent invalides). Exige un MFA RÉCENT (step-up). */
@Injectable()
export class RegenerateRecoveryCodesUseCase {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(RECOVERY_CODE_REPOSITORY) private readonly recoveryCodes: RecoveryCodeRepository,
    @Inject(RECOVERY_CODE_GENERATOR) private readonly generator: RecoveryCodeGenerator,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(command: { userId: string; sessionId: string; actor: ActorContext }): Promise<{ recoveryCodes: string[] }> {
    const now = this.clock.now();
    const session = await this.sessions.findById(command.sessionId);
    const user = await this.users.findById(command.userId);
    if (!user || !user.canAuthenticate() || !session || session.userId !== user.id || !session.isActive(now)) {
      throw new DomainError('UNAUTHENTICATED', 'Session invalide ou expirée');
    }
    if (!user.mfaEnabled) throw new DomainError('FORBIDDEN', "Le MFA n'est pas activé");
    if (!session.hasFreshMfa(now)) {
      throw new DomainError('MFA_STEP_UP_REQUIRED', 'Une vérification MFA récente est requise pour cette action');
    }

    const plain = this.generator.generate(RECOVERY_CODE_COUNT);
    const hashes = await Promise.all(plain.map(async (code) => ({ id: this.ids.next(), hash: await this.hasher.hash(code) })));
    await this.unitOfWork.run(async () => {
      await this.recoveryCodes.replaceAll(user.id, hashes, now);
      await this.audit.record({
        actor: command.actor, module: 'iam', entityType: 'User', entityId: user.id, action: AuditAction.MfaChange,
        newValue: { event: 'recovery_codes_regenerated', recoveryCodes: RECOVERY_CODE_COUNT },
      });
    });
    return { recoveryCodes: plain.map(formatRecoveryCode) };
  }
}

/**
 * Réinitialise le MFA d'un AUTRE utilisateur (perte du téléphone) : secret et codes supprimés, TOUTES ses
 * sessions révoquées. L'utilisateur devra se reconnecter et se réenrôler.
 * L'autorisation (permission `iam.user.reset_mfa` + step-up) est contrôlée par l'appelant (S3.3). Ce cas d'usage
 * interdit en plus l'auto-réinitialisation : une session compromise ne doit pas pouvoir désactiver son propre MFA.
 */
@Injectable()
export class ResetMfaUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokens: RefreshTokenRepository,
    @Inject(RECOVERY_CODE_REPOSITORY) private readonly recoveryCodes: RecoveryCodeRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: { targetUserId: string; actor: ActorContext }): Promise<void> {
    if (command.actor.userId !== null && command.actor.userId === command.targetUserId) {
      throw new DomainError('FORBIDDEN', 'Vous ne pouvez pas réinitialiser votre propre MFA');
    }
    await this.unitOfWork.run(async () => {
      const now = this.clock.now();
      const user = await this.users.lockById(command.targetUserId);
      if (!user) throw new DomainError('NOT_FOUND', 'Utilisateur introuvable');

      user.resetMfa();
      await this.users.save(user);
      await this.recoveryCodes.deleteAll(user.id);
      const revoked = await this.sessions.revokeAllOfUserExcept(user.id, null, now, 'Réinitialisation du MFA');
      for (const sessionId of revoked) await this.refreshTokens.revokeBySession(sessionId, now);

      await this.audit.record({
        actor: command.actor, module: 'iam', entityType: 'User', entityId: user.id, action: AuditAction.MfaChange,
        newValue: { event: 'reset_by_administrator', sessionsRevoked: revoked.length },
      });
    });
  }
}
