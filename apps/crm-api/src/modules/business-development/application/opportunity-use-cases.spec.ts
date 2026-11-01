import { ActorContext, Page } from '../../../shared-kernel';
import { AuditAction, AuditRecord } from '../../audit';
import type { AccessContext } from '../../iam';
import { RoleCode, resolveGrants } from '../../iam';
import { FakeDecisionMakerMeetings, InMemoryOpportunities } from '../../../../test/support/in-memory-opportunities';
import { Company } from '../domain/company';
import { CompanyName } from '../domain/company-name';
import { CompanyRepository } from '../domain/company-repository';
import {
  AdvanceOpportunityUseCase, CloseOpportunityUseCase, CreateOpportunityUseCase, GetOpportunityHandler, GrantWaiverUseCase, ListOpportunitiesHandler, UpdateOpportunityUseCase,
} from './opportunity-use-cases';

class InMemoryCompanies implements CompanyRepository {
  readonly items: Company[] = [];
  async save(company: Company) { if (!this.items.includes(company)) this.items.push(company); }
  async findById(id: string) { return this.items.find((c) => c.id === id) ?? null; }
  async existsByName(name: CompanyName) { return this.items.some((c) => c.name.normalized === name.normalized); }
  async list(): Promise<Page<Company>> { return { items: this.items, total: this.items.length, page: 1, pageSize: 20 }; }
}

const actor: ActorContext = { userId: 'am1', sessionId: 's1', ipAddress: '10.0.0.1', device: 'jest' };
const as = (role: RoleCode, actorId: string, teamMemberIds: string[] = []): AccessContext => ({ actorId, grants: resolveGrants(role), teamMemberIds });
const now = new Date('2026-11-05T10:00:00Z');

function build() {
  const companies = new InMemoryCompanies();
  const opportunities = new InMemoryOpportunities(companies);
  const meetings = new FakeDecisionMakerMeetings();
  const audit: AuditRecord[] = [];
  let seq = 0;
  const recorder = { record: async (r: AuditRecord) => { audit.push(r); } };
  const unitOfWork = { run: <T>(work: () => Promise<T>) => work() };
  const clock = { now: () => now };
  const ids = { next: () => `op-${++seq}` };
  const company = (id: string, owner: string, archived = false) => {
    const c = Company.register({ id, name: `Société ${id}`, ownerUserId: owner, now });
    if (archived) c.archive();
    companies.items.push(c);
    return c;
  };
  return {
    companies, opportunities, meetings, audit, company,
    create: new CreateOpportunityUseCase(opportunities, companies, recorder, unitOfWork, clock, ids),
    update: new UpdateOpportunityUseCase(opportunities, companies, recorder, unitOfWork),
    advance: new AdvanceOpportunityUseCase(opportunities, companies, recorder, unitOfWork, meetings, clock),
    waive: new GrantWaiverUseCase(opportunities, companies, recorder, unitOfWork, clock),
    close: new CloseOpportunityUseCase(opportunities, companies, recorder, unitOfWork, clock),
    get: new GetOpportunityHandler(opportunities, companies),
    list: new ListOpportunitiesHandler(opportunities, companies),
  };
}

const am1 = as(RoleCode.AccountManager, 'am1');
const am2 = as(RoleCode.AccountManager, 'am2');
const chef = as(RoleCode.HeadOfSales, 'chef', ['am1']);
const direction = as(RoleCode.Direction, 'dir');
const base = { title: 'Formation fiscalité', amount: '12500000', source: 'REFERRAL' };
const first = { page: 1, pageSize: 50 };

/** Crée une opportunité de am1 et l'amène à l'étape demandée (nombre d'avancées), rendez-vous décideur tenu. */
async function atStage(w: ReturnType<typeof build>, steps: number) {
  w.company('c1', 'am1');
  w.meetings.held.add('c1');
  let view = await w.create.execute({ ...base, companyId: 'c1', access: am1, actor });
  for (let i = 0; i < steps; i++) view = await w.advance.execute({ id: view.id, version: view.version, access: am1, actor });
  return view;
}

