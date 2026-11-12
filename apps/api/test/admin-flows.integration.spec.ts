import 'reflect-metadata';
import { AssignRolesUseCase, SetUserStatusUseCase } from '../src/modules/iam/application/admin/user-management.use-cases';
import { AcceptInvitationUseCase, InviteUserUseCase } from '../src/modules/iam/application/admin/invitations.use-cases';
import { AuthorizationService } from '../src/modules/iam/application/authorization.service';
import { base32Decode } from '../src/modules/iam/domain/base32';
import { RoleCode } from '../src/modules/iam/domain/roles';
import { totp } from '../src/modules/iam/domain/totp';
import { LogEmailSender } from '../src/modules/notifications/infrastructure/log-email-sender';
import { EMAIL_SENDER } from '../src/modules/notifications';
import { COMPANY_REPOSITORY, CompanyRepository } from '../src/modules/business-development/domain/company-repository';
import { Api, createUserWithRoles, mfaSession, startRbacApp } from './support/rbac-http';
import { SYSTEM_ACTOR, TEST_PASSWORD, TestApp, uniqueEmail } from './support/test-app';

const describeDb = process.env.DATABASE_URL && process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;
const NEW_PASSWORD = 'cheval agrafeuse nuage lointain 73';
const tokenIn = (text: string) => /#token=([\w-]+)/.exec(text)![1];

