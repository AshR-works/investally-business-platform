import 'reflect-metadata';
import { PresenceDeclaration } from '../src/modules/hr/domain/presence';
import { PrismaPresenceRepository } from '../src/modules/hr/infrastructure/prisma-presence.repository';
import { RoleCode } from '../src/modules/iam/domain/roles';
import { Api, createUserWithRoles, mfaSession, startRbacApp } from './support/rbac-http';
import { TestApp } from './support/test-app';

const describeDb = process.env.DATABASE_URL && process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;
const NIL = '00000000-0000-4000-8000-000000000000';
const addDays = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const today = () => new Date().toISOString().slice(0, 10);
/** Le prochain lundi (jamais aujourd'hui) : un jour ouvré, pour qu'une demande d'absence décompte au moins un jour. */
function monday(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7));
  return d.toISOString().slice(0, 10);
}

/**
 * RH-4a : présences déclaratives de bout en bout (HTTP + PostgreSQL) : déclarer, changer, retirer, fenêtre de saisie, absence validée, droits et portée (soi,
 * subordonnés directs, tous), tableau, unicité garantie par la base, audit. Aucune heure, aucun lieu, aucun texte libre.
 */
describeDb('Présences déclaratives (HTTP + PostgreSQL)', () => {
  let t: TestApp;
  let api: Api;
  let seq = 0;
  const ip = () => `10.98.${Math.floor(seq / 250)}.${(seq++ % 250) + 1}`;

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
    const peerUser = await createUserWithRoles(t, [RoleCode.AccountManager]);
    const strangerUser = await createUserWithRoles(t, [RoleCode.Support]);
    const [hr, dir, boss, member, peer, stranger] = [await login(hrUser), await login(dirUser), await login(bossUser), await login(memberUser), await login(peerUser), await login(strangerUser)];
    const employee = async (name: string, userId: string | null, managerEmployeeId: string | null) => {
      const res = await api.call('POST', '/api/v1/hr/employees', {
        ...hr, body: { lastName: `${name}-${unique()}`, firstName: name, jobTitle: 'Poste', department: 'Commercial', hiredOn: '2026-01-05', ...(userId ? { userId } : {}), ...(managerEmployeeId ? { managerEmployeeId } : {}) },
      });
      expect(res.status).toBe(201);
      return res.body as { id: string };
    };
    const bossEmp = await employee('Bruno', bossUser.id, null);
    const memberEmp = await employee('Marie', memberUser.id, bossEmp.id);
    const peerEmp = await employee('Paul', peerUser.id, null);
    return { hr, dir, boss, member, peer, stranger, bossEmp, memberEmp, peerEmp, hrUser, employee };
  }
  type World = Awaited<ReturnType<typeof world>>;

  const put = (as: As, day: string, mode: string, employeeId?: string) => api.call('PUT', `/api/v1/hr/presences/${day}${employeeId ? `?employeeId=${employeeId}` : ''}`, { ...as, body: { mode } });
  const del = (as: As, day: string, employeeId?: string) => api.call('DELETE', `/api/v1/hr/presences/${day}${employeeId ? `?employeeId=${employeeId}` : ''}`, as);
  const board = (as: As, from = addDays(today(), -3), to = addDays(today(), 3), extra = '') => api.call('GET', `/api/v1/hr/presences?from=${from}&to=${to}${extra}`, as);

  it('cycle complet : déclarer → changer → idempotent → retirer ; tout est audité, rien d’autre n’est stocké', async () => {
    const w = await world();
    const day = today();
    const created = await put(w.member, day, 'REMOTE');
    expect(created.status).toBe(200);
    expect(created.body).toMatchObject({ employeeId: w.memberEmp.id, day, mode: 'REMOTE', enteredByOther: false });
    expect(Object.keys(created.body).sort()).toEqual(['day', 'employeeId', 'employeeName', 'enteredByOther', 'id', 'mode', 'updatedAt']);
    const again = await put(w.member, day, 'REMOTE');
    expect(again.body.id).toBe(created.body.id);
    const changed = await put(w.member, day, 'TRAVEL');
    expect(changed.body).toMatchObject({ id: created.body.id, mode: 'TRAVEL' });
    expect((await del(w.member, day)).status).toBe(204);
    expect((await del(w.member, day)).status).toBe(404);
    const logs = await t.prisma.db.auditLog.findMany({ where: { entityId: created.body.id }, orderBy: { createdAt: 'asc' } });
    expect(logs.map((l) => l.action)).toEqual(['CREATE', 'UPDATE', 'DELETE']);
    expect(await t.prisma.db.presenceDeclaration.count({ where: { id: created.body.id } })).toBe(0);
  });

  it('la RH déclare et retire pour un autre ; un collègue, un responsable et la Direction ne le peuvent pas (introuvable)', async () => {
    const w = await world();
    const day = today();
    const byHr = await put(w.hr, day, 'ON_SITE', w.memberEmp.id);
    expect(byHr.status).toBe(200);
    expect(byHr.body).toMatchObject({ employeeId: w.memberEmp.id, enteredByOther: true });
    for (const as of [w.peer, w.boss, w.dir, w.stranger]) {
      expect([(await put(as, day, 'REMOTE', w.memberEmp.id)).status, (await del(as, day, w.memberEmp.id)).status]).toEqual([404, 404]);
    }
    expect(await t.prisma.db.presenceDeclaration.count({ where: { employeeId: w.memberEmp.id } })).toBe(1);
    expect((await del(w.hr, day, w.memberEmp.id)).status).toBe(204);
    expect((await put(w.hr, day, 'REMOTE', NIL)).status).toBe(404);
  });

  it('un compte sans fiche employé est invité à demander à la RH de la relier', async () => {
    const w = await world();
    const res = await put(w.stranger, today(), 'REMOTE');
    expect(res.status).toBe(400);
    expect(res.body.detail).toMatch(/fiche employé/);
  });

  it('refuse un mode inconnu, un jour invalide, un champ en trop ; aucune heure ni lieu acceptés', async () => {
    const w = await world();
    expect((await put(w.member, today(), 'HEURES')).status).toBe(400);
    expect((await put(w.member, '2026-02-30', 'REMOTE')).status).toBe(400);
    expect((await put(w.member, 'demain', 'REMOTE')).status).toBe(400);
    expect((await api.call('PUT', `/api/v1/hr/presences/${today()}`, { ...w.member, body: { mode: 'REMOTE', checkIn: '08:30' } })).status).toBe(400);
    expect((await api.call('PUT', `/api/v1/hr/presences/${today()}?employeeId=pas-un-uuid`, { ...w.member, body: { mode: 'REMOTE' } })).status).toBe(400);
    expect(await t.prisma.db.presenceDeclaration.count({ where: { employeeId: w.memberEmp.id } })).toBe(0);
  });

  it('fenêtre de saisie : employé 7 jours en arrière et 30 en avant ; RH 90 et 90', async () => {
    const w = await world();
    expect((await put(w.member, addDays(today(), -7), 'REMOTE')).status).toBe(200);
    expect((await put(w.member, addDays(today(), 30), 'REMOTE')).status).toBe(200);
    expect((await put(w.member, addDays(today(), -8), 'REMOTE')).status).toBe(400);
    expect((await put(w.member, addDays(today(), 31), 'REMOTE')).status).toBe(400);
    expect((await put(w.hr, addDays(today(), -90), 'REMOTE', w.memberEmp.id)).status).toBe(200);
    expect((await put(w.hr, addDays(today(), 90), 'REMOTE', w.memberEmp.id)).status).toBe(200);
    expect((await put(w.hr, addDays(today(), -91), 'REMOTE', w.memberEmp.id)).status).toBe(400);
    expect((await put(w.hr, addDays(today(), 91), 'REMOTE', w.memberEmp.id)).status).toBe(400);
    expect((await put(w.member, '2026-01-04', 'REMOTE')).status).toBe(400);
  });

  it('une absence validée sur la journée entière interdit la déclaration ; une demande en attente non', async () => {
    const w = await world();
    const types = (await api.call('GET', '/api/v1/hr/leave/types', w.hr)).body as { id: string; code: string; requiresApproval: boolean }[];
    const annual = types.find((x) => x.code === 'ANNUAL') ?? types[0]!;
    const day = monday();
    const request = await api.call('POST', '/api/v1/hr/leave/requests', { ...w.member, body: { leaveTypeId: annual.id, start: day, end: day } });
    expect(request.status).toBe(201);
    if (request.body.status === 'PENDING') {
      expect((await put(w.member, day, 'REMOTE')).status).toBe(200);
      expect((await del(w.member, day)).status).toBe(204);
      const decided = await api.call('POST', `/api/v1/hr/leave/requests/${request.body.id}/decision`, { ...w.boss, body: { decision: 'APPROVE', version: request.body.version } });
      expect(decided.status).toBe(200);
    }
    const blocked = await put(w.member, day, 'REMOTE');
    expect(blocked.status).toBe(409);
    expect(blocked.body.detail).toMatch(/absence validée/);
    const rows = (await board(w.member, addDays(day, -1), addDays(day, 1))).body.rows as { leaveDays: string[] }[];
    expect(rows[0]!.leaveDays).toEqual([day]);
  });

  it('tableau : la RH et la Direction voient tout, le responsable sa ligne et celles de ses subordonnés directs, chacun sa ligne ; le reste est invisible', async () => {
    const w = await world();
    const day = today();
    await put(w.member, day, 'REMOTE');
    await put(w.peer, day, 'ON_SITE');
    await put(w.boss, day, 'TRAVEL');
    const names = async (as: As, extra = '') => ((await board(as, day, day, extra)).body.rows as { employeeId: string }[]).map((r) => r.employeeId);
    const everyone = await names(w.hr);
    expect(everyone).toEqual(expect.arrayContaining([w.bossEmp.id, w.memberEmp.id, w.peerEmp.id]));
    expect(await names(w.dir)).toEqual(expect.arrayContaining([w.bossEmp.id, w.memberEmp.id, w.peerEmp.id]));
    expect((await names(w.boss)).sort()).toEqual([w.bossEmp.id, w.memberEmp.id].sort());
    expect(await names(w.member)).toEqual([w.memberEmp.id]);
    expect(await names(w.peer)).toEqual([w.peerEmp.id]);
    expect(await names(w.stranger)).toEqual([]);
    const row = ((await board(w.boss, day, day)).body.rows as { employeeId: string; entries: { day: string; mode: string }[] }[]).find((r) => r.employeeId === w.memberEmp.id)!;
    expect(row.entries).toEqual([{ day, mode: 'REMOTE' }]);
    expect((await board(w.boss, day, day)).body).toMatchObject({ viewerEmployeeId: w.bossEmp.id, canDeclareForAll: false });
    expect((await board(w.hr, day, day)).body.canDeclareForAll).toBe(true);
    expect(await names(w.hr, '&department=introuvable')).toEqual([]);
  });

  it('tableau : période bornée à 93 jours, dates valides', async () => {
    const w = await world();
    expect((await board(w.hr, '2026-01-01', '2026-04-03')).status).toBe(200);
    expect((await board(w.hr, '2026-01-01', '2026-04-04')).status).toBe(400);
    expect((await board(w.hr, '2026-11-15', '2026-11-09')).status).toBe(400);
    expect((await api.call('GET', '/api/v1/hr/presences', w.hr)).status).toBe(400);
  });

  it('droits : sans jeton, 401', async () => {
    expect((await api.call('GET', `/api/v1/hr/presences?from=${today()}&to=${today()}`, {})).status).toBe(401);
    expect((await api.call('PUT', `/api/v1/hr/presences/${today()}`, { body: { mode: 'REMOTE' } })).status).toBe(401);
    expect((await api.call('DELETE', `/api/v1/hr/presences/${today()}`, {})).status).toBe(401);
  });

  it('persistance : jours lus dans l’ordre, retrait d’un seul jour, dernier mode et dernier auteur gardés en base', async () => {
    const w = await world();
    const day = today();
    // Déclarés dans le désordre : le tableau les rend par jour croissant.
    expect((await put(w.member, addDays(day, 2), 'ON_SITE')).status).toBe(200);
    expect((await put(w.member, day, 'REMOTE')).status).toBe(200);
    expect((await put(w.member, addDays(day, 1), 'TRAVEL')).status).toBe(200);
    const row = ((await board(w.member, day, addDays(day, 2))).body.rows as { entries: { day: string; mode: string }[] }[])[0]!;
    expect(row.entries).toEqual([{ day, mode: 'REMOTE' }, { day: addDays(day, 1), mode: 'TRAVEL' }, { day: addDays(day, 2), mode: 'ON_SITE' }]);
    // Retirer un jour ne touche pas aux autres.
    expect((await del(w.member, addDays(day, 1))).status).toBe(204);
    const left = await t.prisma.db.presenceDeclaration.findMany({ where: { employeeId: w.memberEmp.id }, orderBy: { day: 'asc' } });
    expect(left.map((d) => d.day.toISOString().slice(0, 10))).toEqual([day, addDays(day, 2)]);
    // La RH change le mode : la base garde le nouveau mode, le nouvel auteur et une version de plus.
    expect((await put(w.hr, day, 'TRAVEL', w.memberEmp.id)).status).toBe(200);
    const changed = await t.prisma.db.presenceDeclaration.findFirstOrThrow({ where: { employeeId: w.memberEmp.id, day: new Date(`${day}T00:00:00Z`) } });
    expect([changed.mode, changed.declaredByUserId, changed.version]).toEqual(['TRAVEL', w.hrUser.id, 2]);
    expect((await board(w.member, day, day)).body.rows[0].entries).toEqual([{ day, mode: 'TRAVEL' }]);
    expect((await put(w.member, day, 'TRAVEL')).body.enteredByOther).toBe(true);
  });

  it('le dépôt refuse une seconde déclaration du même jour par un conflit, même sans passer par le cas d’usage', async () => {
    const w = await world();
    const repo = new PrismaPresenceRepository(t.prisma);
    const first = PresenceDeclaration.declare({ id: crypto.randomUUID(), employeeId: w.memberEmp.id, day: '2030-03-04', mode: 'REMOTE', declaredByUserId: w.hrUser.id, now: new Date() });
    await repo.save(first);
    const second = PresenceDeclaration.declare({ id: crypto.randomUUID(), employeeId: w.memberEmp.id, day: '2030-03-04', mode: 'TRAVEL', declaredByUserId: w.hrUser.id, now: new Date() });
    await expect(repo.save(second)).rejects.toMatchObject({ code: 'CONFLICT', message: expect.stringMatching(/déjà déclarée/) });
    expect((await repo.find(w.memberEmp.id, '2030-03-04'))!.mode).toBe('REMOTE');
  });

  describe('règles garanties par la base, quoi que fasse l’application', () => {
    const insert = (employeeId: string, day: string, mode: string, extra = '') =>
      t.prisma.db.$executeRawUnsafe(`INSERT INTO hr.presence_declarations (id, employee_id, day, mode, declared_by_user_id, updated_at${extra ? ', version' : ''}) VALUES (gen_random_uuid(), '${employeeId}'::uuid, '${day}', '${mode}'::"hr"."PresenceMode", gen_random_uuid(), now()${extra ? `, ${extra}` : ''})`);

    it('une seule déclaration par employé et par jour', async () => {
      const w = await world();
      await insert(w.memberEmp.id, '2030-05-02', 'REMOTE');
      await expect(insert(w.memberEmp.id, '2030-05-02', 'ON_SITE')).rejects.toThrow();
      await insert(w.memberEmp.id, '2030-05-03', 'ON_SITE');
    });

    it('seuls trois modes sont possibles et la version est positive', async () => {
      const w = await world();
      await expect(insert(w.memberEmp.id, '2030-06-01', 'HOME')).rejects.toThrow();
      await expect(insert(w.memberEmp.id, '2030-06-02', 'REMOTE', '0')).rejects.toThrow();
    });

    it('l’employé d’une déclaration doit exister', async () => {
      await expect(insert(NIL, '2030-07-01', 'REMOTE')).rejects.toThrow();
    });
  });
});
