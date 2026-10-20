import { Inject, Injectable } from '@nestjs/common';
import { ActorContext, DomainError } from '../../../shared-kernel';
import { AUDIT_RECORDER, AuditAction, AuditRecorder } from '../../audit';
import { AccessContext, decideFor } from '../domain/access-context';
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

  async contextFor(userId: string): Promise<AccessContext> {
    const [grants, teamMemberIds] = await Promise.all([this.grants.grantsOf(userId), this.grants.teamMemberIds(userId)]);
    return { actorId: userId, grants, teamMemberIds };
  }

  /** Vérifie la permission au niveau de la route (sans objet précis) ; la portée est contrôlée ensuite, objet par objet. */
  async assertPermission(context: AccessContext, permission: string, actor: ActorContext): Promise<void> {
    if (decideFor(context, permission, undefined).allowed) return;
    await this.audit.record({
      actor,
      module: 'iam',
      entityType: 'Permission',
      entityId: permission,
      action: AuditAction.AccessDenied,
      newValue: { permission },
    });
    throw new DomainError('FORBIDDEN', 'Accès refusé');
  }
}
