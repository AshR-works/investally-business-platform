import { Inject, Injectable } from '@nestjs/common';
import {
  ActorContext, CLOCK, Clock, DomainError, ID_GENERATOR, IdGenerator, UNIT_OF_WORK, UnitOfWork,
} from '../../../shared-kernel';
import { AUDIT_RECORDER, AuditAction, AuditRecorder } from '../../audit';
import {
  LOGIN_ATTEMPT_REPOSITORY, LoginAttemptRepository, LoginOutcome, SESSION_REPOSITORY, SessionRepository,
  USER_REPOSITORY, UserRepository,
} from '../domain/auth-repositories';
import { base32Decode } from '../domain/base32';
import { normalizeRecoveryCode } from '../domain/recovery-codes';
import { sessionPolicyFor } from '../domain/session-policy';
import { verifyTotp } from '../domain/totp';
import { User } from '../domain/user';
import { RECOVERY_CODE_REPOSITORY, RecoveryCodeRepository, SECRET_CIPHER, SecretCipher } from './mfa-ports';
import { ACCESS_TOKEN_SERVICE, AccessTokenService, PASSWORD_HASHER, PasswordHasher } from './ports';

const MFA_FAILURE = 'Code invalide';

export interface VerifyMfaCommand {
  userId: string;
  sessionId: string;
  /** Code TOTP à 6 chiffres, ou code de secours. */
  code: string;
  actor: ActorContext;
}

export interface MfaVerified {
  /** Nouveau jeton d'accès portant `amr = [pwd, otp]`. */
  accessToken: string;
  accessTokenExpiresAt: Date;
  mfaVerifiedAt: Date;
  /** Seulement si un code de secours vient d'être consommé : combien il en reste. */
  recoveryCodesRemaining?: number;
}

type VerifyResult = { ok: true; value: MfaVerified } | { ok: false };

/**
 * Vérifie le second facteur : à la connexion (la session passe à « MFA vérifié ») ET pour un step-up
 * (action sensible : l'horodatage est rafraîchi). Accepte un code TOTP ou un code de secours.
 *
 * Verrou de ligne sur l'utilisateur : deux vérifications simultanées sont sérialisées, ce qui garantit
 * l'anti-rejeu (un même code ne passe qu'une fois) et un compteur d'échecs fiable (anti-force brute).
 */
@Injectable()
export class VerifyMfaUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(LOGIN_ATTEMPT_REPOSITORY) private readonly attempts: LoginAttemptRepository,
    @Inject(RECOVERY_CODE_REPOSITORY) private readonly recoveryCodes: RecoveryCodeRepository,
    @Inject(SECRET_CIPHER) private readonly cipher: SecretCipher,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(ACCESS_TOKEN_SERVICE) private readonly accessTokens: AccessTokenService,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  /** L'échec est signalé APRÈS la validation de la transaction : compteur d'échecs et audit doivent persister. */
  async execute(command: VerifyMfaCommand): Promise<MfaVerified> {
    const result = await this.unitOfWork.run(() => this.verify(command));
    if (!result.ok) throw new DomainError('UNAUTHENTICATED', MFA_FAILURE);
    return result.value;
  }

  private async verify(command: VerifyMfaCommand): Promise<VerifyResult> {
    const now = this.clock.now();
    const user = await this.users.lockById(command.userId);
    const session = await this.sessions.findById(command.sessionId);
    if (!user || !user.canAuthenticate() || !session || session.userId !== user.id || !session.isActive(now)) {
      throw new DomainError('UNAUTHENTICATED', 'Session invalide ou expirée');
    }
    if (!user.mfaEnabled || user.mfaSecretEnc === null) {
      throw new DomainError('FORBIDDEN', "Le MFA n'est pas encore activé : terminez l'enrôlement");
    }
    if (user.isLocked(now)) return this.fail(command, user, now, 'LOCKED', false);

    const code = (command.code ?? '').trim();
    let recoveryCodesRemaining: number | undefined;

    if (/^\d{6}$/.test(code)) {
      const verification = verifyTotp({
        secret: base32Decode(this.cipher.decrypt(user.mfaSecretEnc, user.id)),
        code,
        nowMs: now.getTime(),
        lastUsedStep: user.mfaLastUsedStep,
      });
      if (!verification.ok) return this.fail(command, user, now, 'BAD_CODE', true);
      user.recordMfaStep(verification.step);
    } else {
      const consumed = await this.consumeRecoveryCode(user, code, now);
      if (!consumed.ok) return this.fail(command, user, now, 'BAD_RECOVERY_CODE', true);
      recoveryCodesRemaining = consumed.remaining;
    }

    user.clearLoginFailures();
    await this.users.save(user);
    session.markMfaVerified(now);
    await this.sessions.save(session);

    const roles = await this.users.roleCodesOf(user.id);
    const token = await this.accessTokens.issue({ sub: user.id, sid: session.id, amr: ['pwd', 'otp'] }, sessionPolicyFor(roles).accessTokenMs, now);

    await this.audit.record({
      actor: { ...command.actor, userId: user.id, sessionId: session.id },
      module: 'iam',
      entityType: 'UserSession',
      entityId: session.id,
      action: AuditAction.MfaChange,
      newValue: recoveryCodesRemaining === undefined
        ? { event: 'mfa_verified', method: 'totp' }
        : { event: 'mfa_verified', method: 'recovery_code', recoveryCodesRemaining },
    });
    return {
      ok: true,
      value: { accessToken: token.token, accessTokenExpiresAt: token.expiresAt, mfaVerifiedAt: now, recoveryCodesRemaining },
    };
  }

  /** Cherche parmi les codes non consommés celui qui correspond, puis le consomme atomiquement. */
  private async consumeRecoveryCode(user: User, input: string, now: Date): Promise<{ ok: true; remaining: number } | { ok: false }> {
    const normalized = normalizeRecoveryCode(input);
    if (!normalized) {
      // Saisie impossible : on fait quand même un calcul de même coût (pas de distinction de temps de réponse).
      await this.hasher.verifyDummy(input ?? '');
      return { ok: false };
    }
    for (const candidate of await this.recoveryCodes.listUnused(user.id)) {
      if (await this.hasher.verify(candidate.hash, normalized)) {
        if (!(await this.recoveryCodes.consume(candidate.id, now))) return { ok: false };
        return { ok: true, remaining: await this.recoveryCodes.countUnused(user.id) };
      }
    }
    return { ok: false };
  }

  private async fail(command: VerifyMfaCommand, user: User, now: Date, reason: string, count: boolean): Promise<VerifyResult> {
    if (count) {
      user.registerFailedMfa(now);
      await this.users.save(user);
    }
    await this.attempts.record({
      id: this.ids.next(), emailKey: user.email.key, userId: user.id, ipAddress: command.actor.ipAddress,
      outcome: LoginOutcome.MfaFailed, createdAt: now,
    });
    await this.audit.record({
      actor: { ...command.actor, userId: user.id, sessionId: command.sessionId },
      module: 'iam', entityType: 'User', entityId: user.id, action: AuditAction.LoginFailed,
      newValue: { reason: `MFA_${reason}` },
    });
    return { ok: false };
  }
}
