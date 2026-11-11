import { JOURNEY_KINDS, Journey, JourneyTemplate, MAX_TEMPLATE_TASKS, TASK_OWNERS, validateTemplateTasks } from './journey';
import { JOURNEY_KIND_CODES, TASK_OWNER_CODES } from '../presentation/dto/journey.dto';

const now = new Date('2026-11-10T09:00:00Z');
const ok = { title: 'Remettre le badge', owner: 'HR', dueOffsetDays: 0 };
let n = 0;
const launch = (reference = '2026-12-01') =>
  Journey.launch({
    id: 'j1', employeeId: 'e1', kind: 'ONBOARDING', referenceDate: reference, launchedByUserId: 'u1', newId: () => `t${++n}`, now,
    template: [{ title: 'A', owner: 'IT', dueOffsetDays: -3 }, { title: 'B', owner: 'MANAGER', dueOffsetDays: 0 }, { title: 'C', owner: 'HR', dueOffsetDays: 30 }],
  });

describe('validateTemplateTasks', () => {
  it('normalise les titres et garde l’ordre', () => {
    expect(validateTemplateTasks([{ ...ok, title: '  Remettre   le badge ' }, { title: 'Autre', owner: 'IT', dueOffsetDays: -5 }])).toEqual([{ ...ok }, { title: 'Autre', owner: 'IT', dueOffsetDays: -5 }]);
  });

  it('refuse une liste vide ou trop longue', () => {
    expect(() => validateTemplateTasks([])).toThrow(/au moins une/);
    const many = Array.from({ length: MAX_TEMPLATE_TASKS + 1 }, (_, i) => ({ ...ok, title: `T${i}` }));
    expect(() => validateTemplateTasks(many)).toThrow(/30/);
    expect(validateTemplateTasks(many.slice(0, MAX_TEMPLATE_TASKS))).toHaveLength(MAX_TEMPLATE_TASKS);
  });

  it('refuse un titre vide ou trop long, un responsable hors liste, une échéance hors bornes ou non entière', () => {
    expect(() => validateTemplateTasks([{ ...ok, title: '   ' }])).toThrow(/obligatoire/);
    expect(() => validateTemplateTasks([{ ...ok, title: 'x'.repeat(151) }])).toThrow(/150/);
    expect(() => validateTemplateTasks([{ ...ok, owner: 'CEO' }])).toThrow(/responsable/);
    expect(() => validateTemplateTasks([{ ...ok, owner: undefined }])).toThrow(/responsable/);
    for (const dueOffsetDays of [366, -366, 1.5, Number.NaN, undefined]) expect(() => validateTemplateTasks([{ ...ok, dueOffsetDays: dueOffsetDays as number }])).toThrow(/échéance/);
    expect(validateTemplateTasks([{ ...ok, dueOffsetDays: 365 }, { ...ok, title: 'Z', dueOffsetDays: -365 }])).toHaveLength(2);
  });

  it('refuse deux tâches de même titre (sans tenir compte de la casse)', () => {
    expect(() => validateTemplateTasks([ok, { ...ok, title: 'REMETTRE LE BADGE' }])).toThrow(/deux fois/);
  });

  it('les listes de l’API sont celles du domaine', () => {
    expect([...JOURNEY_KIND_CODES]).toEqual([...JOURNEY_KINDS]);
    expect([...TASK_OWNER_CODES]).toEqual([...TASK_OWNERS]);
  });
});

describe('JourneyTemplate', () => {
  it('remplace ses tâches sans changer sa nature', () => {
    const t = JourneyTemplate.rehydrate({ id: 't', kind: 'OFFBOARDING', tasks: [{ title: 'Ancienne', owner: 'HR', dueOffsetDays: 0 }], version: 3 });
    t.replaceTasks([ok]);
    expect(t.tasks).toEqual([ok]);
    expect(t).toMatchObject({ kind: 'OFFBOARDING', version: 3 });
    expect(() => t.replaceTasks([])).toThrow();
    expect(t.tasks).toEqual([ok]);
  });
});

