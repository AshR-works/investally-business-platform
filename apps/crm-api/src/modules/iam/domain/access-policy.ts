import { ResolvedGrant, Scope } from './roles';

export interface AccessRequest {
  /** Permissions résolues de l'acteur (union de ses rôles). */
  grants: readonly ResolvedGrant[];
  permission: string;
  actorId: string;
  /** Propriétaire / affecté de l'objet visé. `null` : pas d'objet précis (création, liste). */
  resourceOwnerId: string | null;
  /** Identifiants des subordonnés directs de l'acteur (portée TEAM). */
  teamMemberIds: readonly string[];
}

export type AccessDecision =
  | { allowed: true; scope: Scope }
  | { allowed: false; reason: 'NO_PERMISSION' | 'OUT_OF_SCOPE' };

/**
 * Règle de décision pure (aucune dépendance) : refus par défaut.
 * - permission absente → refus ;
 * - portée ALL → autorisé ;
 * - portée TEAM → autorisé si l'objet appartient à l'acteur ou à un de ses subordonnés ;
 * - portée OWN → autorisé si l'objet appartient à l'acteur ;
 * - objet sans propriétaire connu (`null`) → autorisé seulement pour la création/liste,
 *   le filtrage par portée étant alors appliqué à la requête.
 * Si plusieurs rôles accordent la même permission, la portée la plus large l'emporte.
 */
export function decideAccess(request: AccessRequest): AccessDecision {
  const rank = { [Scope.Own]: 1, [Scope.Team]: 2, [Scope.All]: 3 };
  const matching = request.grants.filter((grant) => grant.permission === request.permission);
  if (matching.length === 0) return { allowed: false, reason: 'NO_PERMISSION' };

  const widest = matching.reduce((a, b) => (rank[b.scope] > rank[a.scope] ? b : a));
  if (widest.scope === Scope.All) return { allowed: true, scope: Scope.All };
  if (request.resourceOwnerId === null) return { allowed: true, scope: widest.scope };

  const owner = request.resourceOwnerId;
  if (owner === request.actorId) return { allowed: true, scope: widest.scope };
  if (widest.scope === Scope.Team && request.teamMemberIds.includes(owner)) {
    return { allowed: true, scope: Scope.Team };
  }
  return { allowed: false, reason: 'OUT_OF_SCOPE' };
}
