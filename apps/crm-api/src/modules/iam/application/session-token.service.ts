import { Inject, Injectable } from '@nestjs/common';
import { ID_GENERATOR, IdGenerator } from '../../../shared-kernel';
import { REFRESH_TOKEN_REPOSITORY, RefreshTokenRepository } from '../domain/auth-repositories';
import { SessionPolicy } from '../domain/session-policy';
import { UserSession } from '../domain/user-session';
import { ACCESS_TOKEN_SERVICE, AccessTokenService, REFRESH_TOKEN_FACTORY, RefreshTokenFactory } from './ports';

/** Jeton d'accès et jeton de rafraîchissement émis, avec leurs échéances. */
export interface IssuedTokens {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

/** Émet le couple jeton d'accès + jeton de rafraîchissement d'une session (connexion et rotation). */
@Injectable()
export class SessionTokenService {
  constructor(
    @Inject(ACCESS_TOKEN_SERVICE) private readonly accessTokens: AccessTokenService,
    @Inject(REFRESH_TOKEN_FACTORY) private readonly refreshFactory: RefreshTokenFactory,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokens: RefreshTokenRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  /** Émet le jeton d'accès et un nouveau jeton de rafraîchissement (dont l'empreinte est stockée) pour une session. */
  async issue(input: { session: UserSession; policy: SessionPolicy; familyId: string; amr: string[]; now: Date }): Promise<IssuedTokens> {
    const { session, policy, familyId, amr, now } = input;

    const refresh = this.refreshFactory.generate();
    // Le jeton de rafraîchissement ne survit jamais à la session.
    const refreshTokenExpiresAt = session.expiresAt;
    await this.refreshTokens.save({
      id: this.ids.next(),
      sessionId: session.id,
      familyId,
      tokenHash: refresh.hash,
      issuedAt: now,
      expiresAt: refreshTokenExpiresAt,
      usedAt: null,
      revokedAt: null,
    });

    const access = await this.accessTokens.issue({ sub: session.userId, sid: session.id, amr }, policy.accessTokenMs, now);
    return {
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt,
      refreshToken: refresh.token,
      refreshTokenExpiresAt,
    };
  }
}
