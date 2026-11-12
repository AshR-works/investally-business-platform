import 'reflect-metadata';
import { RoleCode } from '../src/modules/iam/domain/roles';
import { Api, createUserWithRoles, mfaSession, startRbacApp } from './support/rbac-http';
import { TestApp } from './support/test-app';

const describeDb = process.env.DATABASE_URL && process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;

/** S4.3b : statuts d'entreprise (CU-C-05) et réattribution du propriétaire (D17) de bout en bout (HTTP + PostgreSQL). */
describeDb('Statuts et propriétaire d’une entreprise (HTTP + PostgreSQL)', () => {
  let t: TestApp;
  let api: Api;
  let seq = 0;
  const ip = () => `10.98.${Math.floor(seq / 250)}.${(seq++ % 250) + 1}`;

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

  async function team() {
    const chefUser = await createUserWithRoles(t, [RoleCode.HeadOfSales], { name: 'Chef Équipe' });
    const marieUser = await createUserWithRoles(t, [RoleCode.AccountManager], { managerId: chefUser.id, name: 'Marie Ngo' });
    const anneUser = await createUserWithRoles(t, [RoleCode.AccountManager], { managerId: chefUser.id, name: 'Anne Bello' });
    const paulUser = await createUserWithRoles(t, [RoleCode.AccountManager], { name: 'Paul Etoga' });
    const dirUser = await createUserWithRoles(t, [RoleCode.Direction]);
    const [chef, marie, anne, paul, dir] = [await login(chefUser), await login(marieUser), await login(anneUser), await login(paulUser), await login(dirUser)];
    const company = await api.call('POST', '/api/v1/companies', { ...marie, body: { name: `Société ${unique()}` } });
    expect(company.status).toBe(201);
    return { chef, marie, anne, paul, dir, ids: { chef: chefUser.id, marie: marieUser.id, anne: anneUser.id, paul: paulUser.id }, companyId: company.body.id as string };
  }
  type As = { token: string; ip: string };
  const setStatus = (as: As, id: string, version: number, status: string) => api.call('POST', `/api/v1/companies/${id}/status`, { ...as, body: { version, status } });
  const reassign = (as: As, id: string, version: number, ownerUserId: string) => api.call('POST', `/api/v1/companies/${id}/owner`, { ...as, body: { version, ownerUserId } });
  const addContact = (as: As, companyId: string) =>
    api.call('POST', '/api/v1/contacts', { ...as, body: { companyId, lastName: `Contact${unique()}`, firstName: 'Awa', email: `awa.${unique()}@exemple.cm` } });

  it('statut : Cible → Contactée → Qualifiée (avec un contact) → retour d’un cran ; la version suit', async () => {
    const { marie, companyId } = await team();
    const contacted = await setStatus(marie, companyId, 1, 'CONTACTED');
    expect(contacted.status).toBe(200);
    expect(contacted.body).toMatchObject({ status: 'CONTACTED', version: 2 });
    expect((await setStatus(marie, companyId, 2, 'QUALIFIED')).status).toBe(422); // aucun contact
    expect((await addContact(marie, companyId)).status).toBe(201);
    const qualified = await setStatus(marie, companyId, 2, 'QUALIFIED');
    expect(qualified.status).toBe(200);
    expect(qualified.body).toMatchObject({ status: 'QUALIFIED', version: 3 });
    const back = await setStatus(marie, companyId, 3, 'CONTACTED');
    expect(back.body).toMatchObject({ status: 'CONTACTED', version: 4 });
  }, 120_000);

  it('refus : saut d’étape (422), même statut (422), « Cliente » ou « Archivée » à la main (400), version périmée (409), corps inconnu (400)', async () => {
    const { marie, companyId } = await team();
    expect((await setStatus(marie, companyId, 1, 'QUALIFIED')).status).toBe(422);
    expect((await setStatus(marie, companyId, 1, 'TARGET')).status).toBe(422);
    expect((await setStatus(marie, companyId, 1, 'CLIENT')).status).toBe(400);
    expect((await setStatus(marie, companyId, 1, 'ARCHIVED')).status).toBe(400);
    expect((await setStatus(marie, companyId, 7, 'CONTACTED')).status).toBe(409);
    expect((await api.call('POST', `/api/v1/companies/${companyId}/status`, { ...marie, body: { version: 1, status: 'CONTACTED', ownerUserId: 'x' } })).status).toBe(400);
    const read = await api.call('GET', `/api/v1/companies/${companyId}`, marie);
    expect(read.body).toMatchObject({ status: 'TARGET', version: 1 });
  }, 120_000);

  it('la fiche et la liste nomment le responsable', async () => {
    const { marie, chef, companyId } = await team();
    expect((await api.call('GET', `/api/v1/companies/${companyId}`, marie)).body.ownerName).toBe('Marie Ngo');
    const list = await api.call('GET', '/api/v1/companies?pageSize=100', chef);
    expect(list.body.items.find((c: { id: string }) => c.id === companyId).ownerName).toBe('Marie Ngo');
  }, 120_000);

  it('portée : un collègue d’une autre équipe reçoit « introuvable » ; la Direction (lecture seule) est refusée', async () => {
    const { paul, dir, companyId } = await team();
    expect((await setStatus(paul, companyId, 1, 'CONTACTED')).status).toBe(404);
    expect((await setStatus(dir, companyId, 1, 'CONTACTED')).status).toBe(403);
    expect((await setStatus(paul, '00000000-0000-4000-8000-000000000000', 1, 'CONTACTED')).status).toBe(404);
  }, 120_000);

  it('réattribution : le Responsable commercial confie à un membre de l’équipe ; la portée suit (l’ancien propriétaire perd la vue, le nouveau la gagne)', async () => {
    const { chef, marie, anne, ids, companyId } = await team();
    const opportunity = await api.call('POST', '/api/v1/opportunities', { ...marie, body: { companyId, title: 'Formation suivie', amount: '5000000', source: 'REFERRAL' } });
    expect(opportunity.status).toBe(201);
    const moved = await reassign(chef, companyId, 1, ids.anne);
    expect(moved.status).toBe(200);
    expect(moved.body).toMatchObject({ ownerUserId: ids.anne, ownerName: 'Anne Bello', version: 2 });
    expect((await api.call('GET', `/api/v1/companies/${companyId}`, marie)).status).toBe(404);
    expect((await api.call('GET', `/api/v1/companies/${companyId}`, anne)).status).toBe(200);
    expect((await api.call('GET', `/api/v1/opportunities/${opportunity.body.id}`, anne)).status).toBe(200);
    expect((await api.call('PUT', `/api/v1/opportunities/${opportunity.body.id}`, { ...marie, body: { version: 1, title: 'Piratée' } })).status).toBe(404);
  }, 120_000);

  it('réattribution refusée : chargé de compte (403), destinataire hors équipe ou inconnu (400), même propriétaire (422), version périmée (409)', async () => {
    const { chef, marie, ids, companyId } = await team();
    expect((await reassign(marie, companyId, 1, ids.marie)).status).toBe(403);
    expect((await reassign(chef, companyId, 1, ids.paul)).status).toBe(400);
    expect((await reassign(chef, companyId, 1, '00000000-0000-4000-8000-000000000000')).status).toBe(400);
    expect((await reassign(chef, companyId, 1, ids.marie)).status).toBe(422);
    expect((await reassign(chef, companyId, 9, ids.anne)).status).toBe(409);
    expect((await api.call('GET', `/api/v1/companies/${companyId}`, marie)).body.ownerUserId).toBe(ids.marie);
  }, 120_000);

  it('réattribution : exige un second facteur récent (D41, FD-6) ; périmé, la route répond MFA_STEP_UP_REQUIRED sans rien changer', async () => {
    const { chef, marie, ids, companyId } = await team();
    await t.prisma.db.userSession.update({ where: { id: chef.sessionId }, data: { mfaVerifiedAt: new Date(Date.now() - 11 * 60_000) } });
    const stale = await reassign(chef, companyId, 1, ids.anne);
    expect([stale.status, stale.body.title]).toEqual([403, 'MFA_STEP_UP_REQUIRED']);
    expect((await api.call('GET', `/api/v1/companies/${companyId}`, marie)).body).toMatchObject({ ownerUserId: ids.marie, version: 1 });
    // Le chargé de compte n'a pas le droit : il reçoit un refus net, jamais une invitation à ressaisir un code.
    await t.prisma.db.userSession.update({ where: { id: marie.sessionId }, data: { mfaVerifiedAt: new Date(Date.now() - 11 * 60_000) } });
    expect(await reassign(marie, companyId, 1, ids.anne)).toMatchObject({ status: 403, body: expect.not.objectContaining({ title: 'MFA_STEP_UP_REQUIRED' }) });
  }, 120_000);

  it('la liste des destinataires ne montre que l’équipe du Responsable commercial, sans e-mail ; elle est interdite au chargé de compte', async () => {
    const { chef, marie, ids } = await team();
    const owners = await api.call('GET', '/api/v1/companies/owners', chef);
    expect(owners.status).toBe(200);
    expect((owners.body as { id: string }[]).map((o) => o.id).sort()).toEqual([ids.chef, ids.marie, ids.anne].sort());
    expect(JSON.stringify(owners.body)).not.toContain('@');
    expect((await api.call('GET', '/api/v1/companies/owners', marie)).status).toBe(403);
  }, 120_000);

  it('la liste des destinataires écarte un compte désactivé et un rôle sans portefeuille commercial', async () => {
    const { chef, ids } = await team();
    const gone = await createUserWithRoles(t, [RoleCode.AccountManager], { managerId: ids.chef, name: 'Parti Désactivé' });
    await t.prisma.db.user.update({ where: { id: gone.id }, data: { status: 'DISABLED' } });
    const support = await createUserWithRoles(t, [RoleCode.Support], { managerId: ids.chef, name: 'Appui Sans Portefeuille' });
    const owners = await api.call('GET', '/api/v1/companies/owners', chef);
    const listed = (owners.body as { id: string }[]).map((o) => o.id);
    expect(listed).not.toContain(gone.id);
    expect(listed).not.toContain(support.id);
    expect(listed).toContain(ids.anne);
  }, 120_000);

  it('un contact supprimé ne compte pas pour « Qualifiée »', async () => {
    const { chef, marie, companyId } = await team();
    expect((await setStatus(marie, companyId, 1, 'CONTACTED')).status).toBe(200);
    const contact = await addContact(marie, companyId);
    expect(contact.status).toBe(201);
    expect((await api.call('DELETE', `/api/v1/contacts/${contact.body.id}`, chef)).status).toBeLessThan(300);
    expect((await setStatus(marie, companyId, 2, 'QUALIFIED')).status).toBe(422);
  }, 120_000);

  it('valeur (S4.3c) : la liste des entreprises donne le nombre et la valeur des opportunités OUVERTES par devise, dans la portée de lecture', async () => {
    const { chef, marie, paul, companyId } = await team();
    const make = (title: string, amount: string, currency?: string) =>
      api.call('POST', '/api/v1/opportunities', { ...marie, body: { companyId, title, amount, ...(currency ? { currency } : {}), source: 'REFERRAL' } });
    await make('Une', '1000000.50');
    await make('Deux', '2000000');
    await make('Euro', '300.25', 'EUR');
    const lost = await make('Perdue', '9000000');
    expect((await api.call('POST', `/api/v1/opportunities/${lost.body.id}/close-lost`, { ...marie, body: { version: 1, reason: 'PRICE' } })).status).toBe(200);
    const valueFor = async (as: As) => ((await api.call('GET', '/api/v1/companies?pageSize=100', as)).body.items as { id: string; openOpportunities?: unknown }[]).find((c) => c.id === companyId);
    expect((await valueFor(marie))!.openOpportunities).toEqual({ count: 3, totals: [{ currency: 'EUR', amount: '300.25' }, { currency: 'XAF', amount: '3000000.50' }] });
    expect((await valueFor(chef))!.openOpportunities).toMatchObject({ count: 3 });
    expect(await valueFor(paul)).toBeUndefined(); // hors de sa portée
    const support = await login(await createUserWithRoles(t, [RoleCode.Support]));
    const seen = await valueFor(support);
    expect(seen).toBeDefined();
    expect(seen!.openOpportunities).toBeUndefined(); // peut voir l'entreprise, pas ses opportunités
  }, 120_000);

  it('une entreprise archivée ne change plus de statut ni de propriétaire (422)', async () => {
    const { chef, marie, ids, companyId } = await team();
    await t.prisma.db.company.update({ where: { id: companyId }, data: { status: 'ARCHIVED' } });
    expect((await setStatus(marie, companyId, 1, 'CONTACTED')).status).toBe(422);
    expect((await reassign(chef, companyId, 1, ids.anne)).status).toBe(422);
  }, 120_000);

  it('audit : le changement de statut et la réattribution sont tracés (ancienne et nouvelle valeur, session)', async () => {
    const { chef, marie, ids, companyId } = await team();
    await setStatus(marie, companyId, 1, 'CONTACTED');
    await reassign(chef, companyId, 2, ids.anne);
    const logs = await t.prisma.db.auditLog.findMany({ where: { entityId: companyId, action: 'UPDATE' }, orderBy: { createdAt: 'asc' } });
    expect(logs).toHaveLength(2);
    expect(logs[0]!.sessionId).toBe(marie.sessionId);
    expect(logs[1]!.sessionId).toBe(chef.sessionId);
    expect(logs[0]!.oldValue).toMatchObject({ status: 'TARGET' });
    expect(logs[0]!.newValue).toMatchObject({ status: 'CONTACTED' });
    expect(logs[1]!.oldValue).toMatchObject({ ownerUserId: ids.marie });
    expect(logs[1]!.newValue).toMatchObject({ ownerUserId: ids.anne });
  }, 120_000);
});
