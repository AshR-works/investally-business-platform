/** Ports sortants de l'authentification, implémentés par l'Infrastructure. */

export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(hash: string, plain: string): Promise<boolean>;
  /**
   * Effectue un calcul de même coût qu'une vraie vérification, sans compte réel.
   * Utilisé quand l'e-mail est inconnu ou le compte verrouillé : le temps de réponse ne révèle pas l'existence du compte.
   */
  verifyDummy(plain: string): Promise<void>;
}

export interface AccessTokenClaims {
  /** Identifiant de l'utilisateur. */
  sub: string;
  /** Identifiant de la session. */
  sid: string;
  /** Méthodes d'authentification réussies : `pwd`, puis `otp` (MFA, S3.2). */
  amr: string[];
}

export interface AccessTokenService {
  issue(claims: AccessTokenClaims, ttlMs: number, now: Date): Promise<{ token: string; expiresAt: Date }>;
  /** Retourne les claims si le jeton est authentique et non expiré, `null` sinon. Ne lève jamais. */
  verify(token: string, now: Date): Promise<AccessTokenClaims | null>;
}

export interface RefreshTokenFactory {
  /** Jeton opaque aléatoire (256 bits) et son empreinte SHA-256 ; seule l'empreinte est stockée. */
  generate(): { token: string; hash: string };
  hashOf(token: string): string;
}

export const PASSWORD_HASHER = Symbol('PasswordHasher');
export const ACCESS_TOKEN_SERVICE = Symbol('AccessTokenService');
export const REFRESH_TOKEN_FACTORY = Symbol('RefreshTokenFactory');
