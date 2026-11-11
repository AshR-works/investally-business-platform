import { InMemoryEmployees, InMemoryUsers } from '../../../../test/support/in-memory-employees';
import { InMemoryJourneyTemplates, InMemoryJourneys } from '../../../../test/support/in-memory-journeys';
import { ActorContext } from '../../../shared-kernel';
import { AuditAction, AuditRecord } from '../../audit';
import type { AccessContext } from '../../iam';
import { RoleCode, Scope, resolveGrants } from '../../iam';
import { Employee } from '../domain/employee';
import { JourneyTemplate } from '../domain/journey';
import {
  CancelJourneyUseCase, CompleteJourneyTaskUseCase, GetJourneyHandler, LaunchJourneyUseCase, ListJourneyTemplatesHandler, ListJourneysHandler, ReopenJourneyTaskUseCase,
  UpdateJourneyTemplateUseCase,
} from './journey-use-cases';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const actorOf = (userId: string): ActorContext => ({ userId, sessionId: 's1', ipAddress: '10.0.0.1', device: 'jest' });
const actor = actorOf('u-hr');
const as = (role: RoleCode, actorId: string, teamMemberIds: string[] = []): AccessContext => ({ actorId, grants: resolveGrants(role), teamMemberIds });
const now = new Date('2026-11-10T09:00:00Z');

const boss = as(RoleCode.Direction, 'u-boss');
const claire = as(RoleCode.AccountManager, 'u-claire', [uuid(4)]); // responsable de Sam : ne voit rien pour autant
const sam = as(RoleCode.Support, 'u-sam');
const hr = as(RoleCode.Hr, 'u-hr');
const root = as(RoleCode.SuperAdmin, 'u-root');
const nobody: AccessContext = { actorId: 'u-none', grants: [], teamMemberIds: [] };
// Droit de gérer accordé en portée réduite (Équipe ou Propre) : il ne suffit jamais, la gestion exige la portée Tous.
const narrowManage = (scope: Scope): AccessContext => ({ actorId: 'u-narrow', grants: [{ permission: 'hr.journey.manage', scope }, { permission: 'hr.journey.read', scope: Scope.All }], teamMemberIds: [uuid(4)] });

const ID = { boss: uuid(1), claire: uuid(2), sam: uuid(4), left: uuid(8) };

function build() {
  const employees = new InMemoryEmployees();
  const journeys = new InMemoryJourneys();
  const templates = new InMemoryJourneyTemplates();
  const users = new InMemoryUsers();
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
  person('sam', 'Sam', 'u-sam', '2026-12-01');
  person('left', 'Léa', 'u-left');
  employees.items[3]!.archive({ leftOn: '2026-06-30', reason: 'Départ', now });
  users.add('u-hr', 'Hélène RH');
  users.add('u-root', 'Super Admin');

  templates.list.push(
    JourneyTemplate.rehydrate({ id: uuid(501), kind: 'ONBOARDING', version: 1, tasks: [{ title: 'Accès', owner: 'IT', dueOffsetDays: -3 }, { title: 'Accueil', owner: 'MANAGER', dueOffsetDays: 0 }, { title: 'Bilan', owner: 'HR', dueOffsetDays: 30 }] }),
    JourneyTemplate.rehydrate({ id: uuid(502), kind: 'OFFBOARDING', version: 1, tasks: [{ title: 'Matériel', owner: 'IT', dueOffsetDays: 0 }, { title: 'Entretien', owner: 'HR', dueOffsetDays: -3 }] }),
  );

  return {
    employees, journeys, templates, audit,
    launch: new LaunchJourneyUseCase(employees, journeys, templates, users, recorder, unitOfWork, clock, ids),
    complete: new CompleteJourneyTaskUseCase(employees, journeys, users, recorder, unitOfWork, clock),
    reopen: new ReopenJourneyTaskUseCase(employees, journeys, users, recorder, unitOfWork, clock),
    cancel: new CancelJourneyUseCase(employees, journeys, users, recorder, unitOfWork, clock),
    get: new GetJourneyHandler(employees, journeys, users, clock),
    list: new ListJourneysHandler(employees, journeys, users, clock),
    templatesList: new ListJourneyTemplatesHandler(templates),
    updateTemplate: new UpdateJourneyTemplateUseCase(templates, recorder, unitOfWork),
  };
}

