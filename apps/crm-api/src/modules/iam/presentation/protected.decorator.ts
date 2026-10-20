import {
  CanActivate, ExecutionContext, Injectable, SetMetadata, UseGuards, applyDecorators, createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiBearerAuth } from '@nestjs/swagger';
import { DomainError, actorContextFrom } from '../../../shared-kernel';
import { AuthenticatedActor } from '../application/authenticate-access-token.use-case';
import { AuthorizationService } from '../application/authorization.service';
import type { AccessContext } from '../application/access-types';
import { AccessTokenGuard } from './access-token.guard';
import { RequireMfaGuard, RequireRecentMfaGuard } from './mfa.guards';

export const PERMISSION_KEY = 'crm:permission';

interface RequestWithIdentity {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
  actor?: AuthenticatedActor;
  access?: AccessContext;
}

/**
 * Vérifie que l'appelant possède la permission déclarée par `@Protected(...)`. Les droits sont lus en base à chaque
 * requête. Refus par défaut : une garde sans permission déclarée REFUSE (jamais d'ouverture par oubli).
 * Le contexte d'accès est placé sur la requête pour que le cas d'usage contrôle ensuite la PORTÉE, objet par objet.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authorization: AuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.get<string | undefined>(PERMISSION_KEY, context.getHandler());
    if (!permission) throw new DomainError('FORBIDDEN', 'Accès refusé');

    const request = context.switchToHttp().getRequest<RequestWithIdentity>();
    if (!request.actor) throw new DomainError('UNAUTHENTICATED', 'Authentification requise');

    const access = await this.authorization.contextFor(request.actor.userId);
    await this.authorization.assertPermission(access, permission, actorContextFrom(request, request.actor));
    request.access = access;
    return true;
  }
}

/**
 * Protège une route : identité (jeton valide, session active) → MFA vérifié → permission → (optionnel) MFA récent.
 * La permission est vérifiée AVANT le step-up : un rôle sans droit reçoit un refus net, pas une invitation à
 * ressaisir un code. À utiliser sur TOUTE route métier ou d'administration.
 *
 *   @Protected('bd.company.read')
 *   @Protected('iam.user.assign_role', { stepUp: true })
 */
export function Protected(permission: string, options: { stepUp?: boolean } = {}) {
  const guards = [AccessTokenGuard, RequireMfaGuard, PermissionGuard, ...(options.stepUp ? [RequireRecentMfaGuard] : [])];
  return applyDecorators(SetMetadata(PERMISSION_KEY, permission), UseGuards(...guards), ApiBearerAuth());
}

/** Contexte d'accès de l'appelant (droits, équipe) — à utiliser derrière `@Protected`. */
export const Access = createParamDecorator((_data: unknown, context: ExecutionContext): AccessContext => {
  const access = context.switchToHttp().getRequest<RequestWithIdentity>().access;
  if (!access) throw new DomainError('FORBIDDEN', 'Accès refusé');
  return access;
});
