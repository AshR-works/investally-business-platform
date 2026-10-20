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
import { RECOVERY_CODE_COUNT, formatRecoveryCode } from '../domain/recovery-codes';
import { otpauthUri, verifyTotp } from '../domain/totp';
import { User } from '../domain/user';
import {
  RECOVERY_CODE_GENERATOR, RECOVERY_CODE_REPOSITORY, RecoveryCodeGenerator, RecoveryCodeRepository, SECRET_CIPHER,
  SecretCipher, TOTP_GENERATOR, TotpGenerator,
} from './mfa-ports';
import { sessionPolicyFor } from '../domain/session-policy';
import { ACCESS_TOKEN_SERVICE, AccessTokenService, PASSWORD_HASHER, PasswordHasher } from './ports';

/** Nom affiché dans l'application d'authentification de l'utilisateur. */
export const MFA_ISSUER = 'Investally CRM';

const MFA_FAILURE = 'Code invalide';

export interface MfaCommand {
  userId: string;
  sessionId: string;
  actor: ActorContext;
}

export interface MfaEnrollmentStart {
  /** Secret en base32, affiché UNE fois pour saisie manuelle ; il n'est jamais renvoyé ensuite. */
  secret: string;
  /** URI à encoder en QR code côté interface. */
  otpauthUri: string;
}

/** Démarre l'enrôlement TOTP : génère et stocke (chiffré) un secret ; le MFA n'est pas encore actif. */
@Injectable()
export class StartMfaEnrollmentUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(TOTP_GENERATOR) private readonly totp: TotpGenerator,
    @Inject(SECRET_CIPHER) private readonly cipher: SecretCipher,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: MfaCommand): Promise<MfaEnrollmentStart> {
    return this.unitOfWork.run(async () => {
      const user = await this.users.lockById(command.userId);
      if (!user || !user.canAuthenticate()) throw new DomainError('UNAUTHENTICATED', 'Session invalide ou expirée');
      if (user.mfaEnabled) throw new DomainError('CONFLICT', 'Le MFA est déjà activé pour ce compte');

      const secret = this.totp.generateSecret();
      user.beginMfaEnrollment(this.cipher.encrypt(secret, user.id));
      await this.users.save(user);
      await this.audit.record({
        actor: command.actor, module: 'iam', entityType: 'User', entityId: user.id, action: AuditAction.MfaChange,
        // Jamais le secret : seulement l'événement.
        newValue: { event: 'enrollment_started', at: this.clock.now().toISOString() },
      });
      return { secret, otpauthUri: otpauthUri({ secretBase32: secret, accountName: user.email.value, issuer: MFA_ISSUER }) };
    });
  }
}

export interface MfaEnrollmentConfirmed {
  /** Codes de secours en clair, affichés UNE seule fois (seuls leurs hachages sont conservés). */
  recoveryCodes: string[];
  /** Nouveau jeton d'accès portant `amr = [pwd, otp]` : la session est désormais vérifiée par MFA. */
  accessToken: string;
  accessTokenExpiresAt: Date;
}

type ConfirmResult = { ok: true; value: MfaEnrollmentConfirmed } | { ok: false };

/** Confirme l'enrôlement avec un premier code valide : active le MFA et délivre les codes de secours. */
@Injectable()
export class ConfirmMfaEnrollmentUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(LOGIN_ATTEMPT_REPOSITORY) private readonly attempts: LoginAttemptRepository,
    @Inject(RECOVERY_CODE_REPOSITORY) private readonly recoveryCodes: RecoveryCodeRepository,
    @Inject(RECOVERY_CODE_GENERATOR) private readonly generator: RecoveryCodeGenerator,
    @Inject(SECRET_CIPHER) private readonly cipher: SecretCipher,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(ACCESS_TOKEN_SERVICE) private readonly accessTokens: AccessTokenService,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  /** L'échec est signalé APRÈS la validation de la transaction (le compteur d'échecs doit persister). */
  async execute(command: MfaCommand & { code: string }): Promise<MfaEnrollmentConfirmed> {
    const result = await this.unitOfWork.run(() => this.confirm(command));
    if (!result.ok) throw new DomainError('UNAUTHENTICATED', MFA_FAILURE);
    return result.value;
  }

  private async confirm(command: MfaCommand & { code: string }): Promise<ConfirmResult> {
    const now = this.clock.now();
    const user = await this.users.lockById(command.userId);
    const session = await this.sessions.findById(command.sessionId);
    if (!user || !user.canAuthenticate() || !session || session.userId !== user.id || !session.isActive(now)) {
      throw new DomainError('UNAUTHENTICATED', 'Session invalide ou expirée');
    }
    if (user.mfaEnabled) throw new DomainError('CONFLICT', 'Le MFA est déjà activé pour ce compte');
    if (user.mfaSecretEnc === null) throw new DomainError('VALIDATION', "Aucun enrôlement en cours : démarrez d'abord l'enrôlement");
    if (user.isLocked(now)) return this.fail(command, user, now, 'LOCKED', false);

    const verification = verifyTotp({
      secret: base32Decode(this.cipher.decrypt(user.mfaSecretEnc, user.id)),
      code: command.code,
      nowMs: now.getTime(),
      lastUsedStep: user.mfaLastUsedStep,
    });
    if (!verification.ok) return this.fail(command, user, now, 'BAD_CODE', true);

    user.confirmMfaEnrollment(verification.step);
    user.clearLoginFailures();
    await this.users.save(user);

    const plain = this.generator.generate(RECOVERY_CODE_COUNT);
    const hashes = await Promise.all(plain.map(async (code) => ({ id: this.ids.next(), hash: await this.hasher.hash(code) })));
    await this.recoveryCodes.replaceAll(user.id, hashes, now);

    session.markMfaVerified(now);
    await this.sessions.save(session);
    await this.audit.record({
      actor: command.actor, module: 'iam', entityType: 'User', entityId: user.id, action: AuditAction.MfaChange,
      newValue: { event: 'enrollment_confirmed', recoveryCodes: RECOVERY_CODE_COUNT },
    });
    const roles = await this.users.roleCodesOf(user.id);
    const token = await this.accessTokens.issue({ sub: user.id, sid: session.id, amr: ['pwd', 'otp'] }, sessionPolicyFor(roles).accessTokenMs, now);
    return {
      ok: true,
      value: { recoveryCodes: plain.map(formatRecoveryCode), accessToken: token.token, accessTokenExpiresAt: token.expiresAt },
    };
  }

  private async fail(command: MfaCommand, user: User, now: Date, reason: string, count: boolean): Promise<ConfirmResult> {
    if (count) {
      user.registerFailedMfa(now);
      await this.users.save(user);
    }
    await this.attempts.record({
      id: this.ids.next(), emailKey: user.email.key, userId: user.id, ipAddress: command.actor.ipAddress,
      outcome: LoginOutcome.MfaFailed, createdAt: now,
    });
    await this.audit.record({
      actor: command.actor, module: 'iam', entityType: 'User', entityId: user.id, action: AuditAction.LoginFailed,
      newValue: { reason: 'MFA_ENROLLMENT_' + reason },
    });
    return { ok: false };
  }
}
