import { User } from '../../domain/user';

/** Représentation publique d'un utilisateur : JAMAIS de hachage, de secret MFA ni de compteur interne. */
export interface UserView {
  id: string;
  email: string;
  displayName: string;
  status: string;
  roles: string[];
  managerId: string | null;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

/** Transforme un utilisateur en représentation publique (jamais de hachage, de secret MFA ni de compteur interne). */
export function toUserView(user: User, roles: readonly string[]): UserView {
  return {
    id: user.id,
    email: user.email.value,
    displayName: user.displayName,
    status: user.status,
    roles: [...roles],
    managerId: user.managerId,
    mfaEnabled: user.mfaEnabled,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
  };
}

/** Rôle tel qu'exposé à l'administration : code, libellé, description, MFA exigé et permissions. */
export interface RoleView {
  code: string;
  label: string;
  description: string;
  mfaRequired: boolean;
  permissions: { code: string; scope: string }[];
}

/** Lecture du catalogue des rôles et de leurs permissions, tels qu'enregistrés en base. */
export interface RoleCatalogReader {
  list(): Promise<RoleView[]>;
}

export const ROLE_CATALOG_READER = Symbol('RoleCatalogReader');
