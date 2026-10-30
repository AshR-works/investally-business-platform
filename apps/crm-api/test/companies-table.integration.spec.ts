import 'reflect-metadata';
import { RoleCode } from '../src/modules/iam/domain/roles';
import { Api, createUserWithRoles, mfaSession, startRbacApp } from './support/rbac-http';
import { TestApp } from './support/test-app';

const describeDb = process.env.DATABASE_URL && process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;

/** S4.1b : tableau des entreprises (filtres, tri, synthèse) de bout en bout, HTTP + PostgreSQL. */
describeDb('Tableau des entreprises (HTTP + PostgreSQL)', () => {
  let t: TestApp;
  let api: Api;
  let seq = 0;
  const ip = () => `10.94.${Math.floor(seq / 250)}.${(seq++ % 250) + 1}`;

  beforeAll(async () => {
    ({ t, api } = await startRbacApp());
  }, 60_000);
  afterAll(async () => {
    await t.close();
  });

  const login = async (user: { email: string }) => {
    const addr = ip();
    const session = await mfaSession(t, api, user.email, addr);
    return { token: session.token, ip: addr, sessionId: session.sessionId as string };
  };
  const unique = () => Math.random().toString(36).slice(2, 8);

  /** Un chargé de compte avec trois entreprises repérables par une étiquette commune, et un collègue qui n'en voit aucune. */
  async function world() {
    const amUser = await createUserWithRoles(t, [RoleCode.AccountManager]);
    const otherUser = await createUserWithRoles(t, [RoleCode.AccountManager]);
    const am = await login(amUser);
    const other = await login(otherUser);
    const tag = unique();
    const country = `Pays${unique()}`;
    const create = async (name: string, extra: Record<string, unknown>, as = am) => {
      const r = await api.call('POST', '/api/v1/companies', { ...as, body: { name: `${name} ${tag}`, ...extra } });
      expect(r.status).toBe(201);
      return r.body.id as string;
    };
    await create('Beta', { country, sector: 'Banque' });
    await create('Alpha', { country, sector: 'Assurance' });
    await create('Gamma', {});
    const foreign = await create('Delta', { country: `Etranger${unique()}`, sector: `Secteur${unique()}` }, other);
    return { am, other, tag, country, foreign };
  }
  const list = (as: { token: string; ip: string }, query: string) => api.call('GET', `/api/v1/companies?${query}`, as);
  const names = (body: { items: { name: string }[] }) => body.items.map((c) => c.name.split(' ')[0]);

  it('filtre par pays et par secteur (sans tenir compte de la casse), total cohérent avec les filtres', async () => {
    const { am, tag, country } = await world();
    const byCountry = await list(am, `search=${tag}&country=${country.toUpperCase()}`);
    expect(byCountry.status).toBe(200);
    expect(byCountry.body.total).toBe(2);
    const bySector = await list(am, `search=${tag}&sector=banque`);
    expect(names(bySector.body)).toEqual(['Beta']);
    expect(bySector.body.total).toBe(1);
    expect((await list(am, `search=${tag}&country=${country}&sector=Inconnu`)).body.total).toBe(0);
  }, 90_000);

  it('filtre par statut et refuse un statut inconnu', async () => {
    const { am, tag } = await world();
    expect((await list(am, `search=${tag}&status=TARGET`)).body.total).toBe(3);
    expect((await list(am, `search=${tag}&status=CLIENT`)).body.total).toBe(0);
    expect((await list(am, `search=${tag}&status=PIRATE`)).status).toBe(400);
  }, 90_000);

  it('trie par nom dans les deux sens ; les valeurs absentes (pays) passent toujours en dernier', async () => {
    const { am, tag } = await world();
    expect(names((await list(am, `search=${tag}&sort=name&direction=asc`)).body)).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(names((await list(am, `search=${tag}&sort=name&direction=desc`)).body)).toEqual(['Gamma', 'Beta', 'Alpha']);
    expect(names((await list(am, `search=${tag}&sort=country&direction=asc`)).body).at(-1)).toBe('Gamma');
    expect(names((await list(am, `search=${tag}&sort=country&direction=desc`)).body).at(-1)).toBe('Gamma');
    expect(names((await list(am, `search=${tag}&sort=sector&direction=asc`)).body)).toEqual(['Alpha', 'Beta', 'Gamma']);
  }, 90_000);

  it('refuse un champ de tri inconnu (aucune injection par le nom de colonne) et un sens inconnu', async () => {
    const { am } = await world();
    expect((await list(am, 'sort=passwordHash')).status).toBe(400);
    expect((await list(am, 'sort=name;drop')).status).toBe(400);
    expect((await list(am, 'direction=sideways')).status).toBe(400);
  }, 90_000);

  it('la pagination garde le tri et les filtres (page 2 = suite de la page 1)', async () => {
    const { am, tag } = await world();
    const first = await list(am, `search=${tag}&sort=name&direction=asc&pageSize=2&page=1`);
    const second = await list(am, `search=${tag}&sort=name&direction=asc&pageSize=2&page=2`);
    expect(names(first.body)).toEqual(['Alpha', 'Beta']);
    expect(names(second.body)).toEqual(['Gamma']);
    expect(second.body.total).toBe(3);
  }, 90_000);

  it("la synthèse compte par statut selon recherche, pays et secteur, et liste les valeurs de filtre de la portée", async () => {
    const { am, tag, country } = await world();
    const all = await api.call('GET', `/api/v1/companies/overview?search=${tag}`, am);
    expect(all.status).toBe(200);
    expect(all.body.statusCounts).toEqual({ TARGET: 3, CONTACTED: 0, QUALIFIED: 0, CLIENT: 0, ARCHIVED: 0 });
    expect(all.body.countries).toContain(country);
    expect(all.body.sectors).toEqual(expect.arrayContaining(['Banque', 'Assurance']));
    const filtered = await api.call('GET', `/api/v1/companies/overview?search=${tag}&sector=Banque`, am);
    expect(filtered.body.statusCounts.TARGET).toBe(1);
    expect(filtered.body.sectors).toEqual(expect.arrayContaining(['Banque', 'Assurance']));
  }, 90_000);

  it("la synthèse ne fuit rien hors portée : ni le pays ni le secteur ni les effectifs du collègue", async () => {
    const { am, other, tag, foreign } = await world();
    const mine = await api.call('GET', `/api/v1/companies/overview?search=${tag}`, am);
    const theirs = await api.call('GET', `/api/v1/companies/overview?search=${tag}`, other);
    expect(mine.body.statusCounts.TARGET).toBe(3);
    expect(theirs.body.statusCounts.TARGET).toBe(1);
    const foreignCompany = await api.call('GET', `/api/v1/companies/${foreign}`, other);
    expect(mine.body.countries).not.toContain(foreignCompany.body.country);
    expect(mine.body.sectors).not.toContain(foreignCompany.body.sector);
    expect(theirs.body.countries).toContain(foreignCompany.body.country);
  }, 90_000);

  it('la synthèse exige le droit de lecture des entreprises', async () => {
    const anon = await api.call('GET', '/api/v1/companies/overview', { token: 'nope', ip: ip() });
    expect(anon.status).toBe(401);
    const hrUser = await createUserWithRoles(t, [RoleCode.Hr]);
    const hr = await login(hrUser);
    const denied = await api.call('GET', '/api/v1/companies/overview', hr);
    expect([403, 404]).toContain(denied.status);
  }, 90_000);
});
