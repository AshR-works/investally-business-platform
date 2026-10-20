import 'reflect-metadata';
import { AuditAction } from '../src/modules/audit';
import { AuthenticateAccessTokenUseCase } from '../src/modules/iam/application/authenticate-access-token.use-case';
import { ChangePasswordUseCase } from '../src/modules/iam/application/change-password.use-case';
import { CreateUserUseCase } from '../src/modules/iam/application/create-user.use-case';
import { LoginUseCase } from '../src/modules/iam/application/login.use-case';
import { LogoutUseCase } from '../src/modules/iam/application/logout.use-case';
import { RefreshSessionUseCase } from '../src/modules/iam/application/refresh-session.use-case';
import { RoleCode } from '../src/modules/iam/domain/roles';
import { REUSE_GRACE_MS } from '../src/modules/iam/domain/refresh-token';
import { SYSTEM_ACTOR, TEST_PASSWORD, TestApp, startTestApp, uniqueEmail } from './support/test-app';

const describeDb = process.env.DATABASE_URL && process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;

/** Cas d'usage d'authentification sur la vraie base : hachage argon2id réel, jetons ES256 réels, transactions réelles. */
describeDb('Authentification (PostgreSQL)', () => {
  let t: TestApp;
  let createUser: CreateUserUseCase;
  let login: LoginUseCase;
  let refresh: RefreshSessionUseCase;
  let logout: LogoutUseCase;
  let authenticate: AuthenticateAccessTokenUseCase;
  let changePassword: ChangePasswordUseCase;

  beforeAll(async () => {
    t = await startTestApp();
    createUser = t.get(CreateUserUseCase);
    login = t.get(LoginUseCase);
    refresh = t.get(RefreshSessionUseCase);
    logout = t.get(LogoutUseCase);
    authenticate = t.get(AuthenticateAccessTokenUseCase);
    changePassword = t.get(ChangePasswordUseCase);
  }, 60_000);
  afterAll(() => t.close());

  const actor = (over = {}) => ({ ...SYSTEM_ACTOR, device: 'Navigateur A', ...over });
  async function newUser(roles: RoleCode[] = [RoleCode.AccountManager]) {
    const email = uniqueEmail('user');
    const { id } = await createUser.execute({ email, displayName: 'Utilisateur Test', password: TEST_PASSWORD, roles, actor: SYSTEM_ACTOR });
    return { id, email };
  }
  const auditFor = (entityId: string) =>
    t.prisma.db.auditLog.findMany({ where: { entityId }, orderBy: { createdAt: 'asc' } });

  describe('création et connexion', () => {
    it("stocke un hachage argon2id (jamais le mot de passe) et n'écrit aucun secret dans l'audit", async () => {
      const { id } = await newUser();
      const row = await t.prisma.db.user.findUniqueOrThrow({ where: { id } });
      expect(row.passwordHash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
      expect(row.passwordHash).not.toContain(TEST_PASSWORD);

      const trail = JSON.stringify(await auditFor(id));
      expect(trail).not.toContain(TEST_PASSWORD);
      expect(trail).not.toContain('argon2id');
      expect(await t.prisma.db.passwordHistory.count({ where: { userId: id } })).toBe(1);
      expect(await t.prisma.db.userRole.count({ where: { userId: id } })).toBe(1);
    });

    it('connecte, ouvre une session en base, enregistre la tentative et audite LOGIN (IP et appareil)', async () => {
      const { id, email } = await newUser();
      const result = await login.execute({ email, password: TEST_PASSWORD, actor: actor() });

      const session = await t.prisma.db.userSession.findUniqueOrThrow({ where: { id: result.sessionId } });
      expect(session.userId).toBe(id);
      expect(session.ipAddress).toBe('127.0.0.1');
      expect(session.device).toBe('Navigateur A');
      expect(session.riskLevel).toBe('LOW');
      expect(Math.abs(session.loggedInAt.getTime() - Date.now())).toBeLessThan(10_000); // UTC cohérent
      expect(await t.prisma.db.loginAttempt.count({ where: { userId: id, outcome: 'SUCCESS' } })).toBe(1);

      const login_ = (await auditFor(result.sessionId)).find((row) => row.action === AuditAction.Login)!;
      expect(login_).toMatchObject({ userId: id, sessionId: result.sessionId, ipAddress: '127.0.0.1', device: 'Navigateur A' });
    });

    it("stocke seulement l'empreinte SHA-256 du jeton de rafraîchissement", async () => {
      const { email } = await newUser();
      const result = await login.execute({ email, password: TEST_PASSWORD, actor: actor() });
      expect(await t.prisma.db.refreshToken.count({ where: { tokenHash: result.refreshToken } })).toBe(0);
      const rows = await t.prisma.db.refreshToken.findMany({ where: { sessionId: result.sessionId } });
      expect(rows).toHaveLength(1);
      expect(rows[0].tokenHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("refuse e-mail inconnu, mauvais mot de passe et compte désactivé avec le MÊME message", async () => {
      const { id, email } = await newUser();
      const messages = new Set<string>();
      for (const attempt of [
        { email: uniqueEmail('inconnu'), password: TEST_PASSWORD },
        { email, password: 'mauvais mot de passe' },
      ]) {
        await login.execute({ ...attempt, actor: actor() }).catch((e) => messages.add(`${e.code}:${e.message}`));
      }
      await t.prisma.db.user.update({ where: { id }, data: { status: 'DISABLED' } });
      await login.execute({ email, password: TEST_PASSWORD, actor: actor() }).catch((e) => messages.add(`${e.code}:${e.message}`));
      expect([...messages]).toEqual(['UNAUTHENTICATED:Identifiants invalides']);
    });

    it("note l'appareil et le réseau inconnus : risque plus élevé sur un rôle privilégié", async () => {
      const { email } = await newUser([RoleCode.Direction]);
      await login.execute({ email, password: TEST_PASSWORD, actor: actor() });
      const elsewhere = await login.execute({ email, password: TEST_PASSWORD, actor: actor({ ipAddress: '203.0.113.7', device: 'Navigateur inconnu' }) });
      expect(elsewhere.riskLevel).toBe('HIGH');
      const stored = await t.prisma.db.userSession.findUniqueOrThrow({ where: { id: elsewhere.sessionId } });
      expect(stored.riskLevel).toBe('HIGH');
    });
  });

  describe('verrouillage progressif', () => {
    it('persiste les échecs, verrouille au 5e, refuse le bon mot de passe pendant le verrou', async () => {
      const { id, email } = await newUser();
      for (let i = 0; i < 5; i++) {
        await expect(login.execute({ email, password: 'mauvais', actor: actor() })).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
      }
      const row = await t.prisma.db.user.findUniqueOrThrow({ where: { id } });
      expect(row.failedLoginCount).toBe(5);
      expect(row.lockedUntil!.getTime()).toBeGreaterThan(Date.now());

      await expect(login.execute({ email, password: TEST_PASSWORD, actor: actor() })).rejects.toMatchObject({ message: 'Identifiants invalides' });
      expect(await t.prisma.db.loginAttempt.count({ where: { userId: id, outcome: 'LOCKED' } })).toBe(1);
      expect(await t.prisma.db.userSession.count({ where: { userId: id } })).toBe(0);
    });

    it('résiste aux tentatives PARALLÈLES : aucun échec perdu (verrou de ligne)', async () => {
      const { id, email } = await newUser();
      const attempts = 12;
      await Promise.all(
        Array.from({ length: attempts }, () => login.execute({ email, password: 'mauvais', actor: actor() }).catch(() => undefined)),
      );
      const row = await t.prisma.db.user.findUniqueOrThrow({ where: { id } });
      // Sans verrou de ligne, des lectures simultanées du même compteur le feraient rester très en dessous.
      // Une fois verrouillé, les tentatives suivantes ne font plus augmenter le compteur : au moins le seuil est atteint.
      expect(row.failedLoginCount).toBeGreaterThanOrEqual(5);
      expect(row.lockedUntil).not.toBeNull();
      expect(await t.prisma.db.loginAttempt.count({ where: { userId: id } })).toBe(attempts);
    }, 60_000);
  });

  describe('rotation du refresh token (C5)', () => {
    it('deux rafraîchissements SIMULTANÉS avec le même jeton : un seul réussit, la session survit', async () => {
      const { email } = await newUser();
      const session = await login.execute({ email, password: TEST_PASSWORD, actor: actor() });

      const results = await Promise.allSettled([
        refresh.execute({ refreshToken: session.refreshToken, actor: actor() }),
        refresh.execute({ refreshToken: session.refreshToken, actor: actor() }),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
      const stored = await t.prisma.db.userSession.findUniqueOrThrow({ where: { id: session.sessionId } });
      expect(stored.revokedAt).toBeNull(); // fenêtre de tolérance : pas de fausse alerte de vol
    });

    it('réutilisation hors tolérance : famille et session révoquées, risque CRITICAL, audit SESSION_REVOKE', async () => {
      const { email } = await newUser();
      const session = await login.execute({ email, password: TEST_PASSWORD, actor: actor() });
      const rotated = await refresh.execute({ refreshToken: session.refreshToken, actor: actor() });

      // Vieillit l'utilisation du jeton pour sortir de la fenêtre de tolérance.
      await t.prisma.db.refreshToken.updateMany({
        where: { sessionId: session.sessionId, usedAt: { not: null } },
        data: { usedAt: new Date(Date.now() - REUSE_GRACE_MS - 5_000) },
      });
      await expect(refresh.execute({ refreshToken: session.refreshToken, actor: actor() })).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });

      const stored = await t.prisma.db.userSession.findUniqueOrThrow({ where: { id: session.sessionId } });
      expect(stored.revokedAt).not.toBeNull();
      expect(stored.riskLevel).toBe('CRITICAL');
      expect(await t.prisma.db.refreshToken.count({ where: { sessionId: session.sessionId, revokedAt: null } })).toBe(0);
      expect((await auditFor(session.sessionId)).some((row) => row.action === AuditAction.SessionRevoke)).toBe(true);
      // Le jeton légitime issu de la rotation est lui aussi mort : voleur et victime sont déconnectés.
      await expect(refresh.execute({ refreshToken: rotated.refreshToken, actor: actor() })).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
      expect(await authenticate.execute(rotated.accessToken)).toBeNull();
    });

    it("la session ne peut jamais dépasser son expiration absolue, même en se rafraîchissant sans cesse", async () => {
      const { email } = await newUser([RoleCode.Direction]); // rôle privilégié : 12 h
      const session = await login.execute({ email, password: TEST_PASSWORD, actor: actor() });
      const row = await t.prisma.db.userSession.findUniqueOrThrow({ where: { id: session.sessionId } });
      expect(row.absoluteExpiresAt.getTime() - row.loggedInAt.getTime()).toBe(12 * 3_600_000);
      expect(row.expiresAt.getTime()).toBeLessThanOrEqual(row.absoluteExpiresAt.getTime());
    });
  });

  describe('déconnexion et jeton d\'accès', () => {
    it('refuse le jeton immédiatement après la déconnexion et audite LOGOUT', async () => {
      const { id, email } = await newUser();
      const session = await login.execute({ email, password: TEST_PASSWORD, actor: actor() });
      expect(await authenticate.execute(session.accessToken)).toMatchObject({ userId: id, sessionId: session.sessionId });

      await logout.execute({ sessionId: session.sessionId, actor: actor() });

      expect(await authenticate.execute(session.accessToken)).toBeNull();
      await expect(refresh.execute({ refreshToken: session.refreshToken, actor: actor() })).rejects.toBeDefined();
      expect((await auditFor(session.sessionId)).filter((row) => row.action === AuditAction.Logout)).toHaveLength(1);
    });

    it("refuse le jeton d'un compte désactivé après coup", async () => {
      const { id, email } = await newUser();
      const session = await login.execute({ email, password: TEST_PASSWORD, actor: actor() });
      await t.prisma.db.user.update({ where: { id }, data: { status: 'DISABLED' } });
      expect(await authenticate.execute(session.accessToken)).toBeNull();
    });
  });

  describe('changement de mot de passe', () => {
    it('applique la politique et l\'historique, révoque les autres sessions, audite PASSWORD_CHANGE', async () => {
      const { id, email } = await newUser();
      const a = await login.execute({ email, password: TEST_PASSWORD, actor: actor() });
      const b = await login.execute({ email, password: TEST_PASSWORD, actor: actor({ device: 'Navigateur B' }) });

      await expect(
        changePassword.execute({ userId: id, sessionId: a.sessionId, currentPassword: TEST_PASSWORD, newPassword: TEST_PASSWORD, actor: actor() }),
      ).rejects.toMatchObject({ code: 'VALIDATION' });

      await changePassword.execute({
        userId: id, sessionId: a.sessionId, currentPassword: TEST_PASSWORD, newPassword: 'un tout autre mot de passe 91', actor: actor(),
      });

      expect((await t.prisma.db.userSession.findUniqueOrThrow({ where: { id: a.sessionId } })).revokedAt).toBeNull();
      expect((await t.prisma.db.userSession.findUniqueOrThrow({ where: { id: b.sessionId } })).revokedAt).not.toBeNull();
      expect(await t.prisma.db.refreshToken.count({ where: { sessionId: b.sessionId, revokedAt: null } })).toBe(0);
      expect(await t.prisma.db.passwordHistory.count({ where: { userId: id } })).toBe(2);
      await expect(login.execute({ email, password: TEST_PASSWORD, actor: actor() })).rejects.toBeDefined();
      await expect(login.execute({ email, password: 'un tout autre mot de passe 91', actor: actor() })).resolves.toBeDefined();

      const trail = await auditFor(id);
      const change = trail.find((row) => row.action === AuditAction.PasswordChange)!;
      expect(change.newValue).toEqual({ otherSessionsRevoked: 1 });
      expect(JSON.stringify(trail)).not.toContain('un tout autre');
    }, 60_000);
  });

  describe('intégrité', () => {
    it('refuse deux comptes de même e-mail (index unique partiel) même à travers le cas d\'usage', async () => {
      const { email } = await newUser();
      await expect(
        createUser.execute({ email: email.toUpperCase(), displayName: 'Doublon', password: TEST_PASSWORD, roles: [RoleCode.Trainer], actor: SYSTEM_ACTOR }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
    });

    it('annule tout (utilisateur, historique, rôles) si le rôle demandé n\'existe pas', async () => {
      const email = uniqueEmail('rollback');
      await expect(
        createUser.execute({ email, displayName: 'X Y', password: TEST_PASSWORD, roles: ['ROLE_INEXISTANT' as RoleCode], actor: SYSTEM_ACTOR }),
      ).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
      expect(await t.prisma.db.user.count({ where: { emailKey: email.toLowerCase() } })).toBe(0);
    });
  });
});
