import type { Profile } from './types';

/** Informatif seulement (menus, boutons) : le serveur re-contrôle chaque requête. */
export function can(profile: Profile | null, permission: string): boolean {
  return !!profile?.permissions.some((grant) => grant.code === permission);
}

/** Informatif seulement : la permission est accordée en portée « Tous » (la RH et la Direction voient tout le personnel, les autres seulement leur périmètre). */
export function canAll(profile: Profile | null, permission: string): boolean {
  return !!profile?.permissions.some((grant) => grant.code === permission && grant.scope === 'ALL');
}

/** Code de rôle de l'API → libellé affiché. Les rôles inconnus gardent leur code. */
export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super administrateur',
  DIRECTION: 'Direction',
  HEAD_OF_SALES: 'Responsable commercial',
  ACCOUNT_MANAGER: 'Chargé de compte',
  TRAINING_MANAGER: 'Responsable formation',
  TRAINER: 'Formateur',
  SUPPORT: 'Support',
  FINANCE: 'Finance',
  HR: 'Ressources humaines',
  TAX: 'Fiscalité',
};
/** Libellé français d'un rôle (le code brut si le rôle est inconnu). */
export const roleLabel = (code: string): string => ROLE_LABELS[code] ?? code;

export const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Invitation en attente',
  ACTIVE: 'Actif',
  LOCKED: 'Verrouillé',
  DISABLED: 'Désactivé',
};
