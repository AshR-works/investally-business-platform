import { Page } from '../../../shared-kernel';
import { UserInvitationRecord } from './invitation';
import { RefreshTokenRecord } from './refresh-token';
import { ResolvedGrant, RoleCode } from './roles';
import { User, UserStatus } from './user';
import { UserSession } from './user-session';

/**
 * Port de persistance des utilisateurs : lecture, verrous de ligne pour les opérations concurrentes, rôles, liste
 * d'administration et invariants (dernier SuperAdmin, hiérarchie).
 */
export interface UserRepository {
  findById(id: string): Promise<User | null>;
  /**
   * Charge l'utilisateur ET verrouille sa ligne pour la durée de la transaction en cours (`SELECT ... FOR UPDATE`).
   * Sérialise les connexions concurrentes d'un même compte : sans cela, des tentatives parallèles lisent toutes le
   * même compteur d'échecs et contournent le verrouillage. À appeler dans une unité de travail.
   */
  lockByEmailKey(emailKey: string): Promise<User | null>;
  /** Comme `lockByEmailKey`, par identifiant (vérifications MFA : anti-rejeu et compteur d'échecs fiables). */
  lockById(id: string): Promise<User | null>;
  emailExists(emailKey: string): Promise<boolean>;
  save(user: User): Promise<void>;
  roleCodesOf(userId: string): Promise<RoleCode[]>;
  assignRoles(userId: string, roles: readonly RoleCode[], assignedBy: string | null): Promise<void>;
  /** Liste paginée (recherche sur e-mail et nom), plus récents d'abord. Jamais plus de `pageSize` lignes. */
  list(query: { page: number; pageSize: number; search?: string; status?: UserStatus }): Promise<Page<User>>;
  rolesOfMany(userIds: readonly string[]): Promise<Map<string, RoleCode[]>>;
  /** Remplace l'ensemble des rôles de l'utilisateur. */
  replaceRoles(userId: string, roles: readonly RoleCode[], assignedBy: string | null): Promise<void>;
  /**
   * Verrouille (jusqu'à la fin de la transaction) la règle « il reste au moins un SuperAdmin actif ». À appeler AVANT
   * `countActiveSuperAdmins` dans toute opération qui peut retirer un SuperAdmin : sans ce verrou, deux administrateurs
   * agissant en même temps sur les deux derniers comptes les retireraient tous les deux (course).
   */
  lockSuperAdminInvariant(): Promise<void>;
  countActiveSuperAdmins(): Promise<number>;
  /** Responsables successifs de l'utilisateur (son responsable, puis le responsable de celui-ci…), au plus `maxDepth`. */
  managerChainOf(userId: string, maxDepth: number): Promise<string[]>;
}

/** Lecture des droits d'un utilisateur, résolus depuis la base À CHAQUE requête (jamais dans le jeton). */
export interface GrantReader {
  grantsOf(userId: string): Promise<ResolvedGrant[]>;
  /** Subordonnés directs (portée Équipe). */
  teamMemberIds(userId: string): Promise<string[]>;
}

/**
 * Port des liens à usage unique (invitation et réinitialisation de mot de passe) : seule l'empreinte du jeton est
 * conservée.
 */
export interface InvitationRepository {
  save(record: UserInvitationRecord): Promise<void>;
  findByHash(tokenHash: string): Promise<UserInvitationRecord | null>;
  /** Marque l'invitation comme utilisée **atomiquement** si, et seulement si, elle est encore valide. */
  consume(tokenHash: string, now: Date): Promise<boolean>;
  /** Révoque toutes les invitations non utilisées de l'utilisateur (renvoi d'invitation). */
  revokeAllOfUser(userId: string, now: Date): Promise<void>;
  /** Nombre de liens d'un usage donné émis pour l'utilisateur depuis `since` (plafond de demandes). */
  countCreatedSince(userId: string, purpose: string, since: Date): Promise<number>;
}

/** Port de l'historique des mots de passe (hachages seulement) pour refuser la réutilisation des derniers. */
export interface PasswordHistoryRepository {
  /** Les `limit` derniers hachages (les plus récents d'abord). */
  recentHashes(userId: string, limit: number): Promise<string[]>;
  add(entry: { id: string; userId: string; passwordHash: string; createdAt: Date }): Promise<void>;
}

/** Plages réseau et appareils déjà vus pour un compte, base du calcul du risque d'une nouvelle session. */
export interface KnownFingerprints {
  networks: ReadonlySet<string>;
  devices: ReadonlySet<string>;
}

/** Port de persistance des sessions : ouverture, lecture, révocation en masse et empreintes connues. */
export interface SessionRepository {
  save(session: UserSession): Promise<void>;
  findById(id: string): Promise<UserSession | null>;
  /** Plages réseau et appareils déjà utilisés par ce compte (sessions passées). */
  knownFingerprints(userId: string): Promise<KnownFingerprints>;
  /** Révoque les sessions actives de l'utilisateur, sauf `keepSessionId`. Retourne les identifiants révoqués. */
  revokeAllOfUserExcept(userId: string, keepSessionId: string | null, now: Date, reason: string): Promise<string[]>;
  /** Sessions actuellement actives (ni déconnectées, ni révoquées, ni expirées) de l'utilisateur, récentes d'abord. */
  listActiveOf(userId: string, now: Date): Promise<UserSession[]>;
}

/** Port des jetons de rafraîchissement : consommation atomique (rotation), révocation par famille ou par session. */
export interface RefreshTokenRepository {
  save(record: RefreshTokenRecord): Promise<void>;
  findByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  /**
   * Marque le jeton comme utilisé **atomiquement** si, et seulement si, il est encore valide
   * (non utilisé, non révoqué, non expiré). Retourne `false` si un autre appel l'a consommé entre-temps.
   */
  consume(tokenHash: string, now: Date): Promise<boolean>;
  revokeFamily(familyId: string, now: Date): Promise<void>;
  revokeBySession(sessionId: string, now: Date): Promise<void>;
}

export enum LoginOutcome {
  Success = 'SUCCESS',
  BadCredentials = 'BAD_CREDENTIALS',
  Locked = 'LOCKED',
  MfaFailed = 'MFA_FAILED',
  RateLimited = 'RATE_LIMITED',
}

/**
 * Port du journal des tentatives de connexion (y compris pour des adresses inconnues) et du comptage des échecs
 * récents.
 */
export interface LoginAttemptRepository {
  record(attempt: { id: string; emailKey: string; userId: string | null; ipAddress: string; outcome: LoginOutcome; createdAt: Date }): Promise<void>;
  /** Échecs (hors succès) pour ce compte depuis `since`. */
  countRecentFailures(emailKey: string, since: Date): Promise<number>;
}

export const USER_REPOSITORY = Symbol('UserRepository');
export const PASSWORD_HISTORY_REPOSITORY = Symbol('PasswordHistoryRepository');
export const SESSION_REPOSITORY = Symbol('SessionRepository');
export const REFRESH_TOKEN_REPOSITORY = Symbol('RefreshTokenRepository');
export const LOGIN_ATTEMPT_REPOSITORY = Symbol('LoginAttemptRepository');
export const INVITATION_REPOSITORY = Symbol('InvitationRepository');
export const GRANT_READER = Symbol('GrantReader');
