import 'reflect-metadata';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RoleCode } from '../src/modules/iam/domain/roles';
import { Api, createUserWithRoles, mfaSession, startRbacApp } from './support/rbac-http';
import { TestApp } from './support/test-app';

const describeDb = process.env.DATABASE_URL && process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;

/** S4.0 : facilitateur et commission de bout en bout (HTTP + PostgreSQL), droits et cohérence de la base. */
describeDb('Facilitateurs et commissions (HTTP + PostgreSQL)', () => {
  const storageDir = mkdtempSync(join(tmpdir(), 'investally-fac-it-'));
  let t: TestApp;
  let api: Api;
  let seq = 0;
  const ip = () => `10.91.${Math.floor(seq / 250)}.${(seq++ % 250) + 1}`;

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
    return { token: session.token, ip: addr };
  };
  const unique = () => Math.random().toString(36).slice(2, 8);
  const body = (extra: Record<string, unknown> = {}) => ({
    name: `Société ${unique()}`,
    sector: 'Banque',
    email: 'Contact@Exemple.CM',
    phone: '+237 222 33 44 55',
    facilitation: {
      newFacilitator: { lastName: 'Mbarga', firstName: 'Paul', phone: '+237 699 00 11 22', comment: 'Connaît le DAF' },
      contactMethod: 'WHATSAPP_MESSAGE',
      isCompanyEmployee: true,
      commission: { type: 'PERCENT', value: '7.5' },
    },
    ...extra,
  });

  it('crée entreprise + facilitateur + commission ; coordonnées normalisées ; le responsable commercial relit la commission', async () => {
    const chef = await login(await createUserWithRoles(t, [RoleCode.HeadOfSales]));
    const created = await api.call('POST', '/api/v1/companies', { ...chef, body: body() });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ email: 'contact@exemple.cm', phone: '+237 222 33 44 55' });
    expect(created.body.facilitation).toMatchObject({
      contactMethod: 'WHATSAPP_MESSAGE', isCompanyEmployee: true,
      facilitator: { firstName: 'Paul', lastName: 'Mbarga', comment: 'Connaît le DAF' },
      commission: { type: 'PERCENT', value: '7.50', currency: null },
    });
    const read = await api.call('GET', `/api/v1/companies/${created.body.id}`, chef);
    expect(read.body.facilitation.commission).toEqual({ type: 'PERCENT', value: '7.50', currency: null });
  }, 60_000);

  it('la Finance (lecture sur tout) voit la commission ; le Support voit l\'entreprise mais NI facilitateur NI commission', async () => {
    const chef = await login(await createUserWithRoles(t, [RoleCode.HeadOfSales]));
    const finance = await login(await createUserWithRoles(t, [RoleCode.Finance]));
    const support = await login(await createUserWithRoles(t, [RoleCode.Support]));
    const created = await api.call('POST', '/api/v1/companies', { ...chef, body: body({ name: `Société ${unique()}` }) });
    expect(created.status).toBe(201);

    // La Finance est en portée « Tous » pour les commissions et les facilitateurs.
    const seenByFinance = await api.call('GET', `/api/v1/companies/${created.body.id}`, finance);
    expect(seenByFinance.body.facilitation.commission.value).toBe('7.50');
    expect(seenByFinance.body.facilitation.facilitator.lastName).toBe('Mbarga');

    const seenBySupport = await api.call('GET', `/api/v1/companies/${created.body.id}`, support);
    expect(seenBySupport.status).toBe(200);
    expect(seenBySupport.body.facilitation.facilitator).toBeNull();
    expect(seenBySupport.body.facilitation).not.toHaveProperty('commission');
    const text = seenBySupport.bytes.toString('utf8');
    expect(text).not.toContain('Mbarga');
    expect(text).not.toContain('7.50');
    expect(text).not.toContain('commission');
  }, 60_000);

  it('le chargé de compte crée entreprise et facilitateur mais ne peut pas fixer de commission (403, rien n\'est créé)', async () => {
    const am = await login(await createUserWithRoles(t, [RoleCode.AccountManager]));
    const name = `Société ${unique()}`;
    const refused = await api.call('POST', '/api/v1/companies', { ...am, body: body({ name }) });
    expect(refused.status).toBe(403);
    const none = await api.call('GET', `/api/v1/companies?search=${encodeURIComponent(name)}`, am);
    expect(none.body.total).toBe(0);

    const withoutCommission = body({ name });
    delete (withoutCommission.facilitation as { commission?: unknown }).commission;
    const ok = await api.call('POST', '/api/v1/companies', { ...am, body: withoutCommission });
    expect(ok.status).toBe(201);
    expect(ok.body.facilitation.facilitator.firstName).toBe('Paul');
    expect(ok.body.facilitation).not.toHaveProperty('commission');
  }, 60_000);

  it('les rôles sans droit sur les facilitateurs (Support, RH) reçoivent 403 sur leur liste et leur création', async () => {
    const support = await login(await createUserWithRoles(t, [RoleCode.Support]));
    expect((await api.call('GET', '/api/v1/facilitators', support)).status).toBe(403);
    const create = await api.call('POST', '/api/v1/facilitators', { ...support, body: { lastName: 'X', firstName: 'Y', phone: '+237 600 00 00 00' } });
    expect(create.status).toBe(403);
  }, 60_000);

  it('un identifiant de propriétaire dans le corps est refusé (le propriétaire vient de la session)', async () => {
    const am = await login(await createUserWithRoles(t, [RoleCode.AccountManager]));
    const res = await api.call('POST', '/api/v1/facilitators', { ...am, body: { lastName: 'X', firstName: 'Y', phone: '+237 600 00 00 00', ownerUserId: '00000000-0000-7000-8000-000000000001' } });
    expect(res.status).toBe(400);
  }, 60_000);

  it('validations HTTP : e-mail, téléphone, méthode de contact, commission', async () => {
    const chef = await login(await createUserWithRoles(t, [RoleCode.HeadOfSales]));
    const bad = async (patch: Record<string, unknown>, facilitationPatch: Record<string, unknown> = {}) => {
      const b = body(patch);
      Object.assign(b.facilitation, facilitationPatch);
      return (await api.call('POST', '/api/v1/companies', { ...chef, body: b })).status;
    };
    expect(await bad({ email: 'pas-un-mail' })).toBe(400);
    expect(await bad({ phone: 'abc' })).toBe(400);
    expect(await bad({}, { contactMethod: 'PIGEON' })).toBe(400);
    expect(await bad({}, { commission: { type: 'FIXED', value: '100' } })).toBe(400); // devise manquante
    expect(await bad({}, { commission: { type: 'PERCENT', value: '150' } })).toBe(400);
  }, 60_000);

  it('la base elle-même refuse une commission incohérente (contrainte CHECK, indépendante du code)', async () => {
    const chef = await login(await createUserWithRoles(t, [RoleCode.HeadOfSales]));
    const created = await api.call('POST', '/api/v1/companies', { ...chef, body: body() });
    const attempt = (sql: string) => t.prisma.db.$executeRawUnsafe(sql);
    const id = created.body.id as string;
    for (const set of ["commission_value = 250", "commission_currency = 'XAF'", 'commission_type = NULL', "commission_type = 'FIXED'"]) {
      const outcome = await attempt(`UPDATE bd.company_facilitations SET ${set} WHERE company_id = '${id}'`).then(() => 'accepté', () => 'refusé');
      expect([set, outcome]).toEqual([set, 'refusé']);
    }
  }, 60_000);

  it('audit : la création de l\'entreprise ET celle du facilitateur sont tracées, commission comprise', async () => {
    const chef = await login(await createUserWithRoles(t, [RoleCode.HeadOfSales]));
    const created = await api.call('POST', '/api/v1/companies', { ...chef, body: body() });
    const companyId = created.body.id as string;
    const facilitatorId = created.body.facilitation.facilitatorId as string;
    const logs = await t.prisma.db.auditLog.findMany({ where: { entityId: { in: [companyId, facilitatorId] } } });
    expect(logs.map((l) => l.entityType).sort()).toEqual(['Company', 'Facilitator']);
    expect(JSON.stringify(logs.find((l) => l.entityType === 'Company')?.newValue)).toContain('PERCENT');
  }, 60_000);
});
