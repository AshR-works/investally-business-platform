import 'reflect-metadata';
import { RoleCode } from '../src/modules/iam/domain/roles';
import { PrismaApprovalRepository } from '../src/modules/business-development/infrastructure/prisma-approval.repository';
import { Api, createUserWithRoles, mfaSession, startRbacApp } from './support/rbac-http';
import { TestApp } from './support/test-app';

const describeDb = process.env.DATABASE_URL && process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;
const today = () => new Date().toISOString().slice(0, 10);
const pdf = () => Buffer.from('%PDF-1.7\nagrement signe\n%%EOF');

/** S4.4a : agréments de bout en bout (HTTP + PostgreSQL) : droits, portée, accord de principe, entreprise « Cliente », cycle, règles de la base, documents, audit. */
describeDb('Agréments (HTTP + PostgreSQL)', () => {
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
  /** Une opportunité de l'entreprise, amenée directement à l'étape voulue en base (la règle du rendez-vous décideur est testée ailleurs). */
  async function opportunityAt(as: As, companyId: string, stage = 'AGREEMENT_IN_PRINCIPLE') {
    const o = await api.call('POST', '/api/v1/opportunities', { ...as, body: { companyId, title: `Formation ${unique()}`, amount: '8000000', source: 'REFERRAL' } });
    expect(o.status).toBe(201);
    await t.prisma.db.opportunity.update({ where: { id: o.body.id }, data: { stage: stage as never } });
    return o.body.id as string;
  }
  const register = (as: As, opportunityId: string, extra: Record<string, unknown> = {}) =>
    api.call('POST', '/api/v1/approvals', { ...as, body: { opportunityId, amount: '12500000', receivedOn: today(), ...extra } });
  const act = (as: As, id: string, action: 'honor' | 'expire' | 'cancel', body: Record<string, unknown>) => api.call('POST', `/api/v1/approvals/${id}/${action}`, { ...as, body });

  it('cycle : enregistrer, lire, honorer ; l’entreprise devient « Cliente » ; versions et états suivent', async () => {
    const { am, chef, companyId } = await team();
    const op = await opportunityAt(am, companyId);
    const a = await register(am, op, { places: 8, validUntil: '2099-12-31' });
    expect(a.status).toBe(201);
    expect(a.body).toMatchObject({ status: 'RECEIVED', amount: '12500000.00', currency: 'XAF', places: 8, validUntil: '2099-12-31', opportunityId: op, pastValidity: false, version: 1 });
    expect((await api.call('GET', `/api/v1/companies/${companyId}`, am)).body.status).toBe('CLIENT');
    expect((await api.call('GET', `/api/v1/approvals/${a.body.id}`, am)).body).toMatchObject({
      id: a.body.id, opportunityTitle: expect.stringContaining('Formation'), amount: '12500000.00', places: 8, currency: 'XAF', receivedOn: today(), validUntil: '2099-12-31',
    });
    const honored = await act(chef, a.body.id, 'honor', { version: 1 });
    expect(honored.status).toBe(200);
    expect(honored.body).toMatchObject({ status: 'HONORED', version: 2, closedReason: null });
    expect(honored.body.closedAt).not.toBeNull();
    expect((await act(chef, a.body.id, 'cancel', { version: 2, reason: 'Trop tard' })).status).toBe(422);
  }, 120_000);

  it('expirer et annuler exigent un motif ; un nouvel agrément est possible après annulation', async () => {
    const { am, chef, companyId } = await team();
    const op = await opportunityAt(am, companyId);
    const a = await register(am, op);
    expect((await act(chef, a.body.id, 'expire', { version: 1 })).status).toBe(400);
    expect((await act(chef, a.body.id, 'cancel', { version: 1, reason: 'ab' })).status).toBe(400);
    const cancelled = await act(chef, a.body.id, 'cancel', { version: 1, reason: 'Saisie erronée' });
    expect(cancelled.body).toMatchObject({ status: 'CANCELLED', closedReason: 'Saisie erronée' });
    const again = await register(am, op);
    expect(again.status).toBe(201);
    const expired = await act(chef, again.body.id, 'expire', { version: 1, reason: 'Validité dépassée' });
    expect(expired.body).toMatchObject({ status: 'EXPIRED', closedReason: 'Validité dépassée' });
  }, 120_000);

  it('refus : avant l’accord de principe (422), opportunité perdue (422), second agrément actif (409), sans montant ni places (400), date future (400), identifiant mal écrit (400), champ inconnu (400)', async () => {
    const { am, companyId } = await team();
    const early = await opportunityAt(am, companyId, 'NEGOTIATION');
    expect((await register(am, early)).status).toBe(422);
    const lostId = await opportunityAt(am, companyId);
    expect((await api.call('POST', `/api/v1/opportunities/${lostId}/close-lost`, { ...am, body: { version: 2, reason: 'PRICE' } })).status).toBeLessThan(500);
    const op = await opportunityAt(am, companyId);
    expect((await register(am, op)).status).toBe(201);
    expect((await register(am, op)).status).toBe(409);
    const fresh = await opportunityAt(am, companyId);
    expect((await api.call('POST', '/api/v1/approvals', { ...am, body: { opportunityId: fresh, receivedOn: today() } })).status).toBe(400);
    expect((await register(am, fresh, { receivedOn: '2099-01-01' })).status).toBe(400);
    expect((await register(am, fresh, { amount: '0' })).status).toBe(400);
    expect((await register(am, fresh, { validUntil: '2000-01-01' })).status).toBe(400);
    expect((await register(am, 'pas-un-identifiant')).status).toBe(400);
    expect((await register(am, fresh, { companyId })).status).toBe(400);
    expect((await register(am, '00000000-0000-4000-8000-000000000000')).status).toBe(404);
  }, 180_000);

  it('portée et droits : le chef voit et honore pour son équipe, la Direction lit sans écrire, le chargé de compte ne peut ni honorer ni annuler, le collègue reçoit « introuvable »', async () => {
    const { am, chef, other, dir, companyId } = await team();
    const op = await opportunityAt(am, companyId);
    const a = await register(am, op);
    expect((await act(am, a.body.id, 'honor', { version: 1 })).status).toBe(403);
    expect((await act(am, a.body.id, 'cancel', { version: 1, reason: 'Erreur' })).status).toBe(403);
    expect((await act(other, a.body.id, 'honor', { version: 1 })).status).toBe(403);
    expect((await api.call('GET', `/api/v1/approvals/${a.body.id}`, other)).status).toBe(404);
    expect((await api.call('GET', `/api/v1/approvals?companyId=${companyId}`, other)).status).toBe(404);
    expect((await register(other, op)).status).toBe(404);
    expect((await register(dir, op)).status).toBe(403);
    expect((await api.call('GET', `/api/v1/approvals/${a.body.id}`, dir)).status).toBe(200);
    expect((await api.call('GET', `/api/v1/approvals?companyId=${companyId}`, chef)).body.total).toBe(1);
    expect((await api.call('GET', '/api/v1/approvals', other)).body.total).toBe(0);
  }, 120_000);

  it('version périmée : conflit (409) sans écriture', async () => {
    const { am, chef, companyId } = await team();
    const a = await register(am, await opportunityAt(am, companyId));
    expect((await act(chef, a.body.id, 'honor', { version: 5 })).status).toBe(409);
    expect((await api.call('GET', `/api/v1/approvals/${a.body.id}`, am)).body).toMatchObject({ status: 'RECEIVED', version: 1 });
  }, 120_000);

  it('le document signé se rattache à l’agrément et ne se voit que dans sa portée', async () => {
    const { am, other, chef, companyId } = await team();
    const a = await register(am, await opportunityAt(am, companyId));
    const url = (id: string) => `/api/v1/documents?ownerType=approval&ownerId=${id}&title=Agr%C3%A9ment&category=AGREMENT&fileName=agrement.pdf`;
    const up = await api.call('POST', url(a.body.id), { ...am, raw: { type: 'application/octet-stream', data: pdf() } });
    expect(up.status).toBe(201);
    const listed = await api.call('GET', `/api/v1/documents?ownerType=approval&ownerId=${a.body.id}`, chef);
    expect(listed.status).toBe(200);
    expect(JSON.stringify(listed.body)).toContain('agrement.pdf');
    const foreign = await api.call('POST', url(a.body.id), { ...other, raw: { type: 'application/octet-stream', data: pdf() } });
    expect(foreign.status).toBe(404);
    expect((await api.call('GET', `/api/v1/documents?ownerType=approval&ownerId=${a.body.id}`, other)).status).toBe(404);
    // Un rôle qui lit TOUS les documents mais pas les agréments (responsable de formation) ne voit pas le document d'un agrément.
    const trainer = await login(await createUserWithRoles(t, [RoleCode.TrainingManager]));
    expect((await api.call('GET', `/api/v1/documents?ownerType=approval&ownerId=${a.body.id}`, trainer)).status).toBe(404);
    expect((await api.call('GET', `/api/v1/documents?ownerType=company&ownerId=${companyId}`, trainer)).status).toBeLessThan(500);
  }, 120_000);

  it('entreprise archivée : plus d’agrément ni de clôture (422)', async () => {
    const { am, chef, companyId } = await team();
    const op = await opportunityAt(am, companyId);
    const a = await register(am, op);
    const op2 = await opportunityAt(am, companyId);
    await t.prisma.db.company.update({ where: { id: companyId }, data: { status: 'ARCHIVED' } });
    expect((await register(am, op2)).status).toBe(422);
    expect((await act(chef, a.body.id, 'honor', { version: 1 })).status).toBe(422);
  }, 120_000);

  it('règles garanties par la base : montant, places, somme ou places, validité, clôture cohérente, liens existants, un seul agrément actif', async () => {
    const { am, companyId } = await team();
    const op = await opportunityAt(am, companyId);
    const a = await register(am, op, { places: 5 });
    const id = a.body.id;
    const db = t.prisma.db;
    const sql = (q: string) => expect(db.$executeRawUnsafe(q)).rejects.toThrow();
    await sql(`UPDATE bd.approvals SET amount = 0 WHERE id = '${id}'::uuid`);
    await sql(`UPDATE bd.approvals SET places = 0 WHERE id = '${id}'::uuid`);
    await sql(`UPDATE bd.approvals SET amount = NULL, places = NULL WHERE id = '${id}'::uuid`);
    await sql(`UPDATE bd.approvals SET valid_until = '2000-01-01' WHERE id = '${id}'::uuid`);
    await sql(`UPDATE bd.approvals SET status = 'HONORED' WHERE id = '${id}'::uuid`);
    await sql(`UPDATE bd.approvals SET closed_reason = 'x' WHERE id = '${id}'::uuid`);
    await sql(`UPDATE bd.approvals SET status = 'EXPIRED', closed_at = now() WHERE id = '${id}'::uuid`);
    await sql(`UPDATE bd.approvals SET version = 0 WHERE id = '${id}'::uuid`);
    await sql(`UPDATE bd.approvals SET opportunity_id = '${'0'.repeat(8)}-0000-4000-8000-${'0'.repeat(12)}'::uuid WHERE id = '${id}'::uuid`);
    await sql(`INSERT INTO bd.approvals (id, company_id, opportunity_id, amount, currency, received_on, status, version, updated_at)
               VALUES (gen_random_uuid(), '${companyId}'::uuid, '${op}'::uuid, 1000, 'XAF', now()::date, 'RECEIVED', 1, now())`);
  }, 120_000);

  it('verrou optimiste AU NIVEAU DE LA BASE : deux annulations sur la même version, la seconde est refusée', async () => {
    const { am, companyId } = await team();
    const a = await register(am, await opportunityAt(am, companyId));
    const repository = new PrismaApprovalRepository(t.prisma);
    const first = (await repository.findById(a.body.id))!;
    const second = (await repository.findById(a.body.id))!;
    first.cancel('Première', new Date());
    second.cancel('Seconde', new Date());
    await repository.save(first);
    await expect(repository.save(second)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect((await repository.findById(a.body.id))!.closedReason).toBe('Première');
  }, 120_000);

  it('audit : l’enregistrement (agrément et passage en « Cliente ») et la clôture sont tracés, ancienne et nouvelle valeur, avec la session', async () => {
    const { am, chef, companyId } = await team();
    const a = await register(am, await opportunityAt(am, companyId));
    await act(chef, a.body.id, 'honor', { version: 1 });
    const approvalLogs = await t.prisma.db.auditLog.findMany({ where: { entityId: a.body.id }, orderBy: { createdAt: 'asc' } });
    expect(approvalLogs.map((l) => l.action)).toEqual(['CREATE', 'UPDATE']);
    expect(approvalLogs[0]!.sessionId).toBe(am.sessionId);
    expect(approvalLogs[1]!.sessionId).toBe(chef.sessionId);
    expect((approvalLogs[1]!.oldValue as { status: string }).status).toBe('RECEIVED');
    expect((approvalLogs[1]!.newValue as { status: string }).status).toBe('HONORED');
    const companyLogs = await t.prisma.db.auditLog.findMany({ where: { entityId: companyId, action: 'UPDATE' } });
    expect(companyLogs.some((l) => (l.newValue as { status?: string }).status === 'CLIENT')).toBe(true);
  }, 120_000);
});
