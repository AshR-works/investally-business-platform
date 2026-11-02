import 'reflect-metadata';
import { RoleCode } from '../src/modules/iam/domain/roles';
import { PrismaAmbassadorRepository } from '../src/modules/business-development/infrastructure/prisma-ambassador.repository';
import { Api, createUserWithRoles, mfaSession, startRbacApp } from './support/rbac-http';
import { TestApp } from './support/test-app';

const describeDb = process.env.DATABASE_URL && process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;
const today = () => new Date().toISOString().slice(0, 10);

/** S4.4b : ambassadeurs de bout en bout (HTTP + PostgreSQL) : création manuelle, origine, droits, portée, règles de la base, audit. */
describeDb('Ambassadeurs (HTTP + PostgreSQL)', () => {
  let t: TestApp;
  let api: Api;
  let seq = 0;
  const ip = () => `10.96.${Math.floor(seq / 250)}.${(seq++ % 250) + 1}`;

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
  type As = { token: string; ip: string };

  async function team() {
    const chefUser = await createUserWithRoles(t, [RoleCode.HeadOfSales]);
    const amUser = await createUserWithRoles(t, [RoleCode.AccountManager], { managerId: chefUser.id });
    const otherUser = await createUserWithRoles(t, [RoleCode.AccountManager]);
    const otherChefUser = await createUserWithRoles(t, [RoleCode.HeadOfSales]);
    const dirUser = await createUserWithRoles(t, [RoleCode.Direction]);
    const supportUser = await createUserWithRoles(t, [RoleCode.Support]);
    const [chef, am, other, otherChef, dir, support] = [await login(chefUser), await login(amUser), await login(otherUser), await login(otherChefUser), await login(dirUser), await login(supportUser)];
    const company = await api.call('POST', '/api/v1/companies', { ...am, body: { name: `Société ${unique()}` } });
    expect(company.status).toBe(201);
    return { chef, am, other, otherChef, dir, support, amUser, companyId: company.body.id as string };
  }
  const create = (as: As, extra: Record<string, unknown> = {}) =>
    api.call('POST', '/api/v1/ambassadors', { ...as, body: { lastName: `Fotso${unique()}`, firstName: 'Alain', origin: 'LEARNER', appointedOn: today(), ...extra } });
  const update = (as: As, id: string, body: Record<string, unknown>) => api.call('PUT', `/api/v1/ambassadors/${id}`, { ...as, body });

  it('cycle : le chargé de compte crée, lit ; le Responsable commercial modifie ; versions et responsable suivent', async () => {
    const { am, chef, amUser, companyId } = await team();
    const a = await create(am, { origin: 'CLIENT', companyId, email: `Alain.${unique()}@Exemple.CM`, phone: '+237 699 00 11 22', note: 'Relais à Douala' });
    expect(a.status).toBe(201);
    expect(a.body).toMatchObject({ origin: 'CLIENT', companyId, ownerUserId: amUser.id, appointedOn: today(), version: 1 });
    expect(a.body.email).toBe(a.body.email.toLowerCase());
    expect(a.body.companyName).toContain('Société');
    expect((await api.call('GET', `/api/v1/ambassadors/${a.body.id}`, am)).body).toMatchObject({
      id: a.body.id, companyName: a.body.companyName, phone: '+237 699 00 11 22', note: 'Relais à Douala', appointedOn: today(), email: a.body.email, origin: 'CLIENT',
    });
    const edited = await update(chef, a.body.id, { version: 1, lastName: 'Ndzana', phone: '', note: 'Changé' });
    expect(edited.status).toBe(200);
    expect(edited.body).toMatchObject({ lastName: 'Ndzana', phone: null, note: 'Changé', version: 2, ownerUserId: amUser.id });
  }, 120_000);

  it('un apprenant sans entreprise est accepté ; la liste filtre par origine et par recherche, triée par nom', async () => {
    const { am } = await team();
    const z = await create(am, { lastName: `Zola${unique()}`, origin: 'LEARNER' });
    expect(z.status).toBe(201);
    expect(z.body).toMatchObject({ origin: 'LEARNER', companyId: null, companyName: null });
    const l = await api.call('GET', '/api/v1/ambassadors?origin=LEARNER&pageSize=50', am);
    expect(l.body.items.map((i: { id: string }) => i.id)).toContain(z.body.id);
    expect((await api.call('GET', `/api/v1/ambassadors?origin=CLIENT`, am)).body.items.some((i: { id: string }) => i.id === z.body.id)).toBe(false);
    expect((await api.call('GET', `/api/v1/ambassadors?search=${encodeURIComponent(z.body.lastName)}`, am)).body.total).toBe(1);
    const names = (await api.call('GET', '/api/v1/ambassadors?pageSize=100', am)).body.items.map((i: { lastName: string }) => i.lastName);
    expect(names).toEqual([...names].sort((a: string, b: string) => a.localeCompare(b)));
  }, 120_000);

  it('refus : client sans entreprise, origine inconnue ou absente, date future, identifiant mal écrit, champ inconnu (400), e-mail déjà pris et version périmée (409)', async () => {
    const { am, chef, companyId } = await team();
    expect((await create(am, { origin: 'CLIENT' })).status).toBe(400);
    expect((await create(am, { origin: 'AUTRE' })).status).toBe(400);
    expect((await api.call('POST', '/api/v1/ambassadors', { ...am, body: { lastName: 'A', firstName: 'B', appointedOn: today() } })).status).toBe(400);
    expect((await create(am, { appointedOn: '2099-01-01' })).status).toBe(400);
    expect((await create(am, { appointedOn: '03/11/2026' })).status).toBe(400);
    expect((await create(am, { companyId: 'pas-un-identifiant' })).status).toBe(400);
    expect((await create(am, { ownerUserId: '00000000-0000-4000-8000-000000000000' })).status).toBe(400);
    expect((await create(am, { email: 'pas-un-mail' })).status).toBe(400);
    const email = `unique.${unique()}@exemple.cm`;
    const a = await create(am, { email, origin: 'CLIENT', companyId });
    expect(a.status).toBe(201);
    expect((await create(am, { email: email.toUpperCase() })).status).toBe(409);
    expect((await update(chef, a.body.id, { version: 7, lastName: 'X' })).status).toBe(409);
    expect((await update(chef, a.body.id, { version: 1, origin: 'LEARNER' })).status).toBe(400);
    expect((await update(chef, a.body.id, { version: 1, companyId: null })).status).toBe(400);
  }, 180_000);

  it('portée et droits : le collègue d’une autre équipe ne voit rien ; le chef voit son équipe ; la Direction lit sans écrire ; le Support n’a aucun accès ; le chargé de compte ne modifie pas', async () => {
    const { am, chef, other, otherChef, dir, support } = await team();
    const a = await create(am);
    expect((await api.call('GET', `/api/v1/ambassadors/${a.body.id}`, other)).status).toBe(404);
    expect((await api.call('GET', `/api/v1/ambassadors/${a.body.id}`, otherChef)).status).toBe(200); // le Responsable commercial lit tous les ambassadeurs (matrice)
    expect((await api.call('GET', '/api/v1/ambassadors?pageSize=100', other)).body.items.some((i: { id: string }) => i.id === a.body.id)).toBe(false);
    expect((await api.call('GET', '/api/v1/ambassadors?pageSize=100', chef)).body.items.some((i: { id: string }) => i.id === a.body.id)).toBe(true);
    expect((await api.call('GET', `/api/v1/ambassadors/${a.body.id}`, dir)).status).toBe(200);
    expect((await create(dir)).status).toBe(403);
    expect((await update(dir, a.body.id, { version: 1, lastName: 'X' })).status).toBe(403);
    expect((await api.call('GET', '/api/v1/ambassadors', support)).status).toBe(403);
    expect((await update(am, a.body.id, { version: 1, lastName: 'X' })).status).toBe(403);
    expect((await update(otherChef, a.body.id, { version: 1, lastName: 'X' })).status).toBe(404); // hors de son équipe : introuvable
    expect((await api.call('GET', '/api/v1/ambassadors/00000000-0000-4000-8000-000000000000', am)).status).toBe(404);
  }, 120_000);

  it('l’entreprise d’un collègue est « introuvable » à la création et à la modification', async () => {
    const { am, other, chef } = await team();
    const foreign = await api.call('POST', '/api/v1/companies', { ...other, body: { name: `Société étrangère ${unique()}` } });
    expect(foreign.status).toBe(201);
    expect((await create(am, { origin: 'CLIENT', companyId: foreign.body.id })).status).toBe(404);
    expect((await create(am, { origin: 'CLIENT', companyId: '00000000-0000-4000-8000-000000000000' })).status).toBe(404);
    const a = await create(am);
    expect((await update(chef, a.body.id, { version: 1, companyId: foreign.body.id })).status).toBe(404);
  }, 120_000);

  it('règles garanties par la base : client rattaché à une entreprise, noms non vides, version positive, e-mail unique, entreprise existante', async () => {
    const { am, companyId } = await team();
    const client = await create(am, { origin: 'CLIENT', companyId, email: `base.${unique()}@exemple.cm` });
    const learner = await create(am, { email: `base2.${unique()}@exemple.cm` });
    const db = t.prisma.db;
    const sql = (q: string) => expect(db.$executeRawUnsafe(q)).rejects.toThrow();
    await sql(`UPDATE bd.ambassadors SET company_id = NULL WHERE id = '${client.body.id}'::uuid`);
    await sql(`UPDATE bd.ambassadors SET last_name = '   ' WHERE id = '${learner.body.id}'::uuid`);
    await sql(`UPDATE bd.ambassadors SET first_name = '' WHERE id = '${learner.body.id}'::uuid`);
    await sql(`UPDATE bd.ambassadors SET version = 0 WHERE id = '${learner.body.id}'::uuid`);
    await sql(`UPDATE bd.ambassadors SET email = '${client.body.email}' WHERE id = '${learner.body.id}'::uuid`);
    await sql(`UPDATE bd.ambassadors SET company_id = '${'0'.repeat(8)}-0000-4000-8000-${'0'.repeat(12)}'::uuid WHERE id = '${learner.body.id}'::uuid`);
  }, 120_000);

  it('verrou optimiste AU NIVEAU DE LA BASE : deux modifications sur la même version, la seconde est refusée', async () => {
    const { am } = await team();
    const a = await create(am);
    const repository = new PrismaAmbassadorRepository(t.prisma);
    const first = (await repository.findById(a.body.id))!;
    const second = (await repository.findById(a.body.id))!;
    first.update({ lastName: 'Première' }, new Date());
    second.update({ lastName: 'Seconde' }, new Date());
    await repository.save(first);
    await expect(repository.save(second)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect((await repository.findById(a.body.id))!.lastName).toBe('Première');
  }, 120_000);

  it('audit : création et modification tracées, ancienne et nouvelle valeur, avec la session', async () => {
    const { am, chef } = await team();
    const a = await create(am);
    await update(chef, a.body.id, { version: 1, lastName: 'Tracé' });
    const logs = await t.prisma.db.auditLog.findMany({ where: { entityId: a.body.id }, orderBy: { createdAt: 'asc' } });
    expect(logs.map((l) => l.action)).toEqual(['CREATE', 'UPDATE']);
    expect(logs[0]!.sessionId).toBe(am.sessionId);
    expect(logs[1]!.sessionId).toBe(chef.sessionId);
    expect((logs[1]!.oldValue as { lastName: string }).lastName).toBe(a.body.lastName);
    expect((logs[1]!.newValue as { lastName: string }).lastName).toBe('Tracé');
  }, 120_000);
});