const startFor = (employeeId: string, kind = 'ONBOARDING') => ({ employeeId, kind, actor });

describe('Parcours : lancer', () => {
  it('la RH lance : les tâches du modèle sont copiées, échéances relatives à la date d’entrée ; audit', async () => {
    const w = build();
    const view = await w.launch.execute({ ...startFor(ID.sam), access: hr });
    expect(view).toMatchObject({ employeeName: 'Sam Test', kind: 'ONBOARDING', kindLabel: 'Intégration', referenceDate: '2026-12-01', status: 'ACTIVE', progress: { done: 0, total: 3 }, overdueCount: 0, version: 1 });
    expect(view.tasks.map((t) => [t.title, t.ownerLabel, t.dueOn])).toEqual([['Accès', 'Informatique', '2026-11-28'], ['Accueil', 'Responsable', '2026-12-01'], ['Bilan', 'Ressources humaines', '2026-12-31']]);
    expect(w.audit).toHaveLength(1);
    expect(w.audit[0]).toMatchObject({ module: 'hr', entityType: 'Journey', action: AuditAction.Create });
    expect(w.journeys.locks).toEqual([ID.sam]);
    const dep = await w.launch.execute({ ...startFor(ID.sam, 'OFFBOARDING'), referenceDate: '2026-12-15', access: root });
    expect(dep.tasks.map((t) => t.dueOn)).toEqual(['2026-12-15', '2026-12-12']);
  });

  it('un départ prend aujourd’hui par défaut', async () => {
    const w = build();
    expect((await w.launch.execute({ ...startFor(ID.sam, 'OFFBOARDING'), access: hr })).referenceDate).toBe('2026-11-10');
  });

  it.each([['Direction', boss], ['responsable', claire], ['employé', sam], ['sans droit', nobody]])('refuse à %s', async (_l, access) => {
    const w = build();
    await expect(w.launch.execute({ ...startFor(ID.sam), access })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(w.journeys.items).toHaveLength(0);
    expect(w.audit).toHaveLength(0);
  });

  it('un seul parcours en cours par employé et par nature ; une autre nature est permise', async () => {
    const w = build();
    await w.launch.execute({ ...startFor(ID.sam), access: hr });
    await expect(w.launch.execute({ ...startFor(ID.sam), access: hr })).rejects.toMatchObject({ code: 'CONFLICT', message: expect.stringMatching(/déjà en cours/) });
    await expect(w.launch.execute({ ...startFor(ID.sam, 'OFFBOARDING'), access: hr })).resolves.toBeDefined();
    expect(w.journeys.items).toHaveLength(2);
  });

  it('refuse un employé inconnu ou archivé, une nature ou une date invalide', async () => {
    const w = build();
    await expect(w.launch.execute({ ...startFor(uuid(999)), access: hr })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(w.launch.execute({ ...startFor(ID.left), access: hr })).rejects.toMatchObject({ code: 'CONFLICT', message: expect.stringMatching(/archivé/) });
    await expect(w.launch.execute({ ...startFor(ID.sam, 'AUTRE'), access: hr })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(w.launch.execute({ ...startFor(ID.sam), referenceDate: '2026-02-30', access: hr })).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(w.journeys.items).toHaveLength(0);
  });

  it('modifier le modèle ensuite ne change pas le parcours déjà lancé', async () => {
    const w = build();
    const view = await w.launch.execute({ ...startFor(ID.sam), access: hr });
    await w.updateTemplate.execute({ kind: 'ONBOARDING', version: 1, tasks: [{ title: 'Seule tâche', owner: 'HR', dueOffsetDays: 1 }], access: hr, actor });
    expect((await w.get.execute({ id: view.id, access: hr })).tasks.map((t) => t.title)).toEqual(['Accès', 'Accueil', 'Bilan']);
  });
});

describe('Parcours : le droit de gérer exige la portée Tous', () => {
  it.each([[Scope.Team], [Scope.Own]])('refuse le droit de gérer en portée %s (lancer, modèles, cocher, décocher, annuler)', async (scope) => {
    const w = build();
    const made = await w.launch.execute({ ...startFor(ID.sam), access: hr });
    const access = narrowManage(scope);
    const taskId = made.tasks[0]!.id;
    await expect(w.launch.execute({ ...startFor(ID.claire), access })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(w.updateTemplate.execute({ kind: 'ONBOARDING', version: 1, tasks: [{ title: 'X', owner: 'HR', dueOffsetDays: 0 }], access, actor })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(w.complete.execute({ id: made.id, taskId, version: 1, access, actor })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(w.reopen.execute({ id: made.id, taskId, version: 1, access, actor })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(w.cancel.execute({ id: made.id, version: 1, access, actor })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(w.journeys.items).toHaveLength(1);
    expect(w.journeys.items[0]!.status).toBe('ACTIVE');
  });
});

describe('Parcours : cocher, décocher, annuler', () => {
  async function started(w: ReturnType<typeof build>) {
    return w.launch.execute({ ...startFor(ID.sam), access: hr });
  }

  it('cocher garde la date et l’auteur (nom lisible) ; l’audit garde l’avant et l’après', async () => {
    const w = build();
    const j = await started(w);
    const after = await w.complete.execute({ id: j.id, taskId: j.tasks[0]!.id, version: 1, access: hr, actor });
    expect(after.tasks[0]).toMatchObject({ done: true, doneAt: now.toISOString(), doneByUserId: 'u-hr', doneByName: 'Hélène RH' });
    expect(after.progress).toEqual({ done: 1, total: 3 });
    const record = w.audit.at(-1)!;
    expect(record).toMatchObject({ entityType: 'Journey', action: AuditAction.Update });
    expect((record.oldValue as { progress: unknown }).progress).toEqual({ done: 0, total: 3 });
    expect((record.newValue as { progress: unknown }).progress).toEqual({ done: 1, total: 3 });
  });

  it('la dernière tâche cochée termine le parcours ; décocher le rouvre', async () => {
    const w = build();
    const j = await started(w);
    for (const t of j.tasks) await w.complete.execute({ id: j.id, taskId: t.id, version: 1, access: hr, actor: actorOf('u-root') });
    const done = await w.get.execute({ id: j.id, access: hr });
    expect(done).toMatchObject({ status: 'COMPLETED', progress: { done: 3, total: 3 } });
    expect(done.completedAt).not.toBeNull();
    const reopened = await w.reopen.execute({ id: j.id, taskId: j.tasks[2]!.id, version: 1, access: hr, actor });
    expect(reopened).toMatchObject({ status: 'ACTIVE', completedAt: null, progress: { done: 2, total: 3 } });
    expect(reopened.tasks[2]).toMatchObject({ done: false, doneAt: null, doneByUserId: null, doneByName: null });
  });

  it('rouvrir un parcours terminé est refusé si un autre de la même nature est déjà en cours', async () => {
    const w = build();
    const first = await started(w);
    for (const t of first.tasks) await w.complete.execute({ id: first.id, taskId: t.id, version: 1, access: hr, actor });
    await w.launch.execute({ ...startFor(ID.sam), access: hr });
    await expect(w.reopen.execute({ id: first.id, taskId: first.tasks[0]!.id, version: 1, access: hr, actor })).rejects.toMatchObject({ code: 'CONFLICT', message: expect.stringMatching(/déjà en cours/) });
    expect((await w.get.execute({ id: first.id, access: hr })).status).toBe('COMPLETED');
  });

  it('refuse une version périmée, une tâche inconnue, un double cochage et tout rôle autre que la RH', async () => {
    const w = build();
    const j = await started(w);
    const taskId = j.tasks[0]!.id;
    await expect(w.complete.execute({ id: j.id, taskId, version: 9, access: hr, actor })).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(w.complete.execute({ id: j.id, taskId: uuid(998), version: 1, access: hr, actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await w.complete.execute({ id: j.id, taskId, version: 1, access: hr, actor });
    await expect(w.complete.execute({ id: j.id, taskId, version: 1, access: hr, actor })).rejects.toMatchObject({ code: 'CONFLICT' });
    for (const access of [boss, claire, sam, nobody]) {
      await expect(w.complete.execute({ id: j.id, taskId: j.tasks[1]!.id, version: 1, access, actor })).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(w.reopen.execute({ id: j.id, taskId, version: 1, access, actor })).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(w.cancel.execute({ id: j.id, version: 1, access, actor })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    }
    await expect(w.complete.execute({ id: uuid(997), taskId, version: 1, access: hr, actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('annule un parcours en cours : conservé avec ses tâches, plus modifiable ; une nouvelle intégration devient possible', async () => {
    const w = build();
    const j = await started(w);
    const cancelled = await w.cancel.execute({ id: j.id, version: 1, access: hr, actor });
    expect(cancelled).toMatchObject({ status: 'CANCELLED', progress: { total: 3 } });
    expect(cancelled.cancelledAt).not.toBeNull();
    await expect(w.complete.execute({ id: j.id, taskId: j.tasks[0]!.id, version: 1, access: hr, actor })).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(w.cancel.execute({ id: j.id, version: 1, access: hr, actor })).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(w.launch.execute({ ...startFor(ID.sam), access: hr })).resolves.toBeDefined();
  });

  it('les tâches en retard sont signalées (échéance dépassée, non cochée, parcours en cours)', async () => {
    const w = build();
    const j = await w.launch.execute({ ...startFor(ID.sam), referenceDate: '2026-11-10', access: hr }); // Accès : 2026-11-07 (en retard), Accueil : aujourd'hui (pas en retard)
    expect(j.tasks.map((t) => t.overdue)).toEqual([true, false, false]);
    expect(j.overdueCount).toBe(1);
    const after = await w.complete.execute({ id: j.id, taskId: j.tasks[0]!.id, version: 1, access: hr, actor });
    expect(after.overdueCount).toBe(0);
    const late = await w.launch.execute({ ...startFor(ID.sam, 'OFFBOARDING'), referenceDate: '2026-11-10', access: hr });
    const cancelled = await w.cancel.execute({ id: late.id, version: 1, access: hr, actor });
    expect(cancelled.overdueCount).toBe(0);
  });
});

describe('Parcours : lire', () => {
  async function filled() {
    const w = build();
    const mine = await w.launch.execute({ ...startFor(ID.sam), access: hr });
    const theirs = await w.launch.execute({ ...startFor(ID.boss), access: hr });
    return { w, mine, theirs };
  }

  it('la RH, la Direction et le Super administrateur voient tout', async () => {
    const { w, mine } = await filled();
    for (const access of [hr, boss, root]) {
      expect((await w.get.execute({ id: mine.id, access })).employeeName).toBe('Sam Test');
      expect((await w.list.execute({ page: 1, pageSize: 25, access })).total).toBe(2);
    }
  });

  it('un employé ne voit que ses parcours ; les autres sont « introuvables »', async () => {
    const { w, mine, theirs } = await filled();
    expect((await w.get.execute({ id: mine.id, access: sam })).id).toBe(mine.id);
    await expect(w.get.execute({ id: theirs.id, access: sam })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(w.get.execute({ id: uuid(999), access: sam })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect((await w.list.execute({ page: 1, pageSize: 25, access: sam })).items.map((j) => j.id)).toEqual([mine.id]);
    await expect(w.list.execute({ employeeId: ID.boss, page: 1, pageSize: 25, access: sam })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('le responsable direct ne voit pas le parcours de son équipe ; sans droit : interdit', async () => {
    const { w, mine } = await filled();
    await expect(w.get.execute({ id: mine.id, access: claire })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect((await w.list.execute({ page: 1, pageSize: 25, access: claire })).total).toBe(0);
    await expect(w.list.execute({ page: 1, pageSize: 25, access: nobody })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(w.get.execute({ id: mine.id, access: nobody })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('filtre par nature et par état, et borne la page', async () => {
    const { w, mine } = await filled();
    await w.launch.execute({ ...startFor(ID.sam, 'OFFBOARDING'), access: hr });
    await w.cancel.execute({ id: mine.id, version: 1, access: hr, actor });
    expect((await w.list.execute({ kind: 'OFFBOARDING', page: 1, pageSize: 25, access: hr })).total).toBe(1);
    expect((await w.list.execute({ status: 'CANCELLED', page: 1, pageSize: 25, access: hr })).items.map((j) => j.id)).toEqual([mine.id]);
    await expect(w.list.execute({ kind: 'AUTRE', page: 1, pageSize: 25, access: hr })).rejects.toMatchObject({ code: 'VALIDATION' });
    expect((await w.list.execute({ page: 1, pageSize: 5000, access: hr })).pageSize).toBe(100);
  });
});

describe('Modèles de parcours', () => {
  it('lus par la RH, la Direction et le Super administrateur seulement', async () => {
    const w = build();
    for (const access of [hr, boss, root]) expect((await w.templatesList.execute({ access })).map((t) => t.kind)).toEqual(['OFFBOARDING', 'ONBOARDING']);
    for (const access of [claire, sam, nobody]) await expect(w.templatesList.execute({ access })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('la RH remplace les tâches d’un modèle, avec version et audit avant / après', async () => {
    const w = build();
    const updated = await w.updateTemplate.execute({ kind: 'OFFBOARDING', version: 1, tasks: [{ title: 'Restituer le badge', owner: 'EMPLOYEE', dueOffsetDays: 0 }, { title: 'Solde de tout compte', owner: 'HR', dueOffsetDays: 5 }], access: hr, actor });
    expect(updated.tasks.map((t) => [t.title, t.ownerLabel, t.dueOffsetDays])).toEqual([['Restituer le badge', 'Employé', 0], ['Solde de tout compte', 'Ressources humaines', 5]]);
    const record = w.audit.at(-1)!;
    expect(record).toMatchObject({ entityType: 'JourneyTemplate', action: AuditAction.Update });
    expect((record.oldValue as { tasks: unknown[] }).tasks).toHaveLength(2);
    await expect(w.updateTemplate.execute({ kind: 'OFFBOARDING', version: 7, tasks: [{ title: 'X', owner: 'HR', dueOffsetDays: 0 }], access: hr, actor })).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('refuse un modèle vide, invalide, une nature inconnue, et tout rôle autre que la RH', async () => {
    const w = build();
    await expect(w.updateTemplate.execute({ kind: 'ONBOARDING', version: 1, tasks: [], access: hr, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(w.updateTemplate.execute({ kind: 'ONBOARDING', version: 1, tasks: [{ title: 'X', owner: 'CEO', dueOffsetDays: 0 }], access: hr, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(w.updateTemplate.execute({ kind: 'AUTRE', version: 1, tasks: [{ title: 'X', owner: 'HR', dueOffsetDays: 0 }], access: hr, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
    expect((await w.templatesList.execute({ access: hr })).find((t) => t.kind === 'ONBOARDING')!.tasks).toHaveLength(3);
    for (const access of [boss, claire, sam, nobody]) await expect(w.updateTemplate.execute({ kind: 'ONBOARDING', version: 1, tasks: [{ title: 'X', owner: 'HR', dueOffsetDays: 0 }], access, actor })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(w.audit).toHaveLength(0);
  });
});
