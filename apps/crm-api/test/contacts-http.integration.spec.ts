import 'reflect-metadata';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RoleCode } from '../src/modules/iam/domain/roles';
import { Api, createUserWithRoles, mfaSession, startRbacApp } from './support/rbac-http';
import { PrismaContactRepository } from '../src/modules/business-development/infrastructure/prisma-contact.repository';
import { TestApp } from './support/test-app';

const describeDb = process.env.DATABASE_URL && process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;
const NIL = '00000000-0000-7000-8000-000000000000';

/** S4.1 : contacts de bout en bout (HTTP + PostgreSQL) : droits, portée, version, doublons, audit. */
describeDb('Contacts (HTTP + PostgreSQL)', () => {
  const storageDir = mkdtempSync(join(tmpdir(), 'investally-contacts-it-'));
  let t: TestApp;
  let api: Api;
  let seq = 0;
  const ip = () => `10.93.${Math.floor(seq / 250)}.${(seq++ % 250) + 1}`;

  beforeAll(async () => {
    process.env.DOCUMENTS_DIR = storageDir;
    ({ t, api } = await startRbacApp());
  }, 60_000);
  afterAll(async () => {
    await t.close();
    rmSync(storageDir, { recursive: true, force: true });
  });

  const login = async (user: { email: string }) => {
    const addr = ip();
    const session = await mfaSession(t, api, user.email, addr);
    return { token: session.token, ip: addr, sessionId: session.sessionId as string };
  };
  const unique = () => Math.random().toString(36).slice(2, 8);

  async function team() {
    const chefUser = await createUserWithRoles(t, [RoleCode.HeadOfSales]);
    const amUser = await createUserWithRoles(t, [RoleCode.AccountManager], { managerId: chefUser.id });
    const otherUser = await createUserWithRoles(t, [RoleCode.AccountManager]);
    const supportUser = await createUserWithRoles(t, [RoleCode.Support]);
    const hrUser = await createUserWithRoles(t, [RoleCode.Hr]);
    const [chef, am, other, support, hr] = [await login(chefUser), await login(amUser), await login(otherUser), await login(supportUser), await login(hrUser)];
    const company = await api.call('POST', '/api/v1/companies', { ...am, body: { name: `Société ${unique()}` } });
    expect(company.status).toBe(201);
    return { chef, am, other, support, hr, companyId: company.body.id as string };
  }
  const payload = (companyId: string, extra: Record<string, unknown> = {}) => ({
    companyId, lastName: `Fotso${unique()}`, firstName: 'Alain', role: 'FINANCE_DIRECTOR', email: `A.Fotso.${unique()}@Atlas.CM`, phone: '+237 699 00 11 22', ...extra,
  });

  it('le chargé de compte crée, lit et modifie un contact de son entreprise ; e-mail normalisé, version qui augmente', async () => {
    const { am, companyId } = await team();
    const created = await api.call('POST', '/api/v1/contacts', { ...am, body: payload(companyId) });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ companyId, role: 'FINANCE_DIRECTOR', version: 1 });
    expect(created.body.email).toBe(created.body.email.toLowerCase());
    const read = await api.call('GET', `/api/v1/contacts/${created.body.id}`, am);
    expect(read.status).toBe(200);
    const updated = await api.call('PUT', `/api/v1/contacts/${created.body.id}`, { ...am, body: { version: 1, role: 'DECISION_MAKER', phone: '' } });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ role: 'DECISION_MAKER', phone: null, version: 2 });
  }, 90_000);

  it('verrou optimiste AU NIVEAU DE LA BASE : deux écritures simultanées sur la même version, la seconde est refusée', async () => {
    const { am, companyId } = await team();
    const created = (await api.call('POST', '/api/v1/contacts', { ...am, body: payload(companyId) })).body;
    const repository = new PrismaContactRepository(t.prisma);
    const first = (await repository.findById(created.id))!;
    const second = (await repository.findById(created.id))!;
    first.update({ role: 'OTHER' });
    await repository.save(first);
    second.update({ role: 'DECISION_MAKER' });
    await expect(repository.save(second)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect((await repository.findById(created.id))?.role).toBe('OTHER');
  }, 90_000);

  it('verrou optimiste : une version périmée est refusée (409)', async () => {
    const { am, companyId } = await team();
    const c = (await api.call('POST', '/api/v1/contacts', { ...am, body: payload(companyId) })).body;
    expect((await api.call('PUT', `/api/v1/contacts/${c.id}`, { ...am, body: { version: 1, role: 'OTHER' } })).status).toBe(200);
    expect((await api.call('PUT', `/api/v1/contacts/${c.id}`, { ...am, body: { version: 1, role: 'DECISION_MAKER' } })).status).toBe(409);
  }, 90_000);

  it('doublon dans la même entreprise : 409 ; « créer quand même » : 201 ; autre entreprise : jamais un doublon', async () => {
    const { am, companyId } = await team();
    const body = payload(companyId);
    expect((await api.call('POST', '/api/v1/contacts', { ...am, body })).status).toBe(201);
    const dup = await api.call('POST', '/api/v1/contacts', { ...am, body: { ...body, email: undefined } });
    expect(dup.status).toBe(409);
    const sameEmail = await api.call('POST', '/api/v1/contacts', { ...am, body: payload(companyId, { email: body.email }) });
    expect(sameEmail.status).toBe(409); // même e-mail, autre nom : doublon aussi
    expect((await api.call('POST', '/api/v1/contacts', { ...am, body: { ...body, allowDuplicate: true } })).status).toBe(201);
    const other = await api.call('POST', '/api/v1/companies', { ...am, body: { name: `Autre ${unique()}` } });
    expect((await api.call('POST', '/api/v1/contacts', { ...am, body: { ...body, companyId: other.body.id } })).status).toBe(201);
  }, 90_000);

  it('validations HTTP : champs obligatoires, e-mail, fonction ; champs inconnus refusés (400)', async () => {
    const { am, companyId } = await team();
    const post = async (patch: Record<string, unknown>) => (await api.call('POST', '/api/v1/contacts', { ...am, body: { ...payload(companyId), ...patch } })).status;
    expect(await post({ lastName: '' })).toBe(400);
    expect(await post({ email: 'pas-un-mail' })).toBe(400);
    expect(await post({ role: 'PATRON' })).toBe(400);
    expect(await post({ phone: 'abc' })).toBe(400);
    expect(await post({ companyId: 'pas-un-uuid' })).toBe(400);
    expect(await post({ ownerUserId: NIL })).toBe(400);
    const c = (await api.call('POST', '/api/v1/contacts', { ...am, body: payload(companyId) })).body;
    for (const forbidden of [{ companyId: NIL }, { id: NIL }, { createdAt: '2020-01-01' }]) {
      const res = await api.call('PUT', `/api/v1/contacts/${c.id}`, { ...am, body: { version: 1, ...forbidden } });
      expect([forbidden, res.status]).toEqual([forbidden, 400]);
    }
  }, 90_000);

  it("portée : l'autre chargé de compte reçoit 404 partout ; le Support lit mais ne crée pas ; le RH n'a aucun accès", async () => {
    const { am, other, support, hr, companyId } = await team();
    const c = (await api.call('POST', '/api/v1/contacts', { ...am, body: payload(companyId) })).body;
    const missing = await api.call('GET', `/api/v1/contacts/${NIL}`, other);
    const foreign = await api.call('GET', `/api/v1/contacts/${c.id}`, other);
    expect([foreign.status, foreign.body]).toEqual([missing.status, missing.body]);
    expect(foreign.status).toBe(404);
    expect((await api.call('POST', '/api/v1/contacts', { ...other, body: payload(companyId) })).status).toBe(404);
    expect((await api.call('GET', `/api/v1/contacts?companyId=${companyId}`, other)).status).toBe(404);
    expect((await api.call('GET', `/api/v1/contacts/${c.id}`, support)).status).toBe(200);
    expect((await api.call('POST', '/api/v1/contacts', { ...support, body: payload(companyId) })).status).toBe(403);
    expect((await api.call('GET', '/api/v1/contacts', hr)).status).toBe(403);
  }, 120_000);

  it("la liste ne montre à chacun que les contacts des entreprises de sa portée ; filtres et pagination", async () => {
    const { am, other, chef, support, companyId } = await team();
    const mine = payload(companyId, { lastName: `Zeta${unique()}`, role: 'DECISION_MAKER' });
    await api.call('POST', '/api/v1/contacts', { ...am, body: mine });
    await api.call('POST', '/api/v1/contacts', { ...am, body: payload(companyId) });
    const otherCompany = (await api.call('POST', '/api/v1/companies', { ...other, body: { name: `Autre ${unique()}` } })).body.id;
    const theirs = payload(otherCompany, { lastName: `Invisible${unique()}` });
    await api.call('POST', '/api/v1/contacts', { ...other, body: theirs });

    const names = async (as: object, query = '') => (await api.call('GET', `/api/v1/contacts?pageSize=100${query}`, as)).body.items.map((x: { lastName: string }) => x.lastName);
    expect(await names(am)).not.toContain(theirs.lastName);
    expect(await names(am)).toContain(mine.lastName);
    expect(await names(chef)).toContain(mine.lastName); // l'équipe du chef
    expect(await names(chef)).not.toContain(theirs.lastName);
    expect(await names(support)).toEqual(expect.arrayContaining([mine.lastName, theirs.lastName]));
    expect(await names(am, `&role=DECISION_MAKER`)).toEqual([mine.lastName]);
    expect(await names(am, `&search=${mine.lastName.slice(0, 6)}`)).toEqual([mine.lastName]);
    expect((await api.call('GET', `/api/v1/contacts?pageSize=1`, am)).body).toMatchObject({ pageSize: 1 });
    expect((await api.call('GET', '/api/v1/contacts?pageSize=5000', am)).status).toBe(400);
  }, 120_000);

  it("suppression : le chargé de compte reçoit 403, le chef d'équipe 204 ; le contact disparaît (404) et sa suppression est tracée", async () => {
    const { am, chef, other, companyId } = await team();
    const c = (await api.call('POST', '/api/v1/contacts', { ...am, body: payload(companyId) })).body;
    expect((await api.call('DELETE', `/api/v1/contacts/${c.id}`, am)).status).toBe(403);
    expect((await api.call('DELETE', `/api/v1/contacts/${c.id}`, other)).status).toBe(403);
    expect((await api.call('DELETE', `/api/v1/contacts/${c.id}`, chef)).status).toBe(204);
    expect((await api.call('GET', `/api/v1/contacts/${c.id}`, am)).status).toBe(404);
    expect(await t.prisma.db.auditLog.count({ where: { entityId: c.id, action: 'DELETE' } })).toBe(1);
    expect((await api.call('GET', `/api/v1/contacts?companyId=${companyId}`, am)).body.total).toBe(0);
  }, 120_000);

  it("audit : création et modification tracées (ancienne et nouvelle valeur), avec la session", async () => {
    const { am, companyId } = await team();
    const c = (await api.call('POST', '/api/v1/contacts', { ...am, body: payload(companyId) })).body;
    await api.call('PUT', `/api/v1/contacts/${c.id}`, { ...am, body: { version: 1, role: 'DECISION_MAKER' } });
    const logs = await t.prisma.db.auditLog.findMany({ where: { entityId: c.id }, orderBy: { createdAt: 'asc' } });
    expect(logs.map((l) => l.action)).toEqual(['CREATE', 'UPDATE']);
    expect(logs[1].sessionId).toBe(am.sessionId);
    expect(JSON.stringify(logs[1].oldValue)).toContain('FINANCE_DIRECTOR');
    expect(JSON.stringify(logs[1].newValue)).toContain('DECISION_MAKER');
  }, 90_000);

  it("une entreprise archivée n'accepte plus de contact (422) et ses contacts restent lisibles", async () => {
    const { am, companyId } = await team();
    const c = (await api.call('POST', '/api/v1/contacts', { ...am, body: payload(companyId) })).body;
    await t.prisma.db.company.update({ where: { id: companyId }, data: { status: 'ARCHIVED' } });
    const create = await api.call('POST', '/api/v1/contacts', { ...am, body: payload(companyId) });
    expect(create.status).toBe(422);
    expect((await api.call('PUT', `/api/v1/contacts/${c.id}`, { ...am, body: { version: 1, role: 'OTHER' } })).status).toBe(422);
    expect((await api.call('GET', `/api/v1/contacts/${c.id}`, am)).status).toBe(200);
  }, 90_000);
});
