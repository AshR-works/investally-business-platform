import { AuditRecord } from '../../src/modules/audit';
import {
  KnownFingerprints, LoginAttemptRepository, LoginOutcome, PasswordHistoryRepository, RefreshTokenRepository,
  SessionRepository, UserRepository,
} from '../../src/modules/iam/domain/auth-repositories';
import { deviceFingerprint, networkRangeOf } from '../../src/modules/iam/domain/network';
import { RefreshTokenRecord } from '../../src/modules/iam/domain/refresh-token';
import { RoleCode } from '../../src/modules/iam/domain/roles';
import { User } from '../../src/modules/iam/domain/user';
import { UserSession } from '../../src/modules/iam/domain/user-session';
import { RecoveryCodeRepository } from '../../src/modules/iam/application/mfa-ports';
import { AccessTokenClaims, AccessTokenService, PasswordHasher, RefreshTokenFactory } from '../../src/modules/iam/application/ports';
import { ActorContext, Clock, IdGenerator } from '../../src/shared-kernel';

export class InMemoryUsers implements UserRepository {
  readonly items = new Map<string, User>();
  readonly roles = new Map<string, RoleCode[]>();
  async findById(id: string) { return this.items.get(id) ?? null; }
  async lockByEmailKey(key: string) { return [...this.items.values()].find((u) => u.email.key === key) ?? null; }
  async lockById(id: string) { return this.items.get(id) ?? null; }
  async emailExists(key: string) { return (await this.lockByEmailKey(key)) !== null; }
  async save(user: User) { this.items.set(user.id, user); }
  async roleCodesOf(id: string) { return this.roles.get(id) ?? []; }
  async assignRoles(id: string, roles: readonly RoleCode[]) { this.roles.set(id, [...roles]); }
}

export class InMemoryHistory implements PasswordHistoryRepository {
  readonly items: { userId: string; passwordHash: string; createdAt: Date }[] = [];
  async recentHashes(userId: string, limit: number) {
    return this.items.filter((i) => i.userId === userId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit).map((i) => i.passwordHash);
  }
  async add(entry: { userId: string; passwordHash: string; createdAt: Date }) { this.items.push(entry); }
}

export class InMemorySessions implements SessionRepository {
  readonly items = new Map<string, UserSession>();
  async save(session: UserSession) { this.items.set(session.id, session); }
  async findById(id: string) { return this.items.get(id) ?? null; }
  async knownFingerprints(userId: string): Promise<KnownFingerprints> {
    const mine = [...this.items.values()].filter((s) => s.userId === userId);
    return { networks: new Set(mine.map((s) => networkRangeOf(s.ipAddress))), devices: new Set(mine.map((s) => deviceFingerprint(s.device))) };
  }
  async revokeAllOfUserExcept(userId: string, keep: string | null, now: Date, reason: string) {
    const revoked: string[] = [];
    for (const s of this.items.values()) {
      if (s.userId === userId && s.id !== keep && s.isActive(now)) { s.revoke(now, reason); revoked.push(s.id); }
    }
    return revoked;
  }
}

export class InMemoryRefreshTokens implements RefreshTokenRepository {
  readonly items = new Map<string, RefreshTokenRecord>();
  async save(record: RefreshTokenRecord) { this.items.set(record.tokenHash, { ...record }); }
  async findByHash(hash: string) { const r = this.items.get(hash); return r ? { ...r } : null; }
  async consume(hash: string, now: Date) {
    const r = this.items.get(hash);
    if (!r || r.usedAt || r.revokedAt || r.expiresAt.getTime() <= now.getTime()) return false;
    r.usedAt = now;
    return true;
  }
  async revokeFamily(familyId: string, now: Date) { for (const r of this.items.values()) if (r.familyId === familyId && !r.revokedAt) r.revokedAt = now; }
  async revokeBySession(sessionId: string, now: Date) { for (const r of this.items.values()) if (r.sessionId === sessionId && !r.revokedAt) r.revokedAt = now; }
}

export class InMemoryAttempts implements LoginAttemptRepository {
  readonly items: { emailKey: string; userId: string | null; ipAddress: string; outcome: LoginOutcome; createdAt: Date }[] = [];
  async record(a: { emailKey: string; userId: string | null; ipAddress: string; outcome: LoginOutcome; createdAt: Date }) { this.items.push(a); }
  async countRecentFailures(emailKey: string, since: Date) {
    return this.items.filter((a) => a.emailKey === emailKey && a.outcome !== LoginOutcome.Success && a.createdAt >= since).length;
  }
}

export class InMemoryRecoveryCodes implements RecoveryCodeRepository {
  readonly items: { id: string; userId: string; hash: string; usedAt: Date | null }[] = [];
  async replaceAll(userId: string, hashes: { id: string; hash: string }[]) {
    for (let i = this.items.length - 1; i >= 0; i--) if (this.items[i].userId === userId) this.items.splice(i, 1);
    for (const h of hashes) this.items.push({ id: h.id, userId, hash: h.hash, usedAt: null });
  }
  async deleteAll(userId: string) { await this.replaceAll(userId, []); }
  async listUnused(userId: string) { return this.items.filter((i) => i.userId === userId && !i.usedAt).map((i) => ({ id: i.id, hash: i.hash })); }
  async consume(id: string, now: Date) {
    const item = this.items.find((i) => i.id === id);
    if (!item || item.usedAt) return false;
    item.usedAt = now;
    return true;
  }
  async countUnused(userId: string) { return (await this.listUnused(userId)).length; }
}

/** Hachage factice déterministe ; compte les appels à verifyDummy (anti-énumération). */
export class FakeHasher implements PasswordHasher {
  dummyCalls = 0;
  async hash(plain: string) { return `hash(${plain})`; }
  async verify(hash: string, plain: string) { return hash === `hash(${plain})`; }
  async verifyDummy() { this.dummyCalls += 1; }
}

export class FakeAccessTokens implements AccessTokenService {
  async issue(claims: AccessTokenClaims, ttlMs: number, now: Date) {
    const expiresAt = new Date(now.getTime() + ttlMs);
    return { token: `at|${claims.sub}|${claims.sid}|${claims.amr.join(',')}|${expiresAt.getTime()}`, expiresAt };
  }
  async verify(token: string, now: Date) {
    const [kind, sub, sid, amr, exp] = token.split('|');
    if (kind !== 'at' || Number(exp) <= now.getTime()) return null;
    return { sub, sid, amr: amr.split(',') };
  }
}

/** Empreinte factice OPAQUE (hexadécimal) : ne contient pas le jeton en clair, comme un vrai SHA-256. */
export const fakeHash = (token: string) => `sha:${Buffer.from(token).toString('hex')}`;

export class FakeRefreshFactory implements RefreshTokenFactory {
  private counter = 0;
  generate() { this.counter += 1; return { token: `rt-${this.counter}`, hash: this.hashOf(`rt-${this.counter}`) }; }
  hashOf(token: string) { return fakeHash(token); }
}

export class MutableClock implements Clock {
  constructor(public current = new Date('2026-10-20T08:00:00Z')) {}
  now() { return this.current; }
  advance(ms: number) { this.current = new Date(this.current.getTime() + ms); }
}

export class SequentialIds implements IdGenerator {
  private n = 0;
  next() { this.n += 1; return `id-${String(this.n).padStart(4, '0')}`; }
}

export const actor = (over: Partial<ActorContext> = {}): ActorContext => ({
  userId: null, sessionId: null, ipAddress: '10.0.0.1', device: 'Mozilla/5.0 test', ...over,
});

export type RecordedAudit = AuditRecord;
