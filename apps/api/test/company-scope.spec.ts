import { GetCompanyHandler } from '../src/modules/business-development/application/get-company.query';
import { ListCompaniesHandler } from '../src/modules/business-development/application/list-companies.query';
import { Company } from '../src/modules/business-development/domain/company';
import { Opportunity } from '../src/modules/business-development/domain/opportunity';
import { CompanyName } from '../src/modules/business-development/domain/company-name';
import { CompanyRepository } from '../src/modules/business-development/domain/company-repository';
import { CompanyStatus } from '../src/modules/business-development/domain/company-status';
import { visibilityFor } from '../src/modules/iam';
import { RoleCode } from '../src/modules/iam/domain/roles';
import { Page } from '../src/shared-kernel';
import { buildIamWorld } from './support/iam-world';
import { InMemoryFacilitators } from './support/in-memory-facilitators';
import { InMemoryOpportunities } from './support/in-memory-opportunities';
import { InMemoryOpportunityTotals } from './support/in-memory-opportunity-totals';
import { InMemoryOwnerDirectory } from './support/in-memory-owner-directory';

class InMemoryCompanies implements CompanyRepository {
  readonly items: Company[] = [];
  async save(company: Company) { this.items.push(company); }
  async findById(id: string) { return this.items.find((c) => c.id === id) ?? null; }
  async existsByName(name: CompanyName) { return this.items.some((c) => c.name.normalized === name.normalized); }
  async list(q: { page: number; pageSize: number; search?: string; ownerIds?: readonly string[] }): Promise<Page<Company>> {
    const filtered = this.items
      .filter((c) => !q.ownerIds || (c.ownerUserId !== null && q.ownerIds.includes(c.ownerUserId)))
      .filter((c) => !q.search || c.name.normalized.includes(q.search.toLowerCase()));
    return { items: filtered.slice((q.page - 1) * q.pageSize, q.page * q.pageSize), total: filtered.length, page: q.page, pageSize: q.pageSize };
  }
}

const now = new Date('2026-10-20T10:00:00Z');
const company = (id: string, owner: string | null) =>
  Company.rehydrate({ id, name: CompanyName.of(`Société ${id}`), status: CompanyStatus.Target, ownerUserId: owner, sector: null, country: null, email: null, phone: null, facilitation: null, createdAt: now, version: 1 });

/**
 * Hiérarchie :   hos ─┬─ am1 ── intern      (am1 est aussi chargé de compte)
 *                     └─ am2
 * `intern` est un PETIT-ENFANT de hos : jamais dans sa portée Équipe (subordonnés DIRECTS seulement).
 */
async function scenario() {
  const w = buildIamWorld();
  const hos = await w.createDefaultUser([RoleCode.HeadOfSales], 'hos@investally.test');
  const am1 = await w.createUser.execute({ email: 'am1@investally.test', displayName: 'Alice Ngo', password: w.PASSWORD, roles: [RoleCode.AccountManager], managerId: hos.id, actor: { userId: null, sessionId: null, ipAddress: 'x', device: 'x' } });
  const am2 = await w.createUser.execute({ email: 'am2@investally.test', displayName: 'Bruno Eto', password: w.PASSWORD, roles: [RoleCode.AccountManager], managerId: hos.id, actor: { userId: null, sessionId: null, ipAddress: 'x', device: 'x' } });
  const intern = await w.createUser.execute({ email: 'intern@investally.test', displayName: 'Carla Mbo', password: w.PASSWORD, roles: [RoleCode.AccountManager], managerId: am1.id, actor: { userId: null, sessionId: null, ipAddress: 'x', device: 'x' } });
  const direction = await w.createDefaultUser([RoleCode.Direction], 'direction@investally.test');
  const trainer = await w.createDefaultUser([RoleCode.Trainer], 'trainer@investally.test');
  const support = await w.createDefaultUser([RoleCode.Support], 'support@investally.test');

  const repo = new InMemoryCompanies();
  for (const [id, owner] of [['hos', hos.id], ['am1', am1.id], ['am2', am2.id], ['intern', intern.id], ['legacy', null]] as const) repo.items.push(company(id, owner));

  const opportunities = new InMemoryOpportunities(repo);
  const list = new ListCompaniesHandler(repo, new InMemoryOwnerDirectory(), new InMemoryOpportunityTotals(opportunities));
  const get = new GetCompanyHandler(repo, new InMemoryFacilitators(), new InMemoryOwnerDirectory());
  const ctx = (userId: string) => w.authorization.contextFor(userId);
  const visible = async (userId: string) => {
    const access = await ctx(userId);
    return (await list.execute({ page: 1, pageSize: 50, visibility: visibilityFor(access, 'bd.company.read'), opportunityVisibility: visibilityFor(access, 'bd.opportunity.read') })).items.map((c) => c.id.valueOf()).sort();
  };
  return { w, repo, opportunities, list, get, ctx, visible, ids: { hos: hos.id, am1: am1.id, am2: am2.id, intern: intern.id, direction: direction.id, trainer: trainer.id, support: support.id } };
}

