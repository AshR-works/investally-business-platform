import { AccessDecision, decideAccess, widestScope } from './access-policy';
import { ResolvedGrant, Scope } from './roles';

/** Ce que l'on sait des droits de l'appelant pour la durée d'une requête (résolus depuis la base, jamais lus dans le jeton). */
export interface AccessContext {
  actorId: string;
  grants: readonly ResolvedGrant[];
  /** Subordonnés directs de l'acteur (portée Équipe). */
  teamMemberIds: readonly string[];
}

/** Les objets qu'un acteur peut voir pour une permission : tous, ou ceux de ces propriétaires (liste vide = aucun). */
export type Visibility = { unrestricted: true } | { unrestricted: false; ownerIds: readonly string[] };

/**
 * Traduit les droits de l'acteur en périmètre de lecture pour une permission : tout voir, voir les objets de certains
 * propriétaires (lui, ou lui + ses subordonnés directs), ou rien.
 */
export function visibilityFor(context: AccessContext, permission: string): Visibility {
  const scope = widestScope(context.grants, permission);
  if (scope === Scope.All) return { unrestricted: true };
  if (scope === Scope.Team) return { unrestricted: false, ownerIds: [context.actorId, ...context.teamMemberIds] };
  if (scope === Scope.Own) return { unrestricted: false, ownerIds: [context.actorId] };
  return { unrestricted: false, ownerIds: [] };
}

/** Décision pour un objet précis (voir `decideAccess` pour la signification de `ownerId`). */
export function decideFor(context: AccessContext, permission: string, ownerId: string | null | undefined): AccessDecision {
  return decideAccess({
    grants: context.grants,
    permission,
    actorId: context.actorId,
    resourceOwnerId: ownerId,
    teamMemberIds: context.teamMemberIds,
  });
}
