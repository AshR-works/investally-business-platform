/** Ports sortants de l'authentification, implémentés par l'Infrastructure. */

/**
 * Port : hachage et vérification des mots de passe (argon2id), avec une vérification factice pour égaliser le temps
 * des comptes inconnus.
 */
export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(hash: string, plain: string): Promise<boolean>;
  /**
   * Effectue un calcul de même coût qu'une vraie vérification, sans compte réel.
   * Utilisé quand l'e-mail est inconnu ou le compte verrouillé : le temps de réponse ne révèle pas l'existence du compte.
   */
  verifyDummy(plain: string): Promise<void>;
}

/**
 * Revendications d'un jeton d'accès : identité, session et méthodes d'authentification (`pwd`, `otp`) ; aucune
 * permission.
 */
export interface AccessTokenClaims {
  /** Identifiant de l'utilisateur. */
  sub: string;
  /** Identifiant de la session. */
  sid: string;
  /** Méthodes d'authentification réussies : `pwd`, puis `otp` (MFA, S3.2). */
  amr: string[];
}

/** Port : émission et vérification des jetons d'accès signés. */
export interface AccessTokenService {
  /** Signe un jeton d'accès valable `ttlMs` millisecondes. */
  issue(claims: AccessTokenClaims, ttlMs: number, now: Date): Promise<{ token: string; expiresAt: Date }>;
  /** Retourne les claims si le jeton est authentique et non expiré, `null` sinon. Ne lève jamais. */
  verify(token: string, now: Date): Promise<AccessTokenClaims | null>;
}

/** Port : fabrique de jetons opaques et de leurs empreintes (rafraîchissement, invitation, réinitialisation). */
export interface RefreshTokenFactory {
  /** Jeton opaque aléatoire (256 bits) et son empreinte SHA-256 ; seule l'empreinte est stockée. */
  generate(): { token: string; hash: string };
  hashOf(token: string): string;
}

/** Jeton opaque aléatoire et son empreinte : même forme que le jeton de rafraîchissement, usage différent (invitations). */
export type OpaqueTokenFactory = RefreshTokenFactory;

export const PASSWORD_HASHER = Symbol('PasswordHasher');
export const INVITATION_TOKEN_FACTORY = Symbol('InvitationTokenFactory');
export const ACCESS_TOKEN_SERVICE = Symbol('AccessTokenService');
export const REFRESH_TOKEN_FACTORY = Symbol('RefreshTokenFactory');
