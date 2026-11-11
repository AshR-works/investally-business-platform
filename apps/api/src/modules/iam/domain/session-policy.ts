import { RoleCode } from './roles';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Durées d'une session : jeton d'accès, inactivité maximale, durée absolue (plus courtes pour les rôles privilégiés).
 */
export interface SessionPolicy {
  /** Durée de vie du jeton d'accès. */
  accessTokenMs: number;
  /** Inactivité maximale avant expiration de la session. */
  idleMs: number;
  /** Durée absolue, quelle que soit l'activité. */
  absoluteMs: number;
}

/** Rôles à durée absolue réduite (décision du 2026-10-20, SECURITY.md §2.2). */
export const PRIVILEGED_ROLES: ReadonlySet<RoleCode> = new Set([RoleCode.SuperAdmin, RoleCode.Direction, RoleCode.Finance]);

export const STANDARD_POLICY: SessionPolicy = { accessTokenMs: 15 * MINUTE, idleMs: 8 * HOUR, absoluteMs: 7 * DAY };
export const PRIVILEGED_POLICY: SessionPolicy = { accessTokenMs: 15 * MINUTE, idleMs: 8 * HOUR, absoluteMs: 12 * HOUR };

/** Un utilisateur cumulant plusieurs rôles reçoit la politique la plus stricte. */
export function sessionPolicyFor(roles: readonly RoleCode[]): SessionPolicy {
  return roles.some((role) => PRIVILEGED_ROLES.has(role)) ? PRIVILEGED_POLICY : STANDARD_POLICY;
}

/** Vrai si l'un des rôles est privilégié (SuperAdmin, Direction, Finance) : sa session absolue est plus courte. */
export function hasPrivilegedRole(roles: readonly RoleCode[]): boolean {
  return roles.some((role) => PRIVILEGED_ROLES.has(role));
}
