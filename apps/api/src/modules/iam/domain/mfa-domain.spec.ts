import { DomainError } from '../../../shared-kernel';
import { Email } from './email';
import { PRIVILEGED_POLICY } from './session-policy';
import { RiskLevel } from './session-risk';
import { STEP_UP_MAX_AGE_MS, UserSession } from './user-session';
import { User } from './user';

const t0 = new Date('2026-10-20T10:00:00Z');
const plus = (ms: number) => new Date(t0.getTime() + ms);

const newUser = () => User.create({ id: 'u1', email: Email.of('m@investally.test'), displayName: 'Marie', passwordHash: 'h', now: t0 });
const newSession = () => UserSession.open({ id: 's1', userId: 'u1', ipAddress: '10.0.0.1', device: 'x', riskLevel: RiskLevel.Low, policy: PRIVILEGED_POLICY, now: t0 });

describe('User — MFA (A4)', () => {
  it("l'enrôlement est d'abord en attente : secret présent, MFA inactif", () => {
    const user = newUser();
    user.beginMfaEnrollment('v1.chiffre');
    expect(user.mfaEnabled).toBe(false);
    expect(user.mfaSecretEnc).toBe('v1.chiffre');
    expect(user.mfaLastUsedStep).toBeNull();
  });

  it('recommencer un enrôlement non confirmé remplace le secret en attente', () => {
    const user = newUser();
    user.beginMfaEnrollment('premier');
    user.beginMfaEnrollment('second');
    expect(user.mfaSecretEnc).toBe('second');
  });

  it("la confirmation active le MFA et consomme le pas de temps (anti-rejeu)", () => {
    const user = newUser();
    user.beginMfaEnrollment('secret');
    user.confirmMfaEnrollment(57_000_000);
    expect(user.mfaEnabled).toBe(true);
    expect(user.mfaLastUsedStep).toBe(57_000_000);
  });

  it('ne peut pas être confirmé sans enrôlement, ni enrôlé/confirmé une seconde fois', () => {
    const fresh = newUser();
    expect(() => fresh.confirmMfaEnrollment(1)).toThrow(DomainError);

    const active = newUser();
    active.beginMfaEnrollment('s');
    active.confirmMfaEnrollment(1);
    expect(() => active.beginMfaEnrollment('autre')).toThrow(/déjà activé/);
    expect(() => active.confirmMfaEnrollment(2)).toThrow(/déjà activé/);
  });

  it('la réinitialisation efface tout : MFA inactif, plus de secret, plus de pas utilisé', () => {
    const user = newUser();
    user.beginMfaEnrollment('s');
    user.confirmMfaEnrollment(5);
    user.resetMfa();
    expect(user).toMatchObject({ mfaEnabled: false, mfaSecretEnc: null, mfaLastUsedStep: null });
  });

  it('un échec MFA compte comme un échec de mot de passe et verrouille au 5e', () => {
    const user = newUser();
    for (let i = 0; i < 4; i++) user.registerFailedMfa(t0);
    expect(user.isLocked(t0)).toBe(false);
    user.registerFailedMfa(t0);
    expect(user.failedLoginCount).toBe(5);
    expect(user.isLocked(t0)).toBe(true);
  });

  it('un mot de passe raté et un code raté partagent le même compteur', () => {
    const user = newUser();
    user.registerFailedLogin(t0);
    user.registerFailedLogin(t0);
    user.registerFailedMfa(t0);
    user.registerFailedMfa(t0);
    user.registerFailedMfa(t0);
    expect(user.isLocked(t0)).toBe(true);
  });

  it('clearLoginFailures remet le compteur et le verrou à zéro sans toucher la dernière connexion', () => {
    const user = newUser();
    for (let i = 0; i < 6; i++) user.registerFailedMfa(t0);
    user.clearLoginFailures();
    expect(user.failedLoginCount).toBe(0);
    expect(user.lockedUntil).toBeNull();
    expect(user.lastLoginAt).toBeNull();
  });
});

describe('UserSession — MFA (A5)', () => {
  it('démarre non vérifiée, sans horodatage', () => {
    const session = newSession();
    expect(session.mfaVerified).toBe(false);
    expect(session.mfaVerifiedAt).toBeNull();
    expect(session.hasFreshMfa(t0)).toBe(false);
  });

  it('après vérification : vérifiée et récente pendant 10 minutes exactement', () => {
    expect(STEP_UP_MAX_AGE_MS).toBe(600_000);
    const session = newSession();
    session.markMfaVerified(t0);
    expect(session.mfaVerified).toBe(true);
    expect(session.hasFreshMfa(plus(STEP_UP_MAX_AGE_MS))).toBe(true);
    expect(session.hasFreshMfa(plus(STEP_UP_MAX_AGE_MS + 1))).toBe(false);
  });

  it('un horodatage dans le futur n\'est jamais considéré comme récent (horloge incohérente)', () => {
    const session = newSession();
    session.markMfaVerified(plus(5_000));
    expect(session.hasFreshMfa(t0)).toBe(false);
  });

  it('une nouvelle vérification (step-up) rafraîchit la fraîcheur', () => {
    const session = newSession();
    session.markMfaVerified(t0);
    expect(session.hasFreshMfa(plus(11 * 60_000))).toBe(false);
    session.markMfaVerified(plus(11 * 60_000));
    expect(session.hasFreshMfa(plus(12 * 60_000))).toBe(true);
  });

  it('accepte une durée de fraîcheur personnalisée', () => {
    const session = newSession();
    session.markMfaVerified(t0);
    expect(session.hasFreshMfa(plus(61_000), 60_000)).toBe(false);
    expect(session.hasFreshMfa(plus(60_000), 60_000)).toBe(true);
  });
});
