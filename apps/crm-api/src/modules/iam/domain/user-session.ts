import { RiskLevel } from './session-risk';
import { SessionPolicy } from './session-policy';

/** Fraîcheur maximale d'une vérification MFA pour une action sensible (step-up, SECURITY.md §2.3). */
export const STEP_UP_MAX_AGE_MS = 10 * 60_000;

/** État d'une session : utilisateur, réseau, appareil, risque, MFA vérifié (et quand), activité et échéances. */
export interface UserSessionProps {
  id: string;
  userId: string;
  ipAddress: string;
  device: string;
  riskLevel: RiskLevel;
  mfaVerified: boolean;
  /** Dernière vérification MFA réussie (connexion ou step-up). */
  mfaVerifiedAt: Date | null;
  loggedInAt: Date;
  lastSeenAt: Date;
  /** Expiration sur inactivité (glissante, bornée par l'expiration absolue). */
  expiresAt: Date;
  absoluteExpiresAt: Date;
  loggedOutAt: Date | null;
  revokedAt: Date | null;
  revokedReason: string | null;
}

/**
 * Session de connexion : ouverture, activité, vérification du MFA, révocation et expiration (inactivité ou durée
 * absolue).
 */
export class UserSession {
  private constructor(private props: UserSessionProps) {}

  static open(input: {
    id: string;
    userId: string;
    ipAddress: string;
    device: string;
    riskLevel: RiskLevel;
    policy: SessionPolicy;
    now: Date;
  }): UserSession {
    const absoluteExpiresAt = new Date(input.now.getTime() + input.policy.absoluteMs);
    const idleExpiry = new Date(input.now.getTime() + input.policy.idleMs);
    return new UserSession({
      id: input.id,
      userId: input.userId,
      ipAddress: input.ipAddress,
      device: input.device,
      riskLevel: input.riskLevel,
      mfaVerified: false,
      mfaVerifiedAt: null,
      loggedInAt: input.now,
      lastSeenAt: input.now,
      expiresAt: idleExpiry < absoluteExpiresAt ? idleExpiry : absoluteExpiresAt,
      absoluteExpiresAt,
      loggedOutAt: null,
      revokedAt: null,
      revokedReason: null,
    });
  }

  static rehydrate(props: UserSessionProps): UserSession {
    return new UserSession(props);
  }

  /** Active = ni déconnectée, ni révoquée, ni expirée (inactivité ou durée absolue). */
  isActive(now: Date): boolean {
    return (
      this.props.loggedOutAt === null &&
      this.props.revokedAt === null &&
      now.getTime() < this.props.expiresAt.getTime() &&
      now.getTime() < this.props.absoluteExpiresAt.getTime()
    );
  }

  /** Prolonge l'inactivité sans jamais dépasser l'expiration absolue. */
  touch(now: Date, policy: SessionPolicy): void {
    const idleExpiry = now.getTime() + policy.idleMs;
    this.props.lastSeenAt = now;
    this.props.expiresAt = new Date(Math.min(idleExpiry, this.props.absoluteExpiresAt.getTime()));
  }

  /** Déconnexion volontaire. */
  end(now: Date): void {
    if (this.props.loggedOutAt === null) this.props.loggedOutAt = now;
  }

  /** Révocation (sécurité, administrateur). Idempotente : le premier motif est conservé. */
  revoke(now: Date, reason: string): void {
    if (this.props.revokedAt === null) {
      this.props.revokedAt = now;
      this.props.revokedReason = reason.slice(0, 200);
    }
  }

  /** Second facteur prouvé (connexion, ou step-up pour une action sensible). */
  markMfaVerified(now: Date): void {
    this.props.mfaVerified = true;
    this.props.mfaVerifiedAt = now;
  }

  /** `true` si le MFA a été vérifié depuis moins de `maxAgeMs` (jamais si l'horodatage est dans le futur). */
  hasFreshMfa(now: Date, maxAgeMs: number = STEP_UP_MAX_AGE_MS): boolean {
    const at = this.props.mfaVerifiedAt;
    if (!this.props.mfaVerified || at === null) return false;
    const age = now.getTime() - at.getTime();
    return age >= 0 && age <= maxAgeMs;
  }

  /** Enregistre le niveau de risque calculé à l'ouverture de la session. */
  markRisk(level: RiskLevel): void {
    this.props.riskLevel = level;
  }

  get id(): string { return this.props.id; }
  get userId(): string { return this.props.userId; }
  get ipAddress(): string { return this.props.ipAddress; }
  get device(): string { return this.props.device; }
  get riskLevel(): RiskLevel { return this.props.riskLevel; }
  get mfaVerified(): boolean { return this.props.mfaVerified; }
  get mfaVerifiedAt(): Date | null { return this.props.mfaVerifiedAt; }
  get loggedInAt(): Date { return this.props.loggedInAt; }
  get lastSeenAt(): Date { return this.props.lastSeenAt; }
  get expiresAt(): Date { return this.props.expiresAt; }
  get absoluteExpiresAt(): Date { return this.props.absoluteExpiresAt; }
  get loggedOutAt(): Date | null { return this.props.loggedOutAt; }
  get revokedAt(): Date | null { return this.props.revokedAt; }
  get revokedReason(): string | null { return this.props.revokedReason; }
}
