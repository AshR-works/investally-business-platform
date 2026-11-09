import { ActorContext, Page } from '../../../shared-kernel';
import { AuditAction, AuditRecord } from '../../audit';
import type { AccessContext } from '../../iam';
import { RoleCode, resolveGrants, visibilityFor } from '../../iam';
import { InMemoryFollowups } from '../../../../test/support/in-memory-followups';
import { InMemoryOffers } from '../../../../test/support/in-memory-offers';
import { Company } from '../domain/company';
import { CompanyName } from '../domain/company-name';
import { CompanyRepository } from '../domain/company-repository';
import { Offer, OfferStatus } from '../domain/offer';
import { PlannedFollowupsCloser } from './followup-closer';
import { CloseFollowupUseCase, GetFollowupHandler, ListFollowupsHandler, PlanFollowupUseCase, UpdateFollowupUseCase } from './followup-use-cases';
import { ChangeOfferStatusUseCase } from './offer-use-cases';

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

function build() {
  const companies = new InMemoryCompanies();
  const offers = new InMemoryOffers(companies);
  const followups = new InMemoryFollowups(offers, companies);
  const audit: AuditRecord[] = [];
  let seq = 0;
  const recorder = { record: async (r: AuditRecord) => { audit.push(r); } };
  const unitOfWork = { run: <T>(work: () => Promise<T>) => work() };
  const clock = { now: () => now };
  const ids = { next: () => `fu-${++seq}` };
  const company = (id: string, owner: string) => {
    const c = Company.register({ id, name: `Société ${id}`, ownerUserId: owner, now });
    companies.items.push(c);
    return c;
  };
  const offer = (id: string, companyId: string, status: OfferStatus = OfferStatus.Submitted) => {
    const o = Offer.create({ id, reference: `OFF-2026-000${offers.items.length + 1}`, companyId, subject: 'Formation', amount: '100000', now });
    if (status !== OfferStatus.Draft) o.submit(now);
    if (status === OfferStatus.ReceiptReceived) o.receiptReceived();
    offers.items.push(o);
    return o;
  };
  return {
    companies, offers, followups, audit, company, offer,
    plan: new PlanFollowupUseCase(followups, offers, companies, recorder, unitOfWork, clock, ids),
    update: new UpdateFollowupUseCase(followups, offers, companies, recorder, unitOfWork, clock),
    close: new CloseFollowupUseCase(followups, offers, companies, recorder, unitOfWork, clock),
    get: new GetFollowupHandler(followups, offers, companies, clock),
    list: new ListFollowupsHandler(followups, offers, companies, clock),
    changeOffer: new ChangeOfferStatusUseCase(offers, companies, recorder, unitOfWork, clock, new PlannedFollowupsCloser(followups, recorder)),
  };
}

const am1 = as(RoleCode.AccountManager, 'am1');
const am2 = as(RoleCode.AccountManager, 'am2');
const chef = as(RoleCode.HeadOfSales, 'chef', ['am1']);
const base = { dueOn: '2026-11-10', channel: 'CALL', note: 'Rappeler le DAF' };

