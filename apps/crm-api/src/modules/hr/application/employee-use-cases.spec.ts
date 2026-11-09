import { InMemoryEmployees, InMemoryUsers } from '../../../../test/support/in-memory-employees';
import { ActorContext } from '../../../shared-kernel';
import { AuditAction, AuditRecord } from '../../audit';
import type { AccessContext } from '../../iam';
import { RoleCode, resolveGrants } from '../../iam';
import {
  GetEmployeeHandler, GetOrgChartHandler, ListDirectoryHandler, ListEmployeesHandler, ListHierarchyGapsHandler, RegisterEmployeeUseCase, SetEmployeeStatusUseCase, UpdateEmployeeUseCase,
} from './employee-use-cases';

const actor: ActorContext = { userId: 'hr1', sessionId: 's1', ipAddress: '10.0.0.1', device: 'jest' };
const as = (role: RoleCode, actorId: string, teamMemberIds: string[] = []): AccessContext => ({ actorId, grants: resolveGrants(role), teamMemberIds });
const now = new Date('2026-11-09T10:00:00Z');
const hr = as(RoleCode.Hr, 'hr1');
const direction = as(RoleCode.Direction, 'dir');
const chef = as(RoleCode.HeadOfSales, 'u-chef', ['u-claire']);
const claire = as(RoleCode.AccountManager, 'u-claire');
const paul = as(RoleCode.AccountManager, 'u-paul');
const support = as(RoleCode.Support, 'u-sup');
const base = { lastName: 'Ndzana', firstName: 'Claire', jobTitle: 'Chargée de compte', department: 'Commercial', hiredOn: '2026-03-02' };
const first = { page: 1, pageSize: 50 };

function build() {
  const employees = new InMemoryEmployees();
  const users = new InMemoryUsers();
  const audit: AuditRecord[] = [];
  let seq = 0;
  const recorder = { record: async (r: AuditRecord) => { audit.push(r); } };
  const unitOfWork = { run: <T>(work: () => Promise<T>) => work() };
  const clock = { now: () => now };
  const ids = { next: () => `e${++seq}` };
  return {
    employees, users, audit,
    register: new RegisterEmployeeUseCase(employees, users, recorder, unitOfWork, clock, ids),
    update: new UpdateEmployeeUseCase(employees, users, recorder, unitOfWork),
    setStatus: new SetEmployeeStatusUseCase(employees, users, recorder, unitOfWork, clock),
    get: new GetEmployeeHandler(employees, users, recorder, unitOfWork),
    list: new ListEmployeesHandler(employees, users),
    directory: new ListDirectoryHandler(employees),
    chart: new GetOrgChartHandler(employees),
    gaps: new ListHierarchyGapsHandler(employees, users),
  };
}
type World = ReturnType<typeof build>;
const create = (w: World, extra: Record<string, unknown> = {}, access: AccessContext = hr) => w.register.execute({ ...base, ...extra, access, actor });

