import { InMemoryApprovals } from '../../../../test/support/in-memory-approvals';
import { InMemoryFacilitators } from '../../../../test/support/in-memory-facilitators';
import { InMemoryOpportunities } from '../../../../test/support/in-memory-opportunities';
import { InMemoryPayouts } from '../../../../test/support/in-memory-payouts';
import { ActorContext, Page } from '../../../shared-kernel';
import { AuditAction, AuditRecord } from '../../audit';
import type { AccessContext } from '../../iam';
import { RoleCode, resolveGrants } from '../../iam';
import { Commission } from '../domain/commission';
import { Company } from '../domain/company';
import { CompanyName } from '../domain/company-name';
import { CompanyRepository } from '../domain/company-repository';
import { Facilitation } from '../domain/facilitation';
import { Facilitator } from '../domain/facilitator';
import { Opportunity } from '../domain/opportunity';
import { CloseApprovalUseCase, RegisterApprovalUseCase } from './approval-use-cases';
import { ChangePayoutUseCase, GetPayoutHandler, ListPayoutsHandler, RegisterCommissionDue } from './commission-payout-use-cases';

class InMemoryCompanies implements CompanyRepository {
  readonly items: Company[] = [];
  async save(company: Company) { if (!this.items.includes(company)) this.items.push(company); }
  async findById(id: string) { return this.items.find((c) => c.id === id) ?? null; }
  async existsByName(name: CompanyName) { return this.items.some((c) => c.name.normalized === name.normalized); }
  async list(): Promise<Page<Company>> { return { items: this.items, total: this.items.length, page: 1, pageSize: 20 }; }
}

const actor: ActorContext = { userId: 'u1', sessionId: 's1', ipAddress: '10.0.0.1', device: 'jest' };
const as = (role: RoleCode, actorId: string, teamMemberIds: string[] = []): AccessContext => ({ actorId, grants: resolveGrants(role), teamMemberIds });
const now = new Date('2026-11-10T10:00:00Z');

function build(options: { proof?: boolean } = {}) {
  const companies = new InMemoryCompanies();
  const opportunities = new InMemoryOpportunities(companies);
  const approvals = new InMemoryApprovals(companies, opportunities);
  const facilitators = new InMemoryFacilitators();
  const payouts = new InMemoryPayouts(companies, facilitators);
  const audit: AuditRecord[] = [];
  let seq = 0;
  const recorder = { record: async (r: AuditRecord) => { audit.push(r); } };
  const unitOfWork = { run: <T>(work: () => Promise<T>) => work() };
  const clock = { now: () => now };
  const ids = { next: () => `id-${++seq}` };
  const presence = { proof: options.proof ?? true, has: async () => presence.proof };
  /** Entreprise de `owner` avec un facilitateur et, si demandé, une commission. */
  const company = (id: string, owner: string, commission: { type: string; value: string; currency?: string } | null = { type: 'FIXED', value: '150000', currency: 'XAF' }, archived = false) => {
    const facilitator = Facilitator.register({ id: `f-${id}`, lastName: 'Mbarga', firstName: 'Paul', phone: '+237699001122', ownerUserId: owner, now });
    facilitators.items.push(facilitator);
    const c = Company.register({
      id, name: `Société ${id}`, ownerUserId: owner, now,
      facilitation: Facilitation.of({ facilitatorId: facilitator.id, contactMethod: 'PHONE_CALL', commission: commission ? Commission.of(commission) : null }),
    });
    if (archived) c.archive();
    companies.items.push(c);
    return c;
  };
  const opportunity = (id: string, companyId: string) => {
    const o = Opportunity.create({ id, companyId, title: `Formation ${id}`, amount: '5000000', source: 'REFERRAL', now });
    for (let i = 0; i < 3; i++) o.advance({ decisionMakerMeetingHeld: true }, now);
    opportunities.items.push(o);
    return o;
  };
  const registerApproval = new RegisterApprovalUseCase(approvals, opportunities, companies, recorder, unitOfWork, clock, ids);
  const due = new RegisterCommissionDue(payouts, facilitators, recorder, clock, ids);
  const closeApproval = new CloseApprovalUseCase(approvals, opportunities, companies, recorder, unitOfWork, clock, due);
  return {
    companies, payouts, audit, presence, company, opportunity,
    /** Un agrément honoré par la Finance : la commission du facilitateur devient due (si elle existe). */
    honored: async (companyId: string, opportunityId: string, amount: string | null = '12500000') => {
      const a = await registerApproval.execute({ opportunityId, amount: amount ?? undefined, places: amount ? undefined : 8, receivedOn: '2026-11-05', access: as(RoleCode.SuperAdmin, 'root'), actor });
      await closeApproval.execute({ id: a.id, version: 1, action: 'honor', access: as(RoleCode.Finance, 'fin'), actor });
      return a;
    },
    change: new ChangePayoutUseCase(payouts, companies, facilitators, presence, recorder, unitOfWork, clock),
    get: new GetPayoutHandler(payouts, companies, facilitators),
    list: new ListPayoutsHandler(payouts, companies),
  };
}

