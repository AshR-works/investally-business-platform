/** Durée de validité d'une invitation (décision : 48 h, SECURITY.md §2.6). */
export const INVITATION_TTL_MS = 48 * 60 * 60 * 1000;

/** À quoi sert un lien : un lien d'invitation ne peut jamais réinitialiser un mot de passe, et inversement. */
export const InvitationPurpose = { Invitation: 'INVITATION', PasswordReset: 'PASSWORD_RESET' } as const;
export type InvitationPurposeName = (typeof InvitationPurpose)[keyof typeof InvitationPurpose];

/** Lien de réinitialisation demandé par l'utilisateur lui-même : court, car la boîte e-mail devient la clé du compte. */
export const SELF_SERVICE_RESET_TTL_MS = 60 * 60 * 1000;
/** Lien de réinitialisation émis par un administrateur : même durée qu'une invitation. */
export const ADMIN_RESET_TTL_MS = INVITATION_TTL_MS;
/** Au plus 3 liens demandés par heure pour un même compte : empêche d'inonder une boîte e-mail ou de révoquer sans cesse les liens. */
export const SELF_SERVICE_RESET_MAX_PER_HOUR = 3;

/**
 * Lien à usage unique : empreinte du jeton, usage (invitation ou réinitialisation), émetteur, échéance, date
 * d'utilisation ou de révocation.
 */
export interface UserInvitationRecord {
  id: string;
  userId: string;
  /** SHA-256 du jeton ; le jeton lui-même n'est jamais stocké. */
  tokenHash: string;
  purpose: InvitationPurposeName;
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
