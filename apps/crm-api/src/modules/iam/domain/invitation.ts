/** Durée de validité d'une invitation (décision : 48 h, SECURITY.md §2.6). */
export const INVITATION_TTL_MS = 48 * 60 * 60 * 1000;

export interface UserInvitationRecord {
  id: string;
  userId: string;
  /** SHA-256 du jeton ; le jeton lui-même n'est jamais stocké. */
  tokenHash: string;
  createdBy: string | null;
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
}

export type InvitationDecision = 'VALID' | 'EXPIRED' | 'USED' | 'REVOKED';

/**
 * État d'une invitation présentée. À l'extérieur, TOUS les états non valides produisent le même refus générique
 * (on ne révèle pas si un lien a existé, a été utilisé ou a expiré) ; la distinction sert aux journaux et aux tests.
 */
export function evaluateInvitation(record: UserInvitationRecord, now: Date): InvitationDecision {
  if (record.revokedAt !== null) return 'REVOKED';
  if (record.usedAt !== null) return 'USED';
  if (now.getTime() >= record.expiresAt.getTime()) return 'EXPIRED';
  return 'VALID';
}
