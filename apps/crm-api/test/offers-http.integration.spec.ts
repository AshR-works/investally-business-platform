import 'reflect-metadata';
import { RoleCode } from '../src/modules/iam/domain/roles';
import { PrismaOfferRepository } from '../src/modules/business-development/infrastructure/prisma-offer.repository';
import { Api, createUserWithRoles, mfaSession, startRbacApp } from './support/rbac-http';
import { TestApp } from './support/test-app';

const describeDb = process.env.DATABASE_URL && process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;

/** S4.2a : offres de bout en bout (HTTP + PostgreSQL) : droits, portée, états, numérotation, version, audit, règles de la base. */
describeDb('Offres (HTTP + PostgreSQL)', () => {
  let t: TestApp;
  let api: Api;
  let seq = 0;
  const ip = () => `10.95.${Math.floor(seq / 250)}.${(seq++ % 250) + 1}`;

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
    const chefUser = await createUserWithRoles(t, [RoleCode.HeadOfSales]);
    const amUser = await createUserWithRoles(t, [RoleCode.AccountManager], { managerId: chefUser.id });
    const otherUser = await createUserWithRoles(t, [RoleCode.AccountManager]);
    const dirUser = await createUserWithRoles(t, [RoleCode.Direction]);
    const supportUser = await createUserWithRoles(t, [RoleCode.Support]);
    const [chef, am, other, dir, support] = [await login(chefUser), await login(amUser), await login(otherUser), await login(dirUser), await login(supportUser)];
    const company = await api.call('POST', '/api/v1/companies', { ...am, body: { name: `Société ${unique()}` } });
    expect(company.status).toBe(201);
    return { chef, am, other, dir, support, companyId: company.body.id as string };
  }
  const payload = (companyId: string, extra: Record<string, unknown> = {}) => ({ companyId, subject: `Formation ${unique()}`, amount: '4 500 000', ...extra });
  const create = async (as: { token: string; ip: string }, companyId: string, extra: Record<string, unknown> = {}) => {
    const r = await api.call('POST', '/api/v1/offers', { ...as, body: payload(companyId, extra) });
    expect(r.status).toBe(201);
    return r.body as { id: string; reference: string; version: number; status: string };
  };
  const act = (as: { token: string; ip: string }, id: string, action: string, body: Record<string, unknown>) => api.call('POST', `/api/v1/offers/${id}/${action}`, { ...as, body });

  it('cycle complet : brouillon, modification, dépôt, acceptation ; la version et les états suivent', async () => {
    const { am, companyId } = await team();
    const offer = await create(am, companyId);
    expect(offer).toMatchObject({ status: 'DRAFT', version: 1 });
    expect(offer.reference).toMatch(/^OFF-\d{4}-\d{4}$/);
    const updated = await api.call('PUT', `/api/v1/offers/${offer.id}`, { ...am, body: { version: 1, amount: '5000000,50', currency: 'fcfa' } });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ amount: '5000000.50', currency: 'XAF', version: 2 });
    const sent = await act(am, offer.id, 'submit', { version: 2 });
    expect(sent.body).toMatchObject({ status: 'SUBMITTED', version: 3 });
    expect(sent.body.submittedAt).not.toBeNull();
    const accepted = await act(am, offer.id, 'accept', { version: 3 });
    expect(accepted.body).toMatchObject({ status: 'ACCEPTED', version: 4 });
    expect((await api.call('GET', `/api/v1/offers/${offer.id}`, am)).body.status).toBe('ACCEPTED');
  }, 90_000);

  it('une offre déposée ne se modifie plus (422) ; une transition interdite est refusée (422), la version périmée aussi (409)', async () => {
    const { am, companyId } = await team();
    const offer = await create(am, companyId);
    expect((await act(am, offer.id, 'accept', { version: 1 })).status).toBe(422);
    expect((await act(am, offer.id, 'submit', { version: 5 })).status).toBe(409);
    expect((await act(am, offer.id, 'submit', { version: 1 })).status).toBe(200);
    expect((await api.call('PUT', `/api/v1/offers/${offer.id}`, { ...am, body: { version: 2, subject: 'Autre' } })).status).toBe(422);
    expect((await act(am, offer.id, 'submit', { version: 2 })).status).toBe(422);
  }, 90_000);

  it('retrait : motif obligatoire (400 ou 422), puis état « retirée » avec son motif ; définitif', async () => {
    const { am, companyId } = await team();
    const offer = await create(am, companyId);
    const noReason = await act(am, offer.id, 'withdraw', { version: 1 });
    expect([400, 422]).toContain(noReason.status);
    const done = await act(am, offer.id, 'withdraw', { version: 1, reason: 'Client indisponible' });
    expect(done.body).toMatchObject({ status: 'WITHDRAWN', withdrawnReason: 'Client indisponible' });
    expect((await act(am, offer.id, 'submit', { version: 2 })).status).toBe(422);
  }, 90_000);

  it('portée et droits : le chargé de compte voit les siennes, son chef celles de son équipe, la Direction tout en lecture seule ; le Support rien', async () => {
    const { am, chef, other, dir, support, companyId } = await team();
    const offer = await create(am, companyId);
    expect((await api.call('GET', `/api/v1/offers/${offer.id}`, chef)).status).toBe(200);
    expect((await api.call('GET', `/api/v1/offers/${offer.id}`, dir)).status).toBe(200);
    expect((await api.call('GET', `/api/v1/offers/${offer.id}`, other)).status).toBe(404);
    expect((await api.call('GET', `/api/v1/offers/${offer.id}`, support)).status).toBe(403);
    expect((await api.call('POST', '/api/v1/offers', { ...dir, body: payload(companyId) })).status).toBe(403);
    expect((await act(dir, offer.id, 'submit', { version: 1 })).status).toBe(403);
    const list = (c: { token: string; ip: string }) => api.call('GET', `/api/v1/offers?companyId=${companyId}`, c);
    expect((await list(am)).body.total).toBe(1);
    expect((await list(other)).status).toBe(404);
  }, 90_000);

  it('la liste sans filtre ne montre que la portée : le collègue ne voit rien, le chef voit son équipe, la Direction tout', async () => {
    const { am, chef, other, dir, companyId } = await team();
    const offer = await create(am, companyId, { subject: `Portée ${unique()}` });
    const ids = (r: { body: { items: { id: string }[] } }) => r.body.items.map((o) => o.id);
    const search = `search=${encodeURIComponent(offer.reference)}`;
    expect(ids(await api.call('GET', `/api/v1/offers?${search}`, am))).toEqual([offer.id]);
    expect(ids(await api.call('GET', `/api/v1/offers?${search}`, chef))).toEqual([offer.id]);
    expect(ids(await api.call('GET', `/api/v1/offers?${search}`, dir))).toEqual([offer.id]);
    expect(ids(await api.call('GET', `/api/v1/offers?${search}`, other))).toEqual([]);
  }, 90_000);

  it('numérotation : deux créations simultanées ne partagent jamais un numéro', async () => {
    const { am, companyId } = await team();
    const results = await Promise.all(Array.from({ length: 6 }, () => api.call('POST', '/api/v1/offers', { ...am, body: payload(companyId) })));
    expect(results.every((r) => r.status === 201)).toBe(true);
    const refs = results.map((r) => r.body.reference as string);
    expect(new Set(refs).size).toBe(6);
    const numbers = refs.map((r) => Number(r.slice(-4))).sort((a, b) => a - b);
    expect(numbers[5]! - numbers[0]!).toBe(5);
  }, 90_000);

  it('verrou optimiste AU NIVEAU DE LA BASE : deux écritures sur la même version, la seconde est refusée', async () => {
    const { am, companyId } = await team();
    const created = await create(am, companyId);
    const repository = new PrismaOfferRepository(t.prisma);
    const first = (await repository.findById(created.id))!;
    const second = (await repository.findById(created.id))!;
    first.edit({ subject: 'Première' });
    second.edit({ subject: 'Seconde' });
    await repository.save(first);
    await expect(repository.save(second)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect((await repository.findById(created.id))!.subject).toBe('Première');
  }, 90_000);

  it('règles garanties par la base : montant positif, brouillon sans date de dépôt, retrait avec motif, référence unique', async () => {
    const { am, companyId } = await team();
    const offer = await create(am, companyId);
    const db = t.prisma.db;
    await expect(db.$executeRawUnsafe(`UPDATE bd.offers SET amount = 0 WHERE id = '${offer.id}'::uuid`)).rejects.toThrow();
    await expect(db.$executeRawUnsafe(`UPDATE bd.offers SET submitted_at = now() WHERE id = '${offer.id}'::uuid`)).rejects.toThrow();
    await expect(db.$executeRawUnsafe(`UPDATE bd.offers SET status = 'SUBMITTED' WHERE id = '${offer.id}'::uuid`)).rejects.toThrow();
    await expect(db.$executeRawUnsafe(`UPDATE bd.offers SET status = 'WITHDRAWN' WHERE id = '${offer.id}'::uuid`)).rejects.toThrow();
    await expect(db.$executeRawUnsafe(`UPDATE bd.offers SET withdrawn_reason = 'x' WHERE id = '${offer.id}'::uuid`)).rejects.toThrow();
    const other = await create(am, companyId);
    await expect(db.$executeRawUnsafe(`UPDATE bd.offers SET reference = '${offer.reference}' WHERE id = '${other.id}'::uuid`)).rejects.toThrow();
  }, 90_000);

  it('une entreprise archivée n’accepte plus d’offre ni de changement d’état (422), ses offres restent lisibles', async () => {
    const { am, companyId } = await team();
    const offer = await create(am, companyId);
    await t.prisma.db.company.update({ where: { id: companyId }, data: { status: 'ARCHIVED' } });
    expect((await api.call('POST', '/api/v1/offers', { ...am, body: payload(companyId) })).status).toBe(422);
    expect((await act(am, offer.id, 'submit', { version: 1 })).status).toBe(422);
    expect((await api.call('GET', `/api/v1/offers/${offer.id}`, am)).status).toBe(200);
  }, 90_000);

  it('audit : création, modification et changements d’état tracés, ancienne et nouvelle valeur, avec la session', async () => {
    const { am, companyId } = await team();
    const offer = await create(am, companyId);
    await api.call('PUT', `/api/v1/offers/${offer.id}`, { ...am, body: { version: 1, amount: '100' } });
    await act(am, offer.id, 'submit', { version: 2 });
    const logs = await t.prisma.db.auditLog.findMany({ where: { entityId: offer.id }, orderBy: { createdAt: 'asc' } });
    expect(logs.map((l) => l.action)).toEqual(['CREATE', 'UPDATE', 'UPDATE']);
    expect(logs.every((l) => l.sessionId === am.sessionId)).toBe(true);
    expect((logs[2]!.oldValue as { status: string }).status).toBe('DRAFT');
    expect((logs[2]!.newValue as { status: string }).status).toBe('SUBMITTED');
  }, 90_000);

  it('validation : montant négatif ou non numérique, objet vide, champ inconnu refusés (400)', async () => {
    const { am, companyId } = await team();
    for (const bad of [{ amount: '-5' }, { amount: 'abc' }, { subject: '' }, { currency: 'EURO12345678' }, { statut: 'ACCEPTED' }, { reference: 'OFF-2026-9999' }]) {
      const r = await api.call('POST', '/api/v1/offers', { ...am, body: payload(companyId, bad) });
      expect([bad, r.status]).toEqual([bad, 400]);
    }
  }, 90_000);

  it('N5 clonage : un nouveau brouillon de la même entreprise, nouvelle référence, original intact ; hors portée = 404 ; sans droit de création refusé', async () => {
    const { am, other, dir, support, companyId } = await team();
    const source = await create(am, companyId, { note: 'Reprise' });
    await act(am, source.id, 'submit', { version: 1 });
    const cloned = await api.call('POST', `/api/v1/offers/${source.id}/clone`, am);
    expect(cloned.status).toBe(201);
    expect(cloned.body).toMatchObject({ status: 'DRAFT', companyId, subject: (await api.call('GET', `/api/v1/offers/${source.id}`, am)).body.subject, amount: '4500000.00', note: 'Reprise', version: 1, submittedAt: null });
    expect(cloned.body.id).not.toBe(source.id);
    expect(cloned.body.reference).not.toBe(source.reference);
    expect((await api.call('GET', `/api/v1/offers/${source.id}`, am)).body).toMatchObject({ status: 'SUBMITTED', reference: source.reference });
    expect((await api.call('POST', `/api/v1/offers/${source.id}/clone`, other)).status).toBe(404);
    expect((await api.call('POST', '/api/v1/offers/00000000-0000-4000-8000-000000000000/clone', am)).status).toBe(404);
    for (const who of [dir, support]) expect([403, 404]).toContain((await api.call('POST', `/api/v1/offers/${source.id}/clone`, who)).status);
    const logs = await t.prisma.db.auditLog.findMany({ where: { entityId: cloned.body.id } });
    expect(logs).toHaveLength(1);
    expect((logs[0]!.newValue as { clonedFromOfferId: string }).clonedFromOfferId).toBe(source.id);
  }, 120_000);
});