const am1 = as(RoleCode.AccountManager, 'am1');
const am2 = as(RoleCode.AccountManager, 'am2');
const chef = as(RoleCode.HeadOfSales, 'chef', ['am1']);
const autreChef = as(RoleCode.HeadOfSales, 'autre', ['am2']);
const finance = as(RoleCode.Finance, 'fin');
const direction = as(RoleCode.Direction, 'dir');

async function world(commission?: { type: string; value: string; currency?: string } | null, amount: string | null = '12500000') {
  const w = build();
  w.company('c1', 'am1', commission);
  w.opportunity('op1', 'c1');
  await w.honored('c1', 'op1', amount);
  return { w, payout: w.payouts.items[0]! };
}

describe('Commission — due à l’honneur de l’agrément (D41, FD-1 B)', () => {
  it('un montant fixe devient « à verser », figé, avec son audit ; le facilitateur et l’entreprise sont nommés', async () => {
    const { w, payout } = await world();
    expect(payout).toMatchObject({ status: 'DUE', amount: '150000.00', currency: 'XAF', commissionType: 'FIXED', companyId: 'c1', facilitatorId: 'f-c1', version: 1 });
    const created = w.audit.find((a) => a.entityType === 'CommissionPayout');
    expect(created).toMatchObject({ action: AuditAction.Create, newValue: { facilitatorName: 'Paul Mbarga', companyName: 'Société c1', amount: '150000.00', status: 'DUE' } });
  });

  it('un pourcentage s’applique au montant de l’agrément ; sans montant d’agrément, il reste à fixer', async () => {
    expect((await world({ type: 'PERCENT', value: '5' })).payout.amount).toBe('625000.00');
    expect((await world({ type: 'PERCENT', value: '5' }, null)).payout.amount).toBeNull();
  });

  it('sans facilitateur commissionné, rien n’est dû ; l’honneur ne produit qu’un versement par agrément', async () => {
    expect((await world(null)).w.payouts.items).toHaveLength(0);
    const { w, payout } = await world();
    const again = await new RegisterCommissionDue(w.payouts, new InMemoryFacilitators(), { record: async () => undefined }, { now: () => now }, { next: () => 'x' })
      .execute({ approval: (await new InMemoryApprovals(w.companies, new InMemoryOpportunities(w.companies)).findById('none')) ?? ({ id: payout.approvalId } as never), company: w.companies.items[0]!, actor });
    expect(again).toBeNull();
    expect(w.payouts.items).toHaveLength(1);
  });

  it('la commission est figée : modifier ensuite la commission du facilitateur ne touche pas le versement', async () => {
    const { w, payout } = await world();
    w.companies.items[0]!.update({ facilitation: Facilitation.of({ facilitatorId: 'f-c1', contactMethod: 'EMAIL', commission: Commission.of({ type: 'FIXED', value: '999999', currency: 'XAF' }) }) });
    expect((await w.get.execute({ id: payout.id, access: am1 })).amount).toBe('150000.00');
  });
});