describe('Journey', () => {
  it('copie les tâches du modèle avec une échéance relative à la date de référence', () => {
    const j = launch('2026-12-01');
    expect(j.tasks.map((t) => [t.title, t.dueOn])).toEqual([['A', '2026-11-28'], ['B', '2026-12-01'], ['C', '2026-12-31']]);
    expect(j).toMatchObject({ status: 'ACTIVE', isActive: true, completedAt: null, version: 1 });
    expect(j.tasks.every((t) => t.doneAt === null && t.doneByUserId === null)).toBe(true);
    expect(new Set(j.tasks.map((t) => t.id)).size).toBe(3);
  });

  it('traverse le changement d’année et les années bissextiles', () => {
    const j = Journey.launch({ id: 'j', employeeId: 'e', kind: 'OFFBOARDING', referenceDate: '2028-02-28', launchedByUserId: 'u', newId: () => `x${++n}`, now, template: [{ title: 'A', owner: 'HR', dueOffsetDays: 2 }, { title: 'B', owner: 'HR', dueOffsetDays: -59 }] });
    expect(j.tasks.map((t) => t.dueOn)).toEqual(['2028-03-01', '2027-12-31']);
  });

  it('refuse une date de référence impossible, un modèle vide, une nature inconnue', () => {
    expect(() => launch('2026-02-30')).toThrow(/date valide/);
    expect(() => Journey.launch({ id: 'j', employeeId: 'e', kind: 'ONBOARDING', referenceDate: '2026-12-01', launchedByUserId: 'u', newId: () => 'x', now, template: [] })).toThrow(/aucune tâche/);
    expect(() => Journey.launch({ id: 'j', employeeId: 'e', kind: 'AUTRE' as 'ONBOARDING', referenceDate: '2026-12-01', launchedByUserId: 'u', newId: () => 'x', now, template: [ok as never] })).toThrow(/Nature/);
  });

  it('une tâche cochée garde sa date et son auteur ; la dernière tâche termine le parcours', () => {
    const j = launch();
    const [a, b, c] = j.tasks.map((t) => t.id);
    j.complete(a!, 'u-hr', new Date('2026-11-11T08:00:00Z'));
    expect(j.tasks[0]).toMatchObject({ doneByUserId: 'u-hr', doneAt: new Date('2026-11-11T08:00:00Z') });
    expect(j.status).toBe('ACTIVE');
    j.complete(b!, 'u-hr', now);
    j.complete(c!, 'u-mgr', new Date('2026-11-12T08:00:00Z'));
    expect(j).toMatchObject({ status: 'COMPLETED', isActive: false, completedAt: new Date('2026-11-12T08:00:00Z') });
  });

  it('refuse de cocher deux fois, une tâche inconnue, ou sur un parcours terminé ou annulé', () => {
    const j = launch();
    const id = j.tasks[0]!.id;
    j.complete(id, 'u', now);
    expect(() => j.complete(id, 'u', now)).toThrow(/déjà cochée/);
    expect(() => j.complete('inconnue', 'u', now)).toThrow(/introuvable/);
    for (const t of j.tasks.slice(1)) j.complete(t.id, 'u', now);
    expect(() => j.complete(id, 'u', now)).toThrow(/terminé/);
    const c = launch();
    c.cancel(now);
    expect(() => c.complete(c.tasks[0]!.id, 'u', now)).toThrow(/annulé/);
  });

  it('décocher une tâche efface la date et l’auteur ; un parcours terminé redevient en cours', () => {
    const j = launch();
    for (const t of j.tasks) j.complete(t.id, 'u', now);
    expect(j.status).toBe('COMPLETED');
    j.reopen(j.tasks[1]!.id);
    expect(j).toMatchObject({ status: 'ACTIVE', completedAt: null });
    expect(j.tasks[1]).toMatchObject({ doneAt: null, doneByUserId: null });
    expect(() => j.reopen(j.tasks[1]!.id)).toThrow(/n’est pas cochée/);
    const c = launch();
    c.cancel(now);
    expect(() => c.reopen(c.tasks[0]!.id)).toThrow(/annulé/);
  });

  it('annule un parcours en cours seulement ; il est conservé avec ses tâches', () => {
    const j = launch();
    j.cancel(now);
    expect(j).toMatchObject({ status: 'CANCELLED', cancelledAt: now, isActive: false });
    expect(j.tasks).toHaveLength(3);
    expect(() => j.cancel(now)).toThrow(/en cours/);
    const done = launch();
    for (const t of done.tasks) done.complete(t.id, 'u', now);
    expect(() => done.cancel(now)).toThrow(/en cours/);
  });
});
