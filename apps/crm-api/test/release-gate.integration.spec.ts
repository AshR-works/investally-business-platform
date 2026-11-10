import 'reflect-metadata';
import { RoleCode } from '../src/modules/iam/domain/roles';
import { KNOWN_DOMAINS, domainOfPermission } from '../src/platform/released-domains';
import { Api, createUserWithRoles, mfaSession, startRbacApp } from './support/rbac-http';
import { discoverRoutes } from './support/route-discovery';
import { TestApp } from './support/test-app';

const describeDb = process.env.DATABASE_URL && process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;

/**
 * V1 : seuls les domaines `iam` et `hr` sont publiés (RELEASED_DOMAINS). Le reste répond « introuvable » à tout le monde, même à ceux qui ont le droit,
 * même sans connexion ; le profil dit à l'interface ce qui est publié ; et toute route porte un domaine connu (une route d'un domaine inconnu serait publiée par oubli).
 */
describeDb('Publication de la V1 (HTTP + PostgreSQL)', () => {
  let t: TestApp;
  let api: Api;
  let previous: string | undefined;
  let seq = 0;
  const ip = () => `10.96.${Math.floor(seq / 250)}.${(seq++ % 250) + 1}`;

  beforeAll(async () => {
    previous = process.env.RELEASED_DOMAINS;
    process.env.RELEASED_DOMAINS = 'iam,hr';
    ({ t, api } = await startRbacApp());
  }, 60_000);
  afterAll(async () => {
    if (previous === undefined) delete process.env.RELEASED_DOMAINS;
    else process.env.RELEASED_DOMAINS = previous;
    await t.close();
  });

  const as = async (role: RoleCode) => {
    const user = await createUserWithRoles(t, [role]);
    const addr = ip();
    const session = await mfaSession(t, api, user.email, addr);
    return { token: session.token, ip: addr };
  };

  it('le profil annonce les domaines publiés à l’interface', async () => {
    const hr = await as(RoleCode.Hr);
    const profile = await api.call('GET', '/api/v1/auth/me/profile', hr);
    expect(profile.status).toBe(200);
    expect(profile.body.releasedDomains).toEqual(['iam', 'hr']);
  });

  it('un domaine publié fonctionne : annuaire RH, administration des comptes', async () => {
    const hr = await as(RoleCode.Hr);
    expect((await api.call('GET', '/api/v1/hr/directory', hr)).status).toBe(200);
    expect((await api.call('GET', '/api/v1/hr/employees', hr)).status).toBe(200);
    const admin = await as(RoleCode.SuperAdmin);
    expect((await api.call('GET', '/api/v1/admin/users', admin)).status).toBe(200);
  });

  it('un domaine non publié répond « introuvable », même à qui a le droit', async () => {
    const direction = await as(RoleCode.Direction);
    for (const path of ['/api/v1/companies', '/api/v1/contacts', '/api/v1/offers', '/api/v1/approvals', '/api/v1/commissions', '/api/v1/programs', '/api/v1/sessions', '/api/v1/enrollments', '/api/v1/learners']) {
      const res = await api.call('GET', path, direction);
      expect([path, res.status]).toEqual([path, 404]);
      expect(JSON.stringify(res.body)).toMatch(/prochaine mise à jour/);
    }
    // Écritures aussi : on ne crée rien dans un module non publié.
    const head = await as(RoleCode.HeadOfSales);
    expect((await api.call('POST', '/api/v1/companies', { ...head, body: { name: 'Société interdite', sector: 'Banque' } })).status).toBe(404);
  });

  it('un domaine non publié répond « introuvable » même sans connexion (la publication passe avant l’authentification)', async () => {
    expect((await api.call('GET', '/api/v1/companies')).status).toBe(404);
    // Une route publiée garde son comportement normal : non authentifié = 401.
    expect((await api.call('GET', '/api/v1/hr/directory')).status).toBe(401);
  });

  it('les routes sans permission (santé, connexion, profil) restent ouvertes', async () => {
    expect((await api.call('GET', '/health/live')).status).toBe(200);
    const login = await api.call('POST', '/api/v1/auth/login', { body: { email: 'inconnu@exemple.test', password: 'mauvais mot de passe long 123' }, ip: ip() });
    expect([400, 401]).toContain(login.status);
  });

  it('contrat : toute route protégée porte une permission dont le domaine est connu', () => {
    const routes = discoverRoutes(t.app).filter((route) => route.permission);
    expect(routes.length).toBeGreaterThan(50);
    const unknown = routes.filter((route) => !(KNOWN_DOMAINS as readonly string[]).includes(domainOfPermission(route.permission!)));
    expect(unknown.map((route) => `${route.key} → ${route.permission}`)).toEqual([]);
  });
});
