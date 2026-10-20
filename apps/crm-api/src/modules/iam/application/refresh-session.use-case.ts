import { Inject, Injectable } from '@nestjs/common';
import {
  ActorContext, CLOCK, Clock, DomainError, UNIT_OF_WORK, UnitOfWork,
} from '../../../shared-kernel';
import { AUDIT_RECORDER, AuditAction, AuditRecorder } from '../../audit';
import {
  REFRESH_TOKEN_REPOSITORY, RefreshTokenRepository, SESSION_REPOSITORY, SessionRepository, USER_REPOSITORY, UserRepository,
} from '../domain/auth-repositories';
import { evaluateRefresh } from '../domain/refresh-token';
import { sessionPolicyFor } from '../domain/session-policy';
import { RiskLevel } from '../domain/session-risk';
import { REFRESH_TOKEN_FACTORY, RefreshTokenFactory } from './ports';
import { IssuedTokens, SessionTokenService } from './session-token.service';

export interface RefreshCommand {
  refreshToken: string;
  actor: ActorContext;
}

type RefreshResult = { ok: true; value: IssuedTokens & { sessionId: string; userId: string } } | { ok: false };

const GENERIC_FAILURE = 'Session invalide ou expirée';

@Injectable()
export class RefreshSessionUseCase {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokens: RefreshTokenRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(REFRESH_TOKEN_FACTORY) private readonly factory: RefreshTokenFactory,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly tokens: SessionTokenService,
  ) {}

  /** Comme pour la connexion, l'échec est signalé APRÈS la validation de la transaction (la révocation doit persister). */
  async execute(command: RefreshCommand): Promise<IssuedTokens & { sessionId: string; userId: string }> {
    const result = await this.unitOfWork.run(() => this.rotate(command));
    if (!result.ok) throw new DomainError('UNAUTHENTICATED', GENERIC_FAILURE);
    return result.value;
  }

  private async rotate(command: RefreshCommand): Promise<RefreshResult> {
    const now = this.clock.now();
    const hash = this.factory.hashOf(command.refreshToken);
    const record = await this.refreshTokens.findByHash(hash);
    if (!record) return { ok: false };

    const decision = evaluateRefresh(record, now);

    if (decision === 'REUSED') {
      // Jeton déjà consommé hors fenêtre de tolérance : vol probable → on coupe toute la connexion.
      const session = await this.sessions.findById(record.sessionId);
      await this.refreshTokens.revokeFamily(record.familyId, now);
      if (session) {
        session.revoke(now, 'Réutilisation d\'un jeton de rafraîchissement');
        session.markRisk(RiskLevel.Critical);
        await this.sessions.save(session);
        await this.audit.record({
          actor: { ...command.actor, userId: session.userId, sessionId: session.id },
          module: 'iam',
          entityType: 'UserSession',
          entityId: session.id,
          action: AuditAction.SessionRevoke,
          newValue: { reason: 'refresh_token_reuse', riskLevel: RiskLevel.Critical },
        });
      }
      return { ok: false };
    }
    if (decision !== 'ROTATE') return { ok: false };

    // Consommation atomique : si une requête concurrente l'a prise entre-temps, celle-ci échoue simplement.
    if (!(await this.refreshTokens.consume(hash, now))) return { ok: false };

    const session = await this.sessions.findById(record.sessionId);
    if (!session || !session.isActive(now)) return { ok: false };

    const user = await this.users.findById(session.userId);
    if (!user || !user.canAuthenticate()) {
      session.revoke(now, 'Compte inactif');
      await this.sessions.save(session);
      await this.refreshTokens.revokeBySession(session.id, now);
      return { ok: false };
    }

    const roles = await this.users.roleCodesOf(user.id);
    const policy = sessionPolicyFor(roles);
    session.touch(now, policy);
    await this.sessions.save(session);

    const issued = await this.tokens.issue({
      session, policy, familyId: record.familyId, amr: session.mfaVerified ? ['pwd', 'otp'] : ['pwd'], now,
    });
    return { ok: true, value: { ...issued, sessionId: session.id, userId: user.id } };
  }
}