describe('Commission — déblocage par la Finance (le DAF seul)', () => {
  it('la Finance débloque ; l’audit porte l’ancien et le nouvel état', async () => {
    const { w, payout } = await world();
    w.audit.length = 0;
    const done = await w.change.execute({ id: payout.id, version: 1, action: 'release', access: finance, actor });
    expect(done).toMatchObject({ status: 'RELEASED' });
    expect(w.audit[0]).toMatchObject({ action: AuditAction.Update, oldValue: { status: 'DUE' }, newValue: { status: 'RELEASED' } });
  });

  it('mettre en attente exige un motif, puis débloquer reste possible', async () => {
    const { w, payout } = await world();
    await expect(w.change.execute({ id: payout.id, version: 1, action: 'hold', access: finance, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
    const held = await w.change.execute({ id: payout.id, version: 1, action: 'hold', reason: 'Virement du client attendu', access: finance, actor });
    expect(held).toMatchObject({ status: 'ON_HOLD', holdReason: 'Virement du client attendu' });
    expect((await w.change.execute({ id: payout.id, version: 1, action: 'release', access: finance, actor })).status).toBe('RELEASED');
  });

  it('ni le chargé de compte, ni le Responsable commercial, ni la Direction ne débloquent ; la commission est introuvable pour eux', async () => {
    const { w, payout } = await world();
    for (const who of [am1, chef, direction]) {
      await expect(w.change.execute({ id: payout.id, version: 1, action: 'release', access: who, actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    }
    expect(w.payouts.items[0]!.status).toBe('DUE');
  });

  it('un montant à fixer bloque le déblocage jusqu’à ce que le Responsable commercial le fixe', async () => {
    const { w, payout } = await world({ type: 'PERCENT', value: '5' }, null);
    await expect(w.change.execute({ id: payout.id, version: 1, action: 'release', access: finance, actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
    await expect(w.change.execute({ id: payout.id, version: 1, action: 'amount', amount: '250000', access: finance, actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const fixed = await w.change.execute({ id: payout.id, version: 1, action: 'amount', amount: '250000', access: chef, actor });
    expect(fixed.amount).toBe('250000.00');
    expect((await w.change.execute({ id: payout.id, version: 1, action: 'release', access: finance, actor })).status).toBe('RELEASED');
  });
});

describe('Commission — versement avec justificatif', () => {
  async function releasedWorld(proof = true) {
    const { w, payout } = await world();
    w.presence.proof = proof;
    await w.change.execute({ id: payout.id, version: 1, action: 'release', access: finance, actor });
    return { w, payout };
  }

  it('le chargé de compte constate le versement quand les fonds sont débloqués et le justificatif déposé', async () => {
    const { w, payout } = await releasedWorld();
    const paid = await w.change.execute({ id: payout.id, version: 1, action: 'pay', paidOn: '2026-11-09', access: am1, actor });
    expect(paid).toMatchObject({ status: 'PAID', paidOn: '2026-11-09' });
  });

  it('le Responsable commercial verse aussi pour son équipe', async () => {
    const { w, payout } = await releasedWorld();
    expect((await w.change.execute({ id: payout.id, version: 1, action: 'pay', paidOn: '2026-11-09', access: chef, actor })).status).toBe('PAID');
  });

  it('refuse sans justificatif ; la Finance ne verse pas ; avant le déblocage on ne verse pas', async () => {
    const { w, payout } = await releasedWorld(false);
    await expect(w.change.execute({ id: payout.id, version: 1, action: 'pay', paidOn: '2026-11-09', access: am1, actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
    w.presence.proof = true;
    await expect(w.change.execute({ id: payout.id, version: 1, action: 'pay', paidOn: '2026-11-09', access: finance, actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const fresh = await world();
    await expect(fresh.w.change.execute({ id: fresh.payout.id, version: 1, action: 'pay', paidOn: '2026-11-09', access: am1, actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
  });

  it('date future refusée ; versement définitif', async () => {
    const { w, payout } = await releasedWorld();
    await expect(w.change.execute({ id: payout.id, version: 1, action: 'pay', paidOn: '2026-12-01', access: am1, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
    await w.change.execute({ id: payout.id, version: 1, action: 'pay', paidOn: '2026-11-09', access: am1, actor });
    await expect(w.change.execute({ id: payout.id, version: 1, action: 'pay', paidOn: '2026-11-09', access: am1, actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
    await expect(w.change.execute({ id: payout.id, version: 1, action: 'cancel', reason: 'Trop tard', access: chef, actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
  });
});

describe('Commission — annulation, versions, portée, entreprise archivée', () => {
  it('le Responsable commercial annule avec un motif ; le chargé de compte ne le peut pas', async () => {
    const { w, payout } = await world();
    await expect(w.change.execute({ id: payout.id, version: 1, action: 'cancel', reason: 'Erreur', access: am1, actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(w.change.execute({ id: payout.id, version: 1, action: 'cancel', access: chef, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
    const cancelled = await w.change.execute({ id: payout.id, version: 1, action: 'cancel', reason: 'Agrément saisi par erreur', access: chef, actor });
    expect(cancelled).toMatchObject({ status: 'CANCELLED', cancelledReason: 'Agrément saisi par erreur' });
  });

  it('version périmée = conflit ; hors portée = introuvable', async () => {
    const { w, payout } = await world();
    await expect(w.change.execute({ id: payout.id, version: 9, action: 'release', access: finance, actor })).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(w.change.execute({ id: payout.id, version: 1, action: 'cancel', reason: 'Erreur', access: autreChef, actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(w.get.execute({ id: payout.id, access: am2 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(w.get.execute({ id: 'inconnu', access: am1 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('l’entreprise archivée fige ses commissions', async () => {
    const { w, payout } = await world();
    w.companies.items[0]!.archive();
    await expect(w.change.execute({ id: payout.id, version: 1, action: 'release', access: finance, actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
  });
});

describe('Commission — lecture', () => {
  it('chacun voit les commissions de sa portée : chargé de compte les siennes, chef son équipe, Finance et Direction tout', async () => {
    const w = build();
    w.company('c1', 'am1'); w.opportunity('op1', 'c1'); await w.honored('c1', 'op1');
    w.company('c2', 'am2'); w.opportunity('op2', 'c2'); await w.honored('c2', 'op2');
    expect((await w.list.execute({ page: 1, pageSize: 20, access: am1 })).total).toBe(1);
    expect((await w.list.execute({ page: 1, pageSize: 20, access: am2 })).total).toBe(1);
    expect((await w.list.execute({ page: 1, pageSize: 20, access: chef })).total).toBe(1);
    expect((await w.list.execute({ page: 1, pageSize: 20, access: finance })).total).toBe(2);
    expect((await w.list.execute({ page: 1, pageSize: 20, access: direction })).total).toBe(2);
    expect((await w.list.execute({ page: 1, pageSize: 20, access: finance, status: 'RELEASED' })).total).toBe(0);
    expect((await w.list.execute({ page: 1, pageSize: 20, access: finance, companyId: 'c2' })).items[0]).toMatchObject({ companyName: 'Société c2', facilitatorName: 'Paul Mbarga' });
    await expect(w.list.execute({ page: 1, pageSize: 20, access: am1, companyId: 'c2' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
