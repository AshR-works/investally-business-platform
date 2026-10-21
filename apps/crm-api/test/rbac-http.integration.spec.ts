import 'reflect-metadata';
import { RoleCode, ROLES, resolveGrants } from '../src/modules/iam/domain/roles';
import { Api, createUserWithRoles, mfaSession, startRbacApp } from './support/rbac-http';
import { TestApp, uniqueEmail } from './support/test-app';

const describeDb = process.env.DATABASE_URL && process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;
const NIL = '00000000-0000-7000-8000-000000000000';

interface RouteSpec { method: string; path: string; permission: string; body?: () => unknown; stepUp?: boolean; minScope?: 'ALL' }

/**
 * Les routes protégées et la permission qu'elles exigent. La PERMISSION attendue est écrite ici ; QUI doit passer ne l'est
 * JAMAIS à la main : c'est calculé depuis la matrice de rôles du code (`ROLE_GRANTS`), la même que celle qui est
 * semée en base. Un écart entre la matrice et le comportement HTTP fait échouer le test.
 */
const ROUTES: RouteSpec[] = [
  { method: 'GET', path: '/api/v1/admin/users', permission: 'iam.user.read' },
  { method: 'GET', path: `/api/v1/admin/users/${NIL}`, permission: 'iam.user.read' },
  { method: 'POST', path: '/api/v1/admin/users', permission: 'iam.user.create', stepUp: true, body: () => ({}) },
  { method: 'POST', path: `/api/v1/admin/users/${NIL}/invitations`, permission: 'iam.user.create' },
  { method: 'PATCH', path: `/api/v1/admin/users/${NIL}`, permission: 'iam.user.update', body: () => ({ displayName: 'Nouveau nom' }) },
  { method: 'POST', path: `/api/v1/admin/users/${NIL}/disable`, permission: 'iam.user.disable', stepUp: true },
  { method: 'POST', path: `/api/v1/admin/users/${NIL}/enable`, permission: 'iam.user.disable', stepUp: true },
  { method: 'PUT', path: `/api/v1/admin/users/${NIL}/roles`, permission: 'iam.user.assign_role', stepUp: true, body: () => ({ roles: ['SUPPORT'] }) },
  { method: 'POST', path: `/api/v1/admin/users/${NIL}/mfa/reset`, permission: 'iam.user.reset_mfa', stepUp: true },
  { method: 'POST', path: `/api/v1/admin/users/${NIL}/sessions/revoke`, permission: 'iam.session.revoke', stepUp: true, minScope: 'ALL' },
  { method: 'GET', path: '/api/v1/admin/roles', permission: 'iam.role.read' },
  { method: 'GET', path: '/api/v1/auth/sessions', permission: 'iam.session.read' },
  { method: 'GET', path: '/api/v1/auth/sessions/history', permission: 'iam.session.read' },
  { method: 'POST', path: '/api/v1/auth/sessions/revoke-others', permission: 'iam.session.revoke', stepUp: true },
  { method: 'DELETE', path: `/api/v1/auth/sessions/${NIL}`, permission: 'iam.session.revoke' },
  { method: 'POST', path: '/api/v1/companies', permission: 'bd.company.create', body: () => ({ name: `Société ${Math.random().toString(36).slice(2)}` }) },
  { method: 'GET', path: '/api/v1/companies', permission: 'bd.company.read' },
  { method: 'GET', path: `/api/v1/companies/${NIL}`, permission: 'bd.company.read' },
];

