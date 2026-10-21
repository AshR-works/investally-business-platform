import 'reflect-metadata';
import { RoleCode } from '../src/modules/iam/domain/roles';
import { Api, createUserWithRoles, mfaSession, startRbacApp } from './support/rbac-http';
import { TestApp } from './support/test-app';

const describeDb = process.env.DATABASE_URL && process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;

describeDb('Historique des connexions et révocation des autres sessions (PostgreSQL)', () => {
  let t: TestApp;
  let api: Api;
  beforeAll(async () => ({ t, api } = await startRbacApp()), 60_000);
  afterAll(() => t.close());

  const history = (token: string, ip: string, query = '') => api.call('GET', `/api/v1/auth/sessions/history${query}`, { token, ip });

  describe('historique : toujours le MIEN', () => {
    it('contient mes connexions réussies et échouées, et aucune de celles d\'un autre utilisateur', async () => {
      const alice = await createUserWithRoles(t, [RoleCode.AccountManager]);
      const bob = await createUserWithRoles(t, [RoleCode.AccountManager]);
      for (let i = 0; i < 2; i++) await api.call('POST', '/api/v1/auth/login', { body: { email: alice.email, password: 'mauvais mot de passe' }, ip: '10.71.0.1' });
      await api.call('POST', '/api/v1/auth/login', { body: { email: bob.email, password: 'mauvais mot de passe' }, ip: '10.71.0.2' });
      await api.call('POST', '/api/v1/auth/login', { body: { email: 'inconnu@investally.test', password: 'mauvais mot de passe' }, ip: '10.71.0.3' });
      const a = await mfaSession(t, api, alice.email, '10.71.0.1');
      const b = await mfaSession(t, api, bob.email, '10.71.0.2');

      const mine = await history(a.token, '10.71.0.1');
      expect(mine.status).toBe(200);
      expect(mine.headers.get('cache-control')).toBe('no-store');
      const items = mine.body.items as { result: string; stage?: string; ipAddress: string }[];
      expect(items.filter((e) => e.result === 'FAILED')).toHaveLength(2);
      expect(items.filter((e) => e.result === 'SUCCESS').length).toBeGreaterThanOrEqual(1);
      expect(items.every((e) => e.ipAddress === '10.71.0.1')).toBe(true);
      expect(items.filter((e) => e.result === 'FAILED').every((e) => e.stage === 'PASSWORD')).toBe(true);
      expect(mine.body.windowDays).toBe(90);

      const hers = await history(b.token, '10.71.0.2');
      expect((hers.body.items as { ipAddress: string }[]).every((e) => e.ipAddress === '10.71.0.2')).toBe(true);
      expect((hers.body.items as unknown[]).length).toBe(2);
    }, 60_000);

    it('du plus récent au plus ancien, sans motif précis ni identifiant interne', async () => {
      const user = await createUserWithRoles(t, [RoleCode.Support]);
      await api.call('POST', '/api/v1/auth/login', { body: { email: user.email, password: 'mauvais mot de passe' }, ip: '10.71.1.1' });
      const s = await mfaSession(t, api, user.email, '10.71.1.1');
      const res = await history(s.token, '10.71.1.1');
      const dates = (res.body.items as { at: string }[]).map((e) => e.at);
      expect([...dates].sort().reverse()).toEqual(dates);
      expect(JSON.stringify(res.body)).not.toMatch(/BAD_PASSWORD|LOCKED|NOT_ACTIVE|UNKNOWN_USER|reason|sessionId|newValue|oldValue|userId/);
    }, 60_000);

    it('pagination par curseur : pages disjointes, dernière page sans curseur', async () => {
      const user = await createUserWithRoles(t, [RoleCode.Support]);
      for (let i = 0; i < 3; i++) await api.call('POST', '/api/v1/auth/login', { body: { email: user.email, password: 'mauvais mot de passe' }, ip: '10.71.2.1' });
      const s = await mfaSession(t, api, user.email, '10.71.2.1');
      const first = await history(s.token, '10.71.2.1', '?limit=2');
      expect(first.body.items).toHaveLength(2);
      expect(first.body.nextBefore).not.toBeNull();
      const second = await history(s.token, '10.71.2.1', `?limit=2&before=${encodeURIComponent(first.body.nextBefore)}`);
      const ids = [...first.body.items, ...second.body.items].map((e: { id: string }) => e.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(second.body.items.length).toBeGreaterThan(0);
      const all = await history(s.token, '10.71.2.1', '?limit=100');
      expect(all.body.nextBefore).toBeNull();
      expect(all.body.items).toHaveLength(4);
    }, 60_000);

    it('paramètres invalides refusés (400) ; un identifiant d\'utilisateur dans la requête est refusé, jamais obéi', async () => {
      const alice = await createUserWithRoles(t, [RoleCode.Support]);
      const bob = await createUserWithRoles(t, [RoleCode.Support]);
      const s = await mfaSession(t, api, alice.email, '10.71.3.1');
      for (const bad of ['?limit=0', '?limit=101', '?limit=abc', '?before=pas-une-date', `?userId=${bob.id}`]) {
        expect([bad, (await history(s.token, '10.71.3.1', bad)).status]).toEqual([bad, 400]);
      }
    }, 60_000);

    it('sans jeton : 401 ; avec un jeton sans second facteur : 403', async () => {
      const user = await createUserWithRoles(t, [RoleCode.Support]);
      const s = await mfaSession(t, api, user.email, '10.71.4.1');
      expect((await api.call('GET', '/api/v1/auth/sessions/history', { ip: '10.71.4.1' })).status).toBe(401);
      const res = await history(s.passwordOnlyToken, '10.71.4.1');
      expect([res.status, res.body.title]).toEqual([403, 'MFA_REQUIRED']);
    }, 60_000);
  });

  describe('révocation de mes autres sessions', () => {
    it('coupe mes autres sessions, garde la courante, ne touche personne d\'autre, et trace l\'action', async () => {
      const alice = await createUserWithRoles(t, [RoleCode.AccountManager]);
      const bob = await createUserWithRoles(t, [RoleCode.AccountManager]);
      const a1 = await mfaSession(t, api, alice.email, '10.72.0.1');
      const a2 = await mfaSession(t, api, alice.email, '10.72.0.2');
      const a3 = await mfaSession(t, api, alice.email, '10.72.0.3');
      const b1 = await mfaSession(t, api, bob.email, '10.72.0.4');

      const res = await api.call('POST', '/api/v1/auth/sessions/revoke-others', { token: a1.token, ip: '10.72.0.1' });
      expect([res.status, res.body]).toEqual([200, { revoked: 2 }]);

      expect((await api.call('GET', '/api/v1/auth/me', { token: a1.token, ip: '10.72.0.1' })).status).toBe(200);
      for (const gone of [a2, a3]) expect((await api.call('GET', '/api/v1/auth/me', { token: gone.token, ip: '10.72.0.9' })).status).toBe(401);
      expect((await api.call('GET', '/api/v1/auth/me', { token: b1.token, ip: '10.72.0.4' })).status).toBe(200);

      const row = await t.prisma.db.auditLog.findFirst({ where: { userId: alice.id, action: 'SESSION_REVOKE' }, orderBy: { createdAt: 'desc' } });
      expect(row?.newValue).toMatchObject({ event: 'other_sessions_revoked', count: 2, byOwner: true });
    }, 90_000);

    it('exige un MFA récent : un MFA de plus de 10 minutes donne un step-up et ne révoque RIEN', async () => {
      const user = await createUserWithRoles(t, [RoleCode.AccountManager]);
      const fresh = await mfaSession(t, api, user.email, '10.72.1.1');
      const stale = await mfaSession(t, api, user.email, '10.72.1.2', 11 * 60_000);
      const res = await api.call('POST', '/api/v1/auth/sessions/revoke-others', { token: stale.token, ip: '10.72.1.2' });
      expect([res.status, res.body.title]).toEqual([403, 'MFA_STEP_UP_REQUIRED']);
      expect((await api.call('GET', '/api/v1/auth/me', { token: fresh.token, ip: '10.72.1.1' })).status).toBe(200);
    }, 60_000);

    it('aucune cible dans la requête : un identifiant d\'un autre utilisateur est sans effet', async () => {
      const alice = await createUserWithRoles(t, [RoleCode.AccountManager]);
      const bob = await createUserWithRoles(t, [RoleCode.AccountManager]);
      const a = await mfaSession(t, api, alice.email, '10.72.2.1');
      const b = await mfaSession(t, api, bob.email, '10.72.2.2');
      const res = await api.call('POST', '/api/v1/auth/sessions/revoke-others', { token: a.token, ip: '10.72.2.1', body: { userId: bob.id } });
      expect([200, 400]).toContain(res.status);
      expect((await api.call('GET', '/api/v1/auth/me', { token: b.token, ip: '10.72.2.2' })).status).toBe(200);
    }, 60_000);
  });
});
