import { RoleCode } from './roles';
import { PRIVILEGED_POLICY, STANDARD_POLICY, sessionPolicyFor } from './session-policy';
import { RiskLevel, assessRisk } from './session-risk';
import { deviceFingerprint, networkRangeOf } from './network';
import { REUSE_GRACE_MS, RefreshTokenRecord, evaluateRefresh } from './refresh-token';
import { UserSession } from './user-session';

const t0 = new Date('2026-10-20T08:00:00Z');
const plus = (ms: number) => new Date(t0.getTime() + ms);
const HOUR = 3_600_000;

describe('sessionPolicyFor', () => {
  it('applique 7 jours aux rôles standards et 12 h aux rôles privilégiés', () => {
    expect(sessionPolicyFor([RoleCode.AccountManager])).toBe(STANDARD_POLICY);
    expect(STANDARD_POLICY.absoluteMs).toBe(7 * 24 * HOUR);
    for (const role of [RoleCode.SuperAdmin, RoleCode.Direction, RoleCode.Finance]) {
      expect(sessionPolicyFor([role])).toBe(PRIVILEGED_POLICY);
    }
    expect(PRIVILEGED_POLICY.absoluteMs).toBe(12 * HOUR);
  });

  it('retient la politique la plus stricte quand les rôles sont cumulés', () => {
    expect(sessionPolicyFor([RoleCode.AccountManager, RoleCode.Direction])).toBe(PRIVILEGED_POLICY);
  });

  it('confirme les durées décidées : jeton 15 min, inactivité 8 h', () => {
    expect(STANDARD_POLICY.accessTokenMs).toBe(15 * 60_000);
    expect(STANDARD_POLICY.idleMs).toBe(8 * HOUR);
  });
});

describe('UserSession', () => {
  const open = (policy = STANDARD_POLICY) =>
    UserSession.open({ id: 's1', userId: 'u1', ipAddress: '10.0.0.1', device: 'jest', riskLevel: RiskLevel.Low, policy, now: t0 });

  it("s'ouvre active, MFA non vérifié, expirant sur inactivité à 8 h", () => {
    const session = open();
    expect(session.isActive(t0)).toBe(true);
    expect(session.mfaVerified).toBe(false);
    expect(session.expiresAt).toEqual(plus(8 * HOUR));
  });

  it("expire sur inactivité", () => {
    const session = open();
    expect(session.isActive(plus(8 * HOUR - 1))).toBe(true);
    expect(session.isActive(plus(8 * HOUR))).toBe(false);
  });

  it("pour un rôle privilégié, l'expiration absolue (12 h) plafonne l'inactivité", () => {
    const session = open(PRIVILEGED_POLICY);
    session.touch(plus(11 * HOUR), PRIVILEGED_POLICY);
    expect(session.expiresAt).toEqual(plus(12 * HOUR));
    expect(session.isActive(plus(12 * HOUR))).toBe(false);
  });

  it('touch prolonge l\'inactivité mais jamais au-delà de la durée absolue', () => {
    const session = open();
    session.touch(plus(7 * 24 * HOUR - HOUR), STANDARD_POLICY);
    expect(session.expiresAt).toEqual(plus(7 * 24 * HOUR));
  });

  it('une session déconnectée ou révoquée est inactive', () => {
    const a = open();
    a.end(plus(HOUR));
    expect(a.isActive(plus(HOUR))).toBe(false);
    const b = open();
    b.revoke(plus(HOUR), 'vol de jeton');
    expect(b.isActive(plus(HOUR))).toBe(false);
  });

  it('la révocation est idempotente et conserve le premier motif', () => {
    const session = open();
    session.revoke(plus(1), 'premier');
    session.revoke(plus(2), 'second');
    expect(session.revokedReason).toBe('premier');
    expect(session.revokedAt).toEqual(plus(1));
  });
});

describe('evaluateRefresh (rotation et détection de réutilisation)', () => {
  const record = (over: Partial<RefreshTokenRecord> = {}): RefreshTokenRecord => ({
    id: 'r1', sessionId: 's1', familyId: 'f1', tokenHash: 'h', issuedAt: t0, expiresAt: plus(8 * HOUR),
    usedAt: null, revokedAt: null, ...over,
  });

  it('autorise la rotation d\'un jeton valide', () => {
    expect(evaluateRefresh(record(), plus(HOUR))).toBe('ROTATE');
  });

  it('refuse un jeton expiré', () => {
    expect(evaluateRefresh(record(), plus(8 * HOUR))).toBe('EXPIRED');
  });

  it('refuse un jeton révoqué, même non utilisé', () => {
    expect(evaluateRefresh(record({ revokedAt: plus(1) }), plus(2))).toBe('REVOKED');
  });

  it('traite une seconde présentation dans la fenêtre de tolérance comme une requête concurrente (sans révoquer)', () => {
    expect(evaluateRefresh(record({ usedAt: plus(1000) }), plus(1000 + REUSE_GRACE_MS))).toBe('CONCURRENT');
  });

  it('détecte la réutilisation hors fenêtre : vol probable', () => {
    expect(evaluateRefresh(record({ usedAt: plus(1000) }), plus(1000 + REUSE_GRACE_MS + 1))).toBe('REUSED');
  });

  it('un jeton utilisé puis expiré reste une réutilisation (la plus grave)', () => {
    expect(evaluateRefresh(record({ usedAt: plus(1000) }), plus(9 * HOUR))).toBe('REUSED');
  });
});

describe('assessRisk', () => {
  const base = { newDevice: false, newNetwork: false, recentFailures: 0, privilegedRole: false };

  it.each([
    [{}, RiskLevel.Low],
    [{ newDevice: true }, RiskLevel.Low],
    [{ newDevice: true, newNetwork: true }, RiskLevel.Medium],
    [{ privilegedRole: true, newDevice: true }, RiskLevel.Medium],
    [{ newDevice: true, newNetwork: true, privilegedRole: true }, RiskLevel.High],
    [{ newDevice: true, newNetwork: true, privilegedRole: true, recentFailures: 1 }, RiskLevel.Critical],
    [{ recentFailures: 1 }, RiskLevel.Low],
    [{ recentFailures: 3 }, RiskLevel.Medium],
    [{ recentFailures: 3, newDevice: true }, RiskLevel.High],
  ])('score %j → %s', (signals, expected) => {
    expect(assessRisk({ ...base, ...signals })).toBe(expected);
  });

  it('la réutilisation de jeton est critique quels que soient les autres signaux', () => {
    expect(assessRisk({ ...base, tokenReuse: true })).toBe(RiskLevel.Critical);
  });
});

describe('network', () => {
  it('regroupe IPv4 par /24 et IPv6 par /64', () => {
    expect(networkRangeOf('192.168.1.45')).toBe('192.168.1');
    expect(networkRangeOf('2001:DB8:AAAA:1:2:3:4:5')).toBe('2001:db8:aaaa:1');
    expect(networkRangeOf('::ffff:10.1.2.3')).toBe('10.1.2');
    expect(networkRangeOf('')).toBe('unknown');
  });

  it("normalise l'empreinte d'appareil", () => {
    expect(deviceFingerprint('  Mozilla/5.0 (X11) ')).toBe('mozilla/5.0 (x11)');
  });
});
