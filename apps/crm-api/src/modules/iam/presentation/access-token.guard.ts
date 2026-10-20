import { CanActivate, ExecutionContext, Injectable, createParamDecorator } from '@nestjs/common';
import { DomainError } from '../../../shared-kernel';
import { AuthenticateAccessTokenUseCase, AuthenticatedActor } from '../application/authenticate-access-token.use-case';

const BEARER = /^Bearer ([A-Za-z0-9._~+/=-]+)$/;

/**
 * Authentification (qui es-tu ?). L'autorisation par permission et portée (que peux-tu faire ?) arrive en S3.3.
 * Refuse par défaut : en-tête absent, mal formé, jeton invalide, session révoquée ou expirée → 401.
 */
@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private readonly authenticate: AuthenticateAccessTokenUseCase) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; actor?: AuthenticatedActor }>();
    const match = BEARER.exec(request.headers.authorization ?? '');
    const actor = match ? await this.authenticate.execute(match[1]) : null;
    if (!actor) throw new DomainError('UNAUTHENTICATED', 'Authentification requise');
    request.actor = actor;
    return true;
  }
}

/** Identité de l'appelant authentifié (à utiliser derrière `AccessTokenGuard`). */
export const CurrentActor = createParamDecorator((_data: unknown, context: ExecutionContext): AuthenticatedActor => {
  return context.switchToHttp().getRequest<{ actor: AuthenticatedActor }>().actor;
});
