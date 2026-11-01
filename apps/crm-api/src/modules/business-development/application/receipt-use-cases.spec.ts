import { ActorContext, Page } from '../../../shared-kernel';
import { AuditAction, AuditRecord } from '../../audit';
import type { AccessContext } from '../../iam';
import { RoleCode, resolveGrants } from '../../iam';
import { InMemoryOffers } from '../../../../test/support/in-memory-offers';
import { InMemoryReceipts } from '../../../../test/support/in-memory-receipts';
import { Company } from '../domain/company';
import { CompanyName } from '../domain/company-name';
import { CompanyRepository } from '../domain/company-repository';
import { Offer, OfferStatus } from '../domain/offer';
import { CancelReceiptUseCase, GetReceiptHandler, ListReceiptsHandler, RegisterReceiptUseCase } from './receipt-use-cases';

class InMemoryCompanies implements CompanyRepository {
  readonly items: Company[] = [];
  async save(company: Company) { if (!this.items.includes(company)) this.items.push(company); }
  async findById(id: string) { return this.items.find((c) => c.id === id) ?? null; }
  async existsByName(name: CompanyName) { return this.items.some((c) => c.name.normalized === name.normalized); }
  async list(): Promise<Page<Company>> { return { items: this.items, total: this.items.length, page: 1, pageSize: 20 }; }
}

const actor: ActorContext = { userId: 'u1', sessionId: 's1', ipAddress: '10.0.0.1', device: 'jest' };
const as = (role: RoleCode, actorId: string, teamMemberIds: string[] = []): AccessContext => ({ actorId, grants: resolveGrants(role), teamMemberIds });
const now = new Date('2026-11-04T10:00:00Z');
const submittedAt = new Date('2026-11-02T09:00:00Z');

function build() {
  const companies = new InMemoryCompanies();
  const offers = new InMemoryOffers(companies);
  const receipts = new InMemoryReceipts();
  const audit: AuditRecord[] = [];
  let seq = 0;
  const recorder = { record: async (r: AuditRecord) => { audit.push(r); } };
  const unitOfWork = { run: <T>(work: () => Promise<T>) => work() };
  const clock = { now: () => now };
  const ids = { next: () => `rc-${++seq}` };
  const company = (id: string, owner: string) => {
    const c = Company.register({ id, name: `Société ${id}`, ownerUserId: owner, now });
    companies.items.push(c);
    return c;
  };
  const offer = (id: string, companyId: string, status: OfferStatus = OfferStatus.Submitted) => {
    const o = Offer.create({ id, reference: `OFF-2026-000${offers.items.length + 1}`, companyId, subject: 'Formation', amount: '100000', now: submittedAt });
    if (status !== OfferStatus.Draft) o.submit(submittedAt);
    if (status === OfferStatus.ReceiptReceived) o.receiptReceived();
    offers.items.push(o);
    return o;
  };
  return {
    companies, offers, receipts, audit, company, offer,
    register: new RegisterReceiptUseCase(receipts, offers, companies, recorder, unitOfWork, clock, ids),
    cancel: new CancelReceiptUseCase(receipts, offers, companies, recorder, unitOfWork, clock),
    get: new GetReceiptHandler(receipts, offers, companies),
    list: new ListReceiptsHandler(receipts, offers, companies),
  };
}

const am1 = as(RoleCode.AccountManager, 'am1');
const am2 = as(RoleCode.AccountManager, 'am2');
const chef = as(RoleCode.HeadOfSales, 'chef', ['am1']);
const base = { receivedOn: '2026-11-03', receivedBy: 'Alain Fotso' };

