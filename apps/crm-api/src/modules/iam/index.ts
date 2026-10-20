// API publique du module IAM : domaine pur uniquement (codes de permission, rôles, règle d'accès).
export { PERMISSIONS, PERMISSION_CODES } from './domain/permission-catalog';
export { RoleCode, Scope, ROLES, resolveGrants } from './domain/roles';
export type { ResolvedGrant } from './domain/roles';
export { decideAccess } from './domain/access-policy';
export type { AccessRequest, AccessDecision } from './domain/access-policy';
export { decideFor, visibilityFor } from './domain/access-context';
export type { AccessContext, Visibility } from './domain/access-context';
export { Access, Protected } from './presentation/protected.decorator';
export { CurrentActor } from './presentation/access-token.guard';
export type { AuthenticatedActor } from './application/authenticate-access-token.use-case';
