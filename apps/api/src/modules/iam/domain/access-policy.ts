import { ResolvedGrant, Scope } from './roles';

/**
 * Question posée à la politique d'accès : droits de l'acteur, permission demandée, objet visé (propriétaire) et
 * équipe de l'acteur.
 */
export interface AccessRequest {
  /** Permissions résolues de l'acteur (union de ses rôles). */
  grants: readonly ResolvedGrant[];
  permission: string;
  actorId: string;
  /**
   * Propriétaire / affecté de l'objet visé :
   * - `undefined` : AUCUN objet précis (création, liste) : la portée de la permission est retournée pour filtrage ;
   * - `string`    : objet appartenant à cet utilisateur ;
   * - `null`      : objet EXISTANT SANS propriétaire (données antérieures) : réservé à la portée Tous.
   * Ne jamais confondre `undefined` et `null` : traiter un objet orphelin comme une liste ouvrirait l'accès
   * à tous les rôles en portée Propre ou Équipe.
   */
  resourceOwnerId: string | null | undefined;
  /** Identifiants des subordonnés directs de l'acteur (portée TEAM). */
  teamMemberIds: readonly string[];
}

export type AccessDecision =
  | { allowed: true; scope: Scope }
  | { allowed: false; reason: 'NO_PERMISSION' | 'OUT_OF_SCOPE' };

const RANK = { [Scope.Own]: 1, [Scope.Team]: 2, [Scope.All]: 3 };

/** `true` si la portée accordée couvre la portée exigée (Propre < Équipe < Tous). */
export function scopeCovers(granted: Scope, required: Scope): boolean {
  return RANK[granted] >= RANK[required];
}

/** Portée la plus large accordée pour une permission, `null` si elle n'est pas accordée. */
export function widestScope(grants: readonly ResolvedGrant[], permission: string): Scope | null {
  let widest: Scope | null = null;
  for (const grant of grants) {
    if (grant.permission === permission && (widest === null || RANK[grant.scope] > RANK[widest])) widest = grant.scope;
  }
  return widest;
}

/**
 * Règle de décision pure (aucune dépendance) : refus par défaut.
 * - permission absente → refus ;
 * - portée ALL → autorisé (même pour un objet sans propriétaire) ;
 * - pas d'objet précis (`undefined`) → autorisé avec la portée de la permission, filtrage ensuite ;
 * - objet sans propriétaire (`null`) → refus (portée Propre ou Équipe) ;
 * - portée TEAM → autorisé si l'objet appartient à l'acteur ou à un de ses subordonnés DIRECTS ;
 * - portée OWN → autorisé si l'objet appartient à l'acteur.
 * Si plusieurs rôles accordent la même permission, la portée la plus large l'emporte.
 */
export function decideAccess(request: AccessRequest): AccessDecision {
  const widest = widestScope(request.grants, request.permission);
  if (widest === null) return { allowed: false, reason: 'NO_PERMISSION' };
  if (widest === Scope.All) return { allowed: true, scope: Scope.All };
  if (request.resourceOwnerId === undefined) return { allowed: true, scope: widest };
  if (request.resourceOwnerId === null) return { allowed: false, reason: 'OUT_OF_SCOPE' };

  const owner = request.resourceOwnerId;
  if (owner === request.actorId) return { allowed: true, scope: widest };
  if (widest === Scope.Team && request.teamMemberIds.includes(owner)) return { allowed: true, scope: Scope.Team };
  return { allowed: false, reason: 'OUT_OF_SCOPE' };
}
