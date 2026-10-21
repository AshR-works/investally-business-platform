import { Inject, Injectable } from '@nestjs/common';
import {
  ActorContext, CLOCK, Clock, DomainError, ID_GENERATOR, IdGenerator, UNIT_OF_WORK, UnitOfWork,
} from '../../../shared-kernel';
import { AUDIT_RECORDER, AuditAction, AuditRecorder } from '../../audit';
import {
  LOGIN_ATTEMPT_REPOSITORY, LoginAttemptRepository, LoginOutcome, SESSION_REPOSITORY, SessionRepository,
  USER_REPOSITORY, UserRepository,
} from '../domain/auth-repositories';
import { Email } from '../domain/email';
import { deviceFingerprint, networkRangeOf } from '../domain/network';
import { ROLES } from '../domain/roles';
import { hasPrivilegedRole, sessionPolicyFor } from '../domain/session-policy';
import { RiskLevel, assessRisk } from '../domain/session-risk';
import { UserSession } from '../domain/user-session';
import { PASSWORD_HASHER, PasswordHasher } from './ports';
import { IssuedTokens, SessionTokenService } from './session-token.service';

/** Données d'une connexion : adresse, mot de passe et contexte du client (IP, appareil). */
export interface LoginCommand {
  email: string;
  password: string;
  actor: ActorContext;
}

/** Connexion réussie : jetons, session, niveau de risque et état du MFA (exigé, configuré, vérifié). */
export interface LoginSuccess extends IssuedTokens {
  userId: string;
  sessionId: string;
  riskLevel: RiskLevel;
  /** MFA obligatoire pour ce compte (décision produit) ; vérifié seulement à partir de S3.2. */
  mfaRequired: boolean;
  mfaVerified: boolean;
  /** Le second facteur est déjà configuré : l'interface demande le code (sinon, elle propose l'enrôlement). */
  mfaEnrolled: boolean;
}

type FailureReason = 'UNKNOWN_USER' | 'BAD_PASSWORD' | 'LOCKED' | 'NOT_ACTIVE';
type LoginOutcomeResult = { ok: true; value: LoginSuccess } | { ok: false };

/** Fenêtre d'observation des échecs récents pour le score de risque. */
const RECENT_FAILURES_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Message unique : jamais de distinction entre e-mail inconnu, mauvais mot de passe, compte verrouillé ou inactif. */
const GENERIC_FAILURE = 'Identifiants invalides';

/**
 * Connexion par mot de passe : message d'échec unique, verrouillage progressif, risque de la session, audit de chaque
 * tentative.
 */
@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(LOGIN_ATTEMPT_REPOSITORY) private readonly attempts: LoginAttemptRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly tokens: SessionTokenService,
  ) {}

  /**
   * Les échecs doivent être PERSISTÉS (compteur, tentative, audit) : on ne lève donc l'erreur qu'après la
   * validation de la transaction, jamais à l'intérieur.
   */
  async execute(command: LoginCommand): Promise<LoginSuccess> {
    const result = await this.unitOfWork.run(() => this.attempt(command));
    if (!result.ok) throw new DomainError('UNAUTHENTICATED', GENERIC_FAILURE);
    return result.value;
  }

  /**
   * Déroule une tentative sous verrou de ligne : compte inconnu (temps de hachage égalisé), verrouillé, inactif,
   * mauvais mot de passe ou succès ; persiste toujours compteur, tentative et audit.
   */
  private async attempt(command: LoginCommand): Promise<LoginOutcomeResult> {
    const now = this.clock.now();
    const emailKey = Email.keyOf(command.email);
    // Verrou de ligne : des tentatives parallèles sur le même compte sont sérialisées (compteur fiable).
    const user = emailKey ? await this.users.lockByEmailKey(emailKey) : null;

    if (!user) {
      await this.hasher.verifyDummy(command.password);
      return this.fail(command, emailKey, null, 'UNKNOWN_USER', LoginOutcome.BadCredentials, now);
    }

    if (user.isLocked(now)) {
      await this.hasher.verifyDummy(command.password);
      return this.fail(command, emailKey, user.id, 'LOCKED', LoginOutcome.Locked, now);
    }

    const passwordOk = user.passwordHash
      ? await this.hasher.verify(user.passwordHash, command.password)
      : (await this.hasher.verifyDummy(command.password), false);

    if (!passwordOk) {
      user.registerFailedLogin(now);
      await this.users.save(user);
      return this.fail(command, emailKey, user.id, 'BAD_PASSWORD', LoginOutcome.BadCredentials, now);
    }

    if (!user.canAuthenticate()) {
      return this.fail(command, emailKey, user.id, 'NOT_ACTIVE', LoginOutcome.BadCredentials, now);
    }

    const roles = await this.users.roleCodesOf(user.id);
    const policy = sessionPolicyFor(roles);

    const known = await this.sessions.knownFingerprints(user.id);
    const network = networkRangeOf(command.actor.ipAddress);
    const device = deviceFingerprint(command.actor.device);
    const recentFailures = await this.attempts.countRecentFailures(emailKey, new Date(now.getTime() - RECENT_FAILURES_WINDOW_MS));
    const firstEver = known.devices.size === 0 && known.networks.size === 0;
    const riskLevel = assessRisk({
      newDevice: !firstEver && !known.devices.has(device),
      newNetwork: !firstEver && !known.networks.has(network),
      recentFailures,
      privilegedRole: hasPrivilegedRole(roles),
    });

    const session = UserSession.open({
      id: this.ids.next(), userId: user.id, ipAddress: command.actor.ipAddress, device: command.actor.device,
      riskLevel, policy, now,
    });
    await this.sessions.save(session);

    const issued = await this.tokens.issue({ session, policy, familyId: this.ids.next(), amr: ['pwd'], now });

    user.registerSuccessfulLogin(now);
    await this.users.save(user);
    await this.attempts.record({ id: this.ids.next(), emailKey, userId: user.id, ipAddress: command.actor.ipAddress, outcome: LoginOutcome.Success, createdAt: now });
    await this.audit.record({
      actor: { ...command.actor, userId: user.id, sessionId: session.id },
      module: 'iam',
      entityType: 'UserSession',
      entityId: session.id,
      action: AuditAction.Login,
      newValue: { riskLevel, mfaVerified: false, network },
    });

    return {
      ok: true,
      value: {
        ...issued,
        userId: user.id,
        sessionId: session.id,
        riskLevel,
        mfaRequired: ROLES.filter((r) => roles.includes(r.code)).some((r) => r.mfaRequired),
        mfaVerified: false,
        mfaEnrolled: user.mfaEnabled,
      },
    };
  }

  private async fail(
    command: LoginCommand, emailKey: string, userId: string | null, reason: FailureReason, outcome: LoginOutcome, now: Date,
  ): Promise<LoginOutcomeResult> {
    await this.attempts.record({ id: this.ids.next(), emailKey, userId, ipAddress: command.actor.ipAddress, outcome, createdAt: now });
    await this.audit.record({
      actor: { ...command.actor, userId },
      module: 'iam',
      entityType: 'User',
      entityId: userId ?? 'unknown',
      action: AuditAction.LoginFailed,
      newValue: { reason },
    });
    return { ok: false };
  }
}
