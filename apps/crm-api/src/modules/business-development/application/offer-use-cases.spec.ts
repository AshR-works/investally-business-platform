import { ActorContext, Page } from '../../../shared-kernel';
import { AuditAction, AuditRecord } from '../../audit';
import type { AccessContext } from '../../iam';
import { RoleCode, resolveGrants, visibilityFor } from '../../iam';
import { InMemoryFollowups } from '../../../../test/support/in-memory-followups';
import { InMemoryOffers } from '../../../../test/support/in-memory-offers';
import { Company } from '../domain/company';
import { CompanyName } from '../domain/company-name';
import { CompanyRepository } from '../domain/company-repository';
import { PlannedFollowupsCloser } from './followup-closer';
import { ChangeOfferStatusUseCase, GetOfferHandler, ListOffersHandler, OfferAction, RegisterOfferUseCase, UpdateOfferUseCase } from './offer-use-cases';

class InMemoryCompanies implements CompanyRepository {
  readonly items: Company[] = [];
  async save(company: Company) { if (!this.items.includes(company)) this.items.push(company); }
  async findById(id: string) { return this.items.find((c) => c.id === id) ?? null; }
  async existsByName(name: CompanyName) { return this.items.some((c) => c.name.normalized === name.normalized); }
  async list(): Promise<Page<Company>> { return { items: this.items, total: this.items.length, page: 1, pageSize: 20 }; }
}

const actor: ActorContext = { userId: 'u1', sessionId: 's1', ipAddress: '10.0.0.1', device: 'jest' };
const as = (role: RoleCode, actorId: string, teamMemberIds: string[] = []): AccessContext => ({ actorId, grants: resolveGrants(role), teamMemberIds });
const now = new Date('2026-10-30T10:00:00Z');

function build() {
  const companies = new InMemoryCompanies();
  const offers = new InMemoryOffers(companies);
  const followups = new InMemoryFollowups(offers, companies);
  const audit: AuditRecord[] = [];
  let seq = 0;
  const recorder = { record: async (r: AuditRecord) => { audit.push(r); } };
  const unitOfWork = { run: <T>(work: () => Promise<T>) => work() };
  const clock = { now: () => now };
  const ids = { next: () => `of-${++seq}` };
  const company = (id: string, owner: string) => {
    const c = Company.register({ id, name: `Société ${id}`, ownerUserId: owner, now });
    companies.items.push(c);
    return c;
  };
  return {
    companies, offers, followups, audit, company,
    register: new RegisterOfferUseCase(offers, companies, recorder, unitOfWork, clock, ids),
    update: new UpdateOfferUseCase(offers, companies, recorder, unitOfWork),
    change: new ChangeOfferStatusUseCase(offers, companies, recorder, unitOfWork, clock, new PlannedFollowupsCloser(followups, recorder)),
    get: new GetOfferHandler(offers, companies),
    list: new ListOffersHandler(offers, companies),
  };
}

const am1 = as(RoleCode.AccountManager, 'am1');
const am2 = as(RoleCode.AccountManager, 'am2');
const chef = as(RoleCode.HeadOfSales, 'chef', ['am1']);
const base = { subject: 'Formation analyse financière', amount: '4 500 000' };

async function submitted(w: ReturnType<typeof build>) {
  w.company('c1', 'am1');
  const created = await w.register.execute({ companyId: 'c1', ...base, access: am1, actor });
  return w.change.execute({ id: created.id, version: created.version, action: 'submit', access: am1, actor });
}