describeDb('Administration des comptes (PostgreSQL)', () => {
  let t: TestApp;
  let api: Api;
  let mailbox: LogEmailSender;
  beforeAll(async () => {
    ({ t, api } = await startRbacApp());
    mailbox = t.get(EMAIL_SENDER as never) as LogEmailSender;
  }, 60_000);
  afterAll(() => t.close());

  const lastMailTo = (address: string) => mailbox.sent.filter((m) => m.to === address).at(-1);
  const actorOf = (userId: string) => ({ ...SYSTEM_ACTOR, userId });

  describe('D4 — parcours d\'invitation complet sur HTTP', () => {
    it('invitation → e-mail → activation → connexion → enrôlement MFA : aucun mot de passe n\'existe avant que l\'utilisateur le choisisse', async () => {
      const admin = await createUserWithRoles(t, [RoleCode.SuperAdmin]);
      const adminSession = await mfaSession(t, api, admin.email, '10.80.0.1');
      const email = uniqueEmail('recrue');

      // 1) L'administrateur invite
      const invited = await api.call('POST', '/api/v1/admin/users', {
        token: adminSession.token, ip: '10.80.0.1', body: { email, displayName: 'Recrue Camerounaise', roles: ['ACCOUNT_MANAGER'] },
      });
      expect(invited.status).toBe(201);
      expect(invited.body).toMatchObject({ emailSent: true, user: { status: 'PENDING', roles: ['ACCOUNT_MANAGER'], mfaEnabled: false } });
      const row = await t.prisma.db.user.findUniqueOrThrow({ where: { id: invited.body.user.id } });
      expect(row.passwordHash).toBeNull(); // aucun mot de passe connu de qui que ce soit
      expect(row.status).toBe('PENDING');

      // 2) Le compte ne peut pas se connecter tant qu'il n'est pas activé
      expect((await api.call('POST', '/api/v1/auth/login', { body: { email, password: NEW_PASSWORD }, ip: '10.80.0.2' })).status).toBe(401);

      // 3) Le lien arrive par e-mail ; le jeton est dans le fragment, jamais stocké en clair
      const mail = lastMailTo(email)!;
      expect(mail.text).toMatch(/https?:\/\/[^\s]+\/invitation#token=[\w-]+/);
      const token = tokenIn(mail.text);
      expect(await t.prisma.db.userInvitation.count({ where: { tokenHash: token } })).toBe(0);
      const stored = await t.prisma.db.userInvitation.findFirstOrThrow({ where: { userId: row.id } });
      expect(stored.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(stored.expiresAt.getTime() - stored.createdAt.getTime()).toBe(48 * 3_600_000);
      const audit = JSON.stringify(await t.prisma.db.auditLog.findMany({ where: { entityId: row.id } }));
      expect(audit).not.toContain(token);

      // 4) Mot de passe faible : refusé SANS consommer le lien
      const weak = await api.call('POST', '/api/v1/auth/invitation/accept', { body: { token, password: 'court' }, ip: '10.80.0.3' });
      expect(weak.status).toBe(400);
      expect(weak.body.detail).toContain('Mot de passe refusé');

      // 5) Activation
      const accepted = await api.call('POST', '/api/v1/auth/invitation/accept', { body: { token, password: NEW_PASSWORD }, ip: '10.80.0.3' });
      expect(accepted.status).toBe(204);
      expect((await t.prisma.db.user.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('ACTIVE');

      // 6) Le lien est à usage unique, et tout lien invalide produit le MÊME refus
      const again = await api.call('POST', '/api/v1/auth/invitation/accept', { body: { token, password: NEW_PASSWORD }, ip: '10.80.0.3' });
      const unknown = await api.call('POST', '/api/v1/auth/invitation/accept', { body: { token: 'inconnu', password: NEW_PASSWORD }, ip: '10.80.0.3' });
      expect([again.status, unknown.status]).toEqual([400, 400]);
      expect(again.body).toEqual(unknown.body);

      // 7) Connexion, puis enrôlement MFA avec un vrai code TOTP
      const login = await api.call('POST', '/api/v1/auth/login', { body: { email, password: NEW_PASSWORD }, ip: '10.80.0.4' });
      expect(login.body).toMatchObject({ mfaRequired: true, mfaEnrolled: false, mfaVerified: false });
      const started = await api.call('POST', '/api/v1/auth/mfa/enroll/start', { token: login.body.accessToken, ip: '10.80.0.4' });
      const code = totp(base32Decode(started.body.secret), Date.now());
      const confirmed = await api.call('POST', '/api/v1/auth/mfa/enroll/confirm', { token: login.body.accessToken, ip: '10.80.0.4', body: { code } });
      expect(confirmed.status).toBe(200);
      expect(confirmed.body.recoveryCodes).toHaveLength(10);
      expect((await api.call('GET', '/api/v1/auth/me', { token: confirmed.body.accessToken, ip: '10.80.0.4' })).body).toMatchObject({ mfaVerified: true });

      // 8) Et il apparaît actif dans la liste d'administration
      const found = await api.call('GET', `/api/v1/admin/users?search=${encodeURIComponent(email)}`, { token: adminSession.token, ip: '10.80.0.1' });
      expect(found.body.items[0]).toMatchObject({ email, status: 'ACTIVE', mfaEnabled: true });
    }, 120_000);

    it('renvoi : l\'ancien lien est révoqué, le nouveau fonctionne', async () => {
      const admin = await createUserWithRoles(t, [RoleCode.SuperAdmin]);
      const session = await mfaSession(t, api, admin.email, '10.80.1.1');
      const email = uniqueEmail('renvoi');
      const invited = await api.call('POST', '/api/v1/admin/users', { token: session.token, ip: '10.80.1.1', body: { email, displayName: 'Renvoi Test', roles: ['SUPPORT'] } });
      const first = tokenIn(lastMailTo(email)!.text);

      const resent = await api.call('POST', `/api/v1/admin/users/${invited.body.user.id}/invitations`, { token: session.token, ip: '10.80.1.1' });
      expect([resent.status, resent.body]).toEqual([200, { emailSent: true }]);
      const second = tokenIn(lastMailTo(email)!.text);
      expect(second).not.toBe(first);

      expect((await api.call('POST', '/api/v1/auth/invitation/accept', { body: { token: first, password: NEW_PASSWORD }, ip: '10.80.1.2' })).status).toBe(400);
      expect((await api.call('POST', '/api/v1/auth/invitation/accept', { body: { token: second, password: NEW_PASSWORD }, ip: '10.80.1.2' })).status).toBe(204);
    }, 120_000);

    it('refuse un doublon (409), un rôle inconnu (400), un corps invalide (400) et un responsable inconnu (404)', async () => {
      const admin = await createUserWithRoles(t, [RoleCode.SuperAdmin]);
      const session = await mfaSession(t, api, admin.email, '10.80.2.1');
      const post = (body: unknown) => api.call('POST', '/api/v1/admin/users', { token: session.token, ip: '10.80.2.1', body });
      const ok = { email: uniqueEmail('x'), displayName: 'X Y', roles: ['SUPPORT'] };
      expect((await post({ ...ok, email: admin.email })).status).toBe(409);
      expect((await post({ ...ok, roles: ['PIRATE'] })).status).toBe(400);
      expect((await post({ ...ok, roles: [] })).status).toBe(400);
      expect((await post({ ...ok, extra: true })).status).toBe(400);
      expect((await post({ ...ok, managerId: 'pas-un-uuid' })).status).toBe(400);
      expect((await post({ ...ok, managerId: '00000000-0000-7000-8000-000000000999' })).status).toBe(404);
    }, 60_000);
  });

  describe('C2 — contraintes de la table des invitations', () => {
    it('refuse un jeton qui n\'est pas un SHA-256, un doublon, et une expiration antérieure à la création ; cascade avec l\'utilisateur', async () => {
      const user = await createUserWithRoles(t, [RoleCode.Support]);
      const insert = (hash: string, expires: string) =>
        t.prisma.db.$executeRawUnsafe(
          `INSERT INTO iam.user_invitations (id, user_id, token_hash, expires_at) VALUES (gen_random_uuid(), '${user.id}'::uuid, '${hash}', ${expires})`,
        );
      const hex = 'a'.repeat(64);

      await expect(insert('pas-un-hash', "now() + interval '1 day'")).rejects.toThrow(/user_invitations_token_hash_hex|check constraint/i);
      await expect(insert(hex, "now() - interval '1 day'")).rejects.toThrow(/user_invitations_expiry_after_creation|check constraint/i);
      await insert(hex, "now() + interval '1 day'");
      await expect(insert(hex, "now() + interval '2 day'")).rejects.toThrow(/user_invitations_token_hash_key|Unique constraint|unique/i);

      expect(await t.prisma.db.userInvitation.count({ where: { userId: user.id } })).toBe(1);
      await t.prisma.db.user.delete({ where: { id: user.id } });
      expect(await t.prisma.db.userInvitation.count({ where: { userId: user.id } })).toBe(0);
    });
  });

  describe('C3 — deux acceptations simultanées du même lien', () => {
    it('une seule réussit : compte activé une fois, une seule entrée d\'historique', async () => {
      const admin = await createUserWithRoles(t, [RoleCode.SuperAdmin]);
      const email = uniqueEmail('course');
      const invited = await t.get(InviteUserUseCase).execute({ email, displayName: 'Course Test', roles: [RoleCode.Support], actor: actorOf(admin.id), access: await t.get(AuthorizationService).contextFor(admin.id) });
      const token = tokenIn(lastMailTo(email)!.text);
      const accept = t.get(AcceptInvitationUseCase);

      const results = await Promise.allSettled([
        accept.execute({ token, password: 'premiere phrase de passe tres longue 1', actor: SYSTEM_ACTOR }),
        accept.execute({ token, password: 'seconde phrase de passe tres longue 2', actor: SYSTEM_ACTOR }),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(await t.prisma.db.passwordHistory.count({ where: { userId: invited.user.id } })).toBe(1);
      expect((await t.prisma.db.user.findUniqueOrThrow({ where: { id: invited.user.id } })).status).toBe('ACTIVE');
      expect((await t.prisma.db.userInvitation.findFirstOrThrow({ where: { userId: invited.user.id } })).usedAt).not.toBeNull();
    }, 60_000);
  });

  describe('C4 — la désactivation coupe tout en base', () => {
    it('toutes les sessions et tous les jetons de rafraîchissement sont révoqués', async () => {
      const admin = await createUserWithRoles(t, [RoleCode.SuperAdmin]);
      const target = await createUserWithRoles(t, [RoleCode.AccountManager]);
      for (const ip of ['10.90.0.1', '10.90.0.2', '10.90.0.3']) await api.call('POST', '/api/v1/auth/login', { body: { email: target.email, password: TEST_PASSWORD }, ip });
      expect(await t.prisma.db.userSession.count({ where: { userId: target.id, revokedAt: null } })).toBe(3);

      await t.get(SetUserStatusUseCase).execute({ userId: target.id, enabled: false, actor: actorOf(admin.id) });

      expect(await t.prisma.db.userSession.count({ where: { userId: target.id, revokedAt: null } })).toBe(0);
      expect(await t.prisma.db.refreshToken.count({ where: { session: { userId: target.id }, revokedAt: null } })).toBe(0);
      const trail = await t.prisma.db.auditLog.findMany({ where: { entityId: target.id, action: 'UPDATE' } });
      expect(trail.some((a) => (a.newValue as { sessionsRevoked?: number } | null)?.sessionsRevoked === 3)).toBe(true);
    }, 60_000);
  });

  describe('C5 — le dernier SuperAdmin (course entre deux administrateurs)', () => {
    /** Isole la base : désactive tous les autres SuperAdmin pour qu'il n'en reste que deux, A et B. */
    async function onlyTwoSuperAdmins() {
      const a = await createUserWithRoles(t, [RoleCode.SuperAdmin]);
      const b = await createUserWithRoles(t, [RoleCode.SuperAdmin]);
      await t.prisma.db.$executeRaw`
        UPDATE iam.users SET status = 'DISABLED'
        WHERE id NOT IN (${a.id}::uuid, ${b.id}::uuid)
          AND id IN (SELECT ur.user_id FROM iam.user_roles ur JOIN iam.roles r ON r.id = ur.role_id WHERE r.code = 'SUPER_ADMIN')`;
      return { a, b };
    }
    const activeSuperAdmins = () => t.prisma.db.user.count({ where: { status: 'ACTIVE', deletedAt: null, roles: { some: { role: { code: 'SUPER_ADMIN' } } } } });

    it('deux administrateurs qui se retirent le rôle SuperAdmin en même temps : l\'un des deux reste', async () => {
      const { a, b } = await onlyTwoSuperAdmins();
      const assign = t.get(AssignRolesUseCase);

      const results = await Promise.allSettled([
        assign.execute({ userId: b.id, roles: [RoleCode.Direction], actor: actorOf(a.id) }),
        assign.execute({ userId: a.id, roles: [RoleCode.Direction], actor: actorOf(b.id) }),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(await activeSuperAdmins()).toBe(1);
    }, 60_000);

    it('deux administrateurs qui se désactivent en même temps : l\'un des deux reste actif', async () => {
      const { a, b } = await onlyTwoSuperAdmins();
      const setStatus = t.get(SetUserStatusUseCase);

      const results = await Promise.allSettled([
        setStatus.execute({ userId: b.id, enabled: false, actor: actorOf(a.id) }),
        setStatus.execute({ userId: a.id, enabled: false, actor: actorOf(b.id) }),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(await activeSuperAdmins()).toBe(1);
    }, 60_000);

    it('via HTTP : retirer le rôle au dernier SuperAdmin donne 422, le compte reste SuperAdmin', async () => {
      const { a, b } = await onlyTwoSuperAdmins();
      await t.get(SetUserStatusUseCase).execute({ userId: b.id, enabled: false, actor: actorOf(a.id) });
      const other = await createUserWithRoles(t, [RoleCode.SuperAdmin]);
      await t.prisma.db.user.update({ where: { id: other.id }, data: { status: 'DISABLED' } }); // actif seulement le temps de se connecter
      await t.prisma.db.user.update({ where: { id: other.id }, data: { status: 'ACTIVE' } });
      const session = await mfaSession(t, api, other.email, '10.90.1.1');
      await t.prisma.db.user.update({ where: { id: other.id }, data: { status: 'ACTIVE' } });
      expect(await activeSuperAdmins()).toBe(2); // a et other
      const res = await api.call('PUT', `/api/v1/admin/users/${a.id}/roles`, { token: session.token, ip: '10.90.1.1', body: { roles: ['DIRECTION'] } });
      expect(res.status).toBe(200); // deux SuperAdmin actifs : autorisé
      const res2 = await api.call('POST', `/api/v1/admin/users/${a.id}/disable`, { token: session.token, ip: '10.90.1.1' });
      expect([res2.status]).toContain(200); // a n'est plus SuperAdmin : sa désactivation ne touche pas à l'invariant
      expect(await activeSuperAdmins()).toBe(1);
      const last = await api.call('PUT', `/api/v1/admin/users/${other.id}/roles`, { token: session.token, ip: '10.90.1.1', body: { roles: ['DIRECTION'] } });
      expect([last.status, last.body.title]).toEqual([403, 'FORBIDDEN']); // jamais soi-même
    }, 120_000);
  });

  describe('C6 — filtrage par propriétaire sur la vraie base', () => {
    it('une liste de propriétaires restreint ; une liste vide ne renvoie RIEN ; sans liste, tout (y compris orphelines)', async () => {
      const repo = t.get(COMPANY_REPOSITORY as never) as CompanyRepository;
      const owner = '01a0b0b0-0000-7000-8000-' + String(Date.now()).padStart(12, '0').slice(-12);
      const tag = Math.random().toString(36).slice(2, 8);
      await t.prisma.db.$executeRaw`INSERT INTO bd.companies (id, name, name_key, status, owner_user_id, updated_at) VALUES (gen_random_uuid(), ${'Possédée ' + tag}, ${'possédée ' + tag}, 'TARGET', ${owner}::uuid, now())`;
      await t.prisma.db.$executeRaw`INSERT INTO bd.companies (id, name, name_key, status, updated_at) VALUES (gen_random_uuid(), ${'Orpheline ' + tag}, ${'orpheline ' + tag}, 'TARGET', now())`;

      const mine = await repo.list({ page: 1, pageSize: 50, search: tag, ownerIds: [owner] });
      expect(mine.items.map((c) => c.name.value)).toEqual([`Possédée ${tag}`]);

      const nobody = await repo.list({ page: 1, pageSize: 50, search: tag, ownerIds: [] });
      expect(nobody.total).toBe(0);

      const everyone = await repo.list({ page: 1, pageSize: 50, search: tag });
      expect(everyone.items.map((c) => c.name.value).sort()).toEqual([`Orpheline ${tag}`, `Possédée ${tag}`]);
    });
  });
});
