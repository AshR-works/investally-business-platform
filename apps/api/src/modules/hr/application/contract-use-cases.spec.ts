import { InMemoryContractTypes, InMemoryContracts } from '../../../../test/support/in-memory-contracts';
import { InMemoryEmployees } from '../../../../test/support/in-memory-employees';
import { ActorContext } from '../../../shared-kernel';
import { AuditAction, AuditRecord } from '../../audit';
import type { AccessContext } from '../../iam';
import { RoleCode, resolveGrants } from '../../iam';
import { Contract, ContractType } from '../domain/contract';
import { Employee } from '../domain/employee';
import {
  AdjustContractUseCase, CreateContractTypeUseCase, CreateContractUseCase, EndContractUseCase, GetContractHandler, ListContractsHandler, ListContractTypesHandler, ListDeadlinesHandler,
  UpdateContractTypeUseCase,
} from './contract-use-cases';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const actor: ActorContext = { userId: 'u-x', sessionId: 's1', ipAddress: '10.0.0.1', device: 'jest' };
const as = (role: RoleCode, actorId: string, teamMemberIds: string[] = []): AccessContext => ({ actorId, grants: resolveGrants(role), teamMemberIds });
const now = new Date('2026-11-10T09:00:00Z');

const boss = as(RoleCode.Direction, 'u-boss');
const claire = as(RoleCode.AccountManager, 'u-claire', [uuid(4)]); // responsable de Sam : ne voit rien pour autant
const sam = as(RoleCode.Support, 'u-sam');
const hr = as(RoleCode.Hr, 'u-hr');
const root = as(RoleCode.SuperAdmin, 'u-root');
const nobody: AccessContext = { actorId: 'u-none', grants: [], teamMemberIds: [] };

const ID = { boss: uuid(1), claire: uuid(2), sam: uuid(4), hr: uuid(6), ghost: uuid(7), left: uuid(8) };
const TYPE = { cdi: uuid(101), cdd: uuid(102), old: uuid(103) };

function build() {
  const employees = new InMemoryEmployees();
  const contracts = new InMemoryContracts();
  const types = new InMemoryContractTypes();
  const audit: AuditRecord[] = [];
  let seq = 0;
  const recorder = { record: async (r: AuditRecord) => { audit.push(r); } };
  const unitOfWork = { run: <T>(work: () => Promise<T>) => work() };
  const clock = { now: () => now };
  const ids = { next: () => uuid(900 + ++seq) };

  const person = (key: keyof typeof ID, firstName: string, user: string | null, hiredOn = '2020-01-01') =>
    employees.items.push(Employee.register({ id: ID[key], lastName: 'Test', firstName, jobTitle: 'Poste', department: 'Dép', managerEmployeeId: null, userId: user, hiredOn, now }));
  person('boss', 'Bruno', 'u-boss');
  person('claire', 'Claire', 'u-claire');
  person('sam', 'Sam', 'u-sam', '2026-03-02');
  person('hr', 'Hélène', 'u-hr');
  person('ghost', 'Gaël', null);
  person('left', 'Léa', 'u-left');
  employees.items[5]!.archive({ leftOn: '2026-06-30', reason: 'Départ', now });

  types.list.push(ContractType.create({ id: TYPE.cdi, code: 'CDI', label: 'CDI', fixedTerm: false, sortOrder: 10, now }));
  types.list.push(ContractType.create({ id: TYPE.cdd, code: 'CDD', label: 'CDD', fixedTerm: true, sortOrder: 20, now }));
  const old = ContractType.create({ id: TYPE.old, code: 'OLD', label: 'Ancien', fixedTerm: false, sortOrder: 30, now });
  old.update({ active: false });
  types.list.push(old);

  return {
    employees, contracts, types, audit,
    create: new CreateContractUseCase(employees, contracts, types, recorder, unitOfWork, clock, ids),
    adjust: new AdjustContractUseCase(employees, contracts, types, recorder, unitOfWork),
    end: new EndContractUseCase(employees, contracts, types, recorder, unitOfWork),
    get: new GetContractHandler(employees, contracts, types),
    list: new ListContractsHandler(employees, contracts, types),
    deadlines: new ListDeadlinesHandler(employees, contracts, types, clock),
    listTypes: new ListContractTypesHandler(types),
    createType: new CreateContractTypeUseCase(types, recorder, unitOfWork, clock, ids),
    updateType: new UpdateContractTypeUseCase(types, recorder, unitOfWork),
  };
}

