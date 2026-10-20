import { RefreshTokenRecord } from './refresh-token';
import { RoleCode } from './roles';
import { User } from './user';
import { UserSession } from './user-session';

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
}

export interface PasswordHistoryRepository {
  /** Les `limit` derniers hachages (les plus récents d'abord). */
  recentHashes(userId: string, limit: number): Promise<string[]>;
  add(entry: { id: string; userId: string; passwordHash: string; createdAt: Date }): Promise<void>;
}

export interface KnownFingerprints {
  networks: ReadonlySet<string>;
  devices: ReadonlySet<string>;
}

export interface SessionRepository {
  save(session: UserSession): Promise<void>;
  findById(id: string): Promise<UserSession | null>;
  /** Plages réseau et appareils déjà utilisés par ce compte (sessions passées). */
  knownFingerprints(userId: string): Promise<KnownFingerprints>;
  /** Révoque les sessions actives de l'utilisateur, sauf `keepSessionId`. Retourne les identifiants révoqués. */
  revokeAllOfUserExcept(userId: string, keepSessionId: string | null, now: Date, reason: string): Promise<string[]>;
}

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
