import 'reflect-metadata';
import { RoleCode } from '../src/modules/iam/domain/roles';
import { PrismaFollowupRepository } from '../src/modules/business-development/infrastructure/prisma-followup.repository';
import { Api, createUserWithRoles, mfaSession, startRbacApp } from './support/rbac-http';
import { TestApp } from './support/test-app';

const describeDb = process.env.DATABASE_URL && process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;
const inDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

/** S4.2c : relances de bout en bout (HTTP + PostgreSQL) : droits, portée, limite, retard, clôture avec l'offre, règles de la base, audit. */
describeDb('Relances (HTTP + PostgreSQL)', () => {
  let t: TestApp;
  let api: Api;
  let seq = 0;
  const ip = () => `10.97.${Math.floor(seq / 250)}.${(seq++ % 250) + 1}`;

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
    const dirUser = await createUserWithRoles(t, [RoleCode.Direction]);
    const [chef, am, other, dir] = [await login(chefUser), await login(amUser), await login(otherUser), await login(dirUser)];
    const company = await api.call('POST', '/api/v1/companies', { ...am, body: { name: `Société ${unique()}` } });
    expect(company.status).toBe(201);
    return { chef, am, other, dir, companyId: company.body.id as string };
  }
  const offer = async (as: As, companyId: string) => {
    const created = await api.call('POST', '/api/v1/offers', { ...as, body: { companyId, subject: `Formation ${unique()}`, amount: '4500000' } });
    expect(created.status).toBe(201);
    const sent = await api.call('POST', `/api/v1/offers/${created.body.id}/submit`, { ...as, body: { version: 1 } });
    expect(sent.status).toBe(200);
    return sent.body as { id: string; version: number };
  };
  const plan = (as: As, offerId: string, extra: Record<string, unknown> = {}) =>
    api.call('POST', '/api/v1/followups', { ...as, body: { offerId, dueOn: inDays(3), channel: 'CALL', note: 'Rappeler le DAF', ...extra } });
  const close = (as: As, id: string, action: 'complete' | 'cancel', body: Record<string, unknown>) => api.call('POST', `/api/v1/followups/${id}/${action}`, { ...as, body });

  it('cycle : planifier, modifier, terminer avec son résultat ; la version et les états suivent', async () => {
    const { am, companyId } = await team();
    const o = await offer(am, companyId);
    const f = await plan(am, o.id);
    expect(f.status).toBe(201);
    expect(f.body).toMatchObject({ status: 'PLANNED', channel: 'CALL', overdue: false, version: 1, offerId: o.id });
    const updated = await api.call('PUT', `/api/v1/followups/${f.body.id}`, { ...am, body: { version: 1, channel: 'EMAIL', dueOn: inDays(5) } });
    expect(updated.body).toMatchObject({ channel: 'EMAIL', dueOn: inDays(5), version: 2 });
    expect((await close(am, f.body.id, 'complete', { version: 2 })).status).toBe(400);
    const done = await close(am, f.body.id, 'complete', { version: 2, text: 'Le DAF rappellera jeudi' });
    expect(done.body).toMatchObject({ status: 'DONE', resultNote: 'Le DAF rappellera jeudi', version: 3 });
    expect(done.body.closedAt).not.toBeNull();
    expect((await api.call('PUT', `/api/v1/followups/${f.body.id}`, { ...am, body: { version: 3, note: 'Encore' } })).status).toBe(422);
    expect((await close(am, f.body.id, 'cancel', { version: 3, text: 'Trop tard' })).status).toBe(422);
  }, 120_000);

  it('refus : échéance passée ou mal écrite, canal inconnu (400/422), version périmée (409), offre en brouillon (422)', async () => {
    const { am, companyId } = await team();
    const o = await offer(am, companyId);
    expect([400, 422]).toContain((await plan(am, o.id, { dueOn: inDays(-2) })).status);
    expect(await plan(am, o.id, { dueOn: 'demain' })).toMatchObject({ status: 400 });
    expect((await plan(am, o.id, { channel: 'PIGEON' })).status).toBe(400);
    expect((await api.call('POST', '/api/v1/followups', { ...am, body: { offerId: o.id, dueOn: inDays(2), channel: 'CALL', statut: 'DONE' } })).status).toBe(400);
    const f = await plan(am, o.id);
    expect((await api.call('PUT', `/api/v1/followups/${f.body.id}`, { ...am, body: { version: 9, note: 'Autre' } })).status).toBe(409);
    const draft = await api.call('POST', '/api/v1/offers', { ...am, body: { companyId, subject: 'Brouillon', amount: '100' } });
    expect((await plan(am, draft.body.id)).status).toBe(422);
  }, 120_000);

  it('au plus trois relances par offre ; une relance annulée libère une place', async () => {
    const { am, companyId } = await team();
    const o = await offer(am, companyId);
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) ids.push((await plan(am, o.id)).body.id);
    expect((await plan(am, o.id)).status).toBe(422);
    await close(am, ids[0]!, 'cancel', { version: 1, text: 'Plus utile' });
    expect((await plan(am, o.id)).status).toBe(201);
  }, 120_000);

  it('retard calculé : une relance dont l’échéance est dépassée est « en retard » et apparaît dans le filtre « en retard »', async () => {
    const { am, companyId } = await team();
    const o = await offer(am, companyId);
    const late = await plan(am, o.id, { dueOn: inDays(1) });
    const fresh = await plan(am, o.id, { dueOn: inDays(6) });
    await t.prisma.db.followup.update({ where: { id: late.body.id }, data: { dueOn: new Date(`${inDays(-3)}T00:00:00Z`) } });
    const read = await api.call('GET', `/api/v1/followups/${late.body.id}`, am);
    expect(read.body).toMatchObject({ overdue: true, dueOn: inDays(-3) });
    expect((await api.call('GET', `/api/v1/followups/${fresh.body.id}`, am)).body.overdue).toBe(false);
    const overdue = await api.call('GET', `/api/v1/followups?due=overdue&offerId=${o.id}`, am);
    expect(overdue.body.items.map((x: { id: string }) => x.id)).toEqual([late.body.id]);
    const upcoming = await api.call('GET', `/api/v1/followups?due=upcoming&offerId=${o.id}`, am);
    expect(upcoming.body.items.map((x: { id: string }) => x.id)).toEqual([fresh.body.id]);
    // Une relance en retard peut être terminée, et modifiée sans changer son échéance passée.
    expect((await api.call('PUT', `/api/v1/followups/${late.body.id}`, { ...am, body: { version: 1, note: 'Toujours à faire', dueOn: inDays(-3) } })).status).toBe(200);
    expect((await api.call('PUT', `/api/v1/followups/${late.body.id}`, { ...am, body: { version: 2, dueOn: inDays(-1) } })).status).toBe(400);
  }, 120_000);

  it('la liste est triée par échéance et ne montre que la portée ; la prochaine relance s’affiche dans la liste des offres', async () => {
    const { am, chef, other, dir, companyId } = await team();
    const o = await offer(am, companyId);
    const later = await plan(am, o.id, { dueOn: inDays(9) });
    const sooner = await plan(am, o.id, { dueOn: inDays(2) });
    const ids = (r: { body: { items: { id: string }[] } }) => r.body.items.map((x) => x.id);
    expect(ids(await api.call('GET', `/api/v1/followups?offerId=${o.id}`, am))).toEqual([sooner.body.id, later.body.id]);
    expect(ids(await api.call('GET', `/api/v1/followups?offerId=${o.id}`, chef))).toEqual([sooner.body.id, later.body.id]);
    expect(ids(await api.call('GET', `/api/v1/followups?offerId=${o.id}`, dir))).toEqual([sooner.body.id, later.body.id]);
    expect((await api.call('GET', `/api/v1/followups?offerId=${o.id}`, other)).status).toBe(404);
    // Navigation contextuelle (D52) : les relances d'une entreprise, et « introuvable » pour l'entreprise d'un collègue, comme pour une offre.
    expect(ids(await api.call('GET', `/api/v1/followups?companyId=${companyId}`, am))).toEqual([sooner.body.id, later.body.id]);
    expect(ids(await api.call('GET', `/api/v1/followups?companyId=${companyId}`, dir))).toEqual([sooner.body.id, later.body.id]);
    expect((await api.call('GET', `/api/v1/followups?companyId=${companyId}`, other)).status).toBe(404);
    expect((await api.call('GET', '/api/v1/followups?companyId=00000000-0000-7000-8000-000000000000', am)).status).toBe(404);
    expect((await api.call('GET', '/api/v1/followups?companyId=pas-un-uuid', am)).status).toBe(400);
    const everything = await api.call('GET', '/api/v1/followups?status=PLANNED&pageSize=100', other);
    expect(ids(everything)).not.toContain(sooner.body.id);
    const offers = await api.call('GET', `/api/v1/offers?search=${encodeURIComponent((await api.call('GET', `/api/v1/offers/${o.id}`, am)).body.reference)}`, am);
    expect(offers.body.items[0]).toMatchObject({ id: o.id, nextFollowupOn: inDays(2) });
  }, 120_000);

  it('l’offre acceptée, refusée ou retirée annule ses relances à faire (motif écrit, tracé) et garde les terminées', async () => {
    const { am, companyId } = await team();
    for (const [action, body, motif] of [['accept', {}, 'acceptée'], ['refuse', {}, 'refusée'], ['withdraw', { reason: 'Client indisponible' }, 'retirée']] as const) {
      const o = await offer(am, companyId);
      const todo = await plan(am, o.id);
      const done = await plan(am, o.id);
      await close(am, done.body.id, 'complete', { version: 1, text: 'Fait' });
      const r = await api.call('POST', `/api/v1/offers/${o.id}/${action}`, { ...am, body: { version: o.version, ...body } });
      expect(r.status).toBe(200);
      const after = await api.call('GET', `/api/v1/followups?offerId=${o.id}`, am);
      const byId = (id: string) => after.body.items.find((x: { id: string }) => x.id === id);
      expect(byId(todo.body.id)).toMatchObject({ status: 'CANCELLED' });
      expect(byId(todo.body.id).resultNote).toContain(motif);
      expect(byId(done.body.id).status).toBe('DONE');
      const logs = await t.prisma.db.auditLog.findMany({ where: { entityId: todo.body.id }, orderBy: { createdAt: 'asc' } });
      expect(logs.map((l) => l.action)).toEqual(['CREATE', 'UPDATE']);
      expect(logs[1]!.sessionId).toBe(am.sessionId);
      expect((await plan(am, o.id)).status).toBe(422);
    }
  }, 180_000);

  it('portée et droits : la Direction lit sans écrire, le collègue reçoit « introuvable »', async () => {
    const { am, chef, other, dir, companyId } = await team();
    const o = await offer(am, companyId);
    const f = await plan(am, o.id);
    expect((await api.call('GET', `/api/v1/followups/${f.body.id}`, chef)).status).toBe(200);
    expect((await api.call('GET', `/api/v1/followups/${f.body.id}`, dir)).status).toBe(200);
    expect((await api.call('GET', `/api/v1/followups/${f.body.id}`, other)).status).toBe(404);
    expect((await plan(dir, o.id)).status).toBe(403);
    expect((await close(dir, f.body.id, 'complete', { version: 1, text: 'Direction' })).status).toBe(403);
    expect((await close(other, f.body.id, 'complete', { version: 1, text: 'Collègue' })).status).toBe(404);
    expect((await plan(other, o.id)).status).toBe(404);
    expect((await close(chef, f.body.id, 'complete', { version: 1, text: 'Le chef a rappelé' })).status).toBe(200);
  }, 120_000);

  it('règles garanties par la base : clôture cohérente (résultat et date ensemble), version positive', async () => {
    const { am, companyId } = await team();
    const o = await offer(am, companyId);
    const f = await plan(am, o.id);
    const db = t.prisma.db;
    await expect(db.$executeRawUnsafe(`UPDATE bd.followups SET status = 'DONE' WHERE id = '${f.body.id}'::uuid`)).rejects.toThrow();
    await expect(db.$executeRawUnsafe(`UPDATE bd.followups SET result_note = 'x' WHERE id = '${f.body.id}'::uuid`)).rejects.toThrow();
    await expect(db.$executeRawUnsafe(`UPDATE bd.followups SET closed_at = now() WHERE id = '${f.body.id}'::uuid`)).rejects.toThrow();
    await expect(db.$executeRawUnsafe(`UPDATE bd.followups SET version = 0 WHERE id = '${f.body.id}'::uuid`)).rejects.toThrow();
    await close(am, f.body.id, 'complete', { version: 1, text: 'Fait' });
    await expect(db.$executeRawUnsafe(`UPDATE bd.followups SET status = 'PLANNED' WHERE id = '${f.body.id}'::uuid`)).rejects.toThrow();
  }, 120_000);

  it('verrou optimiste AU NIVEAU DE LA BASE : deux clôtures sur la même version, la seconde est refusée', async () => {
    const { am, companyId } = await team();
    const o = await offer(am, companyId);
    const f = await plan(am, o.id);
    const repository = new PrismaFollowupRepository(t.prisma);
    const first = (await repository.findById(f.body.id))!;
    const second = (await repository.findById(f.body.id))!;
    first.complete('Première', new Date());
    second.complete('Seconde', new Date());
    await repository.save(first);
    await expect(repository.save(second)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect((await repository.findById(f.body.id))!.resultNote).toBe('Première');
  }, 120_000);

  it('entreprise archivée : plus de relance ni de clôture (422) ; les relances restent lisibles', async () => {
    const { am, companyId } = await team();
    const o = await offer(am, companyId);
    const f = await plan(am, o.id);
    await t.prisma.db.company.update({ where: { id: companyId }, data: { status: 'ARCHIVED' } });
    expect((await plan(am, o.id)).status).toBe(422);
    expect((await close(am, f.body.id, 'complete', { version: 1, text: 'Archivée' })).status).toBe(422);
    expect((await api.call('GET', `/api/v1/followups/${f.body.id}`, am)).status).toBe(200);
  }, 120_000);

  it('audit : planification, modification et clôture tracées, ancienne et nouvelle valeur, avec la session', async () => {
    const { am, companyId } = await team();
    const o = await offer(am, companyId);
    const f = await plan(am, o.id);
    await api.call('PUT', `/api/v1/followups/${f.body.id}`, { ...am, body: { version: 1, note: 'Changée' } });
    await close(am, f.body.id, 'complete', { version: 2, text: 'Fait' });
    const logs = await t.prisma.db.auditLog.findMany({ where: { entityId: f.body.id }, orderBy: { createdAt: 'asc' } });
    expect(logs.map((l) => l.action)).toEqual(['CREATE', 'UPDATE', 'UPDATE']);
    expect(logs.every((l) => l.sessionId === am.sessionId)).toBe(true);
    expect((logs[2]!.oldValue as { status: string }).status).toBe('PLANNED');
    expect((logs[2]!.newValue as { status: string }).status).toBe('DONE');
  }, 120_000);
});
