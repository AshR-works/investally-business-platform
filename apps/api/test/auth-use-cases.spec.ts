import { AuditAction } from '../src/modules/audit';
import { LoginOutcome } from '../src/modules/iam/domain/auth-repositories';
import { REUSE_GRACE_MS } from '../src/modules/iam/domain/refresh-token';
import { RoleCode } from '../src/modules/iam/domain/roles';
import { RiskLevel } from '../src/modules/iam/domain/session-risk';
import { buildIamWorld } from './support/iam-world';
import { actor, fakeHash } from './support/iam-fakes';

const EMAIL = 'marie@investally.test';

describe('CreateUserUseCase (B7)', () => {
  it("applique la politique, stocke un hachage et n'écrit jamais le mot de passe nulle part", async () => {
    const w = buildIamWorld();
    const created = await w.createDefaultUser();

    const user = w.users.items.get(created.id)!;
    expect(user.passwordHash).toBe(`hash(${w.PASSWORD})`);
    expect(w.history.items).toHaveLength(1);
    expect(w.users.roles.get(created.id)).toEqual([RoleCode.AccountManager]);

    // Rien d'exploitable dans l'audit
    const serialized = JSON.stringify(w.audit);
    expect(serialized).not.toContain(w.PASSWORD);
    expect(serialized).not.toContain('hash(');
    expect(w.audit[0]).toMatchObject({ action: AuditAction.Create, entityType: 'User', entityId: created.id });
  });

  it('refuse un mot de passe qui viole la politique, sans le répéter', async () => {
    const w = buildIamWorld();
    await expect(w.createDefaultUser([RoleCode.Trainer], 'a@investally.test', 'courtcourt')).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(w.users.items.size).toBe(0);
  });

  it('refuse un doublon d\'e-mail (insensible à la casse) et un utilisateur sans rôle', async () => {
    const w = buildIamWorld();
    await w.createDefaultUser();
    await expect(w.createDefaultUser([RoleCode.Trainer], 'MARIE@Investally.TEST')).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(
      w.createUser.execute({ email: 'x@investally.test', displayName: 'X Y', password: w.PASSWORD, roles: [], actor: actor() }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
  });
});

describe('LoginUseCase', () => {
  it('B1 — connexion réussie : session, jetons, tentative et audit LOGIN', async () => {
    const w = buildIamWorld();
    const { id } = await w.createDefaultUser();
    w.audit.length = 0;

    const result = await w.login.execute({ email: ' Marie@Investally.test ', password: w.PASSWORD, actor: actor() });

    expect(result.userId).toBe(id);
    expect(result.accessToken).toContain('|pwd|');
    expect(result.refreshToken).toBeTruthy();
    expect(result.mfaRequired).toBe(true);
    expect(result.mfaVerified).toBe(false);
    expect(w.sessions.items.size).toBe(1);
    expect(w.attempts.items.at(-1)).toMatchObject({ outcome: LoginOutcome.Success, userId: id });
    expect(w.audit).toHaveLength(1);
    expect(w.audit[0]).toMatchObject({ action: AuditAction.Login, entityType: 'UserSession', entityId: result.sessionId });
    expect(w.audit[0].actor).toMatchObject({ userId: id, sessionId: result.sessionId, ipAddress: '10.0.0.1' });
  });

  it("ne stocke le jeton de rafraîchissement qu'à l'état d'empreinte", async () => {
    const w = buildIamWorld();
    await w.createDefaultUser();
    const result = await w.login.execute({ email: EMAIL, password: w.PASSWORD, actor: actor() });
    expect([...w.refreshTokens.items.keys()]).not.toContain(result.refreshToken);
    expect(JSON.stringify([...w.refreshTokens.items.values()])).not.toContain(result.refreshToken);
  });

  it('B2 — mauvais mot de passe : message unique, compteur incrémenté, audit LOGIN_FAILED', async () => {
    const w = buildIamWorld();
    const { id } = await w.createDefaultUser();
    w.audit.length = 0;

    await expect(w.login.execute({ email: EMAIL, password: 'mauvais', actor: actor() })).rejects.toMatchObject({
      code: 'UNAUTHENTICATED', message: 'Identifiants invalides',
    });
    expect(w.users.items.get(id)!.failedLoginCount).toBe(1);
    expect(w.audit[0]).toMatchObject({ action: AuditAction.LoginFailed, entityId: id, newValue: { reason: 'BAD_PASSWORD' } });
    expect(w.sessions.items.size).toBe(0);
  });

  it('B3 — e-mail inconnu : même message, calcul factice effectué, aucun e-mail dans l\'audit', async () => {
    const w = buildIamWorld();
    await expect(w.login.execute({ email: 'inconnu@investally.test', password: 'x', actor: actor() })).rejects.toMatchObject({
      code: 'UNAUTHENTICATED', message: 'Identifiants invalides',
    });
    expect(w.hasher.dummyCalls).toBe(1);
    expect(w.audit[0]).toMatchObject({ action: AuditAction.LoginFailed, entityId: 'unknown', newValue: { reason: 'UNKNOWN_USER' } });
    expect(JSON.stringify(w.audit)).not.toContain('inconnu@');
    expect(w.attempts.items[0]).toMatchObject({ userId: null, outcome: LoginOutcome.BadCredentials });
  });

  it("accepte sans planter une adresse invalide ou vide (traitée comme un compte inconnu)", async () => {
    const w = buildIamWorld();
    for (const email of ['', '   ', 'pas-une-adresse', undefined as unknown as string]) {
      await expect(w.login.execute({ email, password: 'x', actor: actor() })).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    }
  });

  it('B4 — après 5 échecs le compte est verrouillé : le bon mot de passe est refusé, même message', async () => {
    const w = buildIamWorld();
    const { id } = await w.createDefaultUser();
    for (let i = 0; i < 5; i++) {
      await expect(w.login.execute({ email: EMAIL, password: 'mauvais', actor: actor() })).rejects.toBeDefined();
    }
    expect(w.users.items.get(id)!.isLocked(w.clock.now())).toBe(true);

    w.audit.length = 0;
    await expect(w.login.execute({ email: EMAIL, password: w.PASSWORD, actor: actor() })).rejects.toMatchObject({
      message: 'Identifiants invalides',
    });
    expect(w.audit[0]).toMatchObject({ newValue: { reason: 'LOCKED' } });
    expect(w.attempts.items.at(-1)?.outcome).toBe(LoginOutcome.Locked);
    expect(w.sessions.items.size).toBe(0);

    // Le verrou n'est pas définitif : après 1 minute le bon mot de passe passe, et les compteurs repartent à zéro.
    w.clock.advance(61_000);
    await expect(w.login.execute({ email: EMAIL, password: w.PASSWORD, actor: actor() })).resolves.toBeDefined();
    expect(w.users.items.get(id)!.failedLoginCount).toBe(0);
  });

  it('refuse un compte désactivé avec le même message, même avec le bon mot de passe', async () => {
    const w = buildIamWorld();
    const { id } = await w.createDefaultUser();
    w.users.items.get(id)!.disable();
    await expect(w.login.execute({ email: EMAIL, password: w.PASSWORD, actor: actor() })).rejects.toMatchObject({
      message: 'Identifiants invalides',
    });
    expect(w.audit.at(-1)).toMatchObject({ newValue: { reason: 'NOT_ACTIVE' } });
  });

  it("calcule le risque : première connexion basse, nouvel appareil et réseau sur rôle privilégié plus haut", async () => {
    const w = buildIamWorld();
    await w.createDefaultUser([RoleCode.Direction], 'direction@investally.test');
    const first = await w.login.execute({ email: 'direction@investally.test', password: w.PASSWORD, actor: actor() });
    expect(first.riskLevel).toBe(RiskLevel.Low); // rôle privilégié seul = +1

    const same = await w.login.execute({ email: 'direction@investally.test', password: w.PASSWORD, actor: actor() });
    expect(same.riskLevel).toBe(RiskLevel.Low);

    const elsewhere = await w.login.execute({
      email: 'direction@investally.test', password: w.PASSWORD, actor: actor({ ipAddress: '203.0.113.9', device: 'Autre navigateur' }),
    });
    expect(elsewhere.riskLevel).toBe(RiskLevel.High); // appareil +1, réseau +1, privilégié +1
  });

  it('utilise la politique la plus courte (12 h) pour un rôle privilégié', async () => {
    const w = buildIamWorld();
    await w.createDefaultUser([RoleCode.SuperAdmin], 'admin@investally.test');
    const { sessionId } = await w.login.execute({ email: 'admin@investally.test', password: w.PASSWORD, actor: actor() });
    const session = w.sessions.items.get(sessionId)!;
    expect(session.absoluteExpiresAt.getTime() - session.loggedInAt.getTime()).toBe(12 * 3_600_000);
  });
});

describe('RefreshSessionUseCase', () => {
  async function loggedIn() {
    const w = buildIamWorld();
    await w.createDefaultUser();
    const session = await w.login.execute({ email: EMAIL, password: w.PASSWORD, actor: actor() });
    return { w, session };
  }

  it('B5 — effectue la rotation : nouveau jeton, ancien consommé, même session', async () => {
    const { w, session } = await loggedIn();
    w.clock.advance(60_000);
    const next = await w.refresh.execute({ refreshToken: session.refreshToken, actor: actor() });

    expect(next.refreshToken).not.toBe(session.refreshToken);
    expect(next.sessionId).toBe(session.sessionId);
    expect(next.accessToken).not.toBe(session.accessToken);
    const old = w.refreshTokens.items.get(fakeHash(session.refreshToken))!;
    expect(old.usedAt).not.toBeNull();
    // les deux jetons appartiennent à la même famille de rotation
    const fresh = w.refreshTokens.items.get(fakeHash(next.refreshToken))!;
    expect(fresh.familyId).toBe(old.familyId);
  });

  it('B5 — réutilisation hors tolérance : toute la session est révoquée, risque critique, audit SESSION_REVOKE', async () => {
    const { w, session } = await loggedIn();
    w.clock.advance(60_000);
    const rotated = await w.refresh.execute({ refreshToken: session.refreshToken, actor: actor() });
    w.audit.length = 0;

    w.clock.advance(REUSE_GRACE_MS + 1_000);
    await expect(w.refresh.execute({ refreshToken: session.refreshToken, actor: actor() })).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });

    const stored = w.sessions.items.get(session.sessionId)!;
    expect(stored.revokedAt).not.toBeNull();
    expect(stored.riskLevel).toBe(RiskLevel.Critical);
    expect(w.audit[0]).toMatchObject({ action: AuditAction.SessionRevoke, entityId: session.sessionId });
    // Le jeton LÉGITIME issu de la rotation est lui aussi inutilisable : le voleur et la victime sont déconnectés.
    await expect(w.refresh.execute({ refreshToken: rotated.refreshToken, actor: actor() })).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(await w.authenticate.execute(rotated.accessToken)).toBeNull();
  });

  it('refuse sans révoquer une seconde présentation dans la fenêtre de tolérance (deux onglets)', async () => {
    const { w, session } = await loggedIn();
    w.clock.advance(60_000);
    await w.refresh.execute({ refreshToken: session.refreshToken, actor: actor() });
    w.clock.advance(1_000);
    await expect(w.refresh.execute({ refreshToken: session.refreshToken, actor: actor() })).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(w.sessions.items.get(session.sessionId)!.revokedAt).toBeNull();
  });

  it("refuse un jeton inconnu, un jeton expiré et un compte devenu inactif", async () => {
    const { w, session } = await loggedIn();
    await expect(w.refresh.execute({ refreshToken: 'jamais-emis', actor: actor() })).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });

    const w2 = (await loggedIn());
    w2.w.clock.advance(9 * 3_600_000);
    await expect(w2.w.refresh.execute({ refreshToken: w2.session.refreshToken, actor: actor() })).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });

    w.users.items.get(session.userId)!.disable();
    w.clock.advance(1_000);
    await expect(w.refresh.execute({ refreshToken: session.refreshToken, actor: actor() })).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(w.sessions.items.get(session.sessionId)!.revokedAt).not.toBeNull();
  });

  it("prolonge l'inactivité à chaque rotation sans dépasser l'expiration absolue", async () => {
    const { w, session } = await loggedIn();
    const before = w.sessions.items.get(session.sessionId)!.expiresAt.getTime();
    w.clock.advance(3_600_000);
    await w.refresh.execute({ refreshToken: session.refreshToken, actor: actor() });
    const after = w.sessions.items.get(session.sessionId)!;
    expect(after.expiresAt.getTime()).toBe(before + 3_600_000);
    expect(after.expiresAt.getTime()).toBeLessThanOrEqual(after.absoluteExpiresAt.getTime());
  });
});

