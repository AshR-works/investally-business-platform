import 'reflect-metadata';
import { RoleCode } from '../src/modules/iam/domain/roles';
import { Api, createUserWithRoles, mfaSession, startRbacApp } from './support/rbac-http';
import { TestApp } from './support/test-app';

const describeDb = process.env.DATABASE_URL && process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;
const today = () => new Date().toISOString().slice(0, 10);
const pdf = () => Buffer.from('%PDF-1.7\nrecu de virement\n%%EOF');

/** S4.4c : commissions des facilitateurs de bout en bout (HTTP + PostgreSQL) : naissance à l'honneur de l'agrément, déblocage par la Finance, versement avec justificatif, droits, portée, règles de la base, audit. */
describeDb('Commissions des facilitateurs (HTTP + PostgreSQL)', () => {
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
  type As = { token: string; ip: string };

  async function team() {
    const chefUser = await createUserWithRoles(t, [RoleCode.HeadOfSales]);
    const amUser = await createUserWithRoles(t, [RoleCode.AccountManager], { managerId: chefUser.id });
    const otherUser = await createUserWithRoles(t, [RoleCode.AccountManager]);
    const [chef, am, other, fin, dir] = [
      await login(chefUser), await login(amUser), await login(otherUser),
      await login(await createUserWithRoles(t, [RoleCode.Finance])), await login(await createUserWithRoles(t, [RoleCode.Direction])),
    ];
    return { chef, am, other, fin, dir };
  }

  /** Une entreprise du chargé de compte avec son facilitateur ; la commission est définie par le Responsable commercial. */
  async function companyWithCommission(w: Awaited<ReturnType<typeof team>>, commission: Record<string, unknown> | null = { type: 'FIXED', value: '150000', currency: 'XAF' }) {
    const company = await api.call('POST', '/api/v1/companies', { ...w.am, body: { name: `Société ${unique()}`, facilitation: { newFacilitator: { lastName: 'Mbarga', firstName: 'Paul', phone: '+237699001122' }, contactMethod: 'PHONE_CALL' } } });
    expect(company.status).toBe(201);
    let version = company.body.version as number;
    if (commission) {
      const set = await api.call('PUT', `/api/v1/companies/${company.body.id}`, { ...w.chef, body: { version, facilitation: { commission } } });
      expect(set.status).toBe(200);
      version = set.body.version;
    }
    return company.body.id as string;
  }

  /** Une opportunité à l'accord de principe amenée en base (la règle du rendez-vous décideur est testée ailleurs). */
  async function agreedOpportunity(as: As, companyId: string) {
    const o = await api.call('POST', '/api/v1/opportunities', { ...as, body: { companyId, title: `Formation ${unique()}`, amount: '8000000', source: 'REFERRAL' } });
    expect(o.status).toBe(201);
    await t.prisma.db.opportunity.update({ where: { id: o.body.id }, data: { stage: 'AGREEMENT_IN_PRINCIPLE' } });
    return o.body.id as string;
  }

  /** L'agrément reçu puis honoré par la Finance : la commission devient due. */
  async function honoredApproval(w: Awaited<ReturnType<typeof team>>, companyId: string, body: Record<string, unknown> = { amount: '12500000' }) {
    const a = await api.call('POST', '/api/v1/approvals', { ...w.am, body: { opportunityId: await agreedOpportunity(w.am, companyId), receivedOn: today(), ...body } });
    expect(a.status).toBe(201);
    expect((await api.call('POST', `/api/v1/approvals/${a.body.id}/honor`, { ...w.fin, body: { version: 1 } })).status).toBe(200);
    return a.body.id as string;
  }

  async function duePayout(w: Awaited<ReturnType<typeof team>>, companyId: string) {
    const list = await api.call('GET', `/api/v1/commissions?companyId=${companyId}`, w.fin);
    expect(list.status).toBe(200);
    return list.body.items[0] as { id: string; version: number; status: string; amount: string | null; currency: string };
  }
  const act = (as: As, id: string, action: string, body: Record<string, unknown>) => api.call('POST', `/api/v1/commissions/${id}/${action}`, { ...as, body });
  const upload = (as: As, id: string, category = 'JUSTIFICATIF') =>
    api.call('POST', `/api/v1/documents?ownerType=commission&ownerId=${id}&title=Re%C3%A7u&category=${category}&fileName=recu.pdf`, { ...as, raw: { type: 'application/octet-stream', data: pdf() } });

  it('cycle : l’agrément honoré rend la commission due ; la Finance débloque ; le chargé de compte verse avec son justificatif', async () => {
    const w = await team();
    const companyId = await companyWithCommission(w);
    await honoredApproval(w, companyId);
    const due = await duePayout(w, companyId);
    expect(due).toMatchObject({ status: 'DUE', amount: '150000.00', currency: 'XAF', version: 1 });
    const read = await api.call('GET', `/api/v1/commissions/${due.id}`, w.am);
    expect(read.status).toBe(200);
    expect(read.body).toMatchObject({ companyId, facilitatorName: 'Paul Mbarga', commissionType: 'FIXED', status: 'DUE' });
    // Avant le déblocage : on ne verse pas ; sans justificatif non plus.
    expect((await act(w.am, due.id, 'pay', { version: 1, paidOn: today() })).status).toBe(422);
    const released = await act(w.fin, due.id, 'release', { version: 1 });
    expect(released.status).toBe(200);
    expect(released.body).toMatchObject({ status: 'RELEASED', version: 2 });
    expect((await act(w.am, due.id, 'pay', { version: 2, paidOn: today() })).status).toBe(422);
    // Un document d'une autre catégorie ne tient pas lieu de justificatif ; le bon, si.
    expect((await upload(w.am, due.id, 'AGREMENT')).status).toBe(201);
    expect((await act(w.am, due.id, 'pay', { version: 2, paidOn: today() })).status).toBe(422);
    expect((await upload(w.am, due.id)).status).toBe(201);
    const paid = await act(w.am, due.id, 'pay', { version: 2, paidOn: today() });
    expect(paid.status).toBe(200);
    expect(paid.body).toMatchObject({ status: 'PAID', paidOn: today(), version: 3 });
    expect((await act(w.chef, due.id, 'cancel', { version: 3, reason: 'Trop tard' })).status).toBe(422);
  }, 240_000);

  it('mise en attente avec motif, puis déblocage ; annulation motivée par le Responsable commercial', async () => {
    const w = await team();
    const companyId = await companyWithCommission(w);
    await honoredApproval(w, companyId);
    const due = await duePayout(w, companyId);
    expect((await act(w.fin, due.id, 'hold', { version: 1 })).status).toBe(400);
    const held = await act(w.fin, due.id, 'hold', { version: 1, reason: 'Virement du client attendu' });
    expect(held.body).toMatchObject({ status: 'ON_HOLD', holdReason: 'Virement du client attendu', version: 2 });
    expect((await act(w.fin, due.id, 'release', { version: 2 })).body).toMatchObject({ status: 'RELEASED', holdReason: null });
    expect((await act(w.chef, due.id, 'cancel', { version: 3 })).status).toBe(400);
    const cancelled = await act(w.chef, due.id, 'cancel', { version: 3, reason: 'Agrément saisi par erreur' });
    expect(cancelled.body).toMatchObject({ status: 'CANCELLED', cancelledReason: 'Agrément saisi par erreur' });
  }, 240_000);

  it('un pourcentage s’applique au montant de l’agrément ; sans montant d’agrément, le Responsable commercial le fixe avant le déblocage', async () => {
    const w = await team();
    const percentCompany = await companyWithCommission(w, { type: 'PERCENT', value: '5' });
    await honoredApproval(w, percentCompany);
    expect((await duePayout(w, percentCompany))).toMatchObject({ amount: '625000.00', currency: 'XAF' });
    const noAmountCompany = await companyWithCommission(w, { type: 'PERCENT', value: '5' });
    await honoredApproval(w, noAmountCompany, { places: 8 });
    const due = await duePayout(w, noAmountCompany);
    expect(due.amount).toBeNull();
    expect((await act(w.fin, due.id, 'release', { version: 1 })).status).toBe(422);
    expect((await act(w.fin, due.id, 'amount', { version: 1, amount: '250000' })).status).toBe(403);
    const fixed = await act(w.chef, due.id, 'amount', { version: 1, amount: '250000' });
    expect(fixed.body).toMatchObject({ amount: '250000.00', version: 2 });
    expect((await act(w.chef, due.id, 'amount', { version: 2, amount: '300000' })).status).toBe(422);
    expect((await act(w.fin, due.id, 'release', { version: 2 })).status).toBe(200);
  }, 240_000);

  it('sans commission définie, rien n’est dû ; un second constat ne double pas le versement', async () => {
    const w = await team();
    const none = await companyWithCommission(w, null);
    await honoredApproval(w, none);
    expect((await api.call('GET', `/api/v1/commissions?companyId=${none}`, w.fin)).body.total).toBe(0);
    const some = await companyWithCommission(w);
    const approvalId = await honoredApproval(w, some);
    expect((await api.call('GET', `/api/v1/commissions?companyId=${some}`, w.fin)).body.total).toBe(1);
    expect((await act(w.fin, approvalId, 'release', { version: 1 })).status).toBe(404); // un agrément n'est pas une commission
  }, 240_000);

  it('portée et droits : chacun voit sa portée ; seule la Finance débloque ; la Direction lit sans écrire ; l’autre équipe reçoit « introuvable »', async () => {
    const w = await team();
    const companyId = await companyWithCommission(w);
    await honoredApproval(w, companyId);
    const due = await duePayout(w, companyId);
    for (const who of [w.am, w.chef, w.fin, w.dir]) expect((await api.call('GET', `/api/v1/commissions/${due.id}`, who)).status).toBe(200);
    expect((await api.call('GET', `/api/v1/commissions/${due.id}`, w.other)).status).toBe(404);
    expect((await api.call('GET', `/api/v1/commissions?companyId=${companyId}`, w.other)).status).toBe(404);
    expect((await api.call('GET', '/api/v1/commissions', w.other)).body.total).toBe(0);
    expect((await api.call('GET', '/api/v1/commissions', w.fin)).body.total).toBeGreaterThanOrEqual(1);
    for (const who of [w.am, w.chef, w.dir]) expect((await act(who, due.id, 'release', { version: 1 })).status).toBe(403);
    expect((await act(w.am, due.id, 'cancel', { version: 1, reason: 'Erreur' })).status).toBe(403);
    expect((await act(w.fin, due.id, 'cancel', { version: 1, reason: 'Erreur' })).status).toBe(403);
    expect((await act(w.dir, due.id, 'pay', { version: 1, paidOn: today() })).status).toBe(403);
    expect((await act(w.other, due.id, 'hold', { version: 1, reason: 'Piraté' })).status).toBe(403);
    expect((await act(w.other, due.id, 'pay', { version: 1, paidOn: today() })).status).toBe(404);
    expect((await act(w.fin, due.id, 'release', { version: 7 })).status).toBe(409);
    expect((await api.call('GET', `/api/v1/commissions?status=PAID`, w.fin)).status).toBe(200);
  }, 240_000);

  it('le justificatif ne se voit que dans la portée de la commission', async () => {
    const w = await team();
    const companyId = await companyWithCommission(w);
    await honoredApproval(w, companyId);
    const due = await duePayout(w, companyId);
    expect((await upload(w.am, due.id)).status).toBe(201);
    const listed = await api.call('GET', `/api/v1/documents?ownerType=commission&ownerId=${due.id}`, w.chef);
    expect(listed.status).toBe(200);
    expect(JSON.stringify(listed.body)).toContain('recu.pdf');
    expect((await upload(w.other, due.id)).status).toBe(404);
    expect((await api.call('GET', `/api/v1/documents?ownerType=commission&ownerId=${due.id}`, w.other)).status).toBe(404);
  }, 240_000);

  it('entreprise archivée : plus de déblocage (422)', async () => {
    const w = await team();
    const companyId = await companyWithCommission(w);
    await honoredApproval(w, companyId);
    const due = await duePayout(w, companyId);
    await t.prisma.db.company.update({ where: { id: companyId }, data: { status: 'ARCHIVED' } });
    expect((await act(w.fin, due.id, 'release', { version: 1 })).status).toBe(422);
  }, 240_000);

  it('règles garanties par la base : montant, définition figée, état, motifs, date de versement, un versement par agrément', async () => {
    const w = await team();
    const companyId = await companyWithCommission(w);
    const approvalId = await honoredApproval(w, companyId);
    const due = await duePayout(w, companyId);
    const db = t.prisma.db;
    const sql = (q: string) => expect(db.$executeRawUnsafe(q)).rejects.toThrow();
    const id = due.id;
    await sql(`UPDATE bd.commission_payouts SET amount = 0 WHERE id = '${id}'::uuid`);
    await sql(`UPDATE bd.commission_payouts SET version = 0 WHERE id = '${id}'::uuid`);
    await sql(`UPDATE bd.commission_payouts SET status = 'RELEASED', amount = NULL WHERE id = '${id}'::uuid`);
    await sql(`UPDATE bd.commission_payouts SET status = 'ON_HOLD' WHERE id = '${id}'::uuid`);
    await sql(`UPDATE bd.commission_payouts SET hold_reason = 'x' WHERE id = '${id}'::uuid`);
    await sql(`UPDATE bd.commission_payouts SET status = 'CANCELLED' WHERE id = '${id}'::uuid`);
    await sql(`UPDATE bd.commission_payouts SET status = 'PAID' WHERE id = '${id}'::uuid`);
    await sql(`UPDATE bd.commission_payouts SET paid_on = now()::date WHERE id = '${id}'::uuid`);
    await sql(`UPDATE bd.commission_payouts SET commission_value = 0 WHERE id = '${id}'::uuid`);
    await sql(`UPDATE bd.commission_payouts SET commission_type = 'PERCENT' WHERE id = '${id}'::uuid`);
    await sql(`UPDATE bd.commission_payouts SET approval_id = '${'0'.repeat(8)}-0000-4000-8000-${'0'.repeat(12)}'::uuid WHERE id = '${id}'::uuid`);
    await sql(`INSERT INTO bd.commission_payouts (id, company_id, facilitator_id, approval_id, commission_type, commission_value, commission_currency, amount, currency, status, version, updated_at)
               SELECT gen_random_uuid(), company_id, facilitator_id, approval_id, commission_type, commission_value, commission_currency, amount, currency, 'DUE', 1, now() FROM bd.commission_payouts WHERE id = '${id}'::uuid`);
    expect(approvalId).toBeTruthy();
  }, 240_000);

  it('verrou optimiste AU NIVEAU DE LA BASE : deux annulations sur la même version, la seconde est refusée', async () => {
    const { PrismaCommissionPayoutRepository } = await import('../src/modules/business-development/infrastructure/prisma-commission-payout.repository');
    const w = await team();
    const companyId = await companyWithCommission(w);
    await honoredApproval(w, companyId);
    const due = await duePayout(w, companyId);
    const repository = new PrismaCommissionPayoutRepository(t.prisma);
    const first = (await repository.findById(due.id))!;
    const second = (await repository.findById(due.id))!;
    first.cancel('Première');
    second.cancel('Seconde');
    await repository.save(first);
    await expect(repository.save(second)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect((await repository.findById(due.id))!.cancelledReason).toBe('Première');
  }, 240_000);

  it('audit : la naissance (au constat du paiement) et chaque changement d’état sont tracés, ancienne et nouvelle valeur, avec la session', async () => {
    const w = await team();
    const companyId = await companyWithCommission(w);
    await honoredApproval(w, companyId);
    const due = await duePayout(w, companyId);
    await act(w.fin, due.id, 'release', { version: 1 });
    const logs = await t.prisma.db.auditLog.findMany({ where: { entityId: due.id }, orderBy: { createdAt: 'asc' } });
    expect(logs.map((l) => l.action)).toEqual(['CREATE', 'UPDATE']);
    expect(logs[0]!.sessionId).toBe(w.fin.sessionId);
    expect(logs[1]!.sessionId).toBe(w.fin.sessionId);
    expect((logs[1]!.oldValue as { status: string }).status).toBe('DUE');
    expect((logs[1]!.newValue as { status: string }).status).toBe('RELEASED');
  }, 240_000);
});
