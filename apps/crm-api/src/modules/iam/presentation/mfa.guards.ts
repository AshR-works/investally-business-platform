import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { DomainError } from '../../../shared-kernel';
import { AuthenticatedActor } from '../application/authenticate-access-token.use-case';

function actorOf(context: ExecutionContext): AuthenticatedActor | undefined {
  return context.switchToHttp().getRequest<{ actor?: AuthenticatedActor }>().actor;
}

/**
 * Exige que le second facteur ait été vérifié pour cette session (jeton portant `otp`).
 * À placer APRÈS `AccessTokenGuard` : `@UseGuards(AccessTokenGuard, RequireMfaGuard)`.
 * S3.3 l'applique à tous les endpoints métier ; avant, l'API reste locale.
 */
@Injectable()
export class RequireMfaGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (!actorOf(context)?.mfaVerified) throw new DomainError('MFA_REQUIRED', 'Vérification MFA requise');
    return true;
  }
}

/**
 * Step-up : pour une action sensible (changement de rôle, export, suppression), le MFA doit avoir été vérifié
 * depuis moins de 10 minutes. L'interface reconnaît le code `MFA_STEP_UP_REQUIRED` et redemande un code.
 */
@Injectable()
export class RequireRecentMfaGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const actor = actorOf(context);
    if (!actor?.mfaVerified) throw new DomainError('MFA_REQUIRED', 'Vérification MFA requise');
    if (!actor.hasFreshMfa) throw new DomainError('MFA_STEP_UP_REQUIRED', 'Une vérification MFA récente est requise pour cette action');
    return true;
  }
}
