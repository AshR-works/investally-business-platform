import { DomainError } from '../../../shared-kernel';
import { createsCycle, MAX_HIERARCHY_DEPTH } from './hierarchy';
import { Email } from './email';
import { INVITATION_TTL_MS, UserInvitationRecord, evaluateInvitation } from './invitation';
import { User, UserStatus } from './user';

const t0 = new Date('2026-10-20T10:00:00Z');
const plus = (ms: number) => new Date(t0.getTime() + ms);

describe('User invité (A1)', () => {
  const invited = () => User.invite({ id: 'u1', email: Email.of('nouveau@investally.test'), displayName: ' Nouveau ', now: t0 });

  it('est créé en attente, SANS mot de passe, et ne peut pas s\'authentifier', () => {
    const user = invited();
    expect(user.status).toBe(UserStatus.Pending);
    expect(user.passwordHash).toBeNull();
    expect(user.canAuthenticate()).toBe(false);
    expect(user.displayName).toBe('Nouveau');
    expect(user.mfaEnabled).toBe(false);
  });

  it("l'activation pose le mot de passe et rend le compte actif", () => {
    const user = invited();
    user.activateWithPassword('hash', plus(1000));
    expect(user.status).toBe(UserStatus.Active);
    expect(user.passwordHash).toBe('hash');
    expect(user.passwordChangedAt).toEqual(plus(1000));
    expect(user.canAuthenticate()).toBe(true);
  });

  it("ne peut être activé qu'une fois : un compte déjà actif refuse une seconde activation", () => {
    const user = invited();
    user.activateWithPassword('hash', t0);
    expect(() => user.activateWithPassword('autre', t0)).toThrow(/pas en attente/);
    expect(user.passwordHash).toBe('hash');
  });

  it('un compte désactivé ne peut pas être « activé » par un lien d\'invitation', () => {
    const user = invited();
    user.disable();
    expect(() => user.activateWithPassword('hash', t0)).toThrow(DomainError);
  });

  it('réactivation : seulement un compte désactivé qui a déjà un mot de passe', () => {
    const active = User.create({ id: 'u2', email: Email.of('a@b.test'), displayName: 'A', passwordHash: 'h', now: t0 });
    expect(() => active.enable()).toThrow(/pas désactivé/);
    active.disable();
    active.enable();
    expect(active.status).toBe(UserStatus.Active);

    const neverActivated = invited();
    neverActivated.disable();
    expect(() => neverActivated.enable()).toThrow(/pas encore choisi de mot de passe/);
  });

  it('rename : nom nettoyé, vide ou démesuré refusé', () => {
    const user = invited();
    user.rename('  Marie Kamga  ');
    expect(user.displayName).toBe('Marie Kamga');
    expect(() => user.rename('   ')).toThrow(DomainError);
    expect(() => user.rename('x'.repeat(201))).toThrow(DomainError);
    expect(user.displayName).toBe('Marie Kamga');
  });

  it('assignManager : jamais soi-même', () => {
    const user = invited();
    expect(() => user.assignManager('u1')).toThrow(/propre responsable/);
    user.assignManager('boss');
    expect(user.managerId).toBe('boss');
    user.assignManager(null);
    expect(user.managerId).toBeNull();
  });
});

describe('Invitation (A2)', () => {
  const record = (over: Partial<UserInvitationRecord> = {}): UserInvitationRecord => ({
    id: 'i1', userId: 'u1', tokenHash: 'h', purpose: 'INVITATION', createdBy: 'admin', createdAt: t0, expiresAt: plus(INVITATION_TTL_MS), usedAt: null, revokedAt: null, ...over,
  });

  it('dure 48 heures', () => {
    expect(INVITATION_TTL_MS).toBe(48 * 3_600_000);
  });

  it('est valide jusqu\'à la dernière milliseconde, expirée à l\'échéance exacte', () => {
    expect(evaluateInvitation(record(), plus(INVITATION_TTL_MS - 1))).toBe('VALID');
    expect(evaluateInvitation(record(), plus(INVITATION_TTL_MS))).toBe('EXPIRED');
    expect(evaluateInvitation(record(), plus(INVITATION_TTL_MS + 1))).toBe('EXPIRED');
  });

  it('une invitation utilisée ou révoquée n\'est plus valide, même avant l\'échéance', () => {
    expect(evaluateInvitation(record({ usedAt: plus(5) }), plus(10))).toBe('USED');
    expect(evaluateInvitation(record({ revokedAt: plus(5) }), plus(10))).toBe('REVOKED');
  });

  it('la révocation prime sur l\'utilisation, qui prime sur l\'expiration', () => {
    expect(evaluateInvitation(record({ usedAt: plus(5), revokedAt: plus(6) }), plus(10))).toBe('REVOKED');
    expect(evaluateInvitation(record({ usedAt: plus(5) }), plus(INVITATION_TTL_MS + 1))).toBe('USED');
  });
});

describe('Hiérarchie (A3)', () => {
  it('refuse d\'être son propre responsable', () => {
    expect(createsCycle('a', 'a', [])).toBe(true);
  });

  it('refuse un cycle direct (A responsable de B, B voudrait A comme subordonné)', () => {
    // On veut faire de B le responsable de A, or A est déjà responsable de B (A est donc ancêtre de B)
    expect(createsCycle('a', 'b', ['a'])).toBe(true);
  });

  it('refuse un cycle indirect sur plusieurs niveaux', () => {
    expect(createsCycle('a', 'd', ['c', 'b', 'a', 'root'])).toBe(true);
  });

  it('accepte un rattachement sans cycle', () => {
    expect(createsCycle('a', 'b', ['c', 'root'])).toBe(false);
    expect(createsCycle('a', 'b', [])).toBe(false);
  });

  it('expose une profondeur maximale raisonnable', () => {
    expect(MAX_HIERARCHY_DEPTH).toBeGreaterThanOrEqual(10);
  });
});