describeDb('Autorisation HTTP (PostgreSQL)', () => {
  let t: TestApp;
  let api: Api;
  beforeAll(async () => ({ t, api } = await startRbacApp()), 60_000);
  afterAll(() => t.close());

  const call = (route: RouteSpec, token?: string, ip?: string) =>
    api.call(route.method, route.path, { token, ip, body: route.body?.() });

  describe('D1 — chaque rôle × chaque route protégée, selon la matrice du code', () => {
    it.each(ROLES.map((r) => r.code))('%s', async (role) => {
      const index = ROLES.findIndex((r) => r.code === role);
      const ip = `10.20.${index}.1`;
      const user = await createUserWithRoles(t, [role]);
      const session = await mfaSession(t, api, user.email, ip);
      const grants = resolveGrants(role);
      /** Autorisé = permission détenue ET, si la route l'exige, portée « Tous ». Lu depuis la matrice du code. */
      const allowedFor = (route: RouteSpec) => grants.some((g) => g.permission === route.permission && (route.minScope !== 'ALL' || g.scope === 'ALL'));

      const wrong: string[] = [];
      let denied = 0;
      for (const route of ROUTES) {
        const res = await call(route, session.token, ip);
        const expectedAllowed = allowedFor(route);
        if (expectedAllowed) {
          // Autorisé : peut échouer ailleurs (404 sur un identifiant inexistant, 400 sur un corps volontairement vide…), jamais 401/403.
          if (res.status === 401 || res.status === 403) wrong.push(`${role} devrait pouvoir ${route.method} ${route.path} mais a reçu ${res.status}`);
        } else {
          denied += 1;
          if (res.status !== 403 || res.body?.title !== 'FORBIDDEN') wrong.push(`${role} ne devrait PAS pouvoir ${route.method} ${route.path} mais a reçu ${res.status}`);
        }
      }
      expect(wrong).toEqual([]);

      // D10 — chaque refus a laissé une ligne d'audit ACCESS_DENIED au nom de cet utilisateur
      const audited = await t.prisma.db.auditLog.count({ where: { userId: user.id, action: 'ACCESS_DENIED' } });
      expect(audited).toBe(denied);
    }, 120_000);

    it('la matrice n\'est pas vide : chaque route a au moins un rôle autorisé, et la plupart refusent au moins un rôle (le test ne passe pas à vide)', () => {
      const holdersOf = (route: RouteSpec) =>
        ROLES.filter((r) => resolveGrants(r.code).some((g) => g.permission === route.permission && (route.minScope !== 'ALL' || g.scope === 'ALL')));
      for (const route of ROUTES) expect(holdersOf(route).length).toBeGreaterThan(0);
      // Seules les quatre routes « mes propres sessions » (liste, historique, révocation d'une, révocation des autres) sont ouvertes à tous les rôles ; toutes les autres en refusent au moins un.
      const restricted = ROUTES.filter((route) => holdersOf(route).length < ROLES.length);
      expect(restricted.length).toBeGreaterThanOrEqual(ROUTES.length - 4);
    });
  });

  describe('D2 — authentification, MFA et step-up', () => {
    it('sans jeton : 401 sur TOUTES les routes protégées', async () => {
      const failures: string[] = [];
      for (const route of ROUTES) {
        const res = await call(route, undefined, '10.30.0.1');
        if (res.status !== 401) failures.push(`${route.method} ${route.path} : ${res.status}`);
      }
      expect(failures).toEqual([]);
    });

    it('jeton « mot de passe seul » (MFA non vérifié) : MFA_REQUIRED sur TOUTES les routes protégées, même pour un SuperAdmin', async () => {
      const admin = await createUserWithRoles(t, [RoleCode.SuperAdmin]);
      const session = await mfaSession(t, api, admin.email, '10.30.0.2');
      const failures: string[] = [];
      for (const route of ROUTES) {
        const res = await call(route, session.passwordOnlyToken, '10.30.0.2');
        if (res.status !== 403 || res.body?.title !== 'MFA_REQUIRED') failures.push(`${route.method} ${route.path} : ${res.status} ${res.body?.title}`);
      }
      expect(failures).toEqual([]);
    });

    it('MFA vérifié il y a plus de 10 minutes : les actions sensibles exigent un step-up, les autres passent', async () => {
      const admin = await createUserWithRoles(t, [RoleCode.SuperAdmin]);
      const stale = await mfaSession(t, api, admin.email, '10.30.0.3', 11 * 60_000);
      for (const route of ROUTES.filter((r) => r.stepUp)) {
        const res = await call(route, stale.token, '10.30.0.3');
        expect([res.status, res.body?.title]).toEqual([403, 'MFA_STEP_UP_REQUIRED']);
      }
      for (const route of ROUTES.filter((r) => !r.stepUp)) {
        expect([401, 403]).not.toContain((await call(route, stale.token, '10.30.0.3')).status);
      }
    }, 60_000);

    it('la permission est vérifiée AVANT le step-up : un rôle sans droit reçoit un refus net, pas une invitation à ressaisir un code', async () => {
      const am = await createUserWithRoles(t, [RoleCode.AccountManager]);
      const stale = await mfaSession(t, api, am.email, '10.30.0.4', 11 * 60_000);
      const res = await api.call('PUT', `/api/v1/admin/users/${NIL}/roles`, { token: stale.token, ip: '10.30.0.4', body: { roles: ['SUPPORT'] } });
      expect([res.status, res.body.title]).toEqual([403, 'FORBIDDEN']);
    });

    it('un jeton falsifié, expiré ou d\'un autre utilisateur ne donne aucun accès', async () => {
      const user = await createUserWithRoles(t, [RoleCode.Direction]);
      const session = await mfaSession(t, api, user.email, '10.30.0.5');
      const [h, p, s] = session.token.split('.');
      const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p, 'base64url').toString()), sub: NIL })).toString('base64url');
      for (const token of [`${h}.${forged}.${s}`, `${h}.${p}.`, 'a.b.c']) {
        expect((await api.call('GET', '/api/v1/companies', { token, ip: '10.30.0.5' })).status).toBe(401);
      }
    });
  });

  describe('D3 — IDOR et portée sur les entreprises', () => {
    async function team() {
      const hos = await createUserWithRoles(t, [RoleCode.HeadOfSales], { name: 'Hélène Ossa' });
      const am1 = await createUserWithRoles(t, [RoleCode.AccountManager], { managerId: hos.id, name: 'Alice Ngo' });
      const am2 = await createUserWithRoles(t, [RoleCode.AccountManager], { managerId: hos.id, name: 'Bruno Eto' });
      const intern = await createUserWithRoles(t, [RoleCode.AccountManager], { managerId: am1.id, name: 'Carla Mbo' });
      const direction = await createUserWithRoles(t, [RoleCode.Direction]);
      const trainer = await createUserWithRoles(t, [RoleCode.Trainer]);
      const s = {
        hos: await mfaSession(t, api, hos.email, '10.40.0.1'), am1: await mfaSession(t, api, am1.email, '10.40.0.2'),
        am2: await mfaSession(t, api, am2.email, '10.40.0.3'), intern: await mfaSession(t, api, intern.email, '10.40.0.4'),
        direction: await mfaSession(t, api, direction.email, '10.40.0.5'), trainer: await mfaSession(t, api, trainer.email, '10.40.0.6'),
      };
      const ip = { hos: '10.40.0.1', am1: '10.40.0.2', am2: '10.40.0.3', intern: '10.40.0.4', direction: '10.40.0.5', trainer: '10.40.0.6' };
      const create = async (who: keyof typeof s, name: string) => (await api.call('POST', '/api/v1/companies', { token: s[who].token, ip: ip[who], body: { name } })).body.id as string;
      const tag = Math.random().toString(36).slice(2, 8);
      const ids = {
        hos: await create('hos', `HOS ${tag}`), am1: await create('am1', `AM1 ${tag}`), am2: await create('am2', `AM2 ${tag}`), intern: await create('intern', `INTERN ${tag}`),
      };
      const legacyId = '01a0a0a0-0000-7000-8000-' + String(Date.now()).padStart(12, '0').slice(-12);
      await t.prisma.db.$executeRaw`INSERT INTO bd.companies (id, name, name_key, status, updated_at) VALUES (${legacyId}::uuid, ${'LEGACY ' + tag}, ${'legacy ' + tag}, 'TARGET', now())`;
      const list = async (who: keyof typeof s) => ((await api.call('GET', `/api/v1/companies?search=${tag}&pageSize=100`, { token: s[who].token, ip: ip[who] })).body.items as { id: string }[]).map((c) => c.id).sort();
      const get = (who: keyof typeof s, id: string) => api.call('GET', `/api/v1/companies/${id}`, { token: s[who].token, ip: ip[who] });
      return { ids: { ...ids, legacy: legacyId }, list, get, s, ip, owners: { hos: hos.id, am1: am1.id, am2: am2.id, intern: intern.id }, tag };
    }

    it('la création attribue le propriétaire à l\'acteur, jamais à une valeur envoyée par le client (mass assignment)', async () => {
      const k = await team();
      const created = await api.call('POST', '/api/v1/companies', { token: k.s.am1.token, ip: k.ip.am1, body: { name: `Auto ${k.tag}`, ownerUserId: k.owners.hos } });
      expect(created.status).toBe(400); // champ inconnu refusé

      const ok = await api.call('POST', '/api/v1/companies', { token: k.s.am1.token, ip: k.ip.am1, body: { name: `Propre ${k.tag}` } });
      expect(ok.status).toBe(201);
      expect(ok.body.ownerUserId).toBe(k.owners.am1);
    }, 120_000);

    it('chacun ne voit que sa portée : Propre, Équipe (directs seulement), Tous', async () => {
      const k = await team();
      expect(await k.list('am1')).toEqual([k.ids.am1]);
      expect(await k.list('am2')).toEqual([k.ids.am2]);
      expect(await k.list('hos')).toEqual([k.ids.hos, k.ids.am1, k.ids.am2].sort());
      expect(await k.list('hos')).not.toContain(k.ids.intern); // petit-enfant : hors portée Équipe
      expect(await k.list('hos')).not.toContain(k.ids.legacy);
      expect(await k.list('direction')).toEqual([k.ids.hos, k.ids.am1, k.ids.am2, k.ids.intern, k.ids.legacy].sort());
    }, 120_000);

    it('IDOR : l\'entreprise d\'un collègue, d\'un petit-enfant ou orpheline donne 404, indiscernable d\'un identifiant inexistant', async () => {
      const k = await team();
      const outOfScope = [
        await k.get('am1', k.ids.am2), await k.get('am1', k.ids.hos), await k.get('hos', k.ids.intern),
        await k.get('am1', k.ids.legacy), await k.get('hos', k.ids.legacy),
      ];
      const missing = await k.get('am1', NIL);
      for (const res of outOfScope) {
        expect(res.status).toBe(404);
        expect(res.body).toEqual(missing.body);
      }
      expect((await k.get('am1', k.ids.am1)).status).toBe(200);
      expect((await k.get('hos', k.ids.am2)).status).toBe(200);
      expect((await k.get('direction', k.ids.legacy)).status).toBe(200);
    }, 120_000);

    it('le formateur (sans permission) reçoit 403 et non une liste vide trompeuse', async () => {
      const k = await team();
      expect((await api.call('GET', '/api/v1/companies', { token: k.s.trainer.token, ip: k.ip.trainer })).status).toBe(403);
    }, 120_000);
  });

  describe('D5, D6 — effet immédiat des changements de droits', () => {
    it('désactiver un compte : son jeton d\'accès, son cookie de rafraîchissement et sa connexion sont refusés aussitôt', async () => {
      const admin = await createUserWithRoles(t, [RoleCode.SuperAdmin]);
      const target = await createUserWithRoles(t, [RoleCode.AccountManager]);
      const adminSession = await mfaSession(t, api, admin.email, '10.50.0.1');
      const loginRes = await api.call('POST', '/api/v1/auth/login', { body: { email: target.email, password: 'phrase de passe tres longue 42' }, ip: '10.50.0.2' });
      const cookie = loginRes.headers.getSetCookie().find((c) => c.startsWith('crm_refresh='))!.split(';')[0];
      const targetSession = await mfaSession(t, api, target.email, '10.50.0.2');
      expect((await api.call('GET', '/api/v1/companies', { token: targetSession.token, ip: '10.50.0.2' })).status).toBe(200);

      const disabled = await api.call('POST', `/api/v1/admin/users/${target.id}/disable`, { token: adminSession.token, ip: '10.50.0.1' });
      expect([disabled.status, disabled.body.status]).toEqual([200, 'DISABLED']);

      expect((await api.call('GET', '/api/v1/companies', { token: targetSession.token, ip: '10.50.0.2' })).status).toBe(401);
      expect((await api.call('POST', '/api/v1/auth/refresh', { cookie, ip: '10.50.0.2' })).status).toBe(401);
      expect((await api.call('POST', '/api/v1/auth/login', { body: { email: target.email, password: 'phrase de passe tres longue 42' }, ip: '10.50.0.2' })).status).toBe(401);
      expect(await t.prisma.db.userSession.count({ where: { userId: target.id, revokedAt: null } })).toBe(0);
    }, 120_000);

    it('changer un rôle : effet immédiat sur le jeton DÉJÀ émis (les droits sont relus à chaque requête)', async () => {
      const admin = await createUserWithRoles(t, [RoleCode.SuperAdmin]);
      const target = await createUserWithRoles(t, [RoleCode.AccountManager]);
      const adminSession = await mfaSession(t, api, admin.email, '10.50.1.1');
      const targetSession = await mfaSession(t, api, target.email, '10.50.1.2');
      const create = () => api.call('POST', '/api/v1/companies', { token: targetSession.token, ip: '10.50.1.2', body: { name: `Société ${Math.random().toString(36).slice(2)}` } });
      expect((await create()).status).toBe(201);

      const changed = await api.call('PUT', `/api/v1/admin/users/${target.id}/roles`, { token: adminSession.token, ip: '10.50.1.1', body: { roles: ['SUPPORT'] } });
      expect([changed.status, changed.body.roles]).toEqual([200, ['SUPPORT']]);

      expect((await create()).status).toBe(403); // même jeton, droits retirés immédiatement
      const trail = await t.prisma.db.auditLog.findMany({ where: { entityId: target.id, action: 'ROLE_CHANGE' } });
      expect(trail).toHaveLength(1);
      expect(trail[0].newValue).toMatchObject({ added: ['SUPPORT'], removed: ['ACCOUNT_MANAGER'] });
    }, 120_000);

    it('interdit de modifier ses propres rôles et de désactiver son propre compte, même pour un SuperAdmin', async () => {
      const admin = await createUserWithRoles(t, [RoleCode.SuperAdmin]);
      const session = await mfaSession(t, api, admin.email, '10.50.2.1');
      const own = await api.call('PUT', `/api/v1/admin/users/${admin.id}/roles`, { token: session.token, ip: '10.50.2.1', body: { roles: ['SUPER_ADMIN', 'DIRECTION'] } });
      expect([own.status, own.body.title]).toEqual([403, 'FORBIDDEN']);
      const off = await api.call('POST', `/api/v1/admin/users/${admin.id}/disable`, { token: session.token, ip: '10.50.2.1' });
      expect([off.status, off.body.title]).toEqual([403, 'FORBIDDEN']);
      const reset = await api.call('POST', `/api/v1/admin/users/${admin.id}/mfa/reset`, { token: session.token, ip: '10.50.2.1' });
      expect([reset.status, reset.body.title]).toEqual([403, 'FORBIDDEN']);
    }, 60_000);
  });

  describe('D7, D8 — fuites et pagination', () => {
    it('aucune réponse n\'expose hachage, secret, jeton ni compteur interne', async () => {
      const admin = await createUserWithRoles(t, [RoleCode.SuperAdmin]);
      const session = await mfaSession(t, api, admin.email, '10.60.0.1');
      const responses = [
        await api.call('GET', '/api/v1/admin/users?pageSize=100', { token: session.token, ip: '10.60.0.1' }),
        await api.call('GET', `/api/v1/admin/users/${admin.id}`, { token: session.token, ip: '10.60.0.1' }),
        await api.call('GET', '/api/v1/admin/roles', { token: session.token, ip: '10.60.0.1' }),
        await api.call('GET', '/api/v1/auth/sessions', { token: session.token, ip: '10.60.0.1' }),
        await api.call('GET', '/api/v1/auth/me', { token: session.token, ip: '10.60.0.1' }),
      ];
      for (const res of responses) expect(res.status).toBe(200);
      const everything = JSON.stringify(responses.map((r) => r.body));
      expect(everything).not.toMatch(/argon2|passwordHash|password_hash|mfaSecret|mfa_secret|tokenHash|token_hash|failedLoginCount|refresh/i);
      expect(responses[0].headers.get('cache-control')).toBe('no-store');
    }, 60_000);

    it('pagination bornée : taille > 100, page < 1, recherche démesurée, statut invalide → 400 ; valeurs valides acceptées', async () => {
      const admin = await createUserWithRoles(t, [RoleCode.SuperAdmin]);
      const session = await mfaSession(t, api, admin.email, '10.60.0.2');
      const list = (query: string) => api.call('GET', `/api/v1/admin/users?${query}`, { token: session.token, ip: '10.60.0.2' });
      for (const bad of ['pageSize=1000', 'pageSize=0', 'page=0', 'page=abc', `search=${'x'.repeat(101)}`, 'status=ROOT']) expect((await list(bad)).status).toBe(400);
      const ok = await list('page=1&pageSize=100&status=ACTIVE&search=a');
      expect(ok.status).toBe(200);
      expect(ok.body.items.length).toBeLessThanOrEqual(100);
      expect((await api.call('GET', '/api/v1/companies?pageSize=1000', { token: session.token, ip: '10.60.0.2' })).status).toBe(400);
    }, 60_000);

    it('la recherche traite les caractères spéciaux comme du texte (aucune injection)', async () => {
      const admin = await createUserWithRoles(t, [RoleCode.SuperAdmin]);
      const session = await mfaSession(t, api, admin.email, '10.60.0.3');
      for (const search of ["' OR 1=1; DROP TABLE iam.users; --", '%', '_', '\\', '"; --']) {
        const res = await api.call('GET', `/api/v1/admin/users?search=${encodeURIComponent(search)}`, { token: session.token, ip: '10.60.0.3' });
        expect(res.status).toBe(200);
      }
      expect(await t.prisma.db.user.count()).toBeGreaterThan(0); // la table existe toujours
    }, 60_000);
  });

  describe('D9 — contrôle d\'origine (CSRF) sur toutes les routes d\'écriture', () => {
    it('une origine inconnue est refusée (403) sur toute route qui MODIFIE, même sans jeton ; la lecture n\'est pas concernée', async () => {
      const writes = ROUTES.filter((r) => r.method !== 'GET');
      for (const route of writes) {
        const res = await api.call(route.method, route.path, { headers: { origin: 'https://evil.test' }, body: route.body?.(), ip: '10.70.0.1' });
        expect([route.method, route.path, res.status, res.body?.title]).toEqual([route.method, route.path, 403, 'FORBIDDEN']);
      }
      const read = await api.call('GET', '/health/live', { headers: { origin: 'https://evil.test' } });
      expect(read.status).toBe(200);
    }, 60_000);

    it('l\'origine autorisée et l\'absence d\'origine (client non navigateur) sont acceptées', async () => {
      const user = await createUserWithRoles(t, [RoleCode.AccountManager]);
      const session = await mfaSession(t, api, user.email, '10.70.0.2');
      const body = () => ({ name: `Société ${Math.random().toString(36).slice(2)}` });
      expect((await api.call('POST', '/api/v1/companies', { token: session.token, ip: '10.70.0.2', body: body(), headers: { origin: 'http://127.0.0.1:3000' } })).status).toBe(201);
      expect((await api.call('POST', '/api/v1/companies', { token: session.token, ip: '10.70.0.2', body: body() })).status).toBe(201);
    }, 60_000);
  });

  it('les e-mails de ce fichier n\'entrent pas en collision (adresses uniques)', () => {
    expect(uniqueEmail('a')).not.toBe(uniqueEmail('a'));
  });
});