describe('Portée des entreprises (B9)', () => {
  it('Propre (chargé de compte) : seulement SES entreprises', async () => {
    const s = await scenario();
    expect(await s.visible(s.ids.am1)).toEqual(['am1']);
    expect(await s.visible(s.ids.am2)).toEqual(['am2']);
    expect(await s.visible(s.ids.intern)).toEqual(['intern']);
  });

  it('Équipe (responsable commercial) : soi + subordonnés DIRECTS, jamais les petits-enfants ni les orphelines', async () => {
    const s = await scenario();
    expect(await s.visible(s.ids.hos)).toEqual(['am1', 'am2', 'hos']);
    expect(await s.visible(s.ids.hos)).not.toContain('intern');
    expect(await s.visible(s.ids.hos)).not.toContain('legacy');
  });

  it('Tous (Direction, Support) : toutes, y compris l\'entreprise antérieure sans propriétaire', async () => {
    const s = await scenario();
    for (const id of [s.ids.direction, s.ids.support]) expect(await s.visible(id)).toEqual(['am1', 'am2', 'hos', 'intern', 'legacy']);
  });

  it('sans la permission (formateur) : AUCUNE entreprise, jamais « tout »', async () => {
    const s = await scenario();
    expect(await s.visible(s.ids.trainer)).toEqual([]);
  });

  it('le total et la pagination reflètent la portée, pas la table entière', async () => {
    const s = await scenario();
    const access = await s.ctx(s.ids.hos);
    const page = await s.list.execute({ page: 1, pageSize: 2, visibility: visibilityFor(access, 'bd.company.read'), opportunityVisibility: visibilityFor(access, 'bd.opportunity.read') });
    expect(page.total).toBe(3);
    expect(page.items).toHaveLength(2);
    const huge = await s.list.execute({ page: 1, pageSize: 5000, visibility: visibilityFor(access, 'bd.company.read'), opportunityVisibility: visibilityFor(access, 'bd.opportunity.read') });
    expect(huge.pageSize).toBe(100);
  });

  it('la recherche ne sort jamais de la portée (une correspondance hors portée reste invisible)', async () => {
    const s = await scenario();
    const access = await s.ctx(s.ids.am1);
    const result = await s.list.execute({ page: 1, pageSize: 20, search: 'société', visibility: visibilityFor(access, 'bd.company.read'), opportunityVisibility: visibilityFor(access, 'bd.opportunity.read') });
    expect(result.items.map((c) => c.id)).toEqual(['am1']);
  });

  it('IDOR : lire l\'entreprise d\'un collègue donne « introuvable » (404), pas « interdit » (403)', async () => {
    const s = await scenario();
    await expect(s.get.execute({ id: 'am2', access: await s.ctx(s.ids.am1) })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(s.get.execute({ id: 'hos', access: await s.ctx(s.ids.am1) })).rejects.toMatchObject({ code: 'NOT_FOUND' }); // même celle de son responsable
    await expect(s.get.execute({ id: 'inexistante', access: await s.ctx(s.ids.am1) })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('IDOR : une entreprise existante hors portée et une entreprise inexistante sont indiscernables', async () => {
    const s = await scenario();
    const a = await s.get.execute({ id: 'am2', access: await s.ctx(s.ids.am1) }).catch((e) => `${e.code}|${e.message}`);
    const b = await s.get.execute({ id: 'zzz', access: await s.ctx(s.ids.am1) }).catch((e) => `${e.code}|${e.message}`);
    expect(a).toBe(b);
  });

  it('accès à l\'entreprise : propre OK ; subordonné direct OK en Équipe ; petit-enfant refusé ; orpheline refusée sauf portée Tous', async () => {
    const s = await scenario();
    await expect(s.get.execute({ id: 'am1', access: await s.ctx(s.ids.am1) })).resolves.toMatchObject({ id: 'am1', ownerUserId: s.ids.am1 });
    await expect(s.get.execute({ id: 'am1', access: await s.ctx(s.ids.hos) })).resolves.toMatchObject({ id: 'am1' });
    await expect(s.get.execute({ id: 'intern', access: await s.ctx(s.ids.hos) })).rejects.toMatchObject({ code: 'NOT_FOUND' });

    for (const owner of [s.ids.am1, s.ids.hos]) await expect(s.get.execute({ id: 'legacy', access: await s.ctx(owner) })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(s.get.execute({ id: 'legacy', access: await s.ctx(s.ids.direction) })).resolves.toMatchObject({ id: 'legacy', ownerUserId: null });
  });

  it('un déplacement de hiérarchie change immédiatement la portée Équipe', async () => {
    const s = await scenario();
    expect(await s.visible(s.ids.hos)).not.toContain('intern');
    s.w.users.items.get(s.ids.intern)!.assignManager(s.ids.hos); // intern devient subordonné DIRECT de hos
    expect(await s.visible(s.ids.hos)).toContain('intern');
    s.w.users.items.get(s.ids.am2)!.assignManager(null); // am2 quitte l'équipe
    expect(await s.visible(s.ids.hos)).not.toContain('am2');
  });
});

describe('Valeur des opportunités ouvertes dans la liste des entreprises (S4.3c)', () => {
  const now = new Date('2026-11-06T10:00:00Z');
  const opp = (id: string, companyId: string, amount: string, currency = 'XAF') => Opportunity.create({ id, companyId, title: `Opportunité ${id}`, amount, currency, source: 'REFERRAL', now });
  const valueOf = async (s: Awaited<ReturnType<typeof scenario>>, userId: string, companyId: string) => {
    const access = await s.ctx(userId);
    const page = await s.list.execute({ page: 1, pageSize: 50, visibility: visibilityFor(access, 'bd.company.read'), opportunityVisibility: visibilityFor(access, 'bd.opportunity.read') });
    return page.items.find((c) => c.id === companyId)?.openOpportunities;
  };

  it('additionne les opportunités OUVERTES, devise par devise, sans jamais mélanger deux devises', async () => {
    const s = await scenario();
    s.opportunities.items.push(opp('o1', 'am1', '1000000.50'), opp('o2', 'am1', '2000000'), opp('o3', 'am1', '300.25', 'EUR'));
    const lost = opp('o4', 'am1', '9000000'); lost.closeLost('PRICE', null, now); s.opportunities.items.push(lost);
    expect(await valueOf(s, s.ids.am1, 'am1')).toEqual({ count: 3, totals: [{ currency: 'EUR', amount: '300.25' }, { currency: 'XAF', amount: '3000000.50' }] });
  });

  it('une entreprise sans opportunité ouverte affiche zéro, pas « absente »', async () => {
    const s = await scenario();
    expect(await valueOf(s, s.ids.am1, 'am1')).toEqual({ count: 0, totals: [] });
  });

  it('suit la portée de lecture : le chargé de compte ne voit que les siennes, le Responsable commercial et la Direction toutes', async () => {
    const s = await scenario();
    s.opportunities.items.push(opp('o5', 'am2', '700000'));
    expect(await valueOf(s, s.ids.hos, 'am2')).toMatchObject({ count: 1 });
    expect(await valueOf(s, s.ids.direction, 'am2')).toMatchObject({ count: 1 });
    expect(await valueOf(s, s.ids.am1, 'am1')).toEqual({ count: 0, totals: [] });
    expect(await valueOf(s, s.ids.am1, 'am2')).toBeUndefined(); // entreprise hors de sa portée : même absente de la liste
  });

  it('sans le droit de lire les opportunités (Support), la valeur n’est pas calculée, même si l’entreprise est visible', async () => {
    const s = await scenario();
    s.opportunities.items.push(opp('o6', 'am1', '5000000'));
    const access = await s.ctx(s.ids.support);
    const page = await s.list.execute({ page: 1, pageSize: 50, visibility: visibilityFor(access, 'bd.company.read'), opportunityVisibility: visibilityFor(access, 'bd.opportunity.read') });
    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.every((c) => c.openOpportunities === undefined)).toBe(true);
  });
});