describe('Relances — planification', () => {
  it('planifie sur une offre déposée : champs conservés, pas en retard, audit', async () => {
    const w = build(); w.company('c1', 'am1'); w.offer('o1', 'c1');
    const view = await w.plan.execute({ offerId: 'o1', ...base, access: am1, actor });
    expect(view).toMatchObject({ offerReference: 'OFF-2026-0001', companyName: 'Société c1', dueOn: '2026-11-10', channel: 'CALL', status: 'PLANNED', overdue: false, version: 1 });
    expect(w.audit[0]).toMatchObject({ action: AuditAction.Create, entityType: 'Followup', entityId: view.id });
  });
  it('accepte aussi une offre dont la décharge est reçue', async () => {
    const w = build(); w.company('c1', 'am1'); w.offer('o1', 'c1', OfferStatus.ReceiptReceived);
    await expect(w.plan.execute({ offerId: 'o1', ...base, access: am1, actor })).resolves.toBeDefined();
  });
  it.each([OfferStatus.Draft, OfferStatus.Accepted, OfferStatus.Refused, OfferStatus.Withdrawn])('refuse une offre %s : plus de relance sur une offre sans réponse attendue', async (status) => {
    const w = build(); w.company('c1', 'am1');
    const o = w.offer('o1', 'c1', OfferStatus.Draft);
    if (status === OfferStatus.Accepted) { o.submit(now); o.accept(now); }
    if (status === OfferStatus.Refused) { o.submit(now); o.refuse(now); }
    if (status === OfferStatus.Withdrawn) o.withdraw('Client indisponible', now);
    await expect(w.plan.execute({ offerId: 'o1', ...base, access: am1, actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
    expect(w.followups.items).toHaveLength(0);
  });
  it('au plus trois relances par offre ; une relance annulée libère une place', async () => {
    const w = build(); w.company('c1', 'am1'); w.offer('o1', 'c1');
    const created = [];
    for (let i = 0; i < 3; i++) created.push(await w.plan.execute({ offerId: 'o1', ...base, access: am1, actor }));
    await expect(w.plan.execute({ offerId: 'o1', ...base, access: am1, actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION', message: expect.stringContaining('au plus 3') });
    expect(w.followups.items).toHaveLength(3);
    await w.close.execute({ id: created[0]!.id, version: 1, text: 'Plus utile', closing: 'cancel', access: am1, actor });
    await expect(w.plan.execute({ offerId: 'o1', ...base, access: am1, actor })).resolves.toBeDefined();
  });
  it.each([[{ dueOn: '2026-11-03' }], [{ dueOn: 'demain' }], [{ channel: 'PIGEON' }], [{ note: 'x'.repeat(501) }]])('refuse la saisie %j sans rien créer', async (patch) => {
    const w = build(); w.company('c1', 'am1'); w.offer('o1', 'c1');
    await expect(w.plan.execute({ offerId: 'o1', ...base, ...patch, access: am1, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(w.followups.items).toHaveLength(0);
    expect(w.audit).toHaveLength(0);
  });
  it('IDOR : l’offre d’un collègue est « introuvable », comme un identifiant inexistant, et rien n’est créé', async () => {
    const w = build(); w.company('c1', 'am1'); w.offer('o1', 'c1');
    const real = await w.plan.execute({ offerId: 'o1', ...base, access: am2, actor }).catch((e) => e);
    const missing = await w.plan.execute({ offerId: 'inconnue', ...base, access: am2, actor }).catch((e) => e);
    expect(real).toMatchObject({ code: 'NOT_FOUND' });
    expect(real.message).toBe(missing.message);
    expect(w.followups.items).toHaveLength(0);
  });
  it('le Responsable commercial planifie pour son équipe ; Direction, Support et Finance ne le peuvent pas', async () => {
    const w = build(); w.company('c1', 'am1'); w.offer('o1', 'c1');
    await expect(w.plan.execute({ offerId: 'o1', ...base, access: chef, actor })).resolves.toBeDefined();
    for (const role of [RoleCode.Direction, RoleCode.Support, RoleCode.Finance]) {
      await expect(w.plan.execute({ offerId: 'o1', ...base, access: as(role, 'x'), actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    }
  });
  it('une entreprise archivée fige ses relances', async () => {
    const w = build(); w.company('c1', 'am1').archive(); w.offer('o1', 'c1');
    await expect(w.plan.execute({ offerId: 'o1', ...base, access: am1, actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
  });
});

describe('Relances — modification et clôture', () => {
  async function one() {
    const w = build(); w.company('c1', 'am1'); w.offer('o1', 'c1');
    const f = await w.plan.execute({ offerId: 'o1', ...base, access: am1, actor });
    w.audit.length = 0;
    return { w, f };
  }
  it('modifie avec la version lue : audit avant/après, version qui augmente', async () => {
    const { w, f } = await one();
    const view = await w.update.execute({ id: f.id, version: 1, dueOn: '2026-11-12', channel: 'EMAIL', access: am1, actor });
    expect(view).toMatchObject({ dueOn: '2026-11-12', channel: 'EMAIL', note: 'Rappeler le DAF' });
    expect((w.audit[0]!.oldValue as { dueOn: string }).dueOn).toBe('2026-11-10');
    expect((w.audit[0]!.newValue as { dueOn: string }).dueOn).toBe('2026-11-12');
  });
  it('refuse une version périmée sans rien écrire', async () => {
    const { w, f } = await one();
    await expect(w.update.execute({ id: f.id, version: 9, note: 'Autre', access: am1, actor })).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(w.close.execute({ id: f.id, version: 9, text: 'Fait', closing: 'complete', access: am1, actor })).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(w.audit).toHaveLength(0);
    expect(w.followups.items[0]!.status).toBe('PLANNED');
  });
  it('termine avec son résultat : état, date de clôture et audit ; sans résultat, rien ne change', async () => {
    const { w, f } = await one();
    await expect(w.close.execute({ id: f.id, version: 1, closing: 'complete', access: am1, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(w.followups.items[0]!.status).toBe('PLANNED');
    const view = await w.close.execute({ id: f.id, version: 1, text: 'Le DAF rappellera jeudi', closing: 'complete', access: am1, actor });
    expect(view).toMatchObject({ status: 'DONE', resultNote: 'Le DAF rappellera jeudi', closedAt: now.toISOString() });
    expect(w.audit).toHaveLength(1);
  });
  it('annule avec son motif ; une relance close ne bouge plus', async () => {
    const { w, f } = await one();
    const view = await w.close.execute({ id: f.id, version: 1, text: 'Le client a répondu', closing: 'cancel', access: am1, actor });
    expect(view.status).toBe('CANCELLED');
    await expect(w.close.execute({ id: f.id, version: view.version, text: 'Encore', closing: 'complete', access: am1, actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
    await expect(w.update.execute({ id: f.id, version: view.version, note: 'Encore', access: am1, actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
  });
  it('IDOR : modifier, terminer ou annuler la relance d’un collègue est « introuvable », comme un identifiant inexistant', async () => {
    const { w, f } = await one();
    for (const run of [
      (id: string) => w.update.execute({ id, version: 1, note: 'Pirate', access: am2, actor }),
      (id: string) => w.close.execute({ id, version: 1, text: 'Pirate', closing: 'complete', access: am2, actor }),
      (id: string) => w.close.execute({ id, version: 1, text: 'Pirate', closing: 'cancel', access: am2, actor }),
    ]) {
      const real = await run(f.id).catch((e) => e);
      const missing = await run('inconnue').catch((e) => e);
      expect(real).toMatchObject({ code: 'NOT_FOUND' });
      expect(real.message).toBe(missing.message);
    }
    expect(w.followups.items[0]!.status).toBe('PLANNED');
  });
  it('une entreprise archivée fige la modification et la clôture', async () => {
    const { w, f } = await one();
    w.companies.items[0]!.archive();
    await expect(w.update.execute({ id: f.id, version: 1, note: 'Autre', access: am1, actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
    await expect(w.close.execute({ id: f.id, version: 1, text: 'Fait', closing: 'complete', access: am1, actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
  });
});

describe('Relances — annulation automatique avec l’offre', () => {
  it.each([['accept', 'acceptée'], ['refuse', 'refusée'], ['withdraw', 'retiré']] as const)('« %s » annule les relances à faire de l’offre (motif écrit, audit) et laisse les relances terminées', async (action, word) => {
    const w = build(); w.company('c1', 'am1'); w.offer('o1', 'c1'); w.offer('o2', 'c1');
    const todo = await w.plan.execute({ offerId: 'o1', ...base, access: am1, actor });
    const done = await w.plan.execute({ offerId: 'o1', ...base, access: am1, actor });
    await w.close.execute({ id: done.id, version: 1, text: 'Fait', closing: 'complete', access: am1, actor });
    const other = await w.plan.execute({ offerId: 'o2', ...base, access: am1, actor });
    w.audit.length = 0;
    await w.changeOffer.execute({ id: 'o1', version: w.offers.items[0]!.version, action, reason: 'Client indisponible', access: am1, actor });
    const byId = (id: string) => w.followups.items.find((f) => f.id === id)!;
    expect(byId(todo.id)).toMatchObject({ status: 'CANCELLED' });
    expect(byId(todo.id).resultNote).toContain(word === 'retiré' ? 'retirée' : word);
    expect(byId(done.id).status).toBe('DONE');
    expect(byId(other.id).status).toBe('PLANNED');
    expect(w.audit.filter((a) => a.entityType === 'Followup')).toHaveLength(1);
  });
  it('déposer une offre ou annuler sa décharge ne touche pas aux relances', async () => {
    const w = build(); w.company('c1', 'am1'); w.offer('o1', 'c1', OfferStatus.ReceiptReceived);
    await w.plan.execute({ offerId: 'o1', ...base, access: am1, actor });
    expect(w.followups.items[0]!.status).toBe('PLANNED');
  });
});

describe('Relances — lecture et liste « À faire »', () => {
  async function world() {
    const w = build(); w.company('c1', 'am1'); w.company('c2', 'am2'); w.offer('o1', 'c1'); w.offer('o2', 'c2');
    const overdueNow = new Date('2026-11-01T10:00:00Z');
    // Une relance en retard : planifiée dans le passé par un horloge antérieure.
    const early = new PlanFollowupUseCase(w.followups, w.offers, w.companies, { record: async () => undefined }, { run: (work) => work() }, { now: () => overdueNow }, { next: () => 'fu-early' });
    await early.execute({ offerId: 'o1', dueOn: '2026-11-02', channel: 'EMAIL', access: am1, actor });
    await w.plan.execute({ offerId: 'o1', dueOn: '2026-11-04', channel: 'CALL', access: am1, actor });
    await w.plan.execute({ offerId: 'o1', dueOn: '2026-11-20', channel: 'WHATSAPP', access: am1, actor });
    await w.plan.execute({ offerId: 'o2', dueOn: '2026-11-04', channel: 'CALL', access: am2, actor });
    return w;
  }
  const q = (access: AccessContext, extra: Record<string, unknown> = {}) => ({ page: 1, pageSize: 20, access, visibility: visibilityFor(access, 'bd.followup.read'), ...extra });
  it('la liste est triée par échéance, ne montre que la portée, et signale le retard', async () => {
    const w = await world();
    const mine = await w.list.execute(q(am1));
    expect(mine.items.map((f) => [f.dueOn, f.overdue])).toEqual([['2026-11-02', true], ['2026-11-04', false], ['2026-11-20', false]]);
    expect(mine.total).toBe(3);
    expect((await w.list.execute(q(am2))).total).toBe(1);
    expect((await w.list.execute(q(as(RoleCode.Direction, 'dir')))).total).toBe(4);
  });
  it('filtre par échéance (en retard, aujourd’hui, à venir) et par état ; filtres inconnus ignorés', async () => {
    const w = await world();
    expect((await w.list.execute(q(am1, { due: 'overdue' }))).items.map((f) => f.dueOn)).toEqual(['2026-11-02']);
    expect((await w.list.execute(q(am1, { due: 'today' }))).items.map((f) => f.dueOn)).toEqual(['2026-11-04']);
    expect((await w.list.execute(q(am1, { due: 'upcoming' }))).items.map((f) => f.dueOn)).toEqual(['2026-11-20']);
    expect((await w.list.execute(q(am1, { status: 'DONE' }))).total).toBe(0);
    expect((await w.list.execute(q(am1, { due: 'jamais', status: 'PIRATE' }))).total).toBe(3);
  });
  it('filtrer par l’offre d’un collègue est « introuvable » (pas de liste vide qui trahirait son existence)', async () => {
    const w = await world();
    await expect(w.list.execute(q(am1, { offerId: 'o2' }))).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect((await w.list.execute(q(am1, { offerId: 'o1' }))).total).toBe(3);
  });
  it('filtre par entreprise (navigation contextuelle) : ses relances seulement ; l’entreprise d’un collègue est « introuvable »', async () => {
    const w = await world();
    expect((await w.list.execute(q(am1, { companyId: 'c1' }))).items.map((f) => f.companyId)).toEqual(['c1', 'c1', 'c1']);
    expect((await w.list.execute(q(as(RoleCode.Direction, 'dir'), { companyId: 'c2' }))).total).toBe(1);
    await expect(w.list.execute(q(am1, { companyId: 'c2' }))).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'Entreprise introuvable' });
    await expect(w.list.execute(q(am1, { companyId: 'inconnue' }))).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
  it('lecture : hors de la portée « introuvable » ; chef et Direction lisent', async () => {
    const w = await world();
    const id = w.followups.items[0]!.id;
    await expect(w.get.execute({ id, access: am2 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(w.get.execute({ id, access: chef })).resolves.toMatchObject({ id });
    await expect(w.get.execute({ id, access: as(RoleCode.Direction, 'dir') })).resolves.toMatchObject({ id });
  });
});
