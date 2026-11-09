import 'reflect-metadata';
import { RoleCode } from '../src/modules/iam/domain/roles';
import { Api, createUserWithRoles, mfaSession, startRbacApp } from './support/rbac-http';
import { TestApp } from './support/test-app';

const describeDb = process.env.DATABASE_URL && process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;
const NIL = '00000000-0000-4000-8000-000000000000';

/** RH-1a : personnel de bout en bout (HTTP + PostgreSQL) : création, droits et portée, annuaire restreint, hiérarchie, écarts, archivage, règles de la base, audit. */
describeDb('Personnel (HTTP + PostgreSQL)', () => {
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
    return { token: session.token, ip: addr, sessionId: session.sessionId as string };
  };
  const unique = () => Math.random().toString(36).slice(2, 8);
  type As = { token: string; ip: string; sessionId?: string };

  async function world() {
    const hrUser = await createUserWithRoles(t, [RoleCode.Hr]);
    const dirUser = await createUserWithRoles(t, [RoleCode.Direction]);
    const chefUser = await createUserWithRoles(t, [RoleCode.HeadOfSales]);
    const amUser = await createUserWithRoles(t, [RoleCode.AccountManager], { managerId: chefUser.id });
    const otherUser = await createUserWithRoles(t, [RoleCode.AccountManager]);
    const supportUser = await createUserWithRoles(t, [RoleCode.Support]);
    const [hr, dir, chef, am, other, support] = [await login(hrUser), await login(dirUser), await login(chefUser), await login(amUser), await login(otherUser), await login(supportUser)];
    return { hr, dir, chef, am, other, support, hrUser, chefUser, amUser, otherUser };
  }
  const create = (as: As, extra: Record<string, unknown> = {}) =>
    api.call('POST', '/api/v1/hr/employees', { ...as, body: { lastName: `Ndzana${unique()}`, firstName: 'Claire', jobTitle: 'Chargée de compte', department: 'Commercial', hiredOn: '2026-03-02', ...extra } });
  const update = (as: As, id: string, body: Record<string, unknown>) => api.call('PUT', `/api/v1/hr/employees/${id}`, { ...as, body });
  const setStatus = (as: As, id: string, body: Record<string, unknown>) => api.call('POST', `/api/v1/hr/employees/${id}/status`, { ...as, body });
  const get = (as: As, id: string) => api.call('GET', `/api/v1/hr/employees/${id}`, as);

  it('cycle : la RH crée, lit, modifie ; version, responsable et compte lié suivent ; e-mail et matricule normalisés', async () => {
    const { hr, amUser } = await world();
    const boss = await create(hr, { lastName: `Boss${unique()}` });
    expect(boss.status).toBe(201);
    const email = `Claire.${unique()}@Investally.TEST`;
    const e = await create(hr, { matricule: ` inv-${unique()} `, workEmail: email, workPhone: '+237 699 00 11 22', managerEmployeeId: boss.body.id, userId: amUser.id });
    expect(e.status).toBe(201);
    expect(e.body).toMatchObject({ status: 'ACTIVE', version: 1, workEmail: email.toLowerCase(), workPhone: '+237699001122', managerEmployeeId: boss.body.id, userId: amUser.id, hiredOn: '2026-03-02' });
    expect(e.body.matricule).toBe(e.body.matricule.toUpperCase());
    expect(e.body.managerName).toContain('Boss');
    const edited = await update(hr, e.body.id, { version: 1, jobTitle: 'Responsable', workPhone: '', managerEmployeeId: null });
    expect(edited.status).toBe(200);
    expect(edited.body).toMatchObject({ jobTitle: 'Responsable', workPhone: null, managerEmployeeId: null, managerName: null, version: 2 });
    expect((await update(hr, e.body.id, { version: 1, jobTitle: 'Périmé' })).status).toBe(409);
  });

  it('refus : champ inconnu ou sensible (400), date irréelle, identifiant mal écrit, responsable ou compte inconnu, boucle, doublon de matricule, e-mail et compte (409)', async () => {
    const { hr, amUser } = await world();
    const a = await create(hr, { matricule: `M${unique()}`, workEmail: `a.${unique()}@investally.test`, userId: amUser.id });
    expect(a.status).toBe(201);
    for (const sensitive of [{ salary: 1000000 }, { birthDate: '1990-01-01' }, { homeAddress: 'Rue 1' }, { nationalId: 'X' }]) expect((await create(hr, sensitive)).status).toBe(400);
    expect((await create(hr, { hiredOn: '2026-02-31' })).status).toBe(400);
    expect((await create(hr, { hiredOn: 'hier' })).status).toBe(400);
    expect((await create(hr, { lastName: '' })).status).toBe(400);
    expect((await create(hr, { managerEmployeeId: 'pas-un-uuid' })).status).toBe(400);
    expect((await create(hr, { managerEmployeeId: NIL })).status).toBe(404);
    expect((await create(hr, { userId: NIL })).status).toBe(404);
    expect((await create(hr, { matricule: a.body.matricule.toLowerCase() })).status).toBe(409);
    expect((await create(hr, { workEmail: a.body.workEmail.toUpperCase() })).status).toBe(409);
    expect((await create(hr, { userId: amUser.id })).status).toBe(409);
    expect((await create(hr, { matricule: 'a b' })).status).toBe(400);
    const b = await create(hr, { managerEmployeeId: a.body.id });
    expect((await update(hr, a.body.id, { version: 1, managerEmployeeId: b.body.id })).status).toBe(400);
    expect((await update(hr, a.body.id, { version: 1, managerEmployeeId: a.body.id })).status).toBe(400);
  });

  it('droits et portée : la RH et la Direction voient tout ; le chef son équipe ; le chargé de compte lui-même ; le Support personne ; seule la RH écrit', async () => {
    const { hr, dir, chef, am, other, support, amUser } = await world();
    const mine = await create(hr, { userId: amUser.id });
    const foreign = await create(hr);
    const names = async (as: As) => (await api.call('GET', '/api/v1/hr/employees?pageSize=100', as)).body.items.map((i: { id: string }) => i.id);
    expect(await names(hr)).toEqual(expect.arrayContaining([mine.body.id, foreign.body.id]));
    expect(await names(dir)).toEqual(expect.arrayContaining([mine.body.id, foreign.body.id]));
    expect(await names(chef)).toContain(mine.body.id);
    expect(await names(chef)).not.toContain(foreign.body.id);
    expect(await names(am)).toEqual([mine.body.id]);
    expect(await names(other)).toEqual([]);
    expect(await names(support)).toEqual([]);
    expect((await get(am, mine.body.id)).status).toBe(200);
    for (const who of [am, other, support, chef]) expect((await get(who, foreign.body.id)).status).toBe(404);
    expect((await get(am, NIL)).status).toBe(404);
    for (const who of [dir, chef, am, other, support]) {
      expect((await create(who)).status).toBe(403);
      expect([403, 404]).toContain((await update(who, mine.body.id, { version: 1, jobTitle: 'Piraté' })).status);
      expect([403, 404]).toContain((await setStatus(who, mine.body.id, { version: 1, status: 'ARCHIVED' })).status);
    }
    expect((await get(hr, mine.body.id)).body.jobTitle).toBe('Chargée de compte');
  });

  it('annuaire restreint et organigramme : tout utilisateur authentifié lit les actifs, champs professionnels seulement ; les archivés disparaissent', async () => {
    const { hr, support } = await world();
    const tag = unique();
    const kept = await create(hr, { lastName: `Annuaire${tag}`, workEmail: `d.${tag}@investally.test`, matricule: `D${tag}` });
    const gone = await create(hr, { lastName: `Annuaire${tag}Sorti`, hiredOn: '2020-01-01' });
    expect((await setStatus(hr, gone.body.id, { version: 1, status: 'ARCHIVED', leftOn: '2026-06-30' })).status).toBe(200);
    const dir = await api.call('GET', `/api/v1/hr/directory?search=Annuaire${tag}`, support);
    expect(dir.status).toBe(200);
    expect(dir.body.items.map((i: { id: string }) => i.id)).toEqual([kept.body.id]);
    expect(Object.keys(dir.body.items[0]).sort()).toEqual(['department', 'firstName', 'id', 'jobTitle', 'lastName', 'managerEmployeeId', 'workEmail', 'workPhone']);
    expect(JSON.stringify(dir.body)).not.toContain('matricule');
    const chart = await api.call('GET', '/api/v1/hr/org-chart', support);
    expect(chart.status).toBe(200);
    expect(chart.body.map((i: { id: string }) => i.id)).toContain(kept.body.id);
    expect(chart.body.map((i: { id: string }) => i.id)).not.toContain(gone.body.id);
    expect((await api.call('GET', '/api/v1/hr/directory?pageSize=5000', support)).status).toBe(400);
  });

  it('archivage réversible : sortie datée et motivée, gelé, absent de l’annuaire, réactivable ; un responsable avec des collaborateurs ne s’archive pas', async () => {
    const { hr } = await world();
    const boss = await create(hr, { lastName: `Boss${unique()}` });
    const member = await create(hr, { managerEmployeeId: boss.body.id });
    expect((await setStatus(hr, boss.body.id, { version: 1, status: 'ARCHIVED' })).status).toBe(422);
    const out = await setStatus(hr, member.body.id, { version: 1, status: 'ARCHIVED', leftOn: '2026-11-30', reason: '  Fin de contrat ' });
    expect(out.status).toBe(200);
    expect(out.body).toMatchObject({ status: 'ARCHIVED', leftOn: '2026-11-30', archiveReason: 'Fin de contrat', version: 2 });
    expect(typeof out.body.archivedAt).toBe('string');
    expect((await update(hr, member.body.id, { version: 2, jobTitle: 'Autre' })).status).toBe(409);
    expect((await setStatus(hr, member.body.id, { version: 2, status: 'ARCHIVED' })).status).toBe(409);
    expect((await setStatus(hr, member.body.id, { version: 2, status: 'DELETED' })).status).toBe(400);
    expect((await setStatus(hr, member.body.id, { version: 2, status: 'ARCHIVED', unknown: true })).status).toBe(400);
    const back = await setStatus(hr, member.body.id, { version: 2, status: 'ACTIVE' });
    expect(back.body).toMatchObject({ status: 'ACTIVE', leftOn: null, archiveReason: null, archivedAt: null, version: 3 });
    expect((await update(hr, member.body.id, { version: 3, jobTitle: 'Autre' })).status).toBe(200);
    expect((await setStatus(hr, member.body.id, { version: 4, status: 'ARCHIVED', leftOn: '2020-01-01' })).status).toBe(400);
  });

  it('écarts avec la hiérarchie des comptes : signalés à la RH et à la Direction seulement, jamais corrigés', async () => {
    const { hr, dir, chef, am, chefUser, amUser, otherUser } = await world();
    const boss = await create(hr, { lastName: `Boss${unique()}`, userId: otherUser.id });
    const member = await create(hr, { lastName: `Membre${unique()}`, userId: amUser.id, managerEmployeeId: boss.body.id });
    // Le compte du membre a pour responsable le Responsable commercial (chefUser), pas le compte du responsable RH (otherUser) : écart.
    const gaps = await api.call('GET', '/api/v1/hr/employees/hierarchy-gaps', hr);
    expect(gaps.status).toBe(200);
    const mine = gaps.body.find((g: { employeeId: string }) => g.employeeId === member.body.id);
    expect(mine).toMatchObject({ employeeName: expect.stringContaining('Membre'), hrManagerName: expect.stringContaining('Boss') });
    expect((await api.call('GET', '/api/v1/hr/employees/hierarchy-gaps', dir)).status).toBe(200);
    for (const who of [chef, am]) expect(who && (await api.call('GET', '/api/v1/hr/employees/hierarchy-gaps', who)).status).toBe(403);
    // La hiérarchie des comptes n'a pas bougé.
    const account = await t.prisma.db.user.findUniqueOrThrow({ where: { id: amUser.id }, select: { managerId: true } });
    expect(account.managerId).toBe(chefUser.id);
  });

  it('règles garanties par la base : noms non vides, version positive, pas son propre responsable, sortie après entrée, état cohérent, unicités, pas de clé vers un autre schéma', async () => {
    const { hr, amUser } = await world();
    const a = await create(hr, { matricule: `B${unique()}`, workEmail: `b.${unique()}@investally.test`, userId: amUser.id });
    const b = await create(hr);
    const db = t.prisma.db;
    const sql = (q: string) => expect(db.$executeRawUnsafe(q)).rejects.toThrow();
    await sql(`UPDATE hr.employees SET last_name = '   ' WHERE id = '${b.body.id}'::uuid`);
    await sql(`UPDATE hr.employees SET job_title = '' WHERE id = '${b.body.id}'::uuid`);
    await sql(`UPDATE hr.employees SET version = 0 WHERE id = '${b.body.id}'::uuid`);
    await sql(`UPDATE hr.employees SET manager_employee_id = id WHERE id = '${b.body.id}'::uuid`);
    await sql(`UPDATE hr.employees SET manager_employee_id = '${NIL}'::uuid WHERE id = '${b.body.id}'::uuid`);
    await sql(`UPDATE hr.employees SET status = 'ARCHIVED' WHERE id = '${b.body.id}'::uuid`);
    await sql(`UPDATE hr.employees SET archive_reason = 'x' WHERE id = '${b.body.id}'::uuid`);
    await sql(`UPDATE hr.employees SET status = 'ARCHIVED', archived_at = now(), left_on = '2000-01-01' WHERE id = '${b.body.id}'::uuid`);
    await sql(`UPDATE hr.employees SET matricule = lower('${a.body.matricule}') WHERE id = '${b.body.id}'::uuid`);
    await sql(`UPDATE hr.employees SET work_email = upper('${a.body.workEmail}') WHERE id = '${b.body.id}'::uuid`);
    await sql(`UPDATE hr.employees SET user_id = '${amUser.id}'::uuid WHERE id = '${b.body.id}'::uuid`);
    // Un responsable qui a des collaborateurs ne se supprime pas physiquement.
    const boss = await create(hr);
    await create(hr, { managerEmployeeId: boss.body.id });
    await expect(db.employee.delete({ where: { id: boss.body.id } })).rejects.toThrow();
    // Aucune clé étrangère ne quitte le schéma « hr ».
    const crossing = await db.$queryRaw<{ constraint: string }[]>`
      SELECT con.conname AS constraint FROM pg_constraint con
      JOIN pg_class src ON src.oid = con.conrelid JOIN pg_class dst ON dst.oid = con.confrelid
      WHERE con.contype = 'f' AND src.relnamespace <> dst.relnamespace AND src.relnamespace = 'hr'::regnamespace`;
    expect(crossing).toEqual([]);
  }, 120_000);

  it('verrou optimiste AU NIVEAU DE LA BASE : deux modifications sur la même version, la seconde est refusée', async () => {
    const { hr } = await world();
    const e = await create(hr);
    const results = await Promise.all([update(hr, e.body.id, { version: 1, jobTitle: 'Poste A' }), update(hr, e.body.id, { version: 1, jobTitle: 'Poste B' })]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await get(hr, e.body.id)).body.version).toBe(2);
  }, 120_000);

  it('audit : création, modification et archivage tracés avec l’ancienne et la nouvelle valeur ; chaque lecture détaillée est tracée', async () => {
    const { hr } = await world();
    const e = await create(hr);
    await update(hr, e.body.id, { version: 1, jobTitle: 'Tracé' });
    await setStatus(hr, e.body.id, { version: 2, status: 'ARCHIVED', reason: 'Test' });
    await get(hr, e.body.id);
    await get(hr, e.body.id);
    const logs = await t.prisma.db.auditLog.findMany({ where: { entityId: e.body.id }, orderBy: { createdAt: 'asc' } });
    expect(logs.map((l) => l.action)).toEqual(['CREATE', 'UPDATE', 'UPDATE', 'VIEW', 'VIEW']);
    expect(logs[0]!.sessionId).toBe(hr.sessionId);
    expect((logs[1]!.oldValue as { jobTitle: string }).jobTitle).toBe('Chargée de compte');
    expect((logs[1]!.newValue as { jobTitle: string }).jobTitle).toBe('Tracé');
    expect([(logs[2]!.oldValue as { status: string }).status, (logs[2]!.newValue as { status: string }).status]).toEqual(['ACTIVE', 'ARCHIVED']);
    expect(logs.every((l) => l.module === 'hr')).toBe(true);
  }, 120_000);
});
