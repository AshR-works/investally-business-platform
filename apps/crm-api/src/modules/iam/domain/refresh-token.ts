/** Fenêtre pendant laquelle une seconde présentation du même jeton n'est PAS traitée comme un vol
 *  (deux onglets qui se rafraîchissent en même temps). Au-delà : réutilisation = vol probable. */
export const REUSE_GRACE_MS = 10_000;

export interface RefreshTokenRecord {
  id: string;
  sessionId: string;
  /** Famille de rotation : tous les jetons issus d'une même connexion. */
  familyId: string;
  /** SHA-256 du jeton opaque ; le jeton lui-même n'est jamais stocké. */
  tokenHash: string;
  issuedAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
}

export type RefreshDecision =
  /** Jeton valide : on peut effectuer la rotation. */
  | 'ROTATE'
  /** Jeton déjà consommé hors fenêtre de tolérance : vol probable → révoquer la famille et la session. */
  | 'REUSED'
  /** Jeton déjà consommé dans la fenêtre de tolérance : refus simple, sans révocation. */
  | 'CONCURRENT'
  | 'EXPIRED'
  | 'REVOKED';

/**
 * Décide du sort d'un jeton de rafraîchissement présenté. Pure : l'atomicité de la consommation
 * (deux requêtes simultanées) est garantie par la base (`UPDATE ... WHERE used_at IS NULL`).
 */
export function evaluateRefresh(record: RefreshTokenRecord, now: Date): RefreshDecision {
  if (record.revokedAt !== null) return 'REVOKED';
  if (record.usedAt !== null) {
    return now.getTime() - record.usedAt.getTime() <= REUSE_GRACE_MS ? 'CONCURRENT' : 'REUSED';
  }
  if (now.getTime() >= record.expiresAt.getTime()) return 'EXPIRED';
  return 'ROTATE';
}
