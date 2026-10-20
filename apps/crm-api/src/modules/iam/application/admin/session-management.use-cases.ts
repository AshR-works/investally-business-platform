import { Inject, Injectable } from '@nestjs/common';
import { ActorContext, CLOCK, Clock, DomainError, UNIT_OF_WORK, UnitOfWork } from '../../../../shared-kernel';
import { AUDIT_RECORDER, AuditAction, AuditRecorder } from '../../../audit';
import { AccessContext, decideFor } from '../../domain/access-context';
import {
  REFRESH_TOKEN_REPOSITORY, RefreshTokenRepository, SESSION_REPOSITORY, SessionRepository, USER_REPOSITORY, UserRepository,
} from '../../domain/auth-repositories';

export interface SessionView {
  id: string;
  ipAddress: string;
  device: string;
  riskLevel: string;
  mfaVerified: boolean;
  loggedInAt: string;
  lastSeenAt: string;
  expiresAt: string;
  /** `true` pour la session qui fait la demande. */
  current: boolean;
}

/** Les sessions actives de l'appelant : il ne voit jamais celles des autres. */
@Injectable()
export class ListOwnSessionsHandler {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(actor: { userId: string; sessionId: string }): Promise<SessionView[]> {
    const active = await this.sessions.listActiveOf(actor.userId, this.clock.now());
    return active.map((session) => ({
      id: session.id,
      ipAddress: session.ipAddress,
      device: session.device,
      riskLevel: session.riskLevel,
      mfaVerified: session.mfaVerified,
      loggedInAt: session.loggedInAt.toISOString(),
      lastSeenAt: session.lastSeenAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      current: session.id === actor.sessionId,
    }));
  }
}

/**
 * Révoque UNE session. Le propriétaire peut révoquer les siennes ; seule la portée « Tous » permet d'en révoquer
 * une autre. Une session hors portée est « introuvable » (on ne révèle pas son existence).
 */
@Injectable()
export class RevokeSessionUseCase {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokens: RefreshTokenRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: { sessionId: string; access: AccessContext; actor: ActorContext }): Promise<void> {
    await this.unitOfWork.run(async () => {
      const now = this.clock.now();
      const session = await this.sessions.findById(command.sessionId);
      if (!session || !decideFor(command.access, 'iam.session.revoke', session.userId).allowed) {
        throw new DomainError('NOT_FOUND', 'Session introuvable');
      }
      if (session.revokedAt !== null || session.loggedOutAt !== null) return;

      session.revoke(now, session.userId === command.access.actorId ? 'Révoquée par son propriétaire' : 'Révoquée par un administrateur');
      await this.sessions.save(session);
      await this.refreshTokens.revokeBySession(session.id, now);
      await this.audit.record({
        actor: command.actor, module: 'iam', entityType: 'UserSession', entityId: session.id, action: AuditAction.SessionRevoke,
        newValue: { userId: session.userId, byOwner: session.userId === command.access.actorId },
      });
    });
  }
}

/** Coupe TOUTES les sessions d'un utilisateur (incident). Réservé à la portée « Tous » sur `iam.session.revoke`. */
@Injectable()
export class RevokeUserSessionsUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokens: RefreshTokenRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: { targetUserId: string; access: AccessContext; actor: ActorContext }): Promise<{ revoked: number }> {
    if (!decideFor(command.access, 'iam.session.revoke', command.targetUserId).allowed) {
      throw new DomainError('FORBIDDEN', 'Accès refusé');
    }
    return this.unitOfWork.run(async () => {
      const now = this.clock.now();
      if (!(await this.users.findById(command.targetUserId))) throw new DomainError('NOT_FOUND', 'Utilisateur introuvable');
      const revoked = await this.sessions.revokeAllOfUserExcept(command.targetUserId, null, now, 'Toutes les sessions révoquées par un administrateur');
      for (const sessionId of revoked) await this.refreshTokens.revokeBySession(sessionId, now);
      await this.audit.record({
        actor: command.actor, module: 'iam', entityType: 'User', entityId: command.targetUserId, action: AuditAction.SessionRevoke,
        newValue: { event: 'all_sessions_revoked', count: revoked.length },
      });
      return { revoked: revoked.length };
    });
  }
}
