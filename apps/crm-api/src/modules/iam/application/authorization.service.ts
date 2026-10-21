import { Inject, Injectable } from '@nestjs/common';
import { ActorContext, DomainError } from '../../../shared-kernel';
import { AUDIT_RECORDER, AuditAction, AuditRecorder } from '../../audit';
import { AccessContext } from '../domain/access-context';
import { widestScope, scopeCovers } from '../domain/access-policy';
import { Scope } from '../domain/roles';
import type { ScopeName } from './access-types';
import { GRANT_READER, GrantReader } from '../domain/auth-repositories';

/**
 * Autorisation côté serveur : les droits sont lus en base à chaque requête (jamais dans le jeton), donc un changement
 * de rôle ou une désactivation prend effet immédiatement. Refus par défaut ; chaque refus est audité (`ACCESS_DENIED`).
 */
@Injectable()
export class AuthorizationService {
  constructor(
    @Inject(GRANT_READER) private readonly grants: GrantReader,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
  ) {}

  /** Lit en base les droits et l'équipe de l'utilisateur pour la durée de la requête (jamais depuis le jeton). */
  async contextFor(userId: string): Promise<AccessContext> {
    const [grants, teamMemberIds] = await Promise.all([this.grants.grantsOf(userId), this.grants.teamMemberIds(userId)]);
    return { actorId: userId, grants, teamMemberIds };
  }

  /** Vérifie la permission au niveau de la route (sans objet précis) ; la portée est contrôlée ensuite, objet par objet. */
  async assertPermission(context: AccessContext, permission: string, actor: ActorContext, minScope?: ScopeName): Promise<void> {
    const granted = widestScope(context.grants, permission);
    // Une route qui agit sur N'IMPORTE QUEL utilisateur exige la portée « Tous » : détenir la permission en portée « Propre »
    // (agir sur soi-même) ne suffit pas, et le refus est net dès la garde plutôt que flou plus loin.
    if (granted !== null && (minScope === undefined || scopeCovers(granted, minScope as Scope))) return;
    await this.audit.record({
      actor,
      module: 'iam',
      entityType: 'Permission',
      entityId: permission,
      action: AuditAction.AccessDenied,
      newValue: minScope ? { permission, requiredScope: minScope, grantedScope: granted } : { permission },
    });
    throw new DomainError('FORBIDDEN', 'Accès refusé');
  }
}
