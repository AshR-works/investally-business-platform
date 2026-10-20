import { RiskLevel } from './session-risk';
import { SessionPolicy } from './session-policy';

export interface UserSessionProps {
  id: string;
  userId: string;
  ipAddress: string;
  device: string;
  riskLevel: RiskLevel;
  mfaVerified: boolean;
  loggedInAt: Date;
  lastSeenAt: Date;
  /** Expiration sur inactivité (glissante, bornée par l'expiration absolue). */
  expiresAt: Date;
  absoluteExpiresAt: Date;
  loggedOutAt: Date | null;
  revokedAt: Date | null;
  revokedReason: string | null;
}

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

  markRisk(level: RiskLevel): void {
    this.props.riskLevel = level;
  }

  get id(): string { return this.props.id; }
  get userId(): string { return this.props.userId; }
  get ipAddress(): string { return this.props.ipAddress; }
  get device(): string { return this.props.device; }
  get riskLevel(): RiskLevel { return this.props.riskLevel; }
  get mfaVerified(): boolean { return this.props.mfaVerified; }
  get loggedInAt(): Date { return this.props.loggedInAt; }
  get lastSeenAt(): Date { return this.props.lastSeenAt; }
  get expiresAt(): Date { return this.props.expiresAt; }
  get absoluteExpiresAt(): Date { return this.props.absoluteExpiresAt; }
  get loggedOutAt(): Date | null { return this.props.loggedOutAt; }
  get revokedAt(): Date | null { return this.props.revokedAt; }
  get revokedReason(): string | null { return this.props.revokedReason; }
}
