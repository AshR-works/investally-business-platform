import { DomainError } from '../../../shared-kernel';
import { Email } from './email';
import { LOCKOUT_THRESHOLD, User, UserStatus } from './user';

const t0 = new Date('2026-10-20T10:00:00Z');
const at = (minutes: number) => new Date(t0.getTime() + minutes * 60_000);

function newUser() {
  return User.create({ id: 'u1', email: Email.of('Marie@Investally.test'), displayName: ' Marie ', passwordHash: 'hash', now: t0 });
}
function failTimes(user: User, count: number, now = t0) {
  for (let i = 0; i < count; i++) user.registerFailedLogin(now);
}

describe('Email', () => {
  it('normalise en minuscules et conserve la saisie', () => {
    const email = Email.of('  Marie@Investally.Test ');
    expect(email.value).toBe('Marie@Investally.Test');
    expect(email.key).toBe('marie@investally.test');
  });

  it.each(['', 'sans-arobase', 'a@b', 'a b@c.test', `${'x'.repeat(250)}@a.test`])('refuse %p', (raw) => {
    expect(() => Email.of(raw)).toThrow(DomainError);
  });

  it('keyOf ne lève jamais (connexion avec une adresse invalide)', () => {
    expect(Email.keyOf(undefined as unknown as string)).toBe('');
    expect(Email.keyOf('  X@Y.Z ')).toBe('x@y.z');
  });
});

describe('User — verrouillage progressif', () => {
  it('est créé actif, sans verrou, nom nettoyé', () => {
    const user = newUser();
    expect(user.status).toBe(UserStatus.Active);
    expect(user.canAuthenticate()).toBe(true);
    expect(user.isLocked(t0)).toBe(false);
    expect(user.displayName).toBe('Marie');
  });

  it(`ne verrouille pas avant ${LOCKOUT_THRESHOLD} échecs`, () => {
    const user = newUser();
    failTimes(user, LOCKOUT_THRESHOLD - 1);
    expect(user.isLocked(t0)).toBe(false);
  });

  it('verrouille 1 minute au 5e échec, puis 5, 15 et 60 minutes, plafonné à 60', () => {
    const user = newUser();
    failTimes(user, 5);
    expect(user.lockedUntil).toEqual(at(1));
    user.registerFailedLogin(t0);
    expect(user.lockedUntil).toEqual(at(5));
    user.registerFailedLogin(t0);
    expect(user.lockedUntil).toEqual(at(15));
    user.registerFailedLogin(t0);
    expect(user.lockedUntil).toEqual(at(60));
    failTimes(user, 10);
    expect(user.lockedUntil).toEqual(at(60));
  });

  it('le verrou expire tout seul (jamais définitif)', () => {
    const user = newUser();
    failTimes(user, 5);
    expect(user.isLocked(at(0.5))).toBe(true);
    expect(user.isLocked(at(1))).toBe(false);
  });

  it('un succès remet les compteurs à zéro et enregistre la dernière connexion', () => {
    const user = newUser();
    failTimes(user, 6);
    user.registerSuccessfulLogin(at(10));
    expect(user.failedLoginCount).toBe(0);
    expect(user.lockedUntil).toBeNull();
    expect(user.lastLoginAt).toEqual(at(10));
  });

  it('changer le mot de passe lève le verrou', () => {
    const user = newUser();
    failTimes(user, 6);
    user.changePassword('hash2', at(2));
    expect(user.isLocked(at(2))).toBe(false);
    expect(user.passwordHash).toBe('hash2');
  });

  it("un compte désactivé ou sans mot de passe ne peut pas s'authentifier", () => {
    const user = newUser();
    user.disable();
    expect(user.canAuthenticate()).toBe(false);
    const pending = User.rehydrate({
      id: 'u2', email: Email.of('p@x.test'), displayName: 'P', status: UserStatus.Pending, passwordHash: null,
      passwordChangedAt: null, failedLoginCount: 0, lockedUntil: null, mfaEnabled: false, managerId: null,
      lastLoginAt: null, version: 1, createdAt: t0,
    });
    expect(pending.canAuthenticate()).toBe(false);
  });
});
