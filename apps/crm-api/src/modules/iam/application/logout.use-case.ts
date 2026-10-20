import { Inject, Injectable } from '@nestjs/common';
import { ActorContext, CLOCK, Clock, UNIT_OF_WORK, UnitOfWork } from '../../../shared-kernel';
import { AUDIT_RECORDER, AuditAction, AuditRecorder } from '../../audit';
import {
  REFRESH_TOKEN_REPOSITORY, RefreshTokenRepository, SESSION_REPOSITORY, SessionRepository,
} from '../domain/auth-repositories';

export interface LogoutCommand {
  sessionId: string;
  actor: ActorContext;
}

/** Déconnexion : idempotente (une session déjà terminée ne produit ni erreur ni nouvelle ligne d'audit). */
@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokens: RefreshTokenRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: LogoutCommand): Promise<void> {
    await this.unitOfWork.run(async () => {
      const now = this.clock.now();
      const session = await this.sessions.findById(command.sessionId);
      if (!session || session.loggedOutAt !== null || session.revokedAt !== null) return;

      session.end(now);
      await this.sessions.save(session);
      await this.refreshTokens.revokeBySession(session.id, now);
      await this.audit.record({
        actor: { ...command.actor, userId: session.userId, sessionId: session.id },
        module: 'iam',
        entityType: 'UserSession',
        entityId: session.id,
        action: AuditAction.Logout,
      });
    });
  }
}
