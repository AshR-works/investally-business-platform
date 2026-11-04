import { InMemoryApprovals } from '../../../../test/support/in-memory-approvals';
import { InMemoryFacilitators } from '../../../../test/support/in-memory-facilitators';
import { InMemoryPayouts } from '../../../../test/support/in-memory-payouts';
import { InMemoryOpportunities } from '../../../../test/support/in-memory-opportunities';
import { ActorContext, Page } from '../../../shared-kernel';
import { AuditAction, AuditRecord } from '../../audit';
import type { AccessContext } from '../../iam';
import { RoleCode, Scope, resolveGrants } from '../../iam';
import { Company } from '../domain/company';
import { CompanyName } from '../domain/company-name';
import { CompanyRepository } from '../domain/company-repository';
import { CompanyStatus } from '../domain/company-status';
import { Opportunity } from '../domain/opportunity';
import { RegisterCommissionDue } from './commission-payout-use-cases';
import { CloseApprovalUseCase, GetApprovalHandler, ListApprovalsHandler, ReceiveApprovalUseCase, RegisterApprovalUseCase } from './approval-use-cases';

class InMemoryCompanies implements CompanyRepository {
  readonly items: Company[] = [];
  async save(company: Company) { if (!this.items.includes(company)) this.items.push(company); }
  async findById(id: string) { return this.items.find((c) => c.id === id) ?? null; }
  async existsByName(name: CompanyName) { return this.items.some((c) => c.name.normalized === name.normalized); }
  async list(): Promise<Page<Company>> { return { items: this.items, total: this.items.length, page: 1, pageSize: 20 }; }
}

const actor: ActorContext = { userId: 'u1', sessionId: 's1', ipAddress: '10.0.0.1', device: 'jest' };
const as = (role: RoleCode, actorId: string, teamMemberIds: string[] = []): AccessContext => ({ actorId, grants: resolveGrants(role), teamMemberIds });
const now = new Date('2026-11-07T10:00:00Z');

function build() {
  const companies = new InMemoryCompanies();
  const opportunities = new InMemoryOpportunities(companies);
  const approvals = new InMemoryApprovals(companies, opportunities);
  const audit: AuditRecord[] = [];
  let seq = 0;
  const recorder = { record: async (r: AuditRecord) => { audit.push(r); } };
  const unitOfWork = { run: <T>(work: () => Promise<T>) => work() };
  const clock = { now: () => now };
  const ids = { next: () => `ag-${++seq}` };
  const company = (id: string, owner: string, archived = false) => {
    const c = Company.register({ id, name: `Société ${id}`, ownerUserId: owner, now });
    if (archived) c.archive();
    companies.items.push(c);
    return c;
  };
  /** Opportunité amenée à l'étape demandée (0 = Qualification, 3 = Accord de principe, 4 = Agrément). */
  const opportunity = (id: string, companyId: string, steps = 3) => {
    const o = Opportunity.create({ id, companyId, title: `Formation ${id}`, amount: '5000000', source: 'REFERRAL', now });
    for (let i = 0; i < steps; i++) o.advance({ decisionMakerMeetingHeld: true }, now);
    opportunities.items.push(o);
    return o;
  };
  return {
    companies, opportunities, approvals, audit, company, opportunity,
    register: new RegisterApprovalUseCase(approvals, opportunities, companies, recorder, unitOfWork, clock, ids),
    receive: new ReceiveApprovalUseCase(approvals, opportunities, companies, recorder, unitOfWork, clock),
    close: new CloseApprovalUseCase(approvals, opportunities, companies, recorder, unitOfWork, clock, new RegisterCommissionDue(new InMemoryPayouts(companies, new InMemoryFacilitators()), new InMemoryFacilitators(), recorder, clock, ids)),
    get: new GetApprovalHandler(approvals, opportunities, companies, clock),
    list: new ListApprovalsHandler(approvals, opportunities, companies, clock),
  };
}

const am1 = as(RoleCode.AccountManager, 'am1');
const am2 = as(RoleCode.AccountManager, 'am2');
const chef = as(RoleCode.HeadOfSales, 'chef', ['am1']);
const finance = as(RoleCode.Finance, 'fin');
const direction = as(RoleCode.Direction, 'dir');
const base = { amount: '12500000', receivedOn: '2026-11-05' };

