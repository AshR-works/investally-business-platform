import { InMemoryAmbassadors } from '../../../../test/support/in-memory-ambassadors';
import { ActorContext, Page } from '../../../shared-kernel';
import { AuditAction, AuditRecord } from '../../audit';
import type { AccessContext } from '../../iam';
import { RoleCode, resolveGrants, visibilityFor } from '../../iam';
import { Company } from '../domain/company';
import { CompanyName } from '../domain/company-name';
import { CompanyRepository } from '../domain/company-repository';
import { GetAmbassadorHandler, ListAmbassadorsHandler, RegisterAmbassadorUseCase, SetAmbassadorStatusUseCase, UpdateAmbassadorUseCase } from './ambassador-use-cases';

class InMemoryCompanies implements CompanyRepository {
  readonly items: Company[] = [];
  async save(company: Company) { if (!this.items.includes(company)) this.items.push(company); }
  async findById(id: string) { return this.items.find((c) => c.id === id) ?? null; }
  async existsByName(name: CompanyName) { return this.items.some((c) => c.name.normalized === name.normalized); }
  async list(): Promise<Page<Company>> { return { items: this.items, total: this.items.length, page: 1, pageSize: 20 }; }
}

const actor: ActorContext = { userId: 'u1', sessionId: 's1', ipAddress: '10.0.0.1', device: 'jest' };
const as = (role: RoleCode, actorId: string, teamMemberIds: string[] = []): AccessContext => ({ actorId, grants: resolveGrants(role), teamMemberIds });
const now = new Date('2026-11-08T10:00:00Z');

function build() {
  const companies = new InMemoryCompanies();
  const ambassadors = new InMemoryAmbassadors(companies);
  const audit: AuditRecord[] = [];
  let seq = 0;
  const recorder = { record: async (r: AuditRecord) => { audit.push(r); } };
  const unitOfWork = { run: <T>(work: () => Promise<T>) => work() };
  const clock = { now: () => now };
  const ids = { next: () => `am-${++seq}` };
  const company = (id: string, owner: string) => {
    const c = Company.register({ id, name: `Société ${id}`, ownerUserId: owner, now });
    companies.items.push(c);
    return c;
  };
  return {
    companies, ambassadors, audit, company,
    register: new RegisterAmbassadorUseCase(ambassadors, companies, recorder, unitOfWork, clock, ids),
    update: new UpdateAmbassadorUseCase(ambassadors, companies, recorder, unitOfWork, clock),
    get: new GetAmbassadorHandler(ambassadors, companies),
    list: new ListAmbassadorsHandler(ambassadors, companies),
    setStatus: new SetAmbassadorStatusUseCase(ambassadors, companies, recorder, unitOfWork, clock),
  };
}

const am1 = as(RoleCode.AccountManager, 'am1');
const am2 = as(RoleCode.AccountManager, 'am2');
const chef = as(RoleCode.HeadOfSales, 'chef', ['am1']);
const direction = as(RoleCode.Direction, 'dir');
const support = as(RoleCode.Support, 'sup');
const base = { lastName: 'Fotso', firstName: 'Alain', origin: 'CLIENT', appointedOn: '2026-11-05' };
const first = { page: 1, pageSize: 50 };