describe('Opportunités — création', () => {
  it('crée à « Qualification » avec nom d’entreprise, étape suivante et audit', async () => {
    const w = build(); w.company('c1', 'am1');
    const view = await w.create.execute({ ...base, companyId: 'c1', access: am1, actor });
    expect(view).toMatchObject({ companyName: 'Société c1', title: 'Formation fiscalité', amount: '12500000.00', currency: 'XAF', stage: 'QUALIFICATION', nextStage: 'PROPOSAL', status: 'OPEN', version: 1 });
    expect(w.audit[0]).toMatchObject({ action: AuditAction.Create, entityType: 'Opportunity', entityId: view.id });
  });
  it('plusieurs opportunités simultanées pour une même entreprise', async () => {
    const w = build(); w.company('c1', 'am1');
    await w.create.execute({ ...base, companyId: 'c1', access: am1, actor });
    await w.create.execute({ ...base, title: 'Seconde', companyId: 'c1', access: am1, actor });
    expect(w.opportunities.items).toHaveLength(2);
  });
  it('hors portée ou inexistante : introuvable ; archivée : refus ; Direction : introuvable ; saisie invalide : rien n’est écrit', async () => {
    const w = build(); w.company('c1', 'am1'); w.company('c9', 'am1', true);
    await expect(w.create.execute({ ...base, companyId: 'c1', access: am2, actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(w.create.execute({ ...base, companyId: 'zzz', access: am1, actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(w.create.execute({ ...base, companyId: 'c9', access: am1, actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
    await expect(w.create.execute({ ...base, companyId: 'c1', access: direction, actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(w.create.execute({ ...base, amount: '0', companyId: 'c1', access: am1, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(w.opportunities.items).toHaveLength(0);
    expect(w.audit).toHaveLength(0);
  });
});

describe('Opportunités — modification', () => {
  it('modifie avec audit avant/après ; version périmée : conflit ; hors portée : introuvable', async () => {
    const w = build(); const v = await atStage(w, 0);
    const updated = await w.update.execute({ id: v.id, version: 1, title: 'Titre revu', amount: '800', access: am1, actor });
    expect(updated).toMatchObject({ title: 'Titre revu', amount: '800.00' });
    const last = w.audit[w.audit.length - 1]!;
    expect((last.oldValue as { title: string }).title).toBe('Formation fiscalité');
    expect((last.newValue as { title: string }).title).toBe('Titre revu');
    await expect(w.update.execute({ id: v.id, version: 9, title: 'Autre', access: am1, actor })).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(w.update.execute({ id: v.id, version: 1, title: 'Piraté', access: am2, actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(w.update.execute({ id: v.id, version: 1, amount: 'x', access: am1, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(w.opportunities.items[0]!.title).toBe('Titre revu');
  });
  it('entreprise archivée : plus de modification', async () => {
    const w = build(); const v = await atStage(w, 0);
    w.companies.items[0]!.archive();
    await expect(w.update.execute({ id: v.id, version: 1, title: 'Tard', access: am1, actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
  });
});

describe('Opportunités — étapes et règle du rendez-vous décideur', () => {
  it('avance d’une étape à la fois jusqu’à la dernière', async () => {
    const w = build(); const v = await atStage(w, 4);
    expect(v).toMatchObject({ stage: 'ACCREDITATION', nextStage: null });
    await expect(w.advance.execute({ id: v.id, version: v.version, access: am1, actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
  });
  it('l’accord de principe est refusé sans rendez-vous décideur tenu', async () => {
    const w = build(); w.company('c1', 'am1');
    let v = await w.create.execute({ ...base, companyId: 'c1', access: am1, actor });
    for (let i = 0; i < 2; i++) v = await w.advance.execute({ id: v.id, version: v.version, access: am1, actor });
    expect(v.stage).toBe('NEGOTIATION');
    await expect(w.advance.execute({ id: v.id, version: v.version, access: am1, actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION', message: expect.stringContaining('rendez-vous décideur') });
    expect(w.opportunities.items[0]!.stage).toBe('NEGOTIATION');
  });
  it('le rendez-vous décideur d’une AUTRE entreprise ne compte pas', async () => {
    const w = build(); w.company('c1', 'am1'); w.company('c2', 'am1'); w.meetings.held.add('c2');
    let v = await w.create.execute({ ...base, companyId: 'c1', access: am1, actor });
    for (let i = 0; i < 2; i++) v = await w.advance.execute({ id: v.id, version: v.version, access: am1, actor });
    await expect(w.advance.execute({ id: v.id, version: v.version, access: am1, actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
  });
  it('dérogation du Responsable commercial : l’accord de principe devient possible ; justification obligatoire ; tracée', async () => {
    const w = build(); w.company('c1', 'am1');
    let v = await w.create.execute({ ...base, companyId: 'c1', access: am1, actor });
    for (let i = 0; i < 2; i++) v = await w.advance.execute({ id: v.id, version: v.version, access: am1, actor });
    await expect(w.waive.execute({ id: v.id, version: v.version, reason: '', access: chef, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
    const waived = await w.waive.execute({ id: v.id, version: v.version, reason: 'Le décideur est injoignable', access: chef, actor });
    expect(waived).toMatchObject({ waiverReason: 'Le décideur est injoignable' });
    expect(waived.waivedAt).not.toBeNull();
    expect(w.audit[w.audit.length - 1]).toMatchObject({ action: AuditAction.Update, entityId: v.id });
    const next = await w.advance.execute({ id: v.id, version: v.version, access: am1, actor });
    expect(next.stage).toBe('AGREEMENT_IN_PRINCIPLE');
  });
  it('le chargé de compte ne peut pas accorder la dérogation, ni la Direction ; un collègue ne voit rien', async () => {
    const w = build(); const v = await atStage(w, 0);
    await expect(w.waive.execute({ id: v.id, version: 1, reason: 'Moi-même', access: am1, actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(w.waive.execute({ id: v.id, version: 1, reason: 'Direction', access: direction, actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(w.waive.execute({ id: v.id, version: 1, reason: 'Collègue', access: am2, actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
  it('le Responsable commercial fait avancer l’opportunité de son équipe ; version périmée : conflit', async () => {
    const w = build(); const v = await atStage(w, 0);
    expect((await w.advance.execute({ id: v.id, version: 1, access: chef, actor })).stage).toBe('PROPOSAL');
    await expect(w.advance.execute({ id: v.id, version: 4, access: am1, actor })).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

describe('Opportunités — clôture', () => {
  it('le chargé de compte clôt « perdue » avec un motif ; immuable ensuite', async () => {
    const w = build(); const v = await atStage(w, 1);
    await expect(w.close.execute({ id: v.id, version: v.version, outcome: 'lost', access: am1, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
    const lost = await w.close.execute({ id: v.id, version: v.version, outcome: 'lost', reason: 'PRICE', note: 'Trop cher', access: am1, actor });
    expect(lost).toMatchObject({ status: 'LOST', lossReason: 'PRICE', closingNote: 'Trop cher', nextStage: null });
    expect(lost.closedAt).not.toBeNull();
    await expect(w.update.execute({ id: v.id, version: lost.version, title: 'Tard', access: am1, actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
    await expect(w.advance.execute({ id: v.id, version: lost.version, access: am1, actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
  });
  it('« gagnée » : réservée au Responsable commercial (D28), et seulement après l’accord de principe', async () => {
    const w = build(); const early = await atStage(w, 2);
    await expect(w.close.execute({ id: early.id, version: early.version, outcome: 'won', access: chef, actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
    const ready = await w.advance.execute({ id: early.id, version: early.version, access: am1, actor });
    expect(ready.stage).toBe('AGREEMENT_IN_PRINCIPLE');
    await expect(w.close.execute({ id: ready.id, version: ready.version, outcome: 'won', access: am1, actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(w.close.execute({ id: ready.id, version: ready.version, outcome: 'won', access: direction, actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const won = await w.close.execute({ id: ready.id, version: ready.version, outcome: 'won', access: chef, actor });
    expect(won).toMatchObject({ status: 'WON', lossReason: null, nextStage: null });
    expect(w.audit[w.audit.length - 1]).toMatchObject({ action: AuditAction.Update, entityId: ready.id });
  });
  it('le Responsable commercial clôt aussi « perdue » pour son équipe ; un collègue ne le peut pas', async () => {
    const w = build(); const v = await atStage(w, 0);
    await expect(w.close.execute({ id: v.id, version: 1, outcome: 'lost', reason: 'PRICE', access: am2, actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect((await w.close.execute({ id: v.id, version: 1, outcome: 'lost', reason: 'NO_BUDGET', access: chef, actor })).status).toBe('LOST');
  });
});

describe('Opportunités — lecture et portée', () => {
  async function seed() {
    const w = build(); w.company('c1', 'am1'); w.company('c2', 'am2');
    const mine = await w.create.execute({ ...base, title: 'Alpha', companyId: 'c1', access: am1, actor });
    const theirs = await w.create.execute({ ...base, title: 'Beta', companyId: 'c2', access: am2, actor });
    return { w, mine, theirs };
  }
  it('chacun voit les siennes, le Responsable commercial et la Direction toutes (lecture) ; lecture hors portée : introuvable', async () => {
    const { w, mine, theirs } = await seed();
    const ids = async (access: AccessContext) => (await w.list.execute({ ...first, access })).items.map((i) => i.id).sort();
    expect(await ids(am1)).toEqual([mine.id]);
    expect(await ids(am2)).toEqual([theirs.id]);
    expect(await ids(chef)).toEqual([mine.id, theirs.id].sort()); // lecture « Tous » (CU-C-43) ; l'écriture reste limitée à son équipe
    expect(await ids(direction)).toEqual([mine.id, theirs.id].sort());
    await expect(w.get.execute({ id: theirs.id, access: am1 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(w.get.execute({ id: 'inconnue', access: am1 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(w.get.execute({ id: mine.id, access: direction })).resolves.toMatchObject({ id: mine.id });
  });
  it('filtre par état, étape, recherche et entreprise ; l’entreprise hors portée est introuvable ; taille de page bornée', async () => {
    const { w, mine } = await seed();
    const ids = async (q: object) => (await w.list.execute({ ...first, access: am1, ...q })).items.map((i) => i.id);
    expect(await ids({ status: 'OPEN' })).toEqual([mine.id]);
    expect(await ids({ status: 'LOST' })).toEqual([]);
    expect(await ids({ stage: 'QUALIFICATION' })).toEqual([mine.id]);
    expect(await ids({ stage: 'PROPOSAL' })).toEqual([]);
    expect(await ids({ search: 'alph' })).toEqual([mine.id]);
    expect(await ids({ search: 'zzz' })).toEqual([]);
    expect(await ids({ companyId: 'c1' })).toEqual([mine.id]);
    await expect(w.list.execute({ ...first, access: am1, companyId: 'c2' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect((await w.list.execute({ page: 1, pageSize: 5000, access: am1 })).pageSize).toBe(200);
  });
});