describe('Décharges — enregistrement', () => {
  it('enregistre la décharge d’une offre déposée : l’offre passe à « décharge reçue », deux traces d’audit', async () => {
    const w = build(); w.company('c1', 'am1'); w.offer('o1', 'c1');
    const view = await w.register.execute({ offerId: 'o1', ...base, access: am1, actor });
    expect(view).toMatchObject({ offerReference: 'OFF-2026-0001', receivedOn: '2026-11-03', receivedBy: 'Alain Fotso', status: 'VALID', version: 1 });
    expect(w.offers.items[0]!.status).toBe(OfferStatus.ReceiptReceived);
    expect(w.audit.map((a) => [a.entityType, a.action])).toEqual([['Receipt', AuditAction.Create], ['Offer', AuditAction.Update]]);
    expect((w.audit[1]!.oldValue as { status: string }).status).toBe('SUBMITTED');
    expect((w.audit[1]!.newValue as { status: string }).status).toBe('RECEIPT_RECEIVED');
  });
  it('une seule décharge valide par offre : la seconde est un conflit, rien n’est créé', async () => {
    const w = build(); w.company('c1', 'am1'); w.offer('o1', 'c1');
    await w.register.execute({ offerId: 'o1', ...base, access: am1, actor });
    await expect(w.register.execute({ offerId: 'o1', ...base, access: am1, actor })).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(w.receipts.items).toHaveLength(1);
  });
  it.each([OfferStatus.Draft, OfferStatus.Accepted, OfferStatus.Refused, OfferStatus.Withdrawn])('refuse une offre %s (seule une offre déposée attend sa décharge)', async (status) => {
    const w = build(); w.company('c1', 'am1');
    const o = w.offer('o1', 'c1', OfferStatus.Draft);
    if (status === OfferStatus.Accepted) { o.submit(submittedAt); o.accept(now); }
    if (status === OfferStatus.Refused) { o.submit(submittedAt); o.refuse(now); }
    if (status === OfferStatus.Withdrawn) o.withdraw('Client indisponible', now);
    await expect(w.register.execute({ offerId: 'o1', ...base, access: am1, actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION', message: expect.stringContaining('Seule une offre déposée') });
    expect(w.receipts.items).toHaveLength(0);
    expect(w.audit).toHaveLength(0);
  });
  it.each([[{ receivedOn: '2026-11-05' }], [{ receivedOn: '2026-11-01' }], [{ receivedOn: 'demain' }], [{ receivedBy: '' }]])('refuse la saisie %j sans toucher à l’offre', async (patch) => {
    const w = build(); w.company('c1', 'am1'); w.offer('o1', 'c1');
    await expect(w.register.execute({ offerId: 'o1', ...base, ...patch, access: am1, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(w.offers.items[0]!.status).toBe(OfferStatus.Submitted);
    expect(w.receipts.items).toHaveLength(0);
  });
  it('IDOR : l’offre d’un collègue est « introuvable », comme un identifiant inexistant, et rien n’est créé', async () => {
    const w = build(); w.company('c1', 'am1'); w.offer('o1', 'c1');
    const real = await w.register.execute({ offerId: 'o1', ...base, access: am2, actor }).catch((e) => e);
    const missing = await w.register.execute({ offerId: 'inconnue', ...base, access: am2, actor }).catch((e) => e);
    expect(real).toMatchObject({ code: 'NOT_FOUND' });
    expect(real.message).toBe(missing.message);
    expect(w.receipts.items).toHaveLength(0);
    expect(w.offers.items[0]!.status).toBe(OfferStatus.Submitted);
  });
  it('le Responsable commercial enregistre pour son équipe ; Direction, Support et Finance ne le peuvent pas', async () => {
    const w = build(); w.company('c1', 'am1'); w.offer('o1', 'c1'); w.offer('o2', 'c1');
    await expect(w.register.execute({ offerId: 'o1', ...base, access: chef, actor })).resolves.toBeDefined();
    for (const role of [RoleCode.Direction, RoleCode.Support, RoleCode.Finance]) {
      await expect(w.register.execute({ offerId: 'o2', ...base, access: as(role, 'x'), actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    }
  });
  it('une entreprise archivée fige ses décharges', async () => {
    const w = build(); w.company('c1', 'am1').archive(); w.offer('o1', 'c1');
    await expect(w.register.execute({ offerId: 'o1', ...base, access: am1, actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
  });
});

describe('Décharges — annulation', () => {
  async function withReceipt() {
    const w = build(); w.company('c1', 'am1'); w.offer('o1', 'c1');
    const receipt = await w.register.execute({ offerId: 'o1', ...base, access: am1, actor });
    w.audit.length = 0;
    return { w, receipt };
  }
  it('annule avec un motif : l’offre redevient « déposée », deux traces d’audit avant/après', async () => {
    const { w, receipt } = await withReceipt();
    const view = await w.cancel.execute({ id: receipt.id, version: receipt.version, reason: 'Mauvais fichier', access: am1, actor });
    expect(view).toMatchObject({ status: 'CANCELLED', cancelledReason: 'Mauvais fichier' });
    expect(w.offers.items[0]!.status).toBe(OfferStatus.Submitted);
    expect(w.audit.map((a) => a.entityType)).toEqual(['Receipt', 'Offer']);
    expect((w.audit[0]!.oldValue as { status: string }).status).toBe('VALID');
  });
  it('après annulation, une nouvelle décharge peut être enregistrée', async () => {
    const { w, receipt } = await withReceipt();
    await w.cancel.execute({ id: receipt.id, version: receipt.version, reason: 'Mauvais fichier', access: am1, actor });
    await expect(w.register.execute({ offerId: 'o1', ...base, access: am1, actor })).resolves.toMatchObject({ status: 'VALID' });
    expect(w.receipts.items.filter((r) => r.status === 'VALID')).toHaveLength(1);
  });
  it.each([[undefined], ['ok']])('refuse le motif %j sans rien changer', async (reason) => {
    const { w, receipt } = await withReceipt();
    await expect(w.cancel.execute({ id: receipt.id, version: receipt.version, reason, access: am1, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(w.offers.items[0]!.status).toBe(OfferStatus.ReceiptReceived);
    expect(w.receipts.items[0]!.status).toBe('VALID');
    expect(w.audit).toHaveLength(0);
  });
  it('refuse une version périmée', async () => {
    const { w, receipt } = await withReceipt();
    await expect(w.cancel.execute({ id: receipt.id, version: 9, reason: 'Mauvais fichier', access: am1, actor })).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(w.offers.items[0]!.status).toBe(OfferStatus.ReceiptReceived);
  });
  it('impossible une fois que le client a répondu : la décharge et l’offre ne bougent pas', async () => {
    const { w, receipt } = await withReceipt();
    w.offers.items[0]!.accept(now);
    await expect(w.cancel.execute({ id: receipt.id, version: receipt.version, reason: 'Trop tard', access: am1, actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
    expect(w.offers.items[0]!.status).toBe(OfferStatus.Accepted);
    expect(w.audit).toHaveLength(0);
  });
  it('IDOR : annuler la décharge d’un collègue est « introuvable », comme un identifiant inexistant', async () => {
    const { w, receipt } = await withReceipt();
    const real = await w.cancel.execute({ id: receipt.id, version: 1, reason: 'Pirate', access: am2, actor }).catch((e) => e);
    const missing = await w.cancel.execute({ id: 'inconnue', version: 1, reason: 'Pirate', access: am2, actor }).catch((e) => e);
    expect(real).toMatchObject({ code: 'NOT_FOUND' });
    expect(real.message).toBe(missing.message);
    expect(w.receipts.items[0]!.status).toBe('VALID');
  });
  it('une entreprise archivée fige l’annulation', async () => {
    const { w, receipt } = await withReceipt();
    w.companies.items[0]!.archive();
    await expect(w.cancel.execute({ id: receipt.id, version: receipt.version, reason: 'Mauvais fichier', access: am1, actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
  });
});

describe('Décharges — lecture', () => {
  it('lecture et liste : annulées comprises, hors portée « introuvable » ; Direction lit', async () => {
    const w = build(); w.company('c1', 'am1'); w.offer('o1', 'c1');
    const first = await w.register.execute({ offerId: 'o1', ...base, access: am1, actor });
    await w.cancel.execute({ id: first.id, version: 1, reason: 'Mauvais fichier', access: am1, actor });
    const second = await w.register.execute({ offerId: 'o1', ...base, access: am1, actor });
    const list = await w.list.execute({ offerId: 'o1', access: am1 });
    expect(list.map((r) => [r.id, r.status])).toEqual([[second.id, 'VALID'], [first.id, 'CANCELLED']]);
    await expect(w.list.execute({ offerId: 'o1', access: am2 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(w.get.execute({ id: second.id, access: am2 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(w.get.execute({ id: second.id, access: as(RoleCode.Direction, 'dir') })).resolves.toMatchObject({ id: second.id });
  });
});
