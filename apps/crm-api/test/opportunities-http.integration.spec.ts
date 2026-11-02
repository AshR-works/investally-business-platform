import 'reflect-metadata';
import { RoleCode } from '../src/modules/iam/domain/roles';
import { PrismaOpportunityRepository } from '../src/modules/business-development/infrastructure/prisma-opportunity.repository';
import { Api, createUserWithRoles, mfaSession, startRbacApp } from './support/rbac-http';
import { TestApp } from './support/test-app';

const describeDb = process.env.DATABASE_URL && process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;
const inDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString();

/** S4.3 : opportunités de bout en bout (HTTP + PostgreSQL) : droits (D28), portée, étapes, rendez-vous décideur, dérogation, clôture, règles de la base, audit. */
describeDb('Opportunités (HTTP + PostgreSQL)', () => {
  let t: TestApp;
  let api: Api;
  let seq = 0;
  const ip = () => `10.99.${Math.floor(seq / 250)}.${(seq++ % 250) + 1}`;

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
  const create = (as: As, companyId: string, extra: Record<string, unknown> = {}) =>
    api.call('POST', '/api/v1/opportunities', { ...as, body: { companyId, title: `Formation ${unique()}`, amount: '12500000', source: 'REFERRAL', ...extra } });
  const advance = (as: As, id: string, version: number) => api.call('POST', `/api/v1/opportunities/${id}/advance`, { ...as, body: { version } });
  /** Fait avancer d'`n` étapes (la version suit) ; renvoie l'opportunité à jour. */
  async function advanceBy(as: As, o: { id: string; version: number }, n: number) {
    let current = o;
    for (let i = 0; i < n; i++) {
      const r = await advance(as, current.id, current.version);
      expect(r.status).toBe(200);
      current = r.body;
    }
    return current as { id: string; version: number; stage: string };
  }
  /** Un rendez-vous décideur tenu sur l'entreprise (l'heure de début est ramenée dans le passé en base). */
  async function heldDecisionMakerMeeting(as: As, companyId: string) {
    const a = await api.call('POST', '/api/v1/appointments', { ...as, body: { type: 'DECISION_MAKER', companyId, startsAt: inDays(2) } });
    expect(a.status).toBe(201);
    await t.prisma.db.appointment.update({ where: { id: a.body.id }, data: { startsAt: new Date(Date.now() - 3600000) } });
    expect((await api.call('POST', `/api/v1/appointments/${a.body.id}/hold`, { ...as, body: { version: 1, text: 'Le décideur est favorable' } })).status).toBe(200);
  }

  it('cycle : créer, modifier, avancer jusqu’à l’accréditation avec un rendez-vous décideur tenu ; versions et états suivent', async () => {
    const { am, companyId } = await team();
    const o = await create(am, companyId);
    expect(o.status).toBe(201);
    expect(o.body).toMatchObject({ stage: 'QUALIFICATION', nextStage: 'PROPOSAL', status: 'OPEN', amount: '12500000.00', currency: 'XAF', version: 1 });
    const updated = await api.call('PUT', `/api/v1/opportunities/${o.body.id}`, { ...am, body: { version: 1, title: 'Titre revu', amount: '9 000 000,50' } });
    expect(updated.body).toMatchObject({ title: 'Titre revu', amount: '9000000.50', version: 2 });
    const negotiation = await advanceBy(am, updated.body, 2);
    expect(negotiation).toMatchObject({ stage: 'NEGOTIATION', version: 4 });
    await heldDecisionMakerMeeting(am, companyId);
    const agreed = await advance(am, negotiation.id, negotiation.version);
    expect(agreed.body).toMatchObject({ stage: 'AGREEMENT_IN_PRINCIPLE', nextStage: 'ACCREDITATION' });
    const last = await advance(am, agreed.body.id, agreed.body.version);
    expect(last.body).toMatchObject({ stage: 'ACCREDITATION', nextStage: null });
    expect((await advance(am, last.body.id, last.body.version)).status).toBe(422);
  }, 120_000);

  it('refus : intitulé vide, montant nul ou illisible, source inconnue (400), version périmée (409), champ inconnu (400)', async () => {
    const { am, companyId } = await team();
    for (const bad of [{ title: '' }, { amount: '0' }, { amount: 'beaucoup' }, { amount: '-5' }, { source: 'PIGEON' }, { currency: 'EURO' }]) {
      expect([JSON.stringify(bad), (await create(am, companyId, bad)).status]).toEqual([JSON.stringify(bad), 400]);
    }
    expect((await api.call('POST', '/api/v1/opportunities', { ...am, body: { companyId, title: 'T', amount: '10', source: 'EVENT', statut: 'WON' } })).status).toBe(400);
    const o = await create(am, companyId);
    expect((await api.call('PUT', `/api/v1/opportunities/${o.body.id}`, { ...am, body: { version: 9, title: 'Autre' } })).status).toBe(409);
    expect((await advance(am, o.body.id, 9)).status).toBe(409);
  }, 120_000);

  it('règle du rendez-vous décideur : accord de principe refusé (422) sans rendez-vous tenu, puis possible une fois le rendez-vous tenu', async () => {
    const { am, companyId } = await team();
    const o = await advanceBy(am, (await create(am, companyId)).body, 2);
    const refused = await advance(am, o.id, o.version);
    expect(refused.status).toBe(422);
    expect(refused.body.detail).toContain('rendez-vous décideur');
    // Un rendez-vous décideur seulement planifié (pas tenu), ou d'un autre type, ne suffit pas.
    const planned = await api.call('POST', '/api/v1/appointments', { ...am, body: { type: 'DECISION_MAKER', companyId, startsAt: inDays(3) } });
    expect(planned.status).toBe(201);
    await api.call('POST', '/api/v1/appointments', { ...am, body: { type: 'FINANCE_DIRECTOR', companyId, startsAt: inDays(4) } });
    expect((await advance(am, o.id, o.version)).status).toBe(422);
    await t.prisma.db.appointment.updateMany({ where: { companyId, type: 'FINANCE_DIRECTOR' }, data: { startsAt: new Date(Date.now() - 7200000) } });
    const fd = await t.prisma.db.appointment.findFirst({ where: { companyId, type: 'FINANCE_DIRECTOR' } });
    expect((await api.call('POST', `/api/v1/appointments/${fd!.id}/hold`, { ...am, body: { version: 1, text: 'Rendez-vous DAF tenu' } })).status).toBe(200);
    expect((await advance(am, o.id, o.version)).status).toBe(422);
    await t.prisma.db.appointment.update({ where: { id: planned.body.id }, data: { startsAt: new Date(Date.now() - 3600000) } });
    expect((await api.call('POST', `/api/v1/appointments/${planned.body.id}/hold`, { ...am, body: { version: 1, text: 'Le décideur est favorable' } })).status).toBe(200);
    expect((await advance(am, o.id, o.version)).body.stage).toBe('AGREEMENT_IN_PRINCIPLE');
  }, 180_000);

  it('D93 : un rendez-vous décideur lié à une AUTRE opportunité ne débloque pas celle-ci ; lié à elle ou non lié, il la débloque', async () => {
    const { am, companyId } = await team();
    const a = (await create(am, companyId, { title: 'Formation A' })).body;
    const b = (await create(am, companyId, { title: 'Formation B' })).body;
    const heldMeeting = async (extra: Record<string, unknown>) => {
      const m = await api.call('POST', '/api/v1/appointments', { ...am, body: { type: 'DECISION_MAKER', companyId, startsAt: inDays(2), ...extra } });
      expect(m.status).toBe(201);
      await t.prisma.db.appointment.update({ where: { id: m.body.id }, data: { startsAt: new Date(Date.now() - 3600000) } });
      expect((await api.call('POST', `/api/v1/appointments/${m.body.id}/hold`, { ...am, body: { version: 1, text: 'Décideur favorable' } })).status).toBe(200);
    };
    const toNegotiation = async (o: { id: string; version: number }) => advanceBy(am, o, 2);
    const na = await toNegotiation(a);
    const nb = await toNegotiation(b);
    await heldMeeting({ opportunityId: a.id });
    expect((await advance(am, na.id, na.version)).status).toBe(200);
    const refused = await advance(am, nb.id, nb.version);
    expect(refused.status).toBe(422);
    expect(refused.body.detail).toContain('rendez-vous décideur');
    await heldMeeting({});
    expect((await advance(am, nb.id, nb.version)).status).toBe(200);
  }, 180_000);

  it('dérogation : réservée au Responsable commercial, justification obligatoire, tracée ; elle débloque l’accord de principe', async () => {
    const { am, chef, other, dir, companyId } = await team();
    const o = await advanceBy(am, (await create(am, companyId)).body, 2);
    const waive = (as: As, body: Record<string, unknown>) => api.call('POST', `/api/v1/opportunities/${o.id}/waiver`, { ...as, body });
    expect((await waive(am, { version: o.version, reason: 'Je me déroge moi-même' })).status).toBe(403);
    expect((await waive(dir, { version: o.version, reason: 'Direction' })).status).toBe(403);
    expect((await waive(other, { version: o.version, reason: 'Collègue' })).status).toBe(403);
    expect((await waive(chef, { version: o.version })).status).toBe(400);
    expect((await waive(chef, { version: o.version, reason: 'ab' })).status).toBe(400);
    const granted = await waive(chef, { version: o.version, reason: 'Le décideur est injoignable' });
    expect(granted.status).toBe(200);
    expect(granted.body).toMatchObject({ waiverReason: 'Le décideur est injoignable', stage: 'NEGOTIATION' });
    expect((await waive(chef, { version: granted.body.version, reason: 'Encore une' })).status).toBe(422);
    expect((await advance(am, o.id, granted.body.version)).body.stage).toBe('AGREEMENT_IN_PRINCIPLE');
    const logs = await t.prisma.db.auditLog.findMany({ where: { entityId: o.id }, orderBy: { createdAt: 'asc' } });
    const waiverLog = logs.find((l) => (l.newValue as { waiverReason?: string | null })?.waiverReason);
    expect(waiverLog).toBeDefined();
    expect((waiverLog!.oldValue as { waiverReason: string | null }).waiverReason).toBeNull();
  }, 180_000);

  it('clôture perdue : chargé de compte (motif de la liste fermée), « autre » exige une précision, définitive et immuable', async () => {
    const { am, other, companyId } = await team();
    const o = (await create(am, companyId)).body;
    const lose = (as: As, body: Record<string, unknown>) => api.call('POST', `/api/v1/opportunities/${o.id}/close-lost`, { ...as, body });
    expect((await lose(am, { version: 1 })).status).toBe(400);
    expect((await lose(am, { version: 1, reason: 'RAISON_INCONNUE' })).status).toBe(400);
    expect((await lose(am, { version: 1, reason: 'OTHER' })).status).toBe(400);
    expect((await lose(other, { version: 1, reason: 'PRICE' })).status).toBe(404);
    const lost = await lose(am, { version: 1, reason: 'PRICE', note: 'Trop cher de 20 %' });
    expect(lost.body).toMatchObject({ status: 'LOST', lossReason: 'PRICE', closingNote: 'Trop cher de 20 %', nextStage: null, version: 2 });
    expect(lost.body.closedAt).not.toBeNull();
    expect((await api.call('PUT', `/api/v1/opportunities/${o.id}`, { ...am, body: { version: 2, title: 'Tard' } })).status).toBe(422);
    expect((await advance(am, o.id, 2)).status).toBe(422);
    expect((await lose(am, { version: 2, reason: 'PRICE' })).status).toBe(422);
  }, 120_000);

  it('clôture gagnée (D28) : seulement le Responsable commercial, et après l’accord de principe', async () => {
    const { am, chef, dir, companyId } = await team();
    const o = await advanceBy(am, (await create(am, companyId)).body, 2);
    const win = (as: As, version: number) => api.call('POST', `/api/v1/opportunities/${o.id}/close-won`, { ...as, body: { version } });
    expect((await win(am, o.version)).status).toBe(403);
    expect((await win(dir, o.version)).status).toBe(403);
    expect((await win(chef, o.version)).status).toBe(422);
    await heldDecisionMakerMeeting(am, companyId);
    const agreed = await advance(am, o.id, o.version);
    expect(agreed.body.stage).toBe('AGREEMENT_IN_PRINCIPLE');
    const won = await win(chef, agreed.body.version);
    expect(won.body).toMatchObject({ status: 'WON', lossReason: null, nextStage: null });
    expect((await win(chef, won.body.version)).status).toBe(422);
  }, 180_000);

  it('le Responsable commercial lit toutes les opportunités mais n’écrit que dans son équipe ; la Direction lit sans écrire ; le collègue reçoit « introuvable »', async () => {
    const { am, chef, other, dir, companyId } = await team();
    const o = (await create(am, companyId)).body;
    const outsider = await createUserWithRoles(t, [RoleCode.HeadOfSales]);
    const outsiderChef = await login(outsider);
    const ids = (r: { body: { items: { id: string }[] } }) => r.body.items.map((x) => x.id);
    for (const reader of [am, chef, dir, outsiderChef]) {
      expect(ids(await api.call('GET', '/api/v1/opportunities?pageSize=200', reader))).toContain(o.id);
      expect((await api.call('GET', `/api/v1/opportunities/${o.id}`, reader)).status).toBe(200);
    }
    expect(ids(await api.call('GET', '/api/v1/opportunities?pageSize=200', other))).not.toContain(o.id);
    expect((await api.call('GET', `/api/v1/opportunities/${o.id}`, other)).status).toBe(404);
    expect((await api.call('GET', `/api/v1/opportunities?companyId=${companyId}`, other)).status).toBe(404);
    expect((await create(dir, companyId)).status).toBe(403);
    expect((await create(other, companyId)).status).toBe(404);
    expect((await advance(outsiderChef, o.id, 1)).status).toBe(404);
    expect((await advance(chef, o.id, 1)).status).toBe(200);
  }, 120_000);

  it('liste : plus récemment modifiée d’abord, filtres par état, étape, recherche et entreprise', async () => {
    const { am, companyId } = await team();
    const first = (await create(am, companyId, { title: `Alpha-${unique()}` })).body;
    const second = (await create(am, companyId, { title: `Beta-${unique()}` })).body;
    const ids = (r: { body: { items: { id: string }[] } }) => r.body.items.map((x) => x.id);
    expect(ids(await api.call('GET', `/api/v1/opportunities?companyId=${companyId}`, am))).toEqual([second.id, first.id]);
    await advance(am, first.id, 1);
    expect(ids(await api.call('GET', `/api/v1/opportunities?companyId=${companyId}`, am))).toEqual([first.id, second.id]);
    expect(ids(await api.call('GET', `/api/v1/opportunities?companyId=${companyId}&stage=PROPOSAL`, am))).toEqual([first.id]);
    expect(ids(await api.call('GET', `/api/v1/opportunities?companyId=${companyId}&status=LOST`, am))).toEqual([]);
    expect(ids(await api.call('GET', `/api/v1/opportunities?companyId=${companyId}&search=beta`, am))).toEqual([second.id]);
    expect((await api.call('GET', '/api/v1/opportunities?status=ENCOURS', am)).status).toBe(400);
  }, 120_000);

  it('règles garanties par la base : clôture cohérente, gagnée seulement après l’accord de principe, dérogation complète, montant et version positifs', async () => {
    const { am, companyId } = await team();
    const o = (await create(am, companyId)).body;
    const db = t.prisma.db;
    const id = o.id;
    const bad = (sql: string) => expect(db.$executeRawUnsafe(`UPDATE bd.opportunities SET ${sql} WHERE id = '${id}'::uuid`)).rejects.toThrow();
    await bad(`status = 'LOST'`);
    await bad(`status = 'LOST', closed_at = now()`);
    await bad(`status = 'LOST', loss_reason = 'PRICE'`);
    await bad(`status = 'WON', closed_at = now()`);
    await bad(`loss_reason = 'PRICE'`);
    await bad(`closed_at = now()`);
    await bad(`closing_note = 'x'`);
    await bad(`waiver_reason = 'x'`);
    await bad(`waived_at = now()`);
    await bad(`amount = 0`);
    await bad(`version = 0`);
    await db.$executeRawUnsafe(`UPDATE bd.opportunities SET status = 'LOST', loss_reason = 'PRICE', closed_at = now() WHERE id = '${id}'::uuid`);
    await bad(`status = 'OPEN'`);
  }, 120_000);

  it('verrou optimiste AU NIVEAU DE LA BASE : deux clôtures sur la même version, la seconde est refusée', async () => {
    const { am, companyId } = await team();
    const o = (await create(am, companyId)).body;
    const repository = new PrismaOpportunityRepository(t.prisma);
    const first = (await repository.findById(o.id))!;
    const second = (await repository.findById(o.id))!;
    first.closeLost('PRICE', 'Première', new Date());
    second.closeLost('NO_BUDGET', 'Seconde', new Date());
    await repository.save(first);
    await expect(repository.save(second)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect((await repository.findById(o.id))!.lossReason).toBe('PRICE');
  }, 120_000);

  it('entreprise archivée : plus de création, de modification ni d’avancement (422) ; l’opportunité reste lisible', async () => {
    const { am, companyId } = await team();
    const o = (await create(am, companyId)).body;
    await t.prisma.db.company.update({ where: { id: companyId }, data: { status: 'ARCHIVED' } });
    expect((await create(am, companyId)).status).toBe(422);
    expect((await advance(am, o.id, 1)).status).toBe(422);
    expect((await api.call('PUT', `/api/v1/opportunities/${o.id}`, { ...am, body: { version: 1, title: 'Tard' } })).status).toBe(422);
    expect((await api.call('GET', `/api/v1/opportunities/${o.id}`, am)).status).toBe(200);
  }, 120_000);

  it('audit : création, modification, passage d’étape, clôture tracés, ancienne et nouvelle valeur, avec la session', async () => {
    const { am, companyId } = await team();
    const o = (await create(am, companyId)).body;
    await api.call('PUT', `/api/v1/opportunities/${o.id}`, { ...am, body: { version: 1, title: 'Changé' } });
    await advance(am, o.id, 2);
    await api.call('POST', `/api/v1/opportunities/${o.id}/close-lost`, { ...am, body: { version: 3, reason: 'NOT_INTERESTED' } });
    const logs = await t.prisma.db.auditLog.findMany({ where: { entityId: o.id }, orderBy: { createdAt: 'asc' } });
    expect(logs.map((l) => l.action)).toEqual(['CREATE', 'UPDATE', 'UPDATE', 'UPDATE']);
    expect(logs.every((l) => l.sessionId === am.sessionId)).toBe(true);
    expect((logs[2]!.oldValue as { stage: string }).stage).toBe('QUALIFICATION');
    expect((logs[2]!.newValue as { stage: string }).stage).toBe('PROPOSAL');
    expect((logs[3]!.newValue as { status: string }).status).toBe('LOST');
  }, 120_000);
});
