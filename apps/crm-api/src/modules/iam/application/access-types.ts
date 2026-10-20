// Types du domaine exposés à la couche Presentation (qui n'importe jamais le Domain directement).
export type { AccessContext, Visibility } from '../domain/access-context';

/** Portée minimale exigée par une route d'administration (valeurs de `Scope`). */
export type ScopeName = 'OWN' | 'TEAM' | 'ALL';

/** Statuts d'un compte, tels qu'exposés par l'API. */
export type UserStatusName = 'PENDING' | 'ACTIVE' | 'LOCKED' | 'DISABLED';
