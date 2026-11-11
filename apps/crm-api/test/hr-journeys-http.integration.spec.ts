import 'reflect-metadata';
import { RoleCode } from '../src/modules/iam/domain/roles';
import { Api, createUserWithRoles, mfaSession, startRbacApp } from './support/rbac-http';
import { TestApp } from './support/test-app';

const describeDb = process.env.DATABASE_URL && process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;
const NIL = '00000000-0000-4000-8000-000000000000';
const addDays = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const today = () => new Date().toISOString().slice(0, 10);

/**
 * RH-3b : parcours d'intégration et de départ de bout en bout (HTTP + PostgreSQL) : modèles de départ, modification des modèles, lancement à la main, copie figée des
 * tâches, cocher avec date et auteur, terminer, rouvrir, annuler, un seul parcours en cours (y compris sous lancement simultané), droits et portée, règles garanties par la
 * base, verrou optimiste, audit.
 */
describeDb('Parcours d’intégration et de départ (HTTP + PostgreSQL)', () => {
  let t: TestApp;
  let api: Api;
  let seq = 0;
  const ip = () => `10.97.${Math.floor(seq / 250)}.${(seq++ % 250) + 1}`;

  beforeAll(async () => {
    ({ t, api } = await startRbacApp());
  }, 60_000);
  afterAll(async () => {
    await t.close();
  });

  const login = async (user: { email: string }) => {
    const addr = ip();
    const session = await mfaSession(t, api, user.email, addr);
    return { token: session.token, ip: addr };
  };
  const unique = () => Math.random().toString(36).slice(2, 8);
  type As = { token: string; ip: string };

  async function world() {
    const hrUser = await createUserWithRoles(t, [RoleCode.Hr]);
    const dirUser = await createUserWithRoles(t, [RoleCode.Direction]);
    const bossUser = await createUserWithRoles(t, [RoleCode.HeadOfSales]);
    const memberUser = await createUserWithRoles(t, [RoleCode.AccountManager]);
    const strangerUser = await createUserWithRoles(t, [RoleCode.Support]);
    const [hr, dir, boss, member, stranger] = [await login(hrUser), await login(dirUser), await login(bossUser), await login(memberUser), await login(strangerUser)];
    const employee = async (name: string, userId: string | null, managerEmployeeId: string | null, hiredOn = '2026-12-01') => {
      const res = await api.call('POST', '/api/v1/hr/employees', { ...hr, body: { lastName: `${name}-${unique()}`, firstName: name, jobTitle: 'Poste', department: 'Commercial', hiredOn, ...(userId ? { userId } : {}), ...(managerEmployeeId ? { managerEmployeeId } : {}) } });
      expect(res.status).toBe(201);
      return res.body as { id: string };
    };
    const bossEmp = await employee('Bruno', bossUser.id, null);
    const memberEmp = await employee('Marie', memberUser.id, bossEmp.id);
    return { hr, dir, boss, member, stranger, bossEmp, memberEmp, hrUser, employee };
  }
  type World = Awaited<ReturnType<typeof world>>;
  const launch = (as: As, body: Record<string, unknown>) => api.call('POST', '/api/v1/hr/journeys', { ...as, body });
  const fresh = async (w: World) => (await w.employee('Neuf', null, null)).id;
  const check = (as: As, journey: { id: string; version: number }, taskId: string) => api.call('POST', `/api/v1/hr/journeys/${journey.id}/tasks/${taskId}/complete`, { ...as, body: { version: journey.version } });

  it('modèles de départ : intégration (6 tâches) et départ (5 tâches), responsables en liste fermée, lisibles par la RH et la Direction seulement', async () => {
    const w = await world();
    const templates = (await api.call('GET', '/api/v1/hr/journeys/templates', w.hr)).body as { kind: string; tasks: { owner: string; ownerLabel: string }[]; version: number }[];
    expect(templates.map((x) => [x.kind, x.tasks.length])).toEqual([['OFFBOARDING', 5], ['ONBOARDING', 6]]);
    expect(templates.flatMap((x) => x.tasks.map((y) => y.owner)).every((o) => ['HR', 'MANAGER', 'EMPLOYEE', 'IT'].includes(o))).toBe(true);
    expect((await api.call('GET', '/api/v1/hr/journeys/templates', w.dir)).status).toBe(200);
    for (const as of [w.member, w.boss, w.stranger]) expect((await api.call('GET', '/api/v1/hr/journeys/templates', as)).status).toBe(403);
  });

  it('cycle complet : lancer → cocher (date et auteur) → terminer → rouvrir → annuler ; tout est audité', async () => {
    const w = await world();
    const employeeId = await fresh(w);
    const made = await launch(w.hr, { employeeId, kind: 'ONBOARDING' });
    expect(made.status).toBe(201);
    expect(made.body).toMatchObject({ kind: 'ONBOARDING', referenceDate: '2026-12-01', status: 'ACTIVE', progress: { done: 0, total: 6 }, version: 1 });
    const tasks = made.body.tasks as { id: string; dueOn: string; owner: string }[];
    expect(tasks[0]).toMatchObject({ dueOn: '2026-11-28', owner: 'IT', done: false });

    let current = made.body as { id: string; version: number; tasks: { id: string }[] };
    const first = await check(w.hr, current, tasks[0]!.id);
    expect(first.status).toBe(200);
    expect(first.body.tasks[0]).toMatchObject({ done: true, doneByUserId: w.hrUser.id });
    expect(first.body.tasks[0].doneByName).toEqual(expect.any(String));
    expect(first.body.tasks[0].doneAt).toEqual(expect.any(String));
    expect(first.body).toMatchObject({ progress: { done: 1, total: 6 }, version: 2 });
    // Version périmée et double cochage : refusés.
    expect((await check(w.hr, current, tasks[1]!.id)).status).toBe(409);
    current = first.body;
    expect((await check(w.hr, current, tasks[0]!.id)).status).toBe(409);
    for (const task of tasks.slice(1)) {
      const res = await check(w.hr, current, task.id);
      expect(res.status).toBe(200);
      current = res.body;
    }
    expect(current).toMatchObject({ status: 'COMPLETED', progress: { done: 6, total: 6 } });
    const reopened = await api.call('POST', `/api/v1/hr/journeys/${current.id}/tasks/${tasks[5]!.id}/reopen`, { ...w.hr, body: { version: current.version } });
    expect(reopened.body).toMatchObject({ status: 'ACTIVE', completedAt: null, progress: { done: 5, total: 6 } });
    expect(reopened.body.tasks[5]).toMatchObject({ done: false, doneAt: null, doneByUserId: null });
    const cancelled = await api.call('POST', `/api/v1/hr/journeys/${current.id}/cancel`, { ...w.hr, body: { version: reopened.body.version } });
    expect(cancelled.body).toMatchObject({ status: 'CANCELLED', progress: { total: 6 } });
    expect((await api.call('POST', `/api/v1/hr/journeys/${current.id}/cancel`, { ...w.hr, body: { version: cancelled.body.version } })).status).toBe(409);
    expect((await check(w.hr, cancelled.body, tasks[5]!.id)).status).toBe(409);

    const logs = await t.prisma.db.auditLog.findMany({ where: { entityId: current.id }, orderBy: { createdAt: 'asc' } });
    expect(logs.map((l) => l.action)).toEqual(['CREATE', ...Array(8).fill('UPDATE')]);
    // L'auteur et la date d'une coche sont aussi en base.
    const row = await t.prisma.db.journeyTask.findUnique({ where: { id: tasks[0]!.id } });
    expect([row!.doneByUserId, row!.doneAt !== null]).toEqual([w.hrUser.id, true]);
  });

  it('un départ prend aujourd’hui par défaut ; la date de référence se choisit ; les retards sont signalés', async () => {
    const w = await world();
    const employeeId = await fresh(w);
    const dep = await launch(w.hr, { employeeId, kind: 'OFFBOARDING' });
    expect(dep.body.referenceDate).toBe(today());
    expect(dep.body.tasks.map((x: { dueOn: string }) => x.dueOn)).toEqual([addDays(today(), -7), addDays(today(), -3), today(), today(), addDays(today(), 1)]);
    expect(dep.body.overdueCount).toBe(2);
    const other = await fresh(w);
    const on = await launch(w.hr, { employeeId: other, kind: 'ONBOARDING', referenceDate: '2030-03-15' });
    expect(on.body.tasks[0].dueOn).toBe('2030-03-12');
    expect(on.body.overdueCount).toBe(0);
  });

  it('un seul parcours en cours par employé et par nature, même sous trois lancements simultanés', async () => {
    const w = await world();
    const employeeId = await fresh(w);
    const results = await Promise.all([1, 2, 3].map(() => launch(w.hr, { employeeId, kind: 'ONBOARDING' })));
    expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409]);
    expect(await t.prisma.db.journey.count({ where: { employeeId, kind: 'ONBOARDING', status: 'ACTIVE' } })).toBe(1);
    // Une autre nature reste permise ; après annulation, la même nature aussi.
    expect((await launch(w.hr, { employeeId, kind: 'OFFBOARDING' })).status).toBe(201);
    const active = results.find((r) => r.status === 201)!.body;
    await api.call('POST', `/api/v1/hr/journeys/${active.id}/cancel`, { ...w.hr, body: { version: active.version } });
    expect((await launch(w.hr, { employeeId, kind: 'ONBOARDING' })).status).toBe(201);
  }, 60_000);

  it('rouvrir un parcours terminé est refusé si un autre de la même nature est déjà en cours', async () => {
    const w = await world();
    const employeeId = await fresh(w);
    const first = await launch(w.hr, { employeeId, kind: 'OFFBOARDING' });
    let current = first.body;
    for (const task of first.body.tasks as { id: string }[]) current = (await check(w.hr, current, task.id)).body;
    expect(current.status).toBe('COMPLETED');
    expect((await launch(w.hr, { employeeId, kind: 'OFFBOARDING' })).status).toBe(201);
    expect((await api.call('POST', `/api/v1/hr/journeys/${current.id}/tasks/${first.body.tasks[0].id}/reopen`, { ...w.hr, body: { version: current.version } })).status).toBe(409);
  });

  it('refus : employé inconnu ou archivé, nature inconnue, date impossible, tâche inconnue', async () => {
    const w = await world();
    const employeeId = await fresh(w);
    expect((await launch(w.hr, { employeeId: NIL, kind: 'ONBOARDING' })).status).toBe(404);
    expect((await launch(w.hr, { employeeId, kind: 'AUTRE' })).status).toBe(400);
    expect((await launch(w.hr, { employeeId, kind: 'ONBOARDING', referenceDate: '2026-02-30' })).status).toBe(400);
    const archived = await fresh(w);
    const emp = (await api.call('GET', `/api/v1/hr/employees/${archived}`, w.hr)).body as { version: number };
    expect((await api.call('POST', `/api/v1/hr/employees/${archived}/status`, { ...w.hr, body: { version: emp.version, status: 'ARCHIVED', leftOn: '2026-12-15', reason: 'Départ' } })).status).toBe(200);
    expect((await launch(w.hr, { employeeId: archived, kind: 'OFFBOARDING' })).status).toBe(409);
    const made = await launch(w.hr, { employeeId, kind: 'ONBOARDING' });
    expect((await check(w.hr, made.body, NIL)).status).toBe(404);
  });

  it('droits : la RH gère, la Direction lit tout, l’employé lit les siens, le responsable et les tiers ne voient rien', async () => {
    const w = await world();
    const mine = await launch(w.hr, { employeeId: w.memberEmp.id, kind: 'ONBOARDING' });
    const theirs = await launch(w.hr, { employeeId: w.bossEmp.id, kind: 'ONBOARDING' });
    expect([mine.status, theirs.status]).toEqual([201, 201]);
    const taskId = mine.body.tasks[0].id as string;
    for (const as of [w.dir, w.boss, w.member, w.stranger]) {
      expect((await launch(as, { employeeId: await fresh(w), kind: 'ONBOARDING' })).status).toBe(403);
      expect((await check(as, mine.body, taskId)).status).toBe(403);
      expect((await api.call('POST', `/api/v1/hr/journeys/${mine.body.id}/tasks/${taskId}/reopen`, { ...as, body: { version: 1 } })).status).toBe(403);
      expect((await api.call('POST', `/api/v1/hr/journeys/${mine.body.id}/cancel`, { ...as, body: { version: 1 } })).status).toBe(403);
      expect((await api.call('PUT', '/api/v1/hr/journeys/templates/ONBOARDING', { ...as, body: { version: 1, tasks: [{ title: 'X', owner: 'HR', dueOffsetDays: 0 }] } })).status).toBe(403);
    }
    for (const as of [w.hr, w.dir]) {
      expect((await api.call('GET', `/api/v1/hr/journeys/${mine.body.id}`, as)).status).toBe(200);
      expect((await api.call('GET', `/api/v1/hr/journeys/${theirs.body.id}`, as)).status).toBe(200);
    }
    expect((await api.call('GET', `/api/v1/hr/journeys/${mine.body.id}`, w.member)).status).toBe(200);
    for (const [as, id] of [[w.member, theirs.body.id], [w.boss, mine.body.id], [w.stranger, mine.body.id], [w.boss, NIL]] as [As, string][]) {
      expect((await api.call('GET', `/api/v1/hr/journeys/${id}`, as)).status).toBe(404);
    }
    expect((await api.call('GET', '/api/v1/hr/journeys', w.member)).body.items.map((j: { id: string }) => j.id)).toEqual([mine.body.id]);
    expect((await api.call('GET', '/api/v1/hr/journeys', w.boss)).body.items.map((j: { id: string }) => j.id)).toEqual([theirs.body.id]); // le sien, jamais celui de son équipe
    expect((await api.call('GET', `/api/v1/hr/journeys?employeeId=${w.bossEmp.id}`, w.member)).status).toBe(404);
    expect((await api.call('GET', '/api/v1/hr/journeys?kind=AUTRE', w.hr)).status).toBe(400);
    expect((await api.call('GET', '/api/v1/hr/journeys', {})).status).toBe(401);
  });

  it('modèles : la RH remplace les tâches ; un parcours déjà lancé garde sa copie ; refus d’un modèle vide ou mal formé ; version périmée', async () => {
    const w = await world();
    const employeeId = await fresh(w);
    const before = await launch(w.hr, { employeeId, kind: 'ONBOARDING' });
    const templates = (await api.call('GET', '/api/v1/hr/journeys/templates', w.hr)).body as { kind: string; version: number }[];
    const version = templates.find((x) => x.kind === 'ONBOARDING')!.version;
    const tasks = [{ title: 'Seule tâche', owner: 'EMPLOYEE', dueOffsetDays: 4 }, { title: 'Deuxième', owner: 'HR', dueOffsetDays: -1 }];
    const put = (body: unknown) => api.call('PUT', '/api/v1/hr/journeys/templates/ONBOARDING', { ...w.hr, body });
    const updated = await put({ version, tasks });
    expect(updated.status).toBe(200);
    expect(updated.body.tasks.map((x: { title: string; ownerLabel: string }) => [x.title, x.ownerLabel])).toEqual([['Seule tâche', 'Employé'], ['Deuxième', 'Ressources humaines']]);
    expect(updated.body.version).toBe(version + 1);
    expect((await put({ version, tasks })).status).toBe(409);
    expect((await put({ version: version + 1, tasks: [] })).status).toBe(400);
    expect((await put({ version: version + 1, tasks: [{ title: 'X', owner: 'PDG', dueOffsetDays: 0 }] })).status).toBe(400);
    expect((await put({ version: version + 1, tasks: [{ title: 'X', owner: 'HR', dueOffsetDays: 999 }] })).status).toBe(400);
    expect((await put({ version: version + 1, tasks: [{ title: 'X', owner: 'HR', dueOffsetDays: 0 }, { title: 'x', owner: 'HR', dueOffsetDays: 1 }] })).status).toBe(400);
    expect((await api.call('PUT', '/api/v1/hr/journeys/templates/AUTRE', { ...w.hr, body: { version: 1, tasks } })).status).toBe(400);
    // Le parcours déjà lancé n'a pas bougé ; un nouveau reprend le nouveau modèle.
    expect((await api.call('GET', `/api/v1/hr/journeys/${before.body.id}`, w.hr)).body.tasks).toHaveLength(6);
    const after = await launch(w.hr, { employeeId: await fresh(w), kind: 'ONBOARDING' });
    expect(after.body.tasks.map((x: { title: string }) => x.title)).toEqual(['Seule tâche', 'Deuxième']);
    const logs = await t.prisma.db.auditLog.findMany({ where: { entityType: 'JourneyTemplate', action: 'UPDATE' } });
    expect(logs.length).toBeGreaterThanOrEqual(1);
    // Remet le modèle de départ pour ne pas gêner les autres tests (6 tâches).
    const restore = [
      ['Préparer le poste de travail et les accès', 'IT', -3], ['Accueillir et présenter l’équipe', 'MANAGER', 0], ['Remettre le règlement intérieur', 'HR', 0],
      ['Vérifier la fiche de l’employé', 'HR', 2], ['Point de fin de première semaine', 'MANAGER', 7], ['Bilan de fin de période d’essai', 'HR', 30],
    ].map(([title, owner, dueOffsetDays]) => ({ title, owner, dueOffsetDays }));
    expect((await put({ version: version + 1, tasks: restore })).status).toBe(200);
  });

  it('aucune donnée sensible : ni colonne libre en base, ni champ libre dans l’API', async () => {
    const w = await world();
    const made = await launch(w.hr, { employeeId: await fresh(w), kind: 'ONBOARDING' });
    expect(Object.keys(made.body).sort()).toEqual(['cancelledAt', 'completedAt', 'createdAt', 'employeeId', 'employeeName', 'id', 'kind', 'kindLabel', 'overdueCount', 'progress', 'referenceDate', 'status', 'tasks', 'version']);
    expect(Object.keys(made.body.tasks[0]).sort()).toEqual(['doneAt', 'doneByName', 'doneByUserId', 'done', 'dueOn', 'id', 'overdue', 'owner', 'ownerLabel', 'title'].sort());
    const columns = await t.prisma.db.$queryRawUnsafe<{ column_name: string }[]>(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'hr' AND table_name IN ('journeys', 'journey_tasks', 'journey_templates', 'journey_template_tasks')`);
    expect(columns.map((c) => c.column_name).join()).not.toMatch(/note|comment|reason|motif|salary|salaire|document|file/i);
  });

  describe('règles garanties par la base, quoi que fasse l’application', () => {
    const journey = (employee: string, cols: Record<string, string> = {}) => {
      const all = { id: 'gen_random_uuid()', employee_id: `'${employee}'::uuid`, kind: `'ONBOARDING'`, reference_date: `'2026-12-01'`, launched_by_user_id: 'gen_random_uuid()', updated_at: 'now()', ...cols };
      return t.prisma.db.$executeRawUnsafe(`INSERT INTO hr.journeys (${Object.keys(all).join(', ')}) VALUES (${Object.values(all).join(', ')})`);
    };

    it('un seul parcours en cours par employé et par nature (index partiel) ; plusieurs terminés ou annulés permis', async () => {
      const w = await world();
      const employee = await fresh(w);
      await expect(journey(employee)).resolves.toBeDefined();
      await expect(journey(employee)).rejects.toThrow();
      await expect(journey(employee, { kind: `'OFFBOARDING'` })).resolves.toBeDefined();
      await expect(journey(employee, { status: `'CANCELLED'`, cancelled_at: 'now()' })).resolves.toBeDefined();
      await expect(journey(employee, { status: `'CANCELLED'`, cancelled_at: 'now()' })).resolves.toBeDefined();
      await expect(journey(employee, { status: `'COMPLETED'`, completed_at: 'now()' })).resolves.toBeDefined();
    });

    it('état cohérent : terminé sans date, annulé sans date, en cours avec date, les deux dates, version nulle, nature ou état inconnus', async () => {
      const w = await world();
      const e = () => fresh(w);
      await expect(journey(await e(), { status: `'COMPLETED'` })).rejects.toThrow();
      await expect(journey(await e(), { status: `'CANCELLED'` })).rejects.toThrow();
      await expect(journey(await e(), { completed_at: 'now()' })).rejects.toThrow();
      await expect(journey(await e(), { cancelled_at: 'now()' })).rejects.toThrow();
      await expect(journey(await e(), { status: `'COMPLETED'`, completed_at: 'now()', cancelled_at: 'now()' })).rejects.toThrow();
      await expect(journey(await e(), { version: '0' })).rejects.toThrow();
      await expect(journey(await e(), { kind: `'PAUSE'` })).rejects.toThrow();
      await expect(journey(await e(), { status: `'SUSPENDED'` })).rejects.toThrow();
    });

    it('tâches : date et auteur ensemble, titre non vide ; modèles : un par nature, titre non vide, décalage borné ; jamais de suppression d’un employé ou d’un parcours qui a des tâches', async () => {
      const w = await world();
      const employee = await fresh(w);
      const made = await launch(w.hr, { employeeId: employee, kind: 'ONBOARDING' });
      const taskId = made.body.tasks[0].id as string;
      await expect(t.prisma.db.$executeRawUnsafe(`UPDATE hr.journey_tasks SET done_at = now() WHERE id = '${taskId}'::uuid`)).rejects.toThrow();
      await expect(t.prisma.db.$executeRawUnsafe(`UPDATE hr.journey_tasks SET done_by_user_id = gen_random_uuid() WHERE id = '${taskId}'::uuid`)).rejects.toThrow();
      await expect(t.prisma.db.$executeRawUnsafe(`UPDATE hr.journey_tasks SET title = '   ' WHERE id = '${taskId}'::uuid`)).rejects.toThrow();
      await expect(t.prisma.db.$executeRawUnsafe(`INSERT INTO hr.journey_templates (id, kind, updated_at) VALUES (gen_random_uuid(), 'ONBOARDING', now())`)).rejects.toThrow();
      const tpl = await t.prisma.db.journeyTemplate.findUnique({ where: { kind: 'ONBOARDING' } });
      const task = (title: string, offset: number) => t.prisma.db.$executeRawUnsafe(`INSERT INTO hr.journey_template_tasks (id, template_id, title, owner, due_offset_days, sort_order) VALUES (gen_random_uuid(), '${tpl!.id}'::uuid, '${title}', 'HR', ${offset}, 999)`);
      await expect(task('   ', 0)).rejects.toThrow();
      await expect(task('Hors borne', 366)).rejects.toThrow();
      await expect(task('Hors borne', -366)).rejects.toThrow();
      await expect(t.prisma.db.$executeRawUnsafe(`DELETE FROM hr.employees WHERE id = '${employee}'::uuid`)).rejects.toThrow();
      await expect(t.prisma.db.$executeRawUnsafe(`DELETE FROM hr.journeys WHERE id = '${made.body.id}'::uuid`)).rejects.toThrow();
    });
  });
});