describe('Agréments — enregistrement', () => {
  it('enregistre l’agrément d’une opportunité à l’accord de principe : vue complète, audit, entreprise devenue « Cliente »', async () => {
    const w = build(); w.company('c1', 'am1'); w.opportunity('op1', 'c1');
    const view = await w.register.execute({ ...base, opportunityId: 'op1', places: 10, validUntil: '2027-03-31', access: am1, actor });
    expect(view).toMatchObject({
      companyName: 'Société c1', opportunityTitle: 'Formation op1', amount: '12500000.00', currency: 'XAF', places: 10, receivedOn: '2026-11-05',
      validUntil: '2027-03-31', status: 'RECEIVED', pastValidity: false, version: 1,
    });
    expect(w.companies.items[0]!.status).toBe(CompanyStatus.Client);
    expect(w.audit.map((a) => [a.entityType, a.action])).toEqual([['Approval', AuditAction.Create], ['Company', AuditAction.Update]]);
    expect(w.audit[1]).toMatchObject({ oldValue: { status: 'TARGET' }, newValue: { status: 'CLIENT' } });
  });

  it('une entreprise déjà cliente n’est pas retouchée (une seule trace)', async () => {
    const w = build(); const c = w.company('c1', 'am1'); c.becomeClient(); w.opportunity('op1', 'c1');
    await w.register.execute({ ...base, opportunityId: 'op1', access: am1, actor });
    expect(w.audit.map((a) => a.entityType)).toEqual(['Approval']);
  });

  it('exige l’accord de principe : une opportunité plus tôt dans le pipeline est refusée, sans rien écrire', async () => {
    const w = build(); w.company('c1', 'am1'); w.opportunity('op1', 'c1', 2);
    await expect(w.register.execute({ ...base, opportunityId: 'op1', access: am1, actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION', message: expect.stringContaining('accord de principe') });
    expect(w.approvals.items).toHaveLength(0);
    expect(w.audit).toHaveLength(0);
    expect(w.companies.items[0]!.status).toBe(CompanyStatus.Target);
  });

  it('accepte aussi l’étape « Agrément » et une opportunité gagnée ; refuse une opportunité perdue', async () => {
    const w = build(); w.company('c1', 'am1'); w.opportunity('op1', 'c1', 4);
    const won = w.opportunity('op2', 'c1'); won.closeWon(now);
    const lost = w.opportunity('op3', 'c1'); lost.closeLost('PRICE', null, now);
    expect((await w.register.execute({ ...base, opportunityId: 'op1', access: am1, actor })).status).toBe('RECEIVED');
    expect((await w.register.execute({ ...base, opportunityId: 'op2', access: am1, actor })).status).toBe('RECEIVED');
    await expect(w.register.execute({ ...base, opportunityId: 'op3', access: am1, actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION', message: expect.stringContaining('perdue') });
  });

  it('un seul agrément actif par opportunité ; après annulation, un nouveau est possible', async () => {
    const w = build(); w.company('c1', 'am1'); w.opportunity('op1', 'c1');
    const first = await w.register.execute({ ...base, opportunityId: 'op1', access: am1, actor });
    await expect(w.register.execute({ ...base, opportunityId: 'op1', access: am1, actor })).rejects.toMatchObject({ code: 'CONFLICT' });
    await w.close.execute({ id: first.id, version: 1, action: 'cancel', reason: 'Saisie erronée', access: chef, actor });
    expect((await w.register.execute({ ...base, opportunityId: 'op1', access: am1, actor })).status).toBe('RECEIVED');
  });

  it('refuse sans montant ni places, avec des données invalides, ou pour une entreprise archivée', async () => {
    const w = build(); w.company('c1', 'am1'); w.opportunity('op1', 'c1'); w.company('c9', 'am1', true); w.opportunity('op9', 'c9');
    await expect(w.register.execute({ opportunityId: 'op1', receivedOn: '2026-11-05', access: am1, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(w.register.execute({ ...base, opportunityId: 'op1', receivedOn: '2026-12-25', access: am1, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(w.register.execute({ ...base, opportunityId: 'op9', access: am1, actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
    expect(w.approvals.items).toHaveLength(0);
  });

  it('opportunité hors portée ou inexistante : introuvable ; la Direction (lecture seule) ne peut pas enregistrer', async () => {
    const w = build(); w.company('c1', 'am1'); w.opportunity('op1', 'c1');
    await expect(w.register.execute({ ...base, opportunityId: 'op1', access: am2, actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(w.register.execute({ ...base, opportunityId: 'inconnue', access: am1, actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(w.register.execute({ ...base, opportunityId: 'op1', access: direction, actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(w.approvals.items).toHaveLength(0);
  });

  it('le Responsable commercial enregistre pour son équipe', async () => {
    const w = build(); w.company('c1', 'am1'); w.opportunity('op1', 'c1');
    expect((await w.register.execute({ ...base, opportunityId: 'op1', access: chef, actor })).status).toBe('RECEIVED');
  });
});

describe('Agréments — honorer, expirer, annuler', () => {
  async function received(w: ReturnType<typeof build>) {
    w.company('c1', 'am1'); w.opportunity('op1', 'c1');
    return w.register.execute({ ...base, opportunityId: 'op1', validUntil: '2026-11-06', access: am1, actor });
  }

  it('la Finance (le DAF) honore ; la vue et l’audit portent l’ancien et le nouvel état', async () => {
    const w = build(); const a = await received(w);
    w.audit.length = 0;
    const done = await w.close.execute({ id: a.id, version: 1, action: 'honor', access: finance, actor });
    expect(done).toMatchObject({ status: 'HONORED', closedAt: now.toISOString(), closedReason: null });
    expect(w.audit[0]).toMatchObject({ action: AuditAction.Update, oldValue: { status: 'RECEIVED' }, newValue: { status: 'HONORED' } });
  });

  it('le chargé de compte ne peut ni honorer ni annuler ; le Responsable commercial annule mais ne constate plus le paiement (D41)', async () => {
    const w = build(); const a = await received(w);
    await expect(w.close.execute({ id: a.id, version: 1, action: 'honor', access: chef, actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(w.close.execute({ id: a.id, version: 1, action: 'cancel', reason: 'Erreur', access: finance, actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(w.close.execute({ id: a.id, version: 1, action: 'honor', access: am1, actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(w.close.execute({ id: a.id, version: 1, action: 'cancel', reason: 'Erreur', access: am1, actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(w.approvals.items[0]!.status).toBe('RECEIVED');
  });

  it('expirer et annuler exigent un motif ; une validité dépassée est signalée sans expirer d’elle-même', async () => {
    const w = build(); const a = await received(w);
    expect((await w.get.execute({ id: a.id, access: am1 })).pastValidity).toBe(true);
    await expect(w.close.execute({ id: a.id, version: 1, action: 'expire', access: chef, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
    const expired = await w.close.execute({ id: a.id, version: 1, action: 'expire', reason: 'Validité dépassée', access: chef, actor });
    expect(expired).toMatchObject({ status: 'EXPIRED', closedReason: 'Validité dépassée', pastValidity: false });
  });

  it('un agrément clos est définitif ; version périmée = conflit ; hors portée = introuvable', async () => {
    const w = build(); const a = await received(w);
    await expect(w.close.execute({ id: a.id, version: 9, action: 'honor', access: finance, actor })).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(w.close.execute({ id: a.id, version: 1, action: 'honor', access: as(RoleCode.HeadOfSales, 'autre'), actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await w.close.execute({ id: a.id, version: 1, action: 'honor', access: finance, actor });
    await expect(w.close.execute({ id: a.id, version: 1, action: 'cancel', reason: 'Trop tard', access: chef, actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
  });

  it('honorer et annuler sont deux droits distincts : qui n’a que l’un ne peut pas faire l’autre', async () => {
    const w = build(); const a = await received(w);
    const only = (permission: string): AccessContext => ({ actorId: 'chef', grants: [{ permission, scope: Scope.Team }], teamMemberIds: ['am1'] });
    await expect(w.close.execute({ id: a.id, version: 1, action: 'honor', access: only('bd.approval.cancel'), actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(w.close.execute({ id: a.id, version: 1, action: 'cancel', reason: 'Erreur de saisie', access: only('bd.approval.honor'), actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(w.close.execute({ id: a.id, version: 1, action: 'expire', reason: 'Validité dépassée', access: only('bd.approval.honor'), actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(w.approvals.items[0]!.status).toBe('RECEIVED');
    expect((await w.close.execute({ id: a.id, version: 1, action: 'honor', access: only('bd.approval.honor'), actor })).status).toBe('HONORED');
  });

  it('l’entreprise archivée fige ses agréments', async () => {
    const w = build(); const a = await received(w);
    w.companies.items[0]!.archive();
    await expect(w.close.execute({ id: a.id, version: 1, action: 'honor', access: finance, actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
  });
});

describe('Agréments — lecture', () => {
  it('lit et liste dans la portée : le chargé de compte voit les siens, le Responsable commercial son équipe, la Direction tout', async () => {
    const w = build(); w.company('c1', 'am1'); w.company('c2', 'am2'); w.opportunity('op1', 'c1'); w.opportunity('op2', 'c2');
    const a1 = await w.register.execute({ ...base, opportunityId: 'op1', access: am1, actor });
    await w.register.execute({ ...base, opportunityId: 'op2', access: am2, actor });
    const first = { page: 1, pageSize: 50 };
    expect((await w.list.execute({ ...first, access: am1 })).items.map((i) => i.id)).toEqual([a1.id]);
    expect((await w.list.execute({ ...first, access: chef })).total).toBe(1);
    expect((await w.list.execute({ ...first, access: direction })).total).toBe(2);
    await expect(w.get.execute({ id: a1.id, access: am2 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect((await w.get.execute({ id: a1.id, access: direction })).id).toBe(a1.id);
  });

  it('filtre par entreprise, opportunité et état ; un filtre hors portée est « introuvable »', async () => {
    const w = build(); w.company('c1', 'am1'); w.opportunity('op1', 'c1'); w.opportunity('op2', 'c1');
    const a = await w.register.execute({ ...base, opportunityId: 'op1', access: am1, actor });
    await w.register.execute({ ...base, opportunityId: 'op2', access: am1, actor });
    await w.close.execute({ id: a.id, version: 1, action: 'honor', access: finance, actor });
    const first = { page: 1, pageSize: 50, access: am1 };
    expect((await w.list.execute({ ...first, companyId: 'c1' })).total).toBe(2);
    expect((await w.list.execute({ ...first, opportunityId: 'op2' })).total).toBe(1);
    expect((await w.list.execute({ ...first, status: 'HONORED' })).total).toBe(1);
    await expect(w.list.execute({ ...first, access: am2, companyId: 'c1' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(w.list.execute({ ...first, access: am2, opportunityId: 'op1' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('Agréments — payeur tiers (D41, FD-3)', () => {
  const third = { payerName: 'Société Mère SA', payerType: 'EMPLOYER' };

  it('par défaut le client paie : aucun payeur ; un tiers est enregistré avec son nom et son type', async () => {
    const w = build(); w.company('c1', 'am1'); w.opportunity('op1', 'c1');
    expect(await w.register.execute({ ...base, opportunityId: 'op1', access: am1, actor })).toMatchObject({ payerName: null, payerType: null });
    const w2 = build(); w2.company('c1', 'am1'); w2.opportunity('op1', 'c1');
    expect(await w2.register.execute({ ...base, opportunityId: 'op1', ...third, access: am1, actor })).toMatchObject({ payerName: 'Société Mère SA', payerType: 'EMPLOYER' });
    expect(w2.audit[0]!.newValue).toMatchObject({ payerName: 'Société Mère SA', payerType: 'EMPLOYER' });
  });

  it('le nom et le type vont ensemble ; un type inconnu ou un nom trop long est refusé, sans rien écrire', async () => {
    const w = build(); w.company('c1', 'am1'); w.opportunity('op1', 'c1');
    for (const payer of [{ payerName: 'Seul' }, { payerType: 'EMPLOYER' }, { payerName: 'X', payerType: 'AUTRE' }, { payerName: 'x'.repeat(201), payerType: 'LANDLORD' }]) {
      await expect(w.register.execute({ ...base, opportunityId: 'op1', ...payer, access: am1, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
    }
    expect(w.approvals.items).toHaveLength(0);
  });
});

describe('Agréments — demandé puis reçu (D41, FD-4)', () => {
  const ask = { amount: '12500000', requested: true };

  it('un agrément demandé n’a pas de date de réception et ne rend pas l’entreprise « Cliente »', async () => {
    const w = build(); w.company('c1', 'am1'); w.opportunity('op1', 'c1');
    const view = await w.register.execute({ ...ask, opportunityId: 'op1', access: am1, actor });
    expect(view).toMatchObject({ status: 'REQUESTED', receivedOn: null, pastValidity: false });
    expect(w.companies.items[0]!.status).toBe(CompanyStatus.Target);
    expect(w.audit.map((a) => a.entityType)).toEqual(['Approval']);
    expect(w.approvals.items[0]!.pullEvents()).toEqual([]);
  });

  it('refuse une date de réception sur un agrément demandé ; la demande occupe l’opportunité (un seul agrément actif)', async () => {
    const w = build(); w.company('c1', 'am1'); w.opportunity('op1', 'c1');
    await expect(w.register.execute({ ...ask, receivedOn: '2026-11-05', opportunityId: 'op1', access: am1, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
    await w.register.execute({ ...ask, opportunityId: 'op1', access: am1, actor });
    await expect(w.register.execute({ ...base, opportunityId: 'op1', access: am1, actor })).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('la promesse signée le rend reçu : date, entreprise « Cliente », événement « accordé », audit avant et après', async () => {
    const w = build(); w.company('c1', 'am1'); w.opportunity('op1', 'c1');
    const asked = await w.register.execute({ ...ask, opportunityId: 'op1', validUntil: '2027-03-31', access: am1, actor });
    w.audit.length = 0;
    const done = await w.receive.execute({ id: asked.id, version: 1, receivedOn: '2026-11-05', access: am1, actor });
    expect(done).toMatchObject({ status: 'RECEIVED', receivedOn: '2026-11-05' });
    expect(w.companies.items[0]!.status).toBe(CompanyStatus.Client);
    expect(w.audit.map((a) => [a.entityType, a.action])).toEqual([['Approval', AuditAction.Update], ['Company', AuditAction.Update]]);
    expect(w.audit[0]).toMatchObject({ oldValue: { status: 'REQUESTED', receivedOn: null }, newValue: { status: 'RECEIVED', receivedOn: '2026-11-05' } });
    expect(w.approvals.items[0]!.pullEvents().map((e) => e.name)).toEqual(['bd.approval.received']);
  });

  it('refuse une réception dans le futur, avant le début de validité, sur version périmée, hors portée ou déjà reçue', async () => {
    const w = build(); w.company('c1', 'am1'); w.opportunity('op1', 'c1');
    const asked = await w.register.execute({ ...ask, opportunityId: 'op1', validUntil: '2026-11-01', access: am1, actor });
    await expect(w.receive.execute({ id: asked.id, version: 1, receivedOn: '2026-11-30', access: am1, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(w.receive.execute({ id: asked.id, version: 1, receivedOn: '2026-11-05', access: am1, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(w.receive.execute({ id: asked.id, version: 9, receivedOn: '2026-10-30', access: am1, actor })).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(w.receive.execute({ id: asked.id, version: 1, receivedOn: '2026-10-30', access: am2, actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(w.receive.execute({ id: asked.id, version: 1, receivedOn: '2026-10-30', access: finance, actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await w.receive.execute({ id: asked.id, version: 1, receivedOn: '2026-10-30', access: am1, actor });
    await expect(w.receive.execute({ id: asked.id, version: 1, receivedOn: '2026-10-30', access: am1, actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
  });

  it('une demande ne peut être ni honorée ni déclarée expirée, mais peut être annulée avec un motif', async () => {
    const w = build(); w.company('c1', 'am1'); w.opportunity('op1', 'c1');
    const asked = await w.register.execute({ ...ask, opportunityId: 'op1', access: am1, actor });
    await expect(w.close.execute({ id: asked.id, version: 1, action: 'honor', access: finance, actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
    await expect(w.close.execute({ id: asked.id, version: 1, action: 'expire', reason: 'Validité dépassée', access: chef, actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
    const cancelled = await w.close.execute({ id: asked.id, version: 1, action: 'cancel', reason: 'Le client renonce', access: chef, actor });
    expect(cancelled).toMatchObject({ status: 'CANCELLED', receivedOn: null });
    expect(await w.register.execute({ ...base, opportunityId: 'op1', access: am1, actor })).toMatchObject({ status: 'RECEIVED' });
  });

  it('l’entreprise archivée fige aussi la demande', async () => {
    const w = build(); w.company('c1', 'am1'); w.opportunity('op1', 'c1');
    const asked = await w.register.execute({ ...ask, opportunityId: 'op1', access: am1, actor });
    w.companies.items[0]!.archive();
    await expect(w.receive.execute({ id: asked.id, version: 1, receivedOn: '2026-11-05', access: am1, actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
  });
});
