import { InMemoryContacts } from '../../../../test/support/in-memory-contacts';
import { InMemoryOwnerDirectory } from '../../../../test/support/in-memory-owner-directory';
import { ActorContext, Page } from '../../../shared-kernel';
import { AuditAction, AuditRecord } from '../../audit';
import type { AccessContext } from '../../iam';
import { RoleCode, resolveGrants } from '../../iam';
import { Company } from '../domain/company';
import { CompanyName } from '../domain/company-name';
import { CompanyRepository } from '../domain/company-repository';
import { CompanyStatus } from '../domain/company-status';
import { Contact } from '../domain/contact';
import { ChangeCompanyStatusUseCase, ListOwnerCandidatesHandler, ReassignCompanyUseCase } from './company-lifecycle-use-cases';

class InMemoryCompanies implements CompanyRepository {
  readonly items: Company[] = [];
  async save(company: Company) { if (!this.items.includes(company)) this.items.push(company); }
  async findById(id: string) { return this.items.find((c) => c.id === id) ?? null; }
  async existsByName(name: CompanyName) { return this.items.some((c) => c.name.normalized === name.normalized); }
  async list(): Promise<Page<Company>> { return { items: this.items, total: this.items.length, page: 1, pageSize: 20 }; }
}

const actor: ActorContext = { userId: 'u1', sessionId: 's1', ipAddress: '10.0.0.1', device: 'jest' };
const as = (role: RoleCode, actorId: string, teamMemberIds: string[] = []): AccessContext => ({ actorId, grants: resolveGrants(role), teamMemberIds });
const now = new Date('2026-11-05T10:00:00Z');

function build() {
  const companies = new InMemoryCompanies();
  const contacts = new InMemoryContacts(companies);
  const owners = new InMemoryOwnerDirectory([{ id: 'am1', name: 'Marie' }, { id: 'am2', name: 'Paul' }, { id: 'am3', name: 'Zoé' }]);
  const audit: AuditRecord[] = [];
  const recorder = { record: async (r: AuditRecord) => { audit.push(r); } };
  const unitOfWork = { run: <T>(work: () => Promise<T>) => work() };
  const company = (id: string, owner: string) => {
    const c = Company.register({ id, name: `Société ${id}`, ownerUserId: owner, now });
    companies.items.push(c);
    return c;
  };
  const contact = (companyId: string) => contacts.save(Contact.register({ id: `ct-${companyId}`, companyId, lastName: 'Diallo', firstName: 'Awa', now }));
  return {
    companies, audit, company, contact,
    status: new ChangeCompanyStatusUseCase(companies, contacts, owners, recorder, unitOfWork),
    reassign: new ReassignCompanyUseCase(companies, owners, recorder, unitOfWork),
    candidates: new ListOwnerCandidatesHandler(owners),
  };
}

const am1 = as(RoleCode.AccountManager, 'am1');
const am2 = as(RoleCode.AccountManager, 'am2');
const chef = as(RoleCode.HeadOfSales, 'chef', ['am1', 'am2']);
const direction = as(RoleCode.Direction, 'dir');

describe('ChangeCompanyStatusUseCase', () => {
  it('fait avancer le statut, nomme le responsable et trace l’ancien et le nouveau', async () => {
    const w = build();
    w.company('c1', 'am1');
    const view = await w.status.execute({ id: 'c1', version: 1, status: CompanyStatus.Contacted, access: am1, actor });
    expect(view.status).toBe('CONTACTED');
    expect(view.ownerName).toBe('Marie');
    expect(w.audit).toHaveLength(1);
    expect(w.audit[0]).toMatchObject({ action: AuditAction.Update, entityId: 'c1', oldValue: { status: 'TARGET' }, newValue: { status: 'CONTACTED' } });
  });

  it('refuse « Qualifiée » sans contact, l’accepte avec un contact', async () => {
    const w = build();
    w.company('c1', 'am1');
    await w.status.execute({ id: 'c1', version: 1, status: CompanyStatus.Contacted, access: am1, actor });
    await expect(w.status.execute({ id: 'c1', version: 1, status: CompanyStatus.Qualified, access: am1, actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
    await w.contact('c1');
    const view = await w.status.execute({ id: 'c1', version: 1, status: CompanyStatus.Qualified, access: am1, actor });
    expect(view.status).toBe('QUALIFIED');
  });

  it('refuse une version périmée (conflit) et une entreprise hors portée ou en lecture seule (introuvable)', async () => {
    const w = build();
    w.company('c1', 'am1');
    await expect(w.status.execute({ id: 'c1', version: 9, status: CompanyStatus.Contacted, access: am1, actor })).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(w.status.execute({ id: 'c1', version: 1, status: CompanyStatus.Contacted, access: am2, actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(w.status.execute({ id: 'c1', version: 1, status: CompanyStatus.Contacted, access: direction, actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(w.status.execute({ id: 'inconnue', version: 1, status: CompanyStatus.Contacted, access: am1, actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(w.audit).toHaveLength(0);
  });
});

describe('ReassignCompanyUseCase', () => {
  it('le Responsable commercial confie une entreprise de son équipe à un autre membre', async () => {
    const w = build();
    w.company('c1', 'am1');
    const view = await w.reassign.execute({ id: 'c1', version: 1, ownerUserId: 'am2', access: chef, actor });
    expect(view.ownerUserId).toBe('am2');
    expect(view.ownerName).toBe('Paul');
    expect(w.audit[0]).toMatchObject({ oldValue: { ownerUserId: 'am1' }, newValue: { ownerUserId: 'am2' } });
  });

  it('le chargé de compte n’a pas ce droit : l’entreprise lui est « introuvable »', async () => {
    const w = build();
    w.company('c1', 'am1');
    await expect(w.reassign.execute({ id: 'c1', version: 1, ownerUserId: 'am2', access: am1, actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(w.companies.items[0]!.ownerUserId).toBe('am1');
  });

  it('refuse un destinataire hors de la portée du Responsable commercial ou inconnu', async () => {
    const w = build();
    w.company('c1', 'am1');
    await expect(w.reassign.execute({ id: 'c1', version: 1, ownerUserId: 'am3', access: chef, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(w.reassign.execute({ id: 'c1', version: 1, ownerUserId: '00000000-0000-4000-8000-000000000000', access: chef, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('refuse le propriétaire actuel et une version périmée', async () => {
    const w = build();
    w.company('c1', 'am1');
    await expect(w.reassign.execute({ id: 'c1', version: 1, ownerUserId: 'am1', access: chef, actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
    await expect(w.reassign.execute({ id: 'c1', version: 5, ownerUserId: 'am2', access: chef, actor })).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

describe('ListOwnerCandidatesHandler', () => {
  it('ne propose au Responsable commercial que son équipe, triée par nom', async () => {
    const w = build();
    expect((await w.candidates.execute({ access: chef })).map((o) => o.id)).toEqual(['am1', 'am2']);
  });
  it('ne propose rien à qui n’a pas le droit de réattribuer', async () => {
    const w = build();
    expect(await w.candidates.execute({ access: am1 })).toEqual([]);
  });
});
