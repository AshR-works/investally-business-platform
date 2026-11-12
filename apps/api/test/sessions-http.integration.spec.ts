import 'reflect-metadata';
import { RoleCode } from '../src/modules/iam/domain/roles';
import { SESSION_REPOSITORY, SessionRepository } from '../src/modules/training/domain/session-repositories';
import { Api, createUserWithRoles, mfaSession, startRbacApp } from './support/rbac-http';
import { TestApp } from './support/test-app';

const describeDb = process.env.DATABASE_URL && process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;

const iso = (d: Date) => d.toISOString().slice(0, 10);
/** Un lundi dans `weeksAhead` semaines au moins (les tests utilisent la vraie horloge : une session ne se planifie pas dans le passé). */
function monday(weeksAhead: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + weeksAhead * 7);
  d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7));
  return iso(d);
}
const addDays = (date: string, days: number) => iso(new Date(new Date(`${date}T00:00:00Z`).getTime() + days * 86_400_000));

/** S5.2a : sessions de formation de bout en bout (HTTP + PostgreSQL) : cycle de vie, règles croisées, chevauchements, concurrence, portée du formateur, règles de la base, audit. */
describeDb('Sessions de formation (HTTP + PostgreSQL)', () => {
  let t: TestApp;
  let api: Api;
  let seq = 0;
  const ip = () => `10.98.${Math.floor(seq / 250)}.${(seq++ % 250) + 1}`;
  const unique = () => Math.random().toString(36).slice(2, 8);
  type As = { token: string; ip: string; sessionId: string };
  const created = { programs: [] as string[], modules: [] as string[], rooms: [] as string[], trainers: [] as string[], trainings: [] as string[], sessions: [] as string[] };

  beforeAll(async () => {
    ({ t, api } = await startRbacApp());
  }, 60_000);
  afterAll(async () => {
    const db = t.prisma.db;
    await db.trainingSession.deleteMany({ where: { id: { in: created.sessions } } });
    await db.trainingSession.deleteMany({ where: { OR: [{ roomId: { in: created.rooms } }, { trainerId: { in: created.trainers } }] } });
    await db.training.deleteMany({ where: { programId: { in: created.programs } } });
    await db.program.deleteMany({ where: { id: { in: created.programs } } });
    await db.courseModule.deleteMany({ where: { id: { in: created.modules } } });
    await db.room.deleteMany({ where: { id: { in: created.rooms } } });
    await db.trainer.deleteMany({ where: { id: { in: created.trainers } } });
    await t.close();
  });

  const login = async (role: RoleCode): Promise<As & { userId: string }> => {
    const user = await createUserWithRoles(t, [role]);
    const addr = ip();
    const session = await mfaSession(t, api, user.email, addr);
    return { token: session.token, ip: addr, sessionId: session.sessionId as string, userId: user.id };
  };

  /** Un monde propre à chaque test : certificat théorique et certificat à module pratique, salle avec postes (13 places utiles), salle de cours, deux formateurs. */
  async function world() {
    const manager = await login(RoleCode.TrainingManager);
    const program = await api.call('POST', '/api/v1/programs', { ...manager, body: { name: `Programme sessions ${unique()}` } });
    expect(program.status).toBe(201);
    created.programs.push(program.body.id);
    const moduleOf = async (title: string, requiresWorkstations: boolean) => {
      const m = await api.call('POST', '/api/v1/modules', { ...manager, body: { title: `${title} ${unique()}`, requiresWorkstations } });
      expect(m.status).toBe(201);
      created.modules.push(m.body.id);
      return m.body.id as string;
    };
    const magistral = await moduleOf('Fondations', false);
    const pratique = await moduleOf('Trading sur poste', true);
    const trainingOf = async (title: string, moduleIds: string[]) => {
      const tr = await api.call('POST', '/api/v1/trainings', { ...manager, body: { programId: program.body.id, title: `${title} ${unique()}`, moduleIds } });
      expect(tr.status).toBe(201);
      created.trainings.push(tr.body.id);
      return tr.body.id as string;
    };
    const theory = await trainingOf('Certificat théorique', [magistral]);
    const trading = await trainingOf('Certificat trading', [magistral, pratique]);
    const roomOf = async (kind: string, learnerSeats: number, unavailableSeats: number) => {
      const r = await api.call('POST', '/api/v1/rooms', { ...manager, body: { name: `Salle ${unique()}`, kind, learnerSeats, unavailableSeats, trainerSeats: 1 } });
      expect(r.status).toBe(201);
      created.rooms.push(r.body.id);
      return r.body.id as string;
    };
    const marches = await roomOf('WORKSTATIONS', 14, 1);
    const cours = await roomOf('CLASSROOM', 16, 0);
    const trainerUser = await login(RoleCode.Trainer);
    const internal = await api.call('POST', '/api/v1/trainers', { ...manager, body: { lastName: `Interne${unique()}`, firstName: 'Ida', userId: trainerUser.userId } });
    expect(internal.status).toBe(201);
    created.trainers.push(internal.body.id);
    const external = await api.call('POST', '/api/v1/trainers', { ...manager, body: { lastName: `Externe${unique()}`, firstName: 'Eli', email: `eli.${unique()}@formateurs.investudy.test` } });
    expect(external.status).toBe(201);
    created.trainers.push(external.body.id);
    return { manager, trainerUser, theory, trading, marches, cours, internal: internal.body.id as string, external: external.body.id as string };
  }
  type World = Awaited<ReturnType<typeof world>>;

  const plan = (w: World, as: As, over: Record<string, unknown> = {}) =>
    api.call('POST', '/api/v1/sessions', {
      ...as,
      body: { trainingId: w.trading, rhythm: 'DAY', startDate: monday(3), roomId: w.marches, trainerId: w.internal, capacity: 13, ...over },
    });
  const planned = async (w: World, over: Record<string, unknown> = {}) => {
    const res = await plan(w, w.manager, over);
    expect(res.status).toBe(201);
    created.sessions.push(res.body.id);
    return res.body as { id: string; version: number; startDate: string; endDate: string; status: string };
  };

  it('cycle complet : planifier, lire, modifier, ouvrir, reporter, annuler ; l\'audit garde chaque étape', async () => {
    const w = await world();
    const start = monday(3);
    const s = await planned(w, { startDate: start });
    expect(s).toMatchObject({ status: 'PLANNED', startDate: start, endDate: addDays(start, 4), version: 1 });
    const read = await api.call('GET', `/api/v1/sessions/${s.id}`, w.manager);
    expect(read.status).toBe(200);
    expect(read.body).toMatchObject({ roomUsableSeats: 13, needsWorkstations: true, phase: 'UPCOMING', rhythm: { code: 'DAY', totalHours: 35 } });

    const edited = await api.call('PUT', `/api/v1/sessions/${s.id}`, { ...w.manager, body: { version: 1, capacity: 10, trainerId: w.external } });
    expect(edited.status).toBe(200);
    expect(edited.body).toMatchObject({ capacity: 10, version: 2 });

    const opened = await api.call('POST', `/api/v1/sessions/${s.id}/open`, { ...w.manager, body: { version: 2 } });
    expect(opened.body).toMatchObject({ status: 'OPEN', version: 3 });

    const newStart = monday(5);
    const postponed = await api.call('POST', `/api/v1/sessions/${s.id}/postpone`, { ...w.manager, body: { version: 3, startDate: newStart, reason: 'Formateur indisponible' } });
    expect(postponed.status).toBe(200);
    expect(postponed.body).toMatchObject({ status: 'OPEN', startDate: newStart, endDate: addDays(newStart, 4), version: 4 });

    const cancelled = await api.call('POST', `/api/v1/sessions/${s.id}/cancel`, { ...w.manager, body: { version: 4, reason: 'Pas assez d\'inscrits' } });
    expect(cancelled.body).toMatchObject({ status: 'CANCELLED', cancelReason: 'Pas assez d\'inscrits', version: 5 });
    expect((await api.call('PUT', `/api/v1/sessions/${s.id}`, { ...w.manager, body: { version: 5, capacity: 5 } })).status).toBe(422);

    const audit = await t.prisma.db.auditLog.findMany({ where: { entityType: 'TrainingSession', entityId: s.id }, orderBy: { createdAt: 'asc' } });
    expect(audit.map((a) => a.action)).toEqual(['CREATE', 'UPDATE', 'UPDATE', 'UPDATE', 'UPDATE']);
  });

  it('règles croisées : capacité dans les places utiles, salle à postes pour un module pratique, rythme du soir fermé, dates', async () => {
    const w = await world();
    expect((await plan(w, w.manager, { capacity: 14 })).status).toBe(422); // 14 postes dont 1 en panne : 13 places utiles
    expect((await plan(w, w.manager, { roomId: w.cours, capacity: 10 })).status).toBe(422); // module pratique en salle de cours
    expect((await plan(w, w.manager, { rhythm: 'EVENING' })).status).toBe(422);
    expect((await plan(w, w.manager, { startDate: addDays(monday(3), 1) })).status).toBe(201); // un mardi est un jour de cours
    expect((await plan(w, w.manager, { startDate: addDays(monday(8), -2) })).status).toBe(400); // un samedi
    expect((await plan(w, w.manager, { startDate: '2020-01-06' })).status).toBe(400); // dans le passé
    expect((await plan(w, w.manager, { startDate: 'demain' })).status).toBe(400);
    expect((await plan(w, w.manager, { trainingId: 'pas-un-uuid' })).status).toBe(400);
    expect((await plan(w, w.manager, { trainerId: '00000000-0000-7000-8000-000000000000' })).status).toBe(404);
    const theory = await plan(w, w.manager, { trainingId: w.theory, roomId: w.cours, startDate: monday(9), capacity: 16 });
    expect(theory.status).toBe(201);
    created.sessions.push(theory.body.id);
    const sessions = await t.prisma.db.trainingSession.findMany({ where: { trainerId: w.internal } });
    created.sessions.push(...sessions.map((s) => s.id));
  });

  it('chevauchements : salle ou formateur déjà pris = 409 avec la session en conflit ; libéré par une annulation', async () => {
    const w = await world();
    const start = monday(4);
    const first = await planned(w, { startDate: start });
    const sameRoom = await plan(w, w.manager, { startDate: addDays(start, 4), trainerId: w.external });
    expect(sameRoom.status).toBe(409);
    expect(sameRoom.body.detail).toMatch(/est déjà prise du .* au .* par la session/);
    const sameTrainer = await plan(w, w.manager, { trainingId: w.theory, roomId: w.cours, startDate: start, capacity: 10 });
    expect(sameTrainer.status).toBe(409);
    expect(sameTrainer.body.detail).toMatch(/Le formateur .* est déjà pris/);
    const nextWeek = await plan(w, w.manager, { startDate: addDays(start, 7) });
    expect(nextWeek.status).toBe(201);
    created.sessions.push(nextWeek.body.id);
    await api.call('POST', `/api/v1/sessions/${first.id}/cancel`, { ...w.manager, body: { version: 1, reason: 'Annulée' } });
    const again = await plan(w, w.manager, { startDate: start });
    expect(again.status).toBe(201);
    created.sessions.push(again.body.id);
  });

  it('deux planifications simultanées de la même salle : une seule réussit (le verrou sérialise les écritures)', async () => {
    const w = await world();
    const start = monday(6);
    const results = await Promise.all([
      plan(w, w.manager, { startDate: start, trainerId: w.internal }),
      plan(w, w.manager, { startDate: start, trainerId: w.external }),
    ]);
    for (const r of results) if (r.status === 201) created.sessions.push(r.body.id);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await t.prisma.db.trainingSession.count({ where: { roomId: w.marches } })).toBe(1);
  });

  it('droits : Responsable Investudy écrit ; Direction, chargé de compte, Support et Finance lisent seulement ; RH n\'a aucun accès', async () => {
    const w = await world();
    const s = await planned(w);
    const direction = await login(RoleCode.Direction);
    const am = await login(RoleCode.AccountManager);
    const support = await login(RoleCode.Support);
    const finance = await login(RoleCode.Finance);
    const hr = await login(RoleCode.Hr);
    for (const reader of [direction, am, support, finance]) {
      expect((await api.call('GET', `/api/v1/sessions/${s.id}`, reader)).status).toBe(200);
      expect((await api.call('GET', '/api/v1/sessions', reader)).status).toBe(200);
      expect((await plan(w, reader)).status).toBe(403);
      expect((await api.call('PUT', `/api/v1/sessions/${s.id}`, { ...reader, body: { version: 1, capacity: 5 } })).status).toBe(403);
      expect((await api.call('POST', `/api/v1/sessions/${s.id}/open`, { ...reader, body: { version: 1 } })).status).toBe(403);
      expect((await api.call('POST', `/api/v1/sessions/${s.id}/postpone`, { ...reader, body: { version: 1, startDate: monday(7), reason: 'x' } })).status).toBe(403);
      expect((await api.call('POST', `/api/v1/sessions/${s.id}/cancel`, { ...reader, body: { version: 1, reason: 'x' } })).status).toBe(403);
    }
    expect((await api.call('GET', `/api/v1/sessions/${s.id}`, hr)).status).toBe(403);
    expect((await api.call('GET', '/api/v1/sessions', hr)).status).toBe(403);
    expect((await api.call('GET', `/api/v1/sessions/${s.id}`, w.manager)).body).toMatchObject({ capacity: 13, version: 1 });
  });

  it('portée du formateur : il ne voit que ses sessions ; celle d\'un autre est « introuvable », comme une session inexistante', async () => {
    const w = await world();
    const mine = await planned(w, { startDate: monday(3) });
    const other = await planned(w, { startDate: monday(3), roomId: w.cours, trainingId: w.theory, trainerId: w.external, capacity: 10 });
    const own = await api.call('GET', `/api/v1/sessions/${mine.id}`, w.trainerUser);
    expect(own.status).toBe(200);
    const foreign = await api.call('GET', `/api/v1/sessions/${other.id}`, w.trainerUser);
    const missing = await api.call('GET', '/api/v1/sessions/00000000-0000-7000-8000-000000000000', w.trainerUser);
    expect([foreign.status, foreign.body]).toEqual([missing.status, missing.body]);
    expect(foreign.status).toBe(404);
    expect(foreign.bytes.toString('utf8')).not.toContain(other.id);
    const list = await api.call('GET', '/api/v1/sessions?pageSize=100', w.trainerUser);
    expect(list.status).toBe(200);
    expect(list.body.items.map((s: { id: string }) => s.id)).toEqual([mine.id]);
    // Le formateur ne peut rien écrire.
    expect((await api.call('PUT', `/api/v1/sessions/${mine.id}`, { ...w.trainerUser, body: { version: 1, capacity: 5 } })).status).toBe(403);
    expect((await api.call('POST', `/api/v1/sessions/${mine.id}/cancel`, { ...w.trainerUser, body: { version: 1, reason: 'x' } })).status).toBe(403);
  });

  it('liste filtrée : état, salle, formateur, période ; période à l\'envers = 400 ; version périmée = 409', async () => {
    const w = await world();
    const a = await planned(w, { startDate: monday(3) });
    const b = await planned(w, { startDate: monday(5), trainerId: w.external });
    await api.call('POST', `/api/v1/sessions/${b.id}/cancel`, { ...w.manager, body: { version: 1, reason: 'Annulée' } });
    const ids = async (query: string) => ((await api.call('GET', `/api/v1/sessions?pageSize=100&roomId=${w.marches}${query}`, w.manager)).body.items as { id: string }[]).map((s) => s.id).sort();
    expect(await ids('')).toEqual([a.id, b.id].sort());
    expect(await ids('&status=CANCELLED')).toEqual([b.id]);
    expect(await ids(`&trainerId=${w.internal}`)).toEqual([a.id]);
    expect(await ids(`&from=${monday(4)}&to=${addDays(monday(6), 4)}`)).toEqual([b.id]);
    expect((await api.call('GET', '/api/v1/sessions?from=2026-12-01&to=2026-11-01', w.manager)).status).toBe(400);
    expect((await api.call('PUT', `/api/v1/sessions/${a.id}`, { ...w.manager, body: { version: 9, capacity: 5 } })).status).toBe(409);
  });

  it('verrou optimiste au niveau de la base : deux lectures de la même version, la seconde écriture est refusée', async () => {
    const w = await world();
    const s = await planned(w);
    const repository = t.get(SESSION_REPOSITORY as never) as SessionRepository;
    const first = (await repository.findById(s.id))!;
    const second = (await repository.findById(s.id))!;
    first.update({ capacity: 9 }, '2020-01-01');
    second.update({ capacity: 8 }, '2020-01-01');
    await repository.save(first);
    await expect(repository.save(second)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect((await api.call('GET', `/api/v1/sessions/${s.id}`, w.manager)).body).toMatchObject({ capacity: 9, version: 2 });
  });

  it('règles garanties par la base : capacité, dates, motif d\'annulation, version, clés étrangères', async () => {
    const w = await world();
    const s = await planned(w);
    const db = t.prisma.db;
    const refuses = async (data: Record<string, unknown>, name: RegExp) => {
      await expect(db.trainingSession.update({ where: { id: s.id }, data })).rejects.toThrow(name);
    };
    await refuses({ capacity: 0 }, /sessions_capacity_range/);
    await refuses({ capacity: 1001 }, /sessions_capacity_range/);
    await refuses({ endDate: new Date(`${addDays(s.startDate, -1)}T00:00:00Z`) }, /sessions_dates_ordered/);
    await refuses({ status: 'CANCELLED' }, /sessions_cancel_reason_coherent/); // annulée sans motif
    await refuses({ cancelReason: 'Motif sans annulation' }, /sessions_cancel_reason_coherent/); // motif sans annulation
    await refuses({ version: 0 }, /sessions_version_positive/);
    await expect(db.room.delete({ where: { id: w.marches } })).rejects.toThrow(); // jamais de suppression d'une salle utilisée
    await expect(db.trainer.delete({ where: { id: w.internal } })).rejects.toThrow();
    await expect(db.training.delete({ where: { id: w.trading } })).rejects.toThrow();
  });
});