describe('LogoutUseCase et AuthenticateAccessTokenUseCase', () => {
  it('B6 — déconnexion : session et jetons révoqués, audit LOGOUT, jeton d\'accès refusé immédiatement', async () => {
    const w = buildIamWorld();
    await w.createDefaultUser();
    const s = await w.login.execute({ email: EMAIL, password: w.PASSWORD, actor: actor() });
    expect(await w.authenticate.execute(s.accessToken)).toMatchObject({ userId: s.userId, sessionId: s.sessionId, mfaVerified: false });

    w.audit.length = 0;
    await w.logout.execute({ sessionId: s.sessionId, actor: actor() });

    expect(w.audit).toHaveLength(1);
    expect(w.audit[0]).toMatchObject({ action: AuditAction.Logout, entityId: s.sessionId });
    expect(await w.authenticate.execute(s.accessToken)).toBeNull();
    await expect(w.refresh.execute({ refreshToken: s.refreshToken, actor: actor() })).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('la déconnexion est idempotente (aucune erreur, aucun second audit)', async () => {
    const w = buildIamWorld();
    await w.createDefaultUser();
    const s = await w.login.execute({ email: EMAIL, password: w.PASSWORD, actor: actor() });
    await w.logout.execute({ sessionId: s.sessionId, actor: actor() });
    w.audit.length = 0;
    await w.logout.execute({ sessionId: s.sessionId, actor: actor() });
    await w.logout.execute({ sessionId: 'inexistante', actor: actor() });
    expect(w.audit).toHaveLength(0);
  });

  it("refuse un jeton d'accès expiré, falsifié ou dont la session appartient à un autre utilisateur", async () => {
    const w = buildIamWorld();
    await w.createDefaultUser();
    const s = await w.login.execute({ email: EMAIL, password: w.PASSWORD, actor: actor() });

    expect(await w.authenticate.execute('n-importe-quoi')).toBeNull();
    expect(await w.authenticate.execute(s.accessToken.replace(s.userId, 'autre-utilisateur'))).toBeNull();
    w.clock.advance(16 * 60_000);
    expect(await w.authenticate.execute(s.accessToken)).toBeNull(); // jeton de 15 min
  });
});

describe('ChangePasswordUseCase', () => {
  it('change le mot de passe, journalise, et révoque les AUTRES sessions seulement', async () => {
    const w = buildIamWorld();
    const { id } = await w.createDefaultUser();
    const a = await w.login.execute({ email: EMAIL, password: w.PASSWORD, actor: actor() });
    const b = await w.login.execute({ email: EMAIL, password: w.PASSWORD, actor: actor({ device: 'autre' }) });
    w.audit.length = 0;

    await w.changePassword.execute({
      userId: id, sessionId: a.sessionId, currentPassword: w.PASSWORD, newPassword: 'une autre phrase de passe 77', actor: actor(),
    });

    expect(w.sessions.items.get(a.sessionId)!.revokedAt).toBeNull();
    expect(w.sessions.items.get(b.sessionId)!.revokedAt).not.toBeNull();
    expect(w.audit[0]).toMatchObject({ action: AuditAction.PasswordChange, newValue: { otherSessionsRevoked: 1 } });
    expect(JSON.stringify(w.audit)).not.toContain('une autre phrase');
    await expect(w.login.execute({ email: EMAIL, password: w.PASSWORD, actor: actor() })).rejects.toBeDefined();
    await expect(w.login.execute({ email: EMAIL, password: 'une autre phrase de passe 77', actor: actor() })).resolves.toBeDefined();
  });

  it('refuse un mot de passe actuel faux, une politique violée et la réutilisation des 5 derniers', async () => {
    const w = buildIamWorld();
    const { id } = await w.createDefaultUser();
    const s = await w.login.execute({ email: EMAIL, password: w.PASSWORD, actor: actor() });
    const change = (currentPassword: string, newPassword: string) =>
      w.changePassword.execute({ userId: id, sessionId: s.sessionId, currentPassword, newPassword, actor: actor() });

    await expect(change('faux', 'nouvelle phrase de passe 11')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(change(w.PASSWORD, 'court')).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(change(w.PASSWORD, w.PASSWORD)).rejects.toMatchObject({ code: 'VALIDATION' });

    // 5 changements successifs, puis le premier mot de passe est de nouveau interdit (historique de 5 + actuel)
    let current = w.PASSWORD;
    for (let i = 1; i <= 5; i++) {
      const next = `phrase de passe numero ${i} unique`;
      await change(current, next);
      current = next;
    }
    await expect(change(current, 'phrase de passe numero 2 unique')).rejects.toMatchObject({ code: 'VALIDATION' });
  });
});