describe('Personnel — création', () => {
  it('la RH crée un employé : champs normalisés, audit avec la nouvelle valeur', async () => {
    const w = build();
    const view = await create(w, { matricule: 'inv-1', workEmail: 'Claire@Investally.TEST' });
    expect(view).toMatchObject({ matricule: 'INV-1', workEmail: 'claire@investally.test', status: 'ACTIVE', version: 1, managerName: null, userName: null });
    expect(w.audit).toHaveLength(1);
    expect(w.audit[0]).toMatchObject({ module: 'hr', action: AuditAction.Create, entityType: 'Employee', entityId: view.id });
  });

  it('seule la RH (et le Super administrateur) crée : Direction, Responsable commercial, chargé de compte et Support sont refusés', async () => {
    const w = build();
    for (const who of [direction, chef, claire, support]) await expect(create(w, {}, who)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(w.employees.items).toHaveLength(0);
    expect((await create(w, {}, as(RoleCode.SuperAdmin, 'root'))).id).toBeTruthy();
  });

  it('matricule et e-mail professionnel ne servent qu’une fois (conflit lisible, rien n’est créé)', async () => {
    const w = build();
    await create(w, { matricule: 'A1', workEmail: 'a@investally.test' });
    await expect(create(w, { lastName: 'Autre', matricule: 'a1' })).rejects.toMatchObject({ code: 'CONFLICT', message: expect.stringContaining('matricule A1') });
    await expect(create(w, { lastName: 'Autre', workEmail: 'A@investally.test' })).rejects.toMatchObject({ code: 'CONFLICT', message: expect.stringContaining('e-mail') });
    expect(w.employees.items).toHaveLength(1);
  });

  it('le responsable doit exister et être en poste', async () => {
    const w = build();
    await expect(create(w, { managerEmployeeId: 'inconnu' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const boss = await create(w, { lastName: 'Boss' });
    await w.setStatus.execute({ id: boss.id, version: 1, status: 'ARCHIVED', access: hr, actor });
    await expect(create(w, { managerEmployeeId: boss.id })).rejects.toMatchObject({ code: 'VALIDATION', message: expect.stringContaining('archivé') });
  });

  it('le compte lié doit exister et n’être lié qu’à un seul employé', async () => {
    const w = build(); w.users.add('u-claire', 'Claire N.');
    await expect(create(w, { userId: 'u-fantome' })).rejects.toMatchObject({ code: 'NOT_FOUND', message: expect.stringContaining('Compte') });
    const linked = await create(w, { userId: 'u-claire' });
    expect(linked.userName).toBe('Claire N.');
    await expect(create(w, { lastName: 'Autre', userId: 'u-claire' })).rejects.toMatchObject({ code: 'CONFLICT', message: expect.stringContaining('déjà lié') });
  });
});

describe('Personnel — modification et hiérarchie', () => {
  it('modifie avec la version lue : audit avant et après ; version périmée = conflit', async () => {
    const w = build();
    const e = await create(w);
    w.audit.length = 0;
    const view = await w.update.execute({ id: e.id, version: 1, jobTitle: 'Responsable', workPhone: '+237 699 00 11 22', access: hr, actor });
    expect(view).toMatchObject({ jobTitle: 'Responsable', workPhone: '+237699001122', lastName: 'Ndzana' });
    expect(w.audit[0]).toMatchObject({ action: AuditAction.Update, oldValue: { jobTitle: 'Chargée de compte' }, newValue: { jobTitle: 'Responsable' } });
    await expect(w.update.execute({ id: e.id, version: 9, jobTitle: 'X', access: hr, actor })).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(w.employees.items[0]!.jobTitle).toBe('Responsable');
  });

  it('refuse un responsable qui créerait une boucle (directe ou indirecte) et un employé son propre responsable', async () => {
    const w = build();
    const a = await create(w, { lastName: 'A' });
    const b = await create(w, { lastName: 'B', managerEmployeeId: a.id });
    const c = await create(w, { lastName: 'C', managerEmployeeId: b.id });
    await expect(w.update.execute({ id: a.id, version: 1, managerEmployeeId: c.id, access: hr, actor })).rejects.toMatchObject({ code: 'VALIDATION', message: expect.stringContaining('boucle') });
    await expect(w.update.execute({ id: a.id, version: 1, managerEmployeeId: a.id, access: hr, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(w.update.execute({ id: a.id, version: 1, managerEmployeeId: b.id, access: hr, actor })).rejects.toMatchObject({ code: 'VALIDATION', message: expect.stringContaining('boucle') });
    expect(w.employees.items.find((e) => e.id === a.id)!.managerEmployeeId).toBeNull();
    const ok = await w.update.execute({ id: c.id, version: 1, managerEmployeeId: a.id, access: hr, actor });
    expect(ok.managerName).toBe('Claire A');
  });

  it('on retire le responsable ou le compte avec null ; un compte déjà lié à un autre employé est refusé', async () => {
    const w = build(); w.users.add('u1', 'U1');
    const a = await create(w, { lastName: 'A', userId: 'u1' });
    const b = await create(w, { lastName: 'B' });
    await expect(w.update.execute({ id: b.id, version: 1, userId: 'u1', access: hr, actor })).rejects.toMatchObject({ code: 'CONFLICT' });
    expect((await w.update.execute({ id: a.id, version: 1, userId: null, access: hr, actor })).userId).toBeNull();
    expect((await w.update.execute({ id: b.id, version: 1, userId: 'u1', access: hr, actor })).userId).toBe('u1');
  });

  it('seule la RH modifie ; les autres rôles reçoivent « introuvable » (la fiche n’est pas la leur) ou le refus de droit', async () => {
    const w = build(); w.users.add('u-claire', 'Claire');
    const e = await create(w, { userId: 'u-claire' });
    for (const who of [direction, chef, claire, paul, support]) {
      await expect(w.update.execute({ id: e.id, version: 1, jobTitle: 'Piraté', access: who, actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    }
    expect(w.employees.items[0]!.jobTitle).toBe('Chargée de compte');
  });
});

describe('Personnel — archivage (sortie), réversible', () => {
  it('archive avec date et motif, réactive ; rien n’est supprimé ; audit avant/après ; gelé pendant l’archivage', async () => {
    const w = build();
    const e = await create(w);
    const out = await w.setStatus.execute({ id: e.id, version: 1, status: 'ARCHIVED', leftOn: '2026-11-30', reason: ' Démission ', access: hr, actor });
    expect(out).toMatchObject({ status: 'ARCHIVED', leftOn: '2026-11-30', archiveReason: 'Démission' });
    expect(w.employees.items).toHaveLength(1);
    expect(w.audit.at(-1)).toMatchObject({ action: AuditAction.Update, oldValue: { status: 'ACTIVE' }, newValue: { status: 'ARCHIVED' } });
    await expect(w.update.execute({ id: e.id, version: 1, jobTitle: 'X', access: hr, actor })).rejects.toThrow(/archivé/);
    await expect(w.setStatus.execute({ id: e.id, version: 1, status: 'ARCHIVED', access: hr, actor })).rejects.toMatchObject({ code: 'CONFLICT' });
    const back = await w.setStatus.execute({ id: e.id, version: 1, status: 'ACTIVE', access: hr, actor });
    expect(back).toMatchObject({ status: 'ACTIVE', leftOn: null, archiveReason: null, archivedAt: null });
  });

  it('un responsable qui a des collaborateurs en poste ne s’archive pas : on les réaffecte d’abord', async () => {
    const w = build();
    const boss = await create(w, { lastName: 'Boss' });
    const member = await create(w, { lastName: 'Membre', managerEmployeeId: boss.id });
    await expect(w.setStatus.execute({ id: boss.id, version: 1, status: 'ARCHIVED', access: hr, actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
    await w.setStatus.execute({ id: member.id, version: 1, status: 'ARCHIVED', access: hr, actor });
    expect((await w.setStatus.execute({ id: boss.id, version: 1, status: 'ARCHIVED', access: hr, actor })).status).toBe('ARCHIVED');
  });

  it('droit d’archivage réservé à la RH ; état inconnu et version périmée refusés', async () => {
    const w = build();
    const e = await create(w);
    for (const who of [direction, chef, claire, support]) await expect(w.setStatus.execute({ id: e.id, version: 1, status: 'ARCHIVED', access: who, actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(w.setStatus.execute({ id: e.id, version: 9, status: 'ARCHIVED', access: hr, actor })).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(w.setStatus.execute({ id: e.id, version: 1, status: 'DELETED', access: hr, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(w.employees.items[0]!.status).toBe('ACTIVE');
  });
});

describe('Personnel — lecture, portée et traces', () => {
  async function world() {
    const w = build(); w.users.add('u-claire', 'Claire'); w.users.add('u-paul', 'Paul');
    const c = await create(w, { lastName: 'Ndzana', userId: 'u-claire' });
    const p = await create(w, { lastName: 'Fotso', firstName: 'Paul', userId: 'u-paul' });
    const nobody = await create(w, { lastName: 'Sansaccès', firstName: 'Eve' });
    w.audit.length = 0;
    return { w, c, p, nobody };
  }

  it('la RH et la Direction voient tout ; le Responsable commercial son équipe ; le chargé de compte lui-même ; le Support lui-même', async () => {
    const { w, c, p, nobody } = await world();
    const names = async (who: AccessContext) => (await w.list.execute({ ...first, access: who })).items.map((e) => e.lastName);
    expect(await names(hr)).toEqual(['Fotso', 'Ndzana', 'Sansaccès']);
    expect(await names(direction)).toEqual(['Fotso', 'Ndzana', 'Sansaccès']);
    expect(await names(chef)).toEqual(['Ndzana']);
    expect(await names(claire)).toEqual(['Ndzana']);
    expect(await names(paul)).toEqual(['Fotso']);
    expect(await names(support)).toEqual([]);
    expect((await w.get.execute({ id: c.id, access: claire, actor })).id).toBe(c.id);
    for (const [who, id] of [[claire, p.id], [claire, nobody.id], [chef, p.id], [support, c.id]] as const) {
      await expect(w.get.execute({ id, access: who, actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    }
    await expect(w.get.execute({ id: 'inconnu', access: claire, actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('la lecture détaillée est tracée (VIEW) et un refus ne l’est pas', async () => {
    const { w, c } = await world();
    await w.get.execute({ id: c.id, access: hr, actor });
    expect(w.audit).toHaveLength(1);
    expect(w.audit[0]).toMatchObject({ module: 'hr', action: AuditAction.View, entityType: 'Employee', entityId: c.id });
    await expect(w.get.execute({ id: c.id, access: paul, actor })).rejects.toBeTruthy();
    expect(w.audit).toHaveLength(1);
  });

  it('la liste filtre par état, service et recherche ; la taille de page est bornée', async () => {
    const { w, p } = await world();
    await create(w, { lastName: 'Zola', firstName: 'Eve', department: 'Investudy' });
    await w.setStatus.execute({ id: p.id, version: 1, status: 'ARCHIVED', access: hr, actor });
    const list = (extra: object) => w.list.execute({ ...first, access: hr, ...extra });
    expect((await list({})).total).toBe(4);
    expect((await list({ status: 'ARCHIVED' })).items.map((e) => e.lastName)).toEqual(['Fotso']);
    expect((await list({ status: 'ACTIVE', department: 'investudy' })).items.map((e) => e.lastName)).toEqual(['Zola']);
    expect((await list({ search: 'paul' })).total).toBe(1);
    expect((await list({ status: 'inconnu' })).total).toBe(4);
    expect((await w.list.execute({ page: 1, pageSize: 5000, access: hr })).pageSize).toBe(100);
  });

  it('l’annuaire et l’organigramme ne montrent que les actifs, avec les champs professionnels seulement', async () => {
    const { w, p } = await world();
    await w.setStatus.execute({ id: p.id, version: 1, status: 'ARCHIVED', access: hr, actor });
    const dir = await w.directory.execute(first);
    expect(dir.items.map((e) => e.lastName)).toEqual(['Ndzana', 'Sansaccès']);
    expect(Object.keys(dir.items[0]!).sort()).toEqual(['department', 'firstName', 'id', 'jobTitle', 'lastName', 'managerEmployeeId', 'workEmail', 'workPhone']);
    expect((await w.chart.execute()).map((e) => e.lastName)).toEqual(['Ndzana', 'Sansaccès']);
    expect((await w.directory.execute({ ...first, search: 'sans' })).total).toBe(1);
  });
});

describe('Personnel — écarts avec la hiérarchie des comptes (D58)', () => {
  it('signale, sans jamais corriger, un employé dont le responsable du compte n’est pas le compte de son responsable RH', async () => {
    const w = build();
    w.users.add('u-boss', 'Boss'); w.users.add('u-other', 'Autre chef'); w.users.add('u-claire', 'Claire', 'u-other'); w.users.add('u-ok', 'Ok', 'u-boss'); w.users.add('u-orphan', 'Orpheline');
    const boss = await create(w, { lastName: 'Boss', userId: 'u-boss' });
    await create(w, { lastName: 'Autre', firstName: 'Chef', userId: 'u-other' });
    await create(w, { lastName: 'Claire', userId: 'u-claire', managerEmployeeId: boss.id });
    await create(w, { lastName: 'Ok', userId: 'u-ok', managerEmployeeId: boss.id });
    await create(w, { lastName: 'Orpheline', userId: 'u-orphan', managerEmployeeId: boss.id });
    await create(w, { lastName: 'SansCompte', managerEmployeeId: boss.id });
    const gaps = await w.gaps.execute({ access: hr });
    expect(gaps.map((g) => [g.employeeName, g.hrManagerName, g.accountManagerName])).toEqual([
      ['Claire Claire', 'Claire Boss', 'Chef Autre'],
      ['Claire Orpheline', 'Claire Boss', null],
    ]);
    // Aucune hiérarchie de compte n'a été modifiée.
    expect(w.users.users.get('u-claire')!.managerUserId).toBe('u-other');
  });

  it('réservé à la portée Tous : la RH et la Direction ; le Responsable commercial et les autres sont refusés', async () => {
    const w = build();
    expect(await w.gaps.execute({ access: hr })).toEqual([]);
    expect(await w.gaps.execute({ access: direction })).toEqual([]);
    for (const who of [chef, claire, support]) await expect(w.gaps.execute({ access: who })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
