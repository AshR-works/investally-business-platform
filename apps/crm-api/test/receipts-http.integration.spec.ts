import 'reflect-metadata';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RoleCode } from '../src/modules/iam/domain/roles';
import { PrismaReceiptRepository } from '../src/modules/business-development/infrastructure/prisma-receipt.repository';
import { Api, createUserWithRoles, mfaSession, startRbacApp } from './support/rbac-http';
import { TestApp } from './support/test-app';

const describeDb = process.env.DATABASE_URL && process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;
const pdf = () => Buffer.from('%PDF-1.7\ndécharge signée\n%%EOF');
const today = () => new Date().toISOString().slice(0, 10);

/** S4.2b : décharges signées de bout en bout (HTTP + PostgreSQL) : droits, portée, états de l'offre, unicité, fichiers, audit. */
describeDb('Décharges (HTTP + PostgreSQL)', () => {
  const storageDir = mkdtempSync(join(tmpdir(), 'investally-receipts-it-'));
  let t: TestApp;
  let api: Api;
  let seq = 0;
  const ip = () => `10.96.${Math.floor(seq / 250)}.${(seq++ % 250) + 1}`;

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
    const dirUser = await createUserWithRoles(t, [RoleCode.Direction]);
    const [chef, am, other, dir] = [await login(chefUser), await login(amUser), await login(otherUser), await login(dirUser)];
    const company = await api.call('POST', '/api/v1/companies', { ...am, body: { name: `Société ${unique()}` } });
    expect(company.status).toBe(201);
    return { chef, am, other, dir, companyId: company.body.id as string };
  }
  type As = { token: string; ip: string };
  const offer = async (as: As, companyId: string, submit = true) => {
    const created = await api.call('POST', '/api/v1/offers', { ...as, body: { companyId, subject: `Formation ${unique()}`, amount: '4500000' } });
    expect(created.status).toBe(201);
    if (!submit) return created.body as { id: string; version: number };
    const sent = await api.call('POST', `/api/v1/offers/${created.body.id}/submit`, { ...as, body: { version: 1 } });
    expect(sent.status).toBe(200);
    return sent.body as { id: string; version: number };
  };
  const register = (as: As, offerId: string, extra: Record<string, unknown> = {}) =>
    api.call('POST', '/api/v1/receipts', { ...as, body: { offerId, receivedOn: today(), receivedBy: 'Alain Fotso', ...extra } });
  const status = async (as: As, offerId: string) => (await api.call('GET', `/api/v1/offers/${offerId}`, as)).body.status as string;

  it('cycle : décharge enregistrée → offre « décharge reçue » → fichier signé joint → annulation → offre « déposée » → nouvelle décharge', async () => {
    const { am, companyId } = await team();
    const o = await offer(am, companyId);
    const r = await register(am, o.id);
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ status: 'VALID', receivedBy: 'Alain Fotso', version: 1 });
    expect(await status(am, o.id)).toBe('RECEIPT_RECEIVED');
    const upload = await api.call('POST', `/api/v1/documents?ownerType=receipt&ownerId=${r.body.id}&title=D%C3%A9charge&category=DECHARGE&fileName=decharge.pdf`, { ...am, raw: { type: 'application/octet-stream', data: pdf() } });
    expect(upload.status).toBe(201);
    expect((await api.call('GET', `/api/v1/documents?ownerType=receipt&ownerId=${r.body.id}`, am)).body).toHaveLength(1);
    const cancelled = await api.call('POST', `/api/v1/receipts/${r.body.id}/cancel`, { ...am, body: { version: 1, reason: 'Mauvais fichier' } });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body).toMatchObject({ status: 'CANCELLED', cancelledReason: 'Mauvais fichier' });
    expect(await status(am, o.id)).toBe('SUBMITTED');
    expect((await register(am, o.id)).status).toBe(201);
    const list = await api.call('GET', `/api/v1/receipts?offerId=${o.id}`, am);
    expect(list.body.map((x: { status: string }) => x.status)).toEqual(['VALID', 'CANCELLED']);
  }, 120_000);

  it('une seule décharge valide : la seconde est refusée (409), y compris deux enregistrements simultanés', async () => {
    const { am, companyId } = await team();
    const o = await offer(am, companyId);
    expect((await register(am, o.id)).status).toBe(201);
    expect((await register(am, o.id)).status).toBe(409);
    const race = await offer(am, companyId);
    const results = await Promise.all([register(am, race.id), register(am, race.id)]);
    expect(results.map((x) => x.status).sort()).toEqual([201, 409]);
    const valid = await t.prisma.db.receipt.count({ where: { offerId: race.id, status: 'VALID' } });
    expect(valid).toBe(1);
  }, 120_000);

  it('refus : offre en brouillon (422), date future ou antérieure au dépôt (400/422), offre acceptée (422)', async () => {
    const { am, companyId } = await team();
    const draft = await offer(am, companyId, false);
    expect((await register(am, draft.id)).status).toBe(422);
    const o = await offer(am, companyId);
    const future = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    expect([400, 422]).toContain((await register(am, o.id, { receivedOn: future })).status);
    expect([400, 422]).toContain((await register(am, o.id, { receivedOn: '2020-01-01' })).status);
    expect((await register(am, o.id, { receivedOn: 'demain' })).status).toBe(400);
    expect((await register(am, o.id, { receivedBy: '' })).status).toBe(400);
    expect(await status(am, o.id)).toBe('SUBMITTED');
    const accepted = await offer(am, companyId);
    await api.call('POST', `/api/v1/offers/${accepted.id}/accept`, { ...am, body: { version: accepted.version } });
    expect((await register(am, accepted.id)).status).toBe(422);
  }, 120_000);

  it('portée et droits : chef et Direction lisent, le collègue reçoit « introuvable », la Direction n’écrit pas', async () => {
    const { am, chef, other, dir, companyId } = await team();
    const o = await offer(am, companyId);
    const r = await register(am, o.id);
    expect((await api.call('GET', `/api/v1/receipts/${r.body.id}`, chef)).status).toBe(200);
    expect((await api.call('GET', `/api/v1/receipts/${r.body.id}`, dir)).status).toBe(200);
    expect((await api.call('GET', `/api/v1/receipts/${r.body.id}`, other)).status).toBe(404);
    expect((await api.call('GET', `/api/v1/receipts?offerId=${o.id}`, other)).status).toBe(404);
    expect((await register(dir, o.id)).status).toBe(403);
    expect((await api.call('POST', `/api/v1/receipts/${r.body.id}/cancel`, { ...dir, body: { version: 1, reason: 'Direction' } })).status).toBe(403);
    expect((await api.call('POST', `/api/v1/receipts/${r.body.id}/cancel`, { ...other, body: { version: 1, reason: 'Collègue' } })).status).toBe(404);
  }, 120_000);

  it('fichiers : le fichier d’une décharge et le fichier d’une offre ne sont ni visibles ni déposables par un collègue', async () => {
    const { am, other, companyId } = await team();
    const o = await offer(am, companyId);
    const r = await register(am, o.id);
    const asOffer = await api.call('POST', `/api/v1/documents?ownerType=offer&ownerId=${o.id}&title=Offre&category=AUTRE&fileName=offre.pdf`, { ...am, raw: { type: 'application/octet-stream', data: pdf() } });
    expect(asOffer.status).toBe(201);
    for (const [type, id] of [['receipt', r.body.id], ['offer', o.id]]) {
      const attempt = await api.call('POST', `/api/v1/documents?ownerType=${type}&ownerId=${id}&title=Piege&fileName=piege.pdf`, { ...other, raw: { type: 'application/octet-stream', data: pdf() } });
      const missing = await api.call('POST', `/api/v1/documents?ownerType=${type}&ownerId=00000000-0000-7000-8000-000000000000&title=Piege&fileName=piege.pdf`, { ...other, raw: { type: 'application/octet-stream', data: pdf() } });
      expect([type, attempt.status, attempt.body]).toEqual([type, missing.status, missing.body]);
      expect((await api.call('GET', `/api/v1/documents?ownerType=${type}&ownerId=${id}`, other)).status).toBe(404);
    }
  }, 120_000);

  it('règles garanties par la base : une seule décharge valide, annulation cohérente, version positive', async () => {
    const { am, companyId } = await team();
    const o = await offer(am, companyId);
    const r = await register(am, o.id);
    const db = t.prisma.db;
    const other = await offer(am, companyId);
    const second = await register(am, other.id);
    await expect(db.$executeRawUnsafe(`UPDATE bd.receipts SET offer_id = '${o.id}'::uuid WHERE id = '${second.body.id}'::uuid`)).rejects.toThrow();
    await expect(db.$executeRawUnsafe(`UPDATE bd.receipts SET status = 'CANCELLED' WHERE id = '${r.body.id}'::uuid`)).rejects.toThrow();
    await expect(db.$executeRawUnsafe(`UPDATE bd.receipts SET cancelled_reason = 'x' WHERE id = '${r.body.id}'::uuid`)).rejects.toThrow();
    await expect(db.$executeRawUnsafe(`UPDATE bd.receipts SET version = 0 WHERE id = '${r.body.id}'::uuid`)).rejects.toThrow();
  }, 120_000);

  it('verrou optimiste AU NIVEAU DE LA BASE : deux annulations sur la même version, la seconde est refusée', async () => {
    const { am, companyId } = await team();
    const o = await offer(am, companyId);
    const r = await register(am, o.id);
    const repository = new PrismaReceiptRepository(t.prisma);
    const first = (await repository.findById(r.body.id))!;
    const second = (await repository.findById(r.body.id))!;
    first.cancel('Première', new Date());
    second.cancel('Seconde', new Date());
    await repository.save(first);
    await expect(repository.save(second)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect((await repository.findById(r.body.id))!.cancelledReason).toBe('Première');
  }, 120_000);

  it('entreprise archivée : plus de décharge ni d’annulation (422) ; la décharge reste lisible', async () => {
    const { am, companyId } = await team();
    const o = await offer(am, companyId);
    const r = await register(am, o.id);
    const spare = await offer(am, companyId);
    await t.prisma.db.company.update({ where: { id: companyId }, data: { status: 'ARCHIVED' } });
    expect((await register(am, spare.id)).status).toBe(422);
    expect((await api.call('POST', `/api/v1/receipts/${r.body.id}/cancel`, { ...am, body: { version: 1, reason: 'Archivée' } })).status).toBe(422);
    expect((await api.call('GET', `/api/v1/receipts/${r.body.id}`, am)).status).toBe(200);
  }, 120_000);

  it('audit : la décharge et le changement d’état de l’offre sont tracés ensemble, avec la session', async () => {
    const { am, companyId } = await team();
    const o = await offer(am, companyId);
    const r = await register(am, o.id);
    await api.call('POST', `/api/v1/receipts/${r.body.id}/cancel`, { ...am, body: { version: 1, reason: 'Mauvais fichier' } });
    const receiptLogs = await t.prisma.db.auditLog.findMany({ where: { entityId: r.body.id }, orderBy: { createdAt: 'asc' } });
    expect(receiptLogs.map((l) => l.action)).toEqual(['CREATE', 'UPDATE']);
    expect(receiptLogs.every((l) => l.sessionId === am.sessionId)).toBe(true);
    const offerLogs = await t.prisma.db.auditLog.findMany({ where: { entityId: o.id }, orderBy: { createdAt: 'asc' } });
    expect(offerLogs.map((l) => (l.newValue as { status: string }).status)).toEqual(['DRAFT', 'SUBMITTED', 'RECEIPT_RECEIVED', 'SUBMITTED']);
  }, 120_000);
});
