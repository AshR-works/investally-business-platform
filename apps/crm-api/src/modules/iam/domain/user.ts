import { AggregateRoot } from '../../../shared-kernel';
import { Email } from './email';

export enum UserStatus {
  Pending = 'PENDING',
  Active = 'ACTIVE',
  Locked = 'LOCKED',
  Disabled = 'DISABLED',
}

/** Échecs consécutifs tolérés avant le premier verrouillage. */
export const LOCKOUT_THRESHOLD = 5;
/** Durées de verrouillage successives (minutes) ; la dernière se répète. Jamais définitif (SECURITY.md §2.4). */
export const LOCKOUT_STEPS_MINUTES: readonly number[] = [1, 5, 15, 60];

export interface UserProps {
  id: string;
  email: Email;
  displayName: string;
  status: UserStatus;
  passwordHash: string | null;
  passwordChangedAt: Date | null;
  failedLoginCount: number;
  lockedUntil: Date | null;
  mfaEnabled: boolean;
  managerId: string | null;
  lastLoginAt: Date | null;
  version: number;
  createdAt: Date;
}

export class User extends AggregateRoot {
  private constructor(private props: UserProps) {
    super();
  }

  /** Crée un compte actif avec un mot de passe déjà haché (le hachage est fait par l'Application). */
  static create(input: { id: string; email: Email; displayName: string; passwordHash: string; managerId?: string | null; now: Date }): User {
    return new User({
      id: input.id,
      email: input.email,
      displayName: input.displayName.trim(),
      status: UserStatus.Active,
      passwordHash: input.passwordHash,
      passwordChangedAt: input.now,
      failedLoginCount: 0,
      lockedUntil: null,
      mfaEnabled: false,
      managerId: input.managerId ?? null,
      lastLoginAt: null,
      version: 1,
      createdAt: input.now,
    });
  }

  static rehydrate(props: UserProps): User {
    return new User(props);
  }

  /** Seul un compte actif peut s'authentifier ; un compte en attente ou désactivé est refusé. */
  canAuthenticate(): boolean {
    return this.props.status === UserStatus.Active && this.props.passwordHash !== null;
  }

  isLocked(now: Date): boolean {
    return this.props.lockedUntil !== null && this.props.lockedUntil.getTime() > now.getTime();
  }

  /** Enregistre un échec : à partir du 5e échec consécutif, verrouillage progressif (1, 5, 15, 60, 60… min). */
  registerFailedLogin(now: Date): void {
    this.props.failedLoginCount += 1;
    const over = this.props.failedLoginCount - LOCKOUT_THRESHOLD;
    if (over >= 0) {
      const minutes = LOCKOUT_STEPS_MINUTES[Math.min(over, LOCKOUT_STEPS_MINUTES.length - 1)];
      this.props.lockedUntil = new Date(now.getTime() + minutes * 60_000);
    }
  }

  registerSuccessfulLogin(now: Date): void {
    this.props.failedLoginCount = 0;
    this.props.lockedUntil = null;
    this.props.lastLoginAt = now;
  }

  changePassword(passwordHash: string, now: Date): void {
    this.props.passwordHash = passwordHash;
    this.props.passwordChangedAt = now;
    this.props.failedLoginCount = 0;
    this.props.lockedUntil = null;
  }

  disable(): void {
    this.props.status = UserStatus.Disabled;
  }

  get id(): string { return this.props.id; }
  get email(): Email { return this.props.email; }
  get displayName(): string { return this.props.displayName; }
  get status(): UserStatus { return this.props.status; }
  get passwordHash(): string | null { return this.props.passwordHash; }
  get passwordChangedAt(): Date | null { return this.props.passwordChangedAt; }
  get failedLoginCount(): number { return this.props.failedLoginCount; }
  get lockedUntil(): Date | null { return this.props.lockedUntil; }
  get mfaEnabled(): boolean { return this.props.mfaEnabled; }
  get managerId(): string | null { return this.props.managerId; }
  get lastLoginAt(): Date | null { return this.props.lastLoginAt; }
  get version(): number { return this.props.version; }
  get createdAt(): Date { return this.props.createdAt; }
}
