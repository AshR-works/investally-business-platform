import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, Clock } from '../../../shared-kernel';
import { SESSION_REPOSITORY, SessionRepository, USER_REPOSITORY, UserRepository } from '../domain/auth-repositories';
import { ACCESS_TOKEN_SERVICE, AccessTokenService } from './ports';

/** Identité de l'appelant, établie à partir d'un jeton d'accès valide ET d'une session encore active. */
export interface AuthenticatedActor {
  userId: string;
  sessionId: string;
  /** `true` seulement si le second facteur a été vérifié (S3.2). Les endpoints métier l'exigeront en S3.3. */
  mfaVerified: boolean;
  /** MFA vérifié depuis moins de 10 minutes : condition du step-up pour les actions sensibles. */
  hasFreshMfa: boolean;
}

/**
 * Vérifie le jeton (signature, expiration) puis l'état de la session : une session déconnectée, révoquée ou
 * expirée refuse immédiatement le jeton, même encore valide cryptographiquement (révocation immédiate).
 */
@Injectable()
export class AuthenticateAccessTokenUseCase {
  constructor(
    @Inject(ACCESS_TOKEN_SERVICE) private readonly tokens: AccessTokenService,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(token: string): Promise<AuthenticatedActor | null> {
    const now = this.clock.now();
    const claims = await this.tokens.verify(token, now);
    if (!claims) return null;

    const session = await this.sessions.findById(claims.sid);
    if (!session || session.userId !== claims.sub || !session.isActive(now)) return null;

    const user = await this.users.findById(session.userId);
    if (!user || !user.canAuthenticate()) return null;

    const otp = claims.amr.includes('otp');
    return {
      userId: user.id,
      sessionId: session.id,
      mfaVerified: session.mfaVerified && otp,
      hasFreshMfa: otp && session.hasFreshMfa(now),
    };
  }
}