describe('Ambassadeurs — création', () => {
  it('le chargé de compte crée un ambassadeur client de son entreprise : il en est le responsable, tracé dans l’audit', async () => {
    const w = build(); w.company('c1', 'am1');
    const view = await w.register.execute({ ...base, companyId: 'c1', email: 'alain@exemple.cm', access: am1, actor });
    expect(view).toMatchObject({ lastName: 'Fotso', origin: 'CLIENT', companyId: 'c1', companyName: 'Société c1', email: 'alain@exemple.cm', ownerUserId: 'am1', version: 1 });
    expect(w.audit).toHaveLength(1);
    expect(w.audit[0]).toMatchObject({ action: AuditAction.Create, entityType: 'Ambassador', entityId: view.id });
  });

  it('un apprenant sans entreprise est accepté', async () => {
    const w = build();
    const view = await w.register.execute({ lastName: 'Ndzana', firstName: 'Claire', origin: 'LEARNER', appointedOn: '2026-03-10', access: am1, actor });
    expect(view).toMatchObject({ origin: 'LEARNER', companyId: null, companyName: null });
  });

  it('refuse un client sans entreprise, une origine inconnue, une date future, sans rien écrire', async () => {
    const w = build(); w.company('c1', 'am1');
    await expect(w.register.execute({ ...base, access: am1, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(w.register.execute({ ...base, companyId: 'c1', origin: 'AUTRE', access: am1, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(w.register.execute({ ...base, companyId: 'c1', appointedOn: '2026-12-25', access: am1, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(w.ambassadors.items).toHaveLength(0);
    expect(w.audit).toHaveLength(0);
  });

  it('l’entreprise d’un collègue ou inexistante est « introuvable » : on ne rattache pas un ambassadeur à une entreprise hors portée', async () => {
    const w = build(); w.company('c2', 'am2');
    await expect(w.register.execute({ ...base, companyId: 'c2', access: am1, actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(w.register.execute({ ...base, companyId: 'inconnue', access: am1, actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(w.ambassadors.items).toHaveLength(0);
  });

  it('un e-mail ne sert qu’à un seul ambassadeur', async () => {
    const w = build(); w.company('c1', 'am1');
    await w.register.execute({ ...base, companyId: 'c1', email: 'alain@exemple.cm', access: am1, actor });
    await expect(w.register.execute({ ...base, lastName: 'Autre', companyId: 'c1', email: 'ALAIN@exemple.cm', access: am1, actor })).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(w.ambassadors.items).toHaveLength(1);
  });

  it('le Responsable commercial peut créer ; la Direction et le Support (sans droit de création) sont refusés', async () => {
    const w = build();
    expect((await w.register.execute({ lastName: 'A', firstName: 'B', origin: 'LEARNER', appointedOn: '2026-11-01', access: chef, actor })).ownerUserId).toBe('chef');
    await expect(w.register.execute({ lastName: 'A', firstName: 'B', origin: 'LEARNER', appointedOn: '2026-11-01', access: direction, actor })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(w.register.execute({ lastName: 'A', firstName: 'B', origin: 'LEARNER', appointedOn: '2026-11-01', access: support, actor })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('Ambassadeurs — modification', () => {
  async function created(w: ReturnType<typeof build>) {
    w.company('c1', 'am1');
    return w.register.execute({ ...base, companyId: 'c1', email: 'alain@exemple.cm', access: am1, actor });
  }

  it('le Responsable commercial modifie un ambassadeur de son équipe : avant et après dans l’audit', async () => {
    const w = build(); const a = await created(w);
    w.audit.length = 0;
    const view = await w.update.execute({ id: a.id, version: 1, lastName: 'Ndzana', phone: '+237 699 00 11 22', access: chef, actor });
    expect(view).toMatchObject({ lastName: 'Ndzana', phone: '+237699001122', firstName: 'Alain' });
    expect(w.audit[0]).toMatchObject({ action: AuditAction.Update, oldValue: { lastName: 'Fotso' }, newValue: { lastName: 'Ndzana' } });
  });

  it('le chargé de compte ne modifie pas (matrice de droits) ; un collègue d’une autre équipe reçoit « introuvable »', async () => {
    const w = build(); const a = await created(w);
    await expect(w.update.execute({ id: a.id, version: 1, lastName: 'X', access: am1, actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(w.update.execute({ id: a.id, version: 1, lastName: 'X', access: as(RoleCode.HeadOfSales, 'autre'), actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(w.ambassadors.items[0]!.lastName).toBe('Fotso');
  });

  it('version périmée : conflit ; e-mail déjà pris : conflit ; entreprise hors portée : introuvable', async () => {
    const w = build(); const a = await created(w);
    w.company('c2', 'am2');
    await w.register.execute({ lastName: 'B', firstName: 'C', origin: 'LEARNER', email: 'autre@exemple.cm', appointedOn: '2026-11-01', access: am1, actor });
    await expect(w.update.execute({ id: a.id, version: 9, lastName: 'X', access: chef, actor })).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(w.update.execute({ id: a.id, version: 1, email: 'autre@exemple.cm', access: chef, actor })).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(w.update.execute({ id: a.id, version: 1, companyId: 'c2', access: chef, actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('un client ne perd pas son entreprise ; son e-mail peut rester le sien', async () => {
    const w = build(); const a = await created(w);
    await expect(w.update.execute({ id: a.id, version: 1, companyId: null, access: chef, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
    expect((await w.update.execute({ id: a.id, version: 1, email: 'alain@exemple.cm', note: 'Relais', access: chef, actor })).note).toBe('Relais');
  });
});

describe('Ambassadeurs — lecture et portée', () => {
  it('le chargé de compte ne voit que les siens, le Responsable commercial et la Direction tous', async () => {
    const w = build();
    const a1 = await w.register.execute({ lastName: 'A', firstName: 'A', origin: 'LEARNER', appointedOn: '2026-11-01', access: am1, actor });
    await w.register.execute({ lastName: 'B', firstName: 'B', origin: 'LEARNER', appointedOn: '2026-11-01', access: am2, actor });
    const listFor = (access: AccessContext) => w.list.execute({ ...first, access, visibility: visibilityFor(access, 'bd.ambassador.read') });
    expect((await listFor(am1)).items.map((i) => i.id)).toEqual([a1.id]);
    expect((await listFor(chef)).total).toBe(2);
    expect((await listFor(direction)).total).toBe(2);
    await expect(w.get.execute({ id: a1.id, access: am2 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect((await w.get.execute({ id: a1.id, access: direction })).id).toBe(a1.id);
    await expect(w.get.execute({ id: 'inconnu', access: am1 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('recherche et filtre par origine ; tri par nom ; taille de page bornée', async () => {
    const w = build(); w.company('c1', 'am1');
    await w.register.execute({ lastName: 'Zola', firstName: 'Ève', origin: 'LEARNER', appointedOn: '2026-11-01', access: am1, actor });
    await w.register.execute({ lastName: 'Atangana', firstName: 'Paul', origin: 'CLIENT', companyId: 'c1', appointedOn: '2026-11-01', access: am1, actor });
    const visibility = visibilityFor(am1, 'bd.ambassador.read');
    const list = (extra: object) => w.list.execute({ ...first, access: am1, visibility, ...extra });
    expect((await list({})).items.map((i) => i.lastName)).toEqual(['Atangana', 'Zola']);
    expect((await list({ origin: 'LEARNER' })).items.map((i) => i.lastName)).toEqual(['Zola']);
    expect((await list({ search: 'paul' })).total).toBe(1);
    expect((await list({ page: 1, pageSize: 5000 })).pageSize).toBe(100);
  });
});

describe('Ambassadeurs — archivage réversible (N5)', () => {
  const learner = { lastName: 'Zola', firstName: 'Ève', origin: 'LEARNER', appointedOn: '2026-11-01', email: 'eve@exemple.cm' };

  it('archive puis réactive : jamais supprimé, motif conservé le temps de l’archivage, version incrémentée, audit avant/après', async () => {
    const w = build();
    const created = await w.register.execute({ ...learner, access: am1, actor });
    const archived = await w.setStatus.execute({ id: created.id, version: created.version, status: 'ARCHIVED', reason: '  A quitté le réseau ', access: chef, actor });
    expect(archived).toMatchObject({ status: 'ARCHIVED', archiveReason: 'A quitté le réseau', archivedAt: now.toISOString() });
    expect(w.ambassadors.items).toHaveLength(1);
    expect(w.audit.at(-1)).toMatchObject({ action: AuditAction.Update, entityType: 'Ambassador', oldValue: { status: 'ACTIVE' }, newValue: { status: 'ARCHIVED' } });
    const back = await w.setStatus.execute({ id: created.id, version: created.version, status: 'ACTIVE', access: chef, actor });
    expect(back).toMatchObject({ status: 'ACTIVE', archivedAt: null, archiveReason: null });
    expect(w.audit).toHaveLength(3);
  });

  it('un ambassadeur archivé est gelé : modification refusée, double archivage et réactivation d’un actif refusés', async () => {
    const w = build();
    const created = await w.register.execute({ ...learner, access: am1, actor });
    await expect(w.setStatus.execute({ id: created.id, version: 1, status: 'ACTIVE', access: chef, actor })).rejects.toMatchObject({ code: 'CONFLICT' });
    await w.setStatus.execute({ id: created.id, version: 1, status: 'ARCHIVED', access: chef, actor });
    await expect(w.setStatus.execute({ id: created.id, version: 1, status: 'ARCHIVED', access: chef, actor })).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(w.update.execute({ id: created.id, version: 1, lastName: 'Autre', access: chef, actor })).rejects.toThrow(/archivé/);
    await w.setStatus.execute({ id: created.id, version: 1, status: 'ACTIVE', access: chef, actor });
    expect((await w.update.execute({ id: created.id, version: 1, lastName: 'Autre', access: chef, actor })).lastName).toBe('Autre');
  });

  it('l’e-mail reste réservé pendant l’archivage (la réactivation ne peut pas créer de doublon)', async () => {
    const w = build();
    const created = await w.register.execute({ ...learner, access: am1, actor });
    await w.setStatus.execute({ id: created.id, version: 1, status: 'ARCHIVED', access: chef, actor });
    await expect(w.register.execute({ ...learner, lastName: 'Bis', access: am1, actor })).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('même droit et même portée que la modification : le chargé de compte, un autre commercial et le Support voient « introuvable » ; le Responsable commercial de l’équipe archive', async () => {
    const w = build();
    const created = await w.register.execute({ ...learner, access: am1, actor });
    await expect(w.setStatus.execute({ id: created.id, version: 1, status: 'ARCHIVED', access: am2, actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(w.setStatus.execute({ id: created.id, version: 1, status: 'ARCHIVED', access: support, actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect((await w.setStatus.execute({ id: created.id, version: 1, status: 'ARCHIVED', access: chef, actor })).status).toBe('ARCHIVED');
  });

  it('version périmée = conflit ; état inconnu et motif trop long refusés', async () => {
    const w = build();
    const created = await w.register.execute({ ...learner, access: am1, actor });
    await expect(w.setStatus.execute({ id: created.id, version: 9, status: 'ARCHIVED', access: chef, actor })).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(w.setStatus.execute({ id: created.id, version: 1, status: 'DELETED', access: chef, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(w.setStatus.execute({ id: created.id, version: 1, status: 'ARCHIVED', reason: 'x'.repeat(501), access: chef, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(w.ambassadors.items[0]!.status).toBe('ACTIVE');
  });

  it('la liste filtre par état et par entreprise d’origine ; une entreprise hors portée est « introuvable »', async () => {
    const w = build(); w.company('c1', 'am1'); w.company('c2', 'am2');
    const a = await w.register.execute({ lastName: 'Atangana', firstName: 'Paul', origin: 'CLIENT', companyId: 'c1', appointedOn: '2026-11-01', access: am1, actor });
    await w.register.execute({ ...learner, access: am1, actor });
    await w.setStatus.execute({ id: a.id, version: 1, status: 'ARCHIVED', access: chef, actor });
    const visibility = visibilityFor(am1, 'bd.ambassador.read');
    const list = (extra: object) => w.list.execute({ ...first, access: am1, visibility, ...extra });
    expect((await list({})).total).toBe(2);
    expect((await list({ status: 'ACTIVE' })).items.map((i) => i.lastName)).toEqual(['Zola']);
    expect((await list({ status: 'ARCHIVED' })).items.map((i) => i.lastName)).toEqual(['Atangana']);
    expect((await list({ companyId: 'c1' })).items.map((i) => i.lastName)).toEqual(['Atangana']);
    expect((await list({ status: 'inconnu' })).total).toBe(2);
    await expect(list({ companyId: 'c2' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(list({ companyId: 'inconnue' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