describe('Offres — création', () => {
  it('crée un brouillon pour une entreprise de sa portée : référence OFF-année-0001, montant normalisé, audit', async () => {
    const w = build(); w.company('c1', 'am1');
    const view = await w.register.execute({ companyId: 'c1', ...base, access: am1, actor });
    expect(view).toMatchObject({ reference: 'OFF-2026-0001', companyName: 'Société c1', status: 'DRAFT', amount: '4500000.00', currency: 'XAF', version: 1 });
    expect(w.audit[0]).toMatchObject({ action: AuditAction.Create, entityType: 'Offer', entityId: view.id });
  });
  it('numérote sans trou : une saisie refusée ne consomme pas de numéro', async () => {
    const w = build(); w.company('c1', 'am1');
    await w.register.execute({ companyId: 'c1', ...base, access: am1, actor });
    await expect(w.register.execute({ companyId: 'c1', subject: '', amount: '10', access: am1, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
    const second = await w.register.execute({ companyId: 'c1', ...base, access: am1, actor });
    expect(second.reference).toBe('OFF-2026-0002');
  });
  it('IDOR : l’entreprise d’un collègue est « introuvable », comme un identifiant inexistant, et rien n’est créé', async () => {
    const w = build(); w.company('c1', 'am1');
    const real = await w.register.execute({ companyId: 'c1', ...base, access: am2, actor }).catch((e) => e);
    const missing = await w.register.execute({ companyId: 'inconnue', ...base, access: am2, actor }).catch((e) => e);
    expect(real).toMatchObject({ code: 'NOT_FOUND' });
    expect(real.message).toBe(missing.message);
    expect(w.offers.items).toHaveLength(0);
    expect(w.audit).toHaveLength(0);
  });
  it('le Responsable commercial crée pour son équipe, pas pour une autre ; Direction, Support et Finance ne créent pas', async () => {
    const w = build(); w.company('c1', 'am1');
    await expect(w.register.execute({ companyId: 'c1', ...base, access: chef, actor })).resolves.toBeDefined();
    await expect(w.register.execute({ companyId: 'c1', ...base, access: as(RoleCode.HeadOfSales, 'autre', ['am2']), actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    for (const role of [RoleCode.Direction, RoleCode.Support, RoleCode.Finance]) {
      await expect(w.register.execute({ companyId: 'c1', ...base, access: as(role, 'x'), actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    }
  });
  it('une entreprise archivée n’accepte plus d’offre', async () => {
    const w = build(); w.company('c1', 'am1').archive();
    await expect(w.register.execute({ companyId: 'c1', ...base, access: am1, actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
  });
});

describe('Offres — modification d’un brouillon', () => {
  it('modifie avec la version lue ; audit avant/après ; la version augmente', async () => {
    const w = build(); w.company('c1', 'am1');
    const created = await w.register.execute({ companyId: 'c1', ...base, access: am1, actor });
    const view = await w.update.execute({ id: created.id, version: 1, amount: '5000000', access: am1, actor });
    expect(view.amount).toBe('5000000.00');
    const last = w.audit.at(-1)!;
    expect(last).toMatchObject({ action: AuditAction.Update, entityType: 'Offer' });
    expect((last.oldValue as { amount: string }).amount).toBe('4500000.00');
    expect((last.newValue as { amount: string }).amount).toBe('5000000.00');
  });
  it('refuse une version périmée sans rien écrire', async () => {
    const w = build(); w.company('c1', 'am1');
    const created = await w.register.execute({ companyId: 'c1', ...base, access: am1, actor });
    const before = w.audit.length;
    await expect(w.update.execute({ id: created.id, version: 7, subject: 'Autre', access: am1, actor })).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(w.audit).toHaveLength(before);
    expect(w.offers.items[0]!.subject).toBe(base.subject);
  });
  it("une entreprise archivée fige aussi la modification d'un brouillon", async () => {
    const w = build(); w.company('c1', 'am1');
    const created = await w.register.execute({ companyId: 'c1', ...base, access: am1, actor });
    w.companies.items[0]!.archive();
    await expect(w.update.execute({ id: created.id, version: 1, subject: 'Autre', access: am1, actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
    expect(w.offers.items[0]!.subject).toBe(base.subject);
  });
  it('une offre déposée ne se modifie plus', async () => {
    const w = build();
    const view = await submitted(w);
    await expect(w.update.execute({ id: view.id, version: view.version, subject: 'Autre', access: am1, actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
  });
  it('IDOR : l’offre d’un collègue est « introuvable » en modification, comme un identifiant inexistant', async () => {
    const w = build(); w.company('c1', 'am1');
    const created = await w.register.execute({ companyId: 'c1', ...base, access: am1, actor });
    const real = await w.update.execute({ id: created.id, version: 1, subject: 'Pirate', access: am2, actor }).catch((e) => e);
    const missing = await w.update.execute({ id: 'inconnue', version: 1, subject: 'Pirate', access: am2, actor }).catch((e) => e);
    expect(real).toMatchObject({ code: 'NOT_FOUND' });
    expect(real.message).toBe(missing.message);
    expect(w.offers.items[0]!.subject).toBe(base.subject);
  });
});

describe('Offres — changements d’état', () => {
  it('dépose : état « déposée », date de dépôt, audit avant/après', async () => {
    const w = build();
    const view = await submitted(w);
    expect(view).toMatchObject({ status: 'SUBMITTED', submittedAt: now.toISOString(), version: 1 });
    const last = w.audit.at(-1)!;
    expect(last).toMatchObject({ action: AuditAction.Update });
    expect((last.oldValue as { status: string }).status).toBe('DRAFT');
    expect((last.newValue as { status: string }).status).toBe('SUBMITTED');
  });
  it('accepte ou refuse une offre déposée', async () => {
    for (const [action, status] of [['accept', 'ACCEPTED'], ['refuse', 'REFUSED']] as const) {
      const w = build();
      const view = await submitted(w);
      expect(await w.change.execute({ id: view.id, version: view.version, action, access: am1, actor })).toMatchObject({ status, decidedAt: now.toISOString() });
    }
  });
  it('transitions interdites : accepter un brouillon, déposer deux fois, retirer une offre acceptée', async () => {
    const w = build(); w.company('c1', 'am1');
    const draft = await w.register.execute({ companyId: 'c1', ...base, access: am1, actor });
    await expect(w.change.execute({ id: draft.id, version: 1, action: 'accept', access: am1, actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
    const sent = await w.change.execute({ id: draft.id, version: 1, action: 'submit', access: am1, actor });
    await expect(w.change.execute({ id: draft.id, version: sent.version, action: 'submit', access: am1, actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
    const accepted = await w.change.execute({ id: draft.id, version: sent.version, action: 'accept', access: am1, actor });
    await expect(w.change.execute({ id: draft.id, version: accepted.version, action: 'withdraw', reason: 'trop tard', access: am1, actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
  });
  it('retire avec un motif obligatoire ; sans motif, rien ne change', async () => {
    const w = build();
    const view = await submitted(w);
    await expect(w.change.execute({ id: view.id, version: view.version, action: 'withdraw', access: am1, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(w.offers.items[0]!.status).toBe('SUBMITTED');
    const withdrawn = await w.change.execute({ id: view.id, version: view.version, action: 'withdraw', reason: 'Client indisponible', access: am1, actor });
    expect(withdrawn).toMatchObject({ status: 'WITHDRAWN', withdrawnReason: 'Client indisponible' });
  });
  it.each<OfferAction>(['submit', 'accept', 'refuse', 'withdraw'])('refuse une version périmée pour « %s » sans rien écrire', async (action) => {
    const w = build();
    const view = await submitted(w);
    const before = w.audit.length;
    await expect(w.change.execute({ id: view.id, version: 99, action, reason: 'motif', access: am1, actor })).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(w.audit).toHaveLength(before);
  });
  it('IDOR : changer l’état de l’offre d’un collègue est « introuvable » ; l’offre ne bouge pas', async () => {
    const w = build();
    const view = await submitted(w);
    const real = await w.change.execute({ id: view.id, version: view.version, action: 'accept', access: am2, actor }).catch((e) => e);
    const missing = await w.change.execute({ id: 'inconnue', version: 1, action: 'accept', access: am2, actor }).catch((e) => e);
    expect(real).toMatchObject({ code: 'NOT_FOUND' });
    expect(real.message).toBe(missing.message);
    expect(w.offers.items[0]!.status).toBe('SUBMITTED');
  });
  it('une entreprise archivée fige ses offres', async () => {
    const w = build();
    const view = await submitted(w);
    w.companies.items[0]!.archive();
    await expect(w.change.execute({ id: view.id, version: view.version, action: 'accept', access: am1, actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
  });
  it('les droits par action : le retrait exige son droit propre (Direction et Support ne retirent pas)', async () => {
    const w = build();
    const view = await submitted(w);
    for (const role of [RoleCode.Direction, RoleCode.Support, RoleCode.Finance]) {
      await expect(w.change.execute({ id: view.id, version: view.version, action: 'withdraw', reason: 'motif valable', access: as(role, 'x'), actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    }
    await expect(w.change.execute({ id: view.id, version: view.version, action: 'withdraw', reason: 'motif valable', access: chef, actor })).resolves.toMatchObject({ status: 'WITHDRAWN' });
  });
});

describe('Offres — lecture et liste', () => {
  it('lecture : hors de la portée, « introuvable » avec le même message qu’un identifiant inexistant ; Direction lit tout', async () => {
    const w = build(); w.company('c1', 'am1');
    const created = await w.register.execute({ companyId: 'c1', ...base, access: am1, actor });
    const real = await w.get.execute({ id: created.id, access: am2 }).catch((e) => e);
    const missing = await w.get.execute({ id: 'inconnue', access: am2 }).catch((e) => e);
    expect(real).toMatchObject({ code: 'NOT_FOUND' });
    expect(real.message).toBe(missing.message);
    await expect(w.get.execute({ id: created.id, access: as(RoleCode.Direction, 'dir') })).resolves.toMatchObject({ id: created.id });
  });
  it('la liste ne montre que la portée ; filtre par état et par recherche ; page bornée', async () => {
    const w = build(); w.company('c1', 'am1'); w.company('c2', 'am2');
    const a = await w.register.execute({ companyId: 'c1', ...base, access: am1, actor });
    await w.register.execute({ companyId: 'c1', subject: 'Marchés de capitaux', amount: '100', access: am1, actor });
    await w.register.execute({ companyId: 'c2', ...base, access: am2, actor });
    await w.change.execute({ id: a.id, version: 1, action: 'submit', access: am1, actor });
    const q = { page: 1, pageSize: 20, access: am1, visibility: visibilityFor(am1, 'bd.offer.read') };
    expect((await w.list.execute(q)).total).toBe(2);
    expect((await w.list.execute({ ...q, status: 'SUBMITTED' })).items.map((o) => o.id)).toEqual([a.id]);
    expect((await w.list.execute({ ...q, search: 'marchés' })).total).toBe(1);
    expect((await w.list.execute({ ...q, status: 'PIRATE' })).total).toBe(2);
    expect((await w.list.execute({ ...q, pageSize: 5000 })).pageSize).toBe(100);
  });
  it('filtrer par l’entreprise d’un collègue est « introuvable » (pas de liste vide qui trahirait son existence)', async () => {
    const w = build(); w.company('c2', 'am2');
    await expect(w.list.execute({ page: 1, pageSize: 20, companyId: 'c2', access: am1, visibility: visibilityFor(am1, 'bd.offer.read') })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
