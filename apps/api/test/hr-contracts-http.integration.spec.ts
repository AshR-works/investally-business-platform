import 'reflect-metadata';
import { RoleCode } from '../src/modules/iam/domain/roles';
import { Api, createUserWithRoles, mfaSession, startRbacApp } from './support/rbac-http';
import { TestApp } from './support/test-app';

const describeDb = process.env.DATABASE_URL && process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;
const NIL = '00000000-0000-4000-8000-000000000000';
const addDays = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const today = () => new Date().toISOString().slice(0, 10);

/**
 * RH-3a : contrats du personnel de bout en bout (HTTP + PostgreSQL) : types de départ, cycle créer → ajuster → terminer, un seul contrat en cours (y compris sous
 * création simultanée), droits et portée (RH, Direction, employé, responsable, tiers), échéances, règles garanties par la base, verrou optimiste, audit, absence de salaire.
 */
describeDb('Contrats du personnel (HTTP + PostgreSQL)', () => {
  let t: TestApp;
  let api: Api;
  let seq = 0;
  const ip = () => `10.96.${Math.floor(seq / 250)}.${(seq++ % 250) + 1}`;

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

  async function world() {
    const hrUser = await createUserWithRoles(t, [RoleCode.Hr]);
    const dirUser = await createUserWithRoles(t, [RoleCode.Direction]);
    const bossUser = await createUserWithRoles(t, [RoleCode.HeadOfSales]);
    const memberUser = await createUserWithRoles(t, [RoleCode.AccountManager]);
    const strangerUser = await createUserWithRoles(t, [RoleCode.Support]);
    const [hr, dir, boss, member, stranger] = [await login(hrUser), await login(dirUser), await login(bossUser), await login(memberUser), await login(strangerUser)];
    const employee = async (name: string, userId: string | null, managerEmployeeId: string | null, hiredOn = '2020-01-01') => {
      const res = await api.call('POST', '/api/v1/hr/employees', { ...hr, body: { lastName: `${name}-${unique()}`, firstName: name, jobTitle: 'Poste', department: 'Commercial', hiredOn, ...(userId ? { userId } : {}), ...(managerEmployeeId ? { managerEmployeeId } : {}) } });
      expect(res.status).toBe(201);
      return res.body as { id: string };
    };
    const bossEmp = await employee('Bruno', bossUser.id, null);
    const memberEmp = await employee('Marie', memberUser.id, bossEmp.id);
    const strangerEmp = await employee('Serge', strangerUser.id, null);
    const types = (await api.call('GET', '/api/v1/hr/contracts/types', hr)).body as { id: string; code: string; fixedTerm: boolean }[];
    const cdi = types.find((x) => x.code === 'CDI')!.id;
    const cdd = types.find((x) => x.code === 'CDD')!.id;
    return { hr, dir, boss, member, stranger, bossEmp, memberEmp, strangerEmp, cdi, cdd, types };
  }
  type World = Awaited<ReturnType<typeof world>>;
  type As = { token: string; ip: string };
  const create = (as: As, body: Record<string, unknown>) => api.call('POST', '/api/v1/hr/contracts', { ...as, body });
  const withoutContract = async (w: World) => {
    const res = await api.call('POST', '/api/v1/hr/employees', { ...w.hr, body: { lastName: `Neuf-${unique()}`, firstName: 'Nina', jobTitle: 'Poste', department: 'Commercial', hiredOn: '2020-01-01' } });
    return res.body.id as string;
  };

  it('types de départ : CDI, CDD, Stage, Prestation, la nature (durée déterminée ou non) et aucune règle légale codée', async () => {
    const w = await world();
    const byCode = Object.fromEntries(w.types.map((x) => [x.code, x.fixedTerm]));
    expect(byCode).toMatchObject({ CDI: false, CDD: true, STAGE: true, PRESTATION: true });
    // Tout titulaire du droit de lecture les voit ; la RH seule voit les désactivés.
    expect((await api.call('GET', '/api/v1/hr/contracts/types', w.member)).status).toBe(200);
    expect((await api.call('GET', '/api/v1/hr/contracts/types?includeInactive=true', w.member)).body.every((x: { active: boolean }) => x.active)).toBe(true);
  });

  it('cycle complet : créer → ajuster → terminer, trace d’audit, contrat conservé, un nouveau contrat peut suivre', async () => {
    const w = await world();
    const employeeId = await withoutContract(w);
    const made = await create(w.hr, { employeeId, contractTypeId: w.cdd, start: '2026-02-01', end: '2026-07-31', probationEnd: '2026-03-01' });
    expect(made.status).toBe(201);
    expect(made.body).toMatchObject({ contractTypeLabel: 'Contrat à durée déterminée', fixedTerm: true, status: 'ACTIVE', end: '2026-07-31', probationEnd: '2026-03-01', endedOn: null, endReason: null, version: 1 });
    const id = made.body.id as string;

    const extended = await api.call('PUT', `/api/v1/hr/contracts/${id}`, { ...w.hr, body: { version: 1, end: '2026-12-31' } });
    expect(extended.status).toBe(200);
    expect(extended.body).toMatchObject({ end: '2026-12-31', version: 2 });
    // Version périmée : conflit.
    expect((await api.call('PUT', `/api/v1/hr/contracts/${id}`, { ...w.hr, body: { version: 1, end: '2027-01-31' } })).status).toBe(409);

    const ended = await api.call('POST', `/api/v1/hr/contracts/${id}/end`, { ...w.hr, body: { version: 2, endedOn: '2026-09-15', reason: 'RESIGNATION' } });
    expect(ended.status).toBe(200);
    expect(ended.body).toMatchObject({ status: 'ENDED', endedOn: '2026-09-15', endReason: 'RESIGNATION', endReasonLabel: 'Démission', version: 3 });
    // Un contrat terminé ne bouge plus.
    expect((await api.call('PUT', `/api/v1/hr/contracts/${id}`, { ...w.hr, body: { version: 3, end: '2027-01-31' } })).status).toBe(409);
    expect((await api.call('POST', `/api/v1/hr/contracts/${id}/end`, { ...w.hr, body: { version: 3, endedOn: '2026-09-16', reason: 'OTHER' } })).status).toBe(409);
    // Il reste lisible, et un nouveau contrat peut suivre.
    expect((await api.call('GET', `/api/v1/hr/contracts/${id}`, w.hr)).body.status).toBe('ENDED');
    const next = await create(w.hr, { employeeId, contractTypeId: w.cdi, start: '2026-09-16' });
    expect(next.status).toBe(201);
    const list = await api.call('GET', `/api/v1/hr/contracts?employeeId=${employeeId}`, w.hr);
    expect(list.body.items.map((c: { status: string }) => c.status)).toEqual(['ACTIVE', 'ENDED']);

    const logs = await t.prisma.db.auditLog.findMany({ where: { entityId: id }, orderBy: { createdAt: 'asc' } });
    expect(logs.map((l) => l.action)).toEqual(['CREATE', 'UPDATE', 'UPDATE']);
  });

  it('un seul contrat en cours par employé, même sous deux créations simultanées', async () => {
    const w = await world();
    const employeeId = await withoutContract(w);
    const results = await Promise.all([1, 2, 3].map((n) => create(w.hr, { employeeId, contractTypeId: w.cdi, start: `2026-0${n}-01` })));
    expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409]);
    const active = await t.prisma.db.contract.count({ where: { employeeId, status: 'ACTIVE' } });
    expect(active).toBe(1);
  }, 60_000);

  it('refus métier : fin sur un CDI, CDD sans fin, début avant l’entrée, type ou employé inconnu, motif hors liste, chevauchement', async () => {
    const w = await world();
    const employeeId = await withoutContract(w);
    expect((await create(w.hr, { employeeId, contractTypeId: w.cdi, start: '2026-02-01', end: '2026-12-31' })).status).toBe(400);
    expect((await create(w.hr, { employeeId, contractTypeId: w.cdd, start: '2026-02-01' })).status).toBe(400);
    expect((await create(w.hr, { employeeId, contractTypeId: w.cdi, start: '2019-12-31' })).status).toBe(400);
    expect((await create(w.hr, { employeeId, contractTypeId: NIL, start: '2026-02-01' })).status).toBe(400);
    expect((await create(w.hr, { employeeId: NIL, contractTypeId: w.cdi, start: '2026-02-01' })).status).toBe(404);
    expect((await create(w.hr, { employeeId, contractTypeId: w.cdi, start: '2026-02-30' })).status).toBe(400);
    const first = await create(w.hr, { employeeId, contractTypeId: w.cdd, start: '2026-02-01', end: '2026-06-30' });
    expect(first.status).toBe(201);
    expect((await api.call('POST', `/api/v1/hr/contracts/${first.body.id}/end`, { ...w.hr, body: { version: 1, endedOn: '2026-05-01', reason: 'Licenciement pour faute' } })).status).toBe(400);
    expect((await api.call('POST', `/api/v1/hr/contracts/${first.body.id}/end`, { ...w.hr, body: { version: 1, endedOn: '2026-07-01', reason: 'OTHER' } })).status).toBe(400);
    expect((await api.call('POST', `/api/v1/hr/contracts/${first.body.id}/end`, { ...w.hr, body: { version: 1, endedOn: '2026-05-01', reason: 'MISSION_END' } })).status).toBe(200);
    expect((await create(w.hr, { employeeId, contractTypeId: w.cdi, start: '2026-04-01' })).status).toBe(409);
    expect((await create(w.hr, { employeeId, contractTypeId: w.cdi, start: '2026-05-02' })).status).toBe(201);
  });

  it('droits : la RH gère, la Direction lit tout, l’employé lit le sien, le responsable et les tiers ne voient rien', async () => {
    const w = await world();
    const mine = await create(w.hr, { employeeId: w.memberEmp.id, contractTypeId: w.cdi, start: '2026-01-05' });
    const theirs = await create(w.hr, { employeeId: w.bossEmp.id, contractTypeId: w.cdi, start: '2026-01-05' });
    expect([mine.status, theirs.status]).toEqual([201, 201]);
    // Écriture : la RH seulement (403 pour tous les autres, y compris la Direction).
    for (const as of [w.dir, w.boss, w.member, w.stranger]) {
      expect((await create(as, { employeeId: w.strangerEmp.id, contractTypeId: w.cdi, start: '2026-01-05' })).status).toBe(403);
      expect((await api.call('PUT', `/api/v1/hr/contracts/${mine.body.id}`, { ...as, body: { version: 1, probationEnd: '2026-02-01' } })).status).toBe(403);
      expect((await api.call('POST', `/api/v1/hr/contracts/${mine.body.id}/end`, { ...as, body: { version: 1, endedOn: '2026-03-01', reason: 'OTHER' } })).status).toBe(403);
      expect((await api.call('POST', '/api/v1/hr/contracts/types', { ...as, body: { code: `X${unique().toUpperCase()}`, label: 'X', fixedTerm: false } })).status).toBe(403);
    }
    // Lecture : la RH et la Direction voient tout ; l'employé voit le sien seulement ; le responsable et les tiers, rien.
    for (const as of [w.hr, w.dir]) {
      expect((await api.call('GET', `/api/v1/hr/contracts/${mine.body.id}`, as)).status).toBe(200);
      expect((await api.call('GET', `/api/v1/hr/contracts/${theirs.body.id}`, as)).status).toBe(200);
    }
    expect((await api.call('GET', `/api/v1/hr/contracts/${mine.body.id}`, w.member)).status).toBe(200);
    for (const [as, id] of [[w.member, theirs.body.id], [w.boss, mine.body.id], [w.stranger, mine.body.id], [w.boss, NIL]] as [As, string][]) {
      expect((await api.call('GET', `/api/v1/hr/contracts/${id}`, as)).status).toBe(404);
    }
    const own = await api.call('GET', '/api/v1/hr/contracts', w.member);
    expect(own.body.items.map((c: { id: string }) => c.id)).toEqual([mine.body.id]);
    expect((await api.call('GET', '/api/v1/hr/contracts', w.boss)).body.items.map((c: { id: string }) => c.id)).toEqual([theirs.body.id]); // le sien, jamais celui de son équipe
    expect((await api.call('GET', `/api/v1/hr/contracts?employeeId=${w.bossEmp.id}`, w.member)).status).toBe(404);
    expect((await api.call('GET', '/api/v1/hr/contracts', w.dir)).body.total).toBeGreaterThanOrEqual(2);
    // Sans jeton : refusé.
    expect((await api.call('GET', '/api/v1/hr/contracts', {})).status).toBe(401);
  });

  it('échéances : fin de contrat et fin d’essai dans la fenêtre, réservées à la RH et à la Direction', async () => {
    const w = await world();
    const employeeId = await withoutContract(w);
    const soon = addDays(today(), 20);
    const made = await create(w.hr, { employeeId, contractTypeId: w.cdd, start: addDays(today(), -100), end: addDays(today(), 50), probationEnd: soon });
    expect(made.status).toBe(201);
    const rows = (await api.call('GET', '/api/v1/hr/contracts/deadlines', w.hr)).body as { contractId: string; kind: string; date: string; daysLeft: number }[];
    expect(rows.filter((r) => r.contractId === made.body.id).map((r) => [r.kind, r.date, r.daysLeft])).toEqual([['PROBATION_END', soon, 20], ['CONTRACT_END', addDays(today(), 50), 50]]);
    const narrow = (await api.call('GET', '/api/v1/hr/contracts/deadlines?days=30', w.dir)).body as { contractId: string; kind: string }[];
    expect(narrow.filter((r) => r.contractId === made.body.id).map((r) => r.kind)).toEqual(['PROBATION_END']);
    for (const as of [w.member, w.boss, w.stranger]) expect((await api.call('GET', '/api/v1/hr/contracts/deadlines', as)).status).toBe(403);
    expect((await api.call('GET', '/api/v1/hr/contracts/deadlines?days=366', w.hr)).status).toBe(400);
    expect((await api.call('GET', '/api/v1/hr/contracts/deadlines?days=0', w.hr)).status).toBe(400);
  });

  it('paramétrage : la RH crée un type, le désactive ; un contrat garde son libellé ; code déjà pris refusé', async () => {
    const w = await world();
    const code = `T${unique().toUpperCase()}`;
    const type = await api.call('POST', '/api/v1/hr/contracts/types', { ...w.hr, body: { code, label: 'Apprentissage', fixedTerm: true } });
    expect(type.status).toBe(201);
    expect(type.body).toMatchObject({ code, fixedTerm: true, active: true, version: 1 });
    expect((await api.call('POST', '/api/v1/hr/contracts/types', { ...w.hr, body: { code, label: 'Doublon', fixedTerm: true } })).status).toBe(409);
    expect((await api.call('POST', '/api/v1/hr/contracts/types', { ...w.hr, body: { code: 'x-1', label: 'Mal formé', fixedTerm: true } })).status).toBe(400);
    const employeeId = await withoutContract(w);
    const contract = await create(w.hr, { employeeId, contractTypeId: type.body.id, start: '2026-02-01', end: '2026-12-31' });
    expect(contract.status).toBe(201);
    const off = await api.call('PUT', `/api/v1/hr/contracts/types/${type.body.id}`, { ...w.hr, body: { version: 1, active: false } });
    expect(off.body).toMatchObject({ active: false, version: 2 });
    expect((await api.call('PUT', `/api/v1/hr/contracts/types/${type.body.id}`, { ...w.hr, body: { version: 1, label: 'Périmé' } })).status).toBe(409);
    expect((await api.call('GET', `/api/v1/hr/contracts/${contract.body.id}`, w.hr)).body.contractTypeLabel).toBe('Apprentissage');
    expect((await api.call('GET', '/api/v1/hr/contracts/types', w.hr)).body.map((x: { code: string }) => x.code)).not.toContain(code);
    expect((await api.call('GET', '/api/v1/hr/contracts/types?includeInactive=true', w.hr)).body.map((x: { code: string }) => x.code)).toContain(code);
    // Un type désactivé n'accepte plus de nouveau contrat.
    const other = await withoutContract(w);
    expect((await create(w.hr, { employeeId: other, contractTypeId: type.body.id, start: '2026-02-01', end: '2026-12-31' })).status).toBe(400);
  });

  it('aucun salaire, aucun document : ni colonne en base, ni champ dans l’API', async () => {
    const w = await world();
    const made = await create(w.hr, { employeeId: await withoutContract(w), contractTypeId: w.cdi, start: '2026-02-01' });
    expect(Object.keys(made.body).sort()).toEqual(['contractTypeId', 'contractTypeLabel', 'createdAt', 'employeeId', 'employeeName', 'end', 'endReason', 'endReasonLabel', 'endedOn', 'fixedTerm', 'id', 'probationEnd', 'start', 'status', 'version']);
    const columns = await t.prisma.db.$queryRawUnsafe<{ column_name: string }[]>(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'hr' AND table_name = 'contracts'`);
    expect(columns.map((c) => c.column_name).join()).not.toMatch(/salary|salaire|amount|document|file|note|comment/i);
  });

  describe('règles garanties par la base, quoi que fasse l’application', () => {
    const insert = async (employee: string, type: string, cols: Record<string, string>) => {
      const all = { id: 'gen_random_uuid()', employee_id: `'${employee}'::uuid`, contract_type_id: `'${type}'::uuid`, start_date: `'2026-02-01'`, updated_at: 'now()', ...cols };
      return t.prisma.db.$executeRawUnsafe(`INSERT INTO hr.contracts (${Object.keys(all).join(', ')}) VALUES (${Object.values(all).join(', ')})`);
    };

    it('un seul contrat en cours par employé (index partiel), plusieurs terminés permis', async () => {
      const w = await world();
      const employee = await withoutContract(w);
      await expect(insert(employee, w.cdi, {})).resolves.toBeDefined();
      await expect(insert(employee, w.cdi, {})).rejects.toThrow();
      await expect(insert(employee, w.cdi, { status: `'ENDED'`, ended_on: `'2026-03-01'`, end_reason: `'OTHER'`, start_date: `'2025-01-01'` })).resolves.toBeDefined();
      await expect(insert(employee, w.cdi, { status: `'ENDED'`, ended_on: `'2025-06-01'`, end_reason: `'OTHER'`, start_date: `'2024-01-01'` })).resolves.toBeDefined();
    });

    it('dates et état cohérents : fin avant début, essai hors contrat, terminé sans motif, en cours avec motif, fin effective hors bornes', async () => {
      const w = await world();
      const e = () => withoutContract(w);
      await expect(insert(await e(), w.cdd, { end_date: `'2026-01-01'` })).rejects.toThrow();
      await expect(insert(await e(), w.cdd, { end_date: `'2026-06-01'`, probation_end_date: `'2026-07-01'` })).rejects.toThrow();
      await expect(insert(await e(), w.cdd, { probation_end_date: `'2026-01-01'` })).rejects.toThrow();
      await expect(insert(await e(), w.cdi, { status: `'ENDED'`, ended_on: `'2026-03-01'` })).rejects.toThrow();
      await expect(insert(await e(), w.cdi, { status: `'ENDED'`, end_reason: `'OTHER'` })).rejects.toThrow();
      await expect(insert(await e(), w.cdi, { end_reason: `'OTHER'` })).rejects.toThrow();
      await expect(insert(await e(), w.cdi, { ended_on: `'2026-03-01'` })).rejects.toThrow();
      await expect(insert(await e(), w.cdi, { status: `'ENDED'`, ended_on: `'2026-01-01'`, end_reason: `'OTHER'` })).rejects.toThrow();
      await expect(insert(await e(), w.cdd, { end_date: `'2026-06-01'`, status: `'ENDED'`, ended_on: `'2026-07-01'`, end_reason: `'OTHER'` })).rejects.toThrow();
      await expect(insert(await e(), w.cdi, { version: '0' })).rejects.toThrow();
      await expect(insert(await e(), w.cdi, { end_reason: `'LICENCIEMENT'` })).rejects.toThrow();
    });

    it('types : code bien formé, libellé non vide, ordre borné, code unique ; jamais de suppression d’un type ou d’un employé qui a des contrats', async () => {
      const w = await world();
      const type = (code: string, label: string, order = '0') => t.prisma.db.$executeRawUnsafe(`INSERT INTO hr.contract_types (id, code, label, sort_order, updated_at) VALUES (gen_random_uuid(), '${code}', '${label}', ${order}, now())`);
      await expect(type('bad code', 'X')).rejects.toThrow();
      await expect(type('abc', 'X')).rejects.toThrow();
      await expect(type(`OK${unique().toUpperCase()}`, '   ')).rejects.toThrow();
      await expect(type(`OK${unique().toUpperCase()}`, 'X', '10001')).rejects.toThrow();
      await expect(type('CDI', 'Doublon')).rejects.toThrow();
      const employee = await withoutContract(w);
      await insert(employee, w.cdi, {});
      await expect(t.prisma.db.$executeRawUnsafe(`DELETE FROM hr.contract_types WHERE id = '${w.cdi}'::uuid`)).rejects.toThrow();
      await expect(t.prisma.db.$executeRawUnsafe(`DELETE FROM hr.employees WHERE id = '${employee}'::uuid`)).rejects.toThrow();
    });
  });
});
