/** Profil de l'utilisateur connecté : identité, rôles, droits (avec portée) et état du MFA. */
export interface Profile {
  userId: string;
  email: string;
  displayName: string;
  roles: string[];
  permissions: { code: string; scope: 'OWN' | 'TEAM' | 'ALL' }[];
  mfaEnrolled: boolean;
}

/** Page de résultats paginés renvoyée par l'API. */
export interface Page<T> {
  items: T[];
  total: number;
  page?: number;
  pageSize?: number;
}

/** Utilisateur tel que l'API l'expose à l'administration. */
export interface UserView {
  id: string;
  email: string;
  displayName: string;
  status: 'PENDING' | 'ACTIVE' | 'LOCKED' | 'DISABLED';
  roles: string[];
  managerId: string | null;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

/** Rôle et ses permissions, tels que l'API les expose. */
export interface RoleView {
  code: string;
  label: string;
  description: string;
  mfaRequired: boolean;
  permissions: { code: string; scope: string }[];
}

/** Session de connexion telle que l'API l'expose (la courante est marquée). */
export interface SessionView {
  id: string;
  ipAddress: string;
  device: string;
  riskLevel: string;
  mfaVerified: boolean;
  loggedInAt: string;
  lastSeenAt: string;
  expiresAt: string;
  current: boolean;
}

/** Entreprise cible telle que l'API l'expose. */
export interface Company {
  id: string;
  name: string;
  status: string;
  sector: string | null;
  country: string | null;
  /** Date de création (ISO 8601). */
  createdAt: string;
}

/** Une connexion de l'historique (réussie ou échouée) : étape de l'échec, adresse IP et appareil. */
export interface LoginEvent {
  id: string;
  at: string;
  result: 'SUCCESS' | 'FAILED';
  stage?: 'PASSWORD' | 'SECOND_FACTOR';
  ipAddress: string;
  device: string;
}

/** Page de l'historique : `nextBefore` est le curseur de la page suivante (nul s'il n'y en a pas). */
export interface LoginHistoryPage {
  items: LoginEvent[];
  nextBefore: string | null;
  windowDays: number;
}