const cdiFor = (employeeId: string, start = '2026-04-01') => ({ employeeId, contractTypeId: TYPE.cdi, start, actor });

describe('Contrats : créer', () => {
  it('la RH et le Super administrateur créent ; l’audit garde la création sans salaire', async () => {
    const w = build();
    const view = await w.create.execute({ ...cdiFor(ID.sam), probationEnd: '2026-07-01', access: hr });
    expect(view).toMatchObject({ employeeName: 'Sam Test', contractTypeLabel: 'CDI', fixedTerm: false, end: null, probationEnd: '2026-07-01', status: 'ACTIVE', version: 1 });
    expect(Object.keys(view).join()).not.toMatch(/salary|salaire|amount|document/i);
    expect(w.audit).toHaveLength(1);
    expect(w.audit[0]).toMatchObject({ module: 'hr', entityType: 'Contract', action: AuditAction.Create });
    expect(w.contracts.locks).toEqual([ID.sam]);
    const other = await w.create.execute({ employeeId: ID.claire, contractTypeId: TYPE.cdd, start: '2026-04-01', end: '2026-12-31', access: root, actor });
    expect(other.fixedTerm).toBe(true);
  });

  it.each([
    ['Direction', boss], ['responsable', claire], ['employé', sam], ['sans droit', nobody],
  ])('refuse à %s', async (_label, access) => {
    const w = build();
    await expect(w.create.execute({ ...cdiFor(ID.sam), access })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(w.contracts.items).toHaveLength(0);
    expect(w.audit).toHaveLength(0);
  });

  it('un seul contrat en cours par employé', async () => {
    const w = build();
    await w.create.execute({ ...cdiFor(ID.sam), access: hr });
    await expect(w.create.execute({ ...cdiFor(ID.sam, '2027-01-01'), access: hr })).rejects.toMatchObject({ code: 'CONFLICT', message: expect.stringMatching(/déjà en cours/) });
    expect(w.contracts.items).toHaveLength(1);
  });

  it('un nouveau contrat suit un contrat terminé, sans le recouvrir', async () => {
    const w = build();
    const first = await w.create.execute({ employeeId: ID.sam, contractTypeId: TYPE.cdd, start: '2026-04-01', end: '2026-09-30', access: hr, actor });
    await w.end.execute({ id: first.id, version: 1, endedOn: '2026-09-30', reason: 'FIXED_TERM_END', access: hr, actor });
    await expect(w.create.execute({ ...cdiFor(ID.sam, '2026-09-30'), access: hr })).rejects.toMatchObject({ code: 'CONFLICT', message: expect.stringMatching(/recouvre/) });
    await expect(w.create.execute({ ...cdiFor(ID.sam, '2026-04-15'), access: hr })).rejects.toMatchObject({ code: 'CONFLICT' });
    const next = await w.create.execute({ ...cdiFor(ID.sam, '2026-10-01'), access: hr });
    expect(next.status).toBe('ACTIVE');
    expect(w.contracts.items).toHaveLength(2);
  });

  it('refuse un employé inconnu ou archivé, un type inconnu ou désactivé, un début avant l’entrée', async () => {
    const w = build();
    await expect(w.create.execute({ ...cdiFor(uuid(999)), access: hr })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(w.create.execute({ ...cdiFor(ID.left), access: hr })).rejects.toMatchObject({ code: 'CONFLICT', message: expect.stringMatching(/archivé/) });
    await expect(w.create.execute({ employeeId: ID.sam, contractTypeId: uuid(998), start: '2026-04-01', actor, access: hr })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(w.create.execute({ employeeId: ID.sam, contractTypeId: TYPE.old, start: '2026-04-01', actor, access: hr })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(w.create.execute({ ...cdiFor(ID.sam, '2026-03-01'), access: hr })).rejects.toMatchObject({ code: 'VALIDATION', message: expect.stringMatching(/entrée/) });
    await expect(w.create.execute({ employeeId: ID.sam, contractTypeId: TYPE.cdd, start: '2026-04-01', actor, access: hr })).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(w.contracts.items).toHaveLength(0);
  });
});

describe('Contrats : ajuster et terminer', () => {
  async function started(w: ReturnType<typeof build>) {
    return w.create.execute({ employeeId: ID.sam, contractTypeId: TYPE.cdd, start: '2026-04-01', end: '2026-09-30', probationEnd: '2026-05-01', access: hr, actor });
  }

  it('prolonge un contrat à durée déterminée, avec audit avant / après', async () => {
    const w = build();
    const c = await started(w);
    const after = await w.adjust.execute({ id: c.id, version: 1, end: '2026-12-31', access: hr, actor });
    expect(after).toMatchObject({ end: '2026-12-31', probationEnd: '2026-05-01' });
    const record = w.audit.at(-1)!;
    expect(record).toMatchObject({ entityType: 'Contract', action: AuditAction.Update });
    expect(record.oldValue).toMatchObject({ end: '2026-09-30' });
    expect(record.newValue).toMatchObject({ end: '2026-12-31' });
  });

  it('refuse une version périmée et tout rôle autre que la RH', async () => {
    const w = build();
    const c = await started(w);
    await expect(w.adjust.execute({ id: c.id, version: 7, end: '2026-12-31', access: hr, actor })).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(w.end.execute({ id: c.id, version: 7, endedOn: '2026-08-01', reason: 'OTHER', access: hr, actor })).rejects.toMatchObject({ code: 'CONFLICT' });
    for (const access of [boss, claire, sam, nobody]) {
      await expect(w.adjust.execute({ id: c.id, version: 1, end: '2026-12-31', access, actor })).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(w.end.execute({ id: c.id, version: 1, endedOn: '2026-08-01', reason: 'OTHER', access, actor })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    }
    expect(w.contracts.items[0]).toMatchObject({ status: 'ACTIVE', end: '2026-09-30' });
  });

  it('termine avec un motif de la liste fermée ; le contrat est conservé', async () => {
    const w = build();
    const c = await started(w);
    await expect(w.end.execute({ id: c.id, version: 1, endedOn: '2026-08-01', reason: 'Faute grave', access: hr, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
    const done = await w.end.execute({ id: c.id, version: 1, endedOn: '2026-08-01', reason: 'RESIGNATION', access: hr, actor });
    expect(done).toMatchObject({ status: 'ENDED', endedOn: '2026-08-01', endReason: 'RESIGNATION', endReasonLabel: 'Démission' });
    expect(w.contracts.items).toHaveLength(1);
    expect(w.audit.at(-1)!.newValue).toMatchObject({ status: 'ENDED' });
    await expect(w.end.execute({ id: c.id, version: 1, endedOn: '2026-08-02', reason: 'OTHER', access: hr, actor })).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('un contrat inconnu est introuvable', async () => {
    const w = build();
    await expect(w.adjust.execute({ id: uuid(999), version: 1, end: '2026-12-31', access: hr, actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('Contrats : lire', () => {
  async function filled() {
    const w = build();
    const mine = await w.create.execute({ ...cdiFor(ID.sam), access: hr });
    const boss1 = await w.create.execute({ ...cdiFor(ID.boss), access: hr });
    return { w, mine, boss1 };
  }

  it('la RH, la Direction et le Super administrateur voient tout', async () => {
    const { w, mine } = await filled();
    for (const access of [hr, boss, root]) {
      expect((await w.get.execute({ id: mine.id, access })).employeeName).toBe('Sam Test');
      expect((await w.list.execute({ page: 1, pageSize: 25, access })).total).toBe(2);
    }
  });

  it('un employé ne voit que le sien ; les autres sont « introuvables »', async () => {
    const { w, mine, boss1 } = await filled();
    expect((await w.get.execute({ id: mine.id, access: sam })).id).toBe(mine.id);
    await expect(w.get.execute({ id: boss1.id, access: sam })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(w.get.execute({ id: uuid(999), access: sam })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const own = await w.list.execute({ page: 1, pageSize: 25, access: sam });
    expect(own.items.map((c) => c.id)).toEqual([mine.id]);
    await expect(w.list.execute({ employeeId: ID.boss, page: 1, pageSize: 25, access: sam })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect((await w.list.execute({ employeeId: ID.sam, page: 1, pageSize: 25, access: sam })).total).toBe(1);
  });

  it('le responsable direct ne voit pas le contrat de son équipe', async () => {
    const { w, mine } = await filled();
    await expect(w.get.execute({ id: mine.id, access: claire })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(w.list.execute({ employeeId: ID.sam, page: 1, pageSize: 25, access: claire })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect((await w.list.execute({ page: 1, pageSize: 25, access: claire })).total).toBe(0);
  });

  it('sans droit : interdit, et un compte sans fiche d’employé ne voit rien', async () => {
    const { w, mine } = await filled();
    await expect(w.list.execute({ page: 1, pageSize: 25, access: nobody })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(w.get.execute({ id: mine.id, access: nobody })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const stranger = as(RoleCode.Support, 'u-unknown');
    expect((await w.list.execute({ page: 1, pageSize: 25, access: stranger })).total).toBe(0);
  });

  it('filtre par état et borne la taille de page', async () => {
    const { w, mine } = await filled();
    await w.end.execute({ id: mine.id, version: 1, endedOn: '2026-08-01', reason: 'RESIGNATION', access: hr, actor });
    expect((await w.list.execute({ status: 'ENDED', page: 1, pageSize: 25, access: hr })).items.map((c) => c.id)).toEqual([mine.id]);
    expect((await w.list.execute({ status: 'ACTIVE', page: 1, pageSize: 25, access: hr })).total).toBe(1);
    expect((await w.list.execute({ page: 1, pageSize: 5000, access: hr })).pageSize).toBe(100);
    expect((await w.list.execute({ page: 0, pageSize: 25, access: hr })).page).toBe(1);
  });
});

describe('Contrats : échéances', () => {
  // Aujourd'hui : 2026-11-10.
  async function filled() {
    const w = build();
    await w.create.execute({ employeeId: ID.sam, contractTypeId: TYPE.cdd, start: '2026-04-01', end: '2026-12-31', probationEnd: '2026-11-10', access: hr, actor });
    await w.create.execute({ employeeId: ID.claire, contractTypeId: TYPE.cdd, start: '2026-06-01', end: '2027-01-09', access: hr, actor }); // 60 jours exactement
    await w.create.execute({ employeeId: ID.boss, contractTypeId: TYPE.cdd, start: '2026-06-01', end: '2027-01-10', access: hr, actor }); // 61 jours : hors fenêtre
    await w.create.execute({ ...cdiFor(ID.hr), access: hr });
    return w;
  }

  it('liste fin de contrat et fin d’essai dans les 60 jours, jours inclus, triées par date', async () => {
    const w = await filled();
    const rows = await w.deadlines.execute({ access: hr });
    expect(rows.map((r) => [r.employeeName, r.kind, r.date, r.daysLeft])).toEqual([
      ['Sam Test', 'PROBATION_END', '2026-11-10', 0],
      ['Sam Test', 'CONTRACT_END', '2026-12-31', 51],
      ['Claire Test', 'CONTRACT_END', '2027-01-09', 60],
    ]);
  });

  it('une fenêtre plus large inclut l’échéance suivante ; hors bornes, refusé', async () => {
    const w = await filled();
    expect((await w.deadlines.execute({ days: 61, access: hr })).map((r) => r.employeeName)).toContain('Bruno Test');
    for (const days of [0, -1, 366, 1.5]) await expect(w.deadlines.execute({ days, access: hr })).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(await w.deadlines.execute({ days: 365, access: hr })).toHaveLength(4);
  });

  it('un contrat terminé n’a plus d’échéance', async () => {
    const w = await filled();
    const sams = w.contracts.items.find((c) => c.employeeId === ID.sam)!;
    await w.end.execute({ id: sams.id, version: 1, endedOn: '2026-11-10', reason: 'MISSION_END', access: hr, actor });
    expect((await w.deadlines.execute({ access: hr })).map((r) => r.employeeName)).toEqual(['Claire Test']);
  });

  it('réservées à ceux qui voient tous les contrats', async () => {
    const w = await filled();
    for (const access of [boss, root]) await expect(w.deadlines.execute({ access })).resolves.toBeDefined();
    for (const access of [claire, sam, nobody]) await expect(w.deadlines.execute({ access })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('Types de contrat', () => {
  it('tout titulaire du droit de lecture liste les types actifs ; seule la RH voit les désactivés', async () => {
    const w = build();
    expect((await w.listTypes.execute({ access: sam })).map((t) => t.code)).toEqual(['CDI', 'CDD']);
    expect((await w.listTypes.execute({ includeInactive: true, access: sam })).map((t) => t.code)).toEqual(['CDI', 'CDD']);
    expect((await w.listTypes.execute({ includeInactive: true, access: hr })).map((t) => t.code)).toEqual(['CDI', 'CDD', 'OLD']);
    await expect(w.listTypes.execute({ access: nobody })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('la RH crée un type (code unique) et le désactive, avec audit', async () => {
    const w = build();
    const created = await w.createType.execute({ code: 'apprenti', label: 'Apprentissage', fixedTerm: true, access: hr, actor });
    expect(created).toMatchObject({ code: 'APPRENTI', fixedTerm: true, active: true });
    await expect(w.createType.execute({ code: 'APPRENTI', label: 'Doublon', fixedTerm: true, access: hr, actor })).rejects.toMatchObject({ code: 'CONFLICT' });
    const updated = await w.updateType.execute({ id: created.id, version: 1, active: false, access: hr, actor });
    expect(updated.active).toBe(false);
    expect(w.audit.map((r) => r.action)).toEqual([AuditAction.Create, AuditAction.Update]);
    await expect(w.updateType.execute({ id: created.id, version: 9, label: 'X', access: hr, actor })).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(w.updateType.execute({ id: uuid(999), version: 1, label: 'X', access: hr, actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('refusé à la Direction, aux responsables et aux employés', async () => {
    const w = build();
    for (const access of [boss, claire, sam, nobody]) {
      await expect(w.createType.execute({ code: 'NOUVEAU', label: 'Nouveau', fixedTerm: false, access, actor })).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(w.updateType.execute({ id: TYPE.cdi, version: 1, label: 'X', access, actor })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    }
  });

  it('un contrat garde le libellé de son type même désactivé', async () => {
    const w = build();
    const c = await w.create.execute({ ...cdiFor(ID.sam), access: hr });
    await w.updateType.execute({ id: TYPE.cdi, version: 1, active: false, access: hr, actor });
    expect((await w.get.execute({ id: c.id, access: hr })).contractTypeLabel).toBe('CDI');
  });
});

// Garde-fou : le type `Contract` n'expose aucun champ de salaire ni de document.
it('le modèle de contrat ne porte aucune donnée de rémunération', () => {
  const c = Contract.create({ id: 'c', employeeId: 'e', contractTypeId: 't', fixedTerm: false, start: '2026-01-01', now });
  expect(Object.getOwnPropertyNames(Object.getPrototypeOf(c)).join()).not.toMatch(/salary|salaire|pay|document/i);
});
