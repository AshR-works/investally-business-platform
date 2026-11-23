import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { RoleCode } from '../src/modules/iam/domain/roles';
import { Attendance } from '../src/modules/training/domain/attendance';
import { ATTENDANCE_REPOSITORY, AttendanceRepository } from '../src/modules/training/domain/attendance-repositories';
import { Evaluation } from '../src/modules/training/domain/evaluation';
import { EVALUATION_REPOSITORY, EvaluationRepository, TRAINING_THRESHOLDS_REPOSITORY, TrainingThresholdsRepository } from '../src/modules/training/domain/evaluation-repositories';
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
  const created = {
    programs: [] as string[], modules: [] as string[], rooms: [] as string[], trainers: [] as string[], trainings: [] as string[], sessions: [] as string[],
    learners: [] as string[], enrollments: [] as string[],
  };

  beforeAll(async () => {
    ({ t, api } = await startRbacApp());
  }, 60_000);
  afterAll(async () => {
    const db = t.prisma.db;
    await db.ambassadorSuggestion.deleteMany({ where: { enrollmentId: { in: created.enrollments } } });
    await db.certification.deleteMany({ where: { enrollmentId: { in: created.enrollments } } });
    await db.evaluation.deleteMany({ where: { enrollmentId: { in: created.enrollments } } });
    await db.attendance.deleteMany({ where: { enrollmentId: { in: created.enrollments } } });
    await db.enrollment.deleteMany({ where: { id: { in: created.enrollments } } });
    await db.learner.deleteMany({ where: { id: { in: created.learners } } });
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
      // Prix complet obligatoire : un étudiant ou un particulier (S5.3a, payeur lui-même) s'inscrit sans agrément, pour le prix du certificat.
      const tr = await api.call('POST', '/api/v1/trainings', { ...manager, body: { programId: program.body.id, title: `${title} ${unique()}`, moduleIds, priceAmount: '100000' } });
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

  /** Un inscrit confirmé, sans agrément ni entreprise (étudiant, payeur lui-même) : le chemin le plus court pour obtenir une inscription confirmée. */
  async function confirmedEnrollment(w: World, session: { id: string }) {
    const learner = await api.call('POST', '/api/v1/learners', { ...w.manager, body: { kind: 'STUDENT', lastName: `Présence${unique()}`, firstName: 'Noa' } });
    expect(learner.status).toBe(201);
    created.learners.push(learner.body.id);
    const enrolled = await api.call('POST', '/api/v1/enrollments', { ...w.manager, body: { sessionId: session.id, learnerId: learner.body.id, payer: { kind: 'SELF' } } });
    expect(enrolled.status).toBe(201);
    created.enrollments.push(enrolled.body.id);
    const confirmed = await api.call('POST', `/api/v1/enrollments/${enrolled.body.id}/confirm`, { ...w.manager, body: { version: 1 } });
    expect(confirmed.status).toBe(200);
    return { enrollmentId: enrolled.body.id as string, learnerId: learner.body.id as string };
  }

  it('clôture et réouverture (S5.3a) : seule une session ouverte se clôture, les présences sont figées, la réouverture exige un motif', async () => {
    const w = await world();
    const s = await planned(w, { startDate: monday(3) });
    expect((await api.call('POST', `/api/v1/sessions/${s.id}/close`, { ...w.manager, body: { version: 1 } })).status).toBe(422); // pas encore ouverte
    await api.call('POST', `/api/v1/sessions/${s.id}/open`, { ...w.manager, body: { version: 1 } });
    const { enrollmentId } = await confirmedEnrollment(w, s);
    const day = s.startDate;
    expect((await api.call('PUT', `/api/v1/sessions/${s.id}/attendance/${enrollmentId}/${day}`, { ...w.manager, body: { status: 'PRESENT' } })).status).toBe(200);

    const closed = await api.call('POST', `/api/v1/sessions/${s.id}/close`, { ...w.manager, body: { version: 2 } });
    expect(closed.status).toBe(200);
    expect(closed.body).toMatchObject({ status: 'CLOSED', version: 3 });
    expect((await api.call('POST', `/api/v1/sessions/${s.id}/close`, { ...w.manager, body: { version: 3 } })).status).toBe(422); // déjà clôturée
    // Figée : ni nouvelle saisie ni correction.
    expect((await api.call('PUT', `/api/v1/sessions/${s.id}/attendance/${enrollmentId}/${addDays(day, 1)}`, { ...w.manager, body: { status: 'PRESENT' } })).status).toBe(422);
    expect((await api.call('PUT', `/api/v1/sessions/${s.id}/attendance/${enrollmentId}/${day}`, { ...w.manager, body: { status: 'ABSENT' } })).status).toBe(422);

    expect((await api.call('POST', `/api/v1/sessions/${s.id}/reopen`, { ...w.manager, body: { version: 3, reason: '' } })).status).toBe(400); // motif obligatoire
    const reopened = await api.call('POST', `/api/v1/sessions/${s.id}/reopen`, { ...w.manager, body: { version: 3, reason: 'Correction après coup' } });
    expect(reopened.status).toBe(200);
    expect(reopened.body).toMatchObject({ status: 'OPEN', version: 4 });
    expect((await api.call('POST', `/api/v1/sessions/${s.id}/reopen`, { ...w.manager, body: { version: 4, reason: 'Encore' } })).status).toBe(422); // pas clôturée
    expect((await api.call('PUT', `/api/v1/sessions/${s.id}/attendance/${enrollmentId}/${day}`, { ...w.manager, body: { status: 'ABSENT' } })).status).toBe(200); // de nouveau possible

    const audit = await t.prisma.db.auditLog.findMany({ where: { entityType: 'TrainingSession', entityId: s.id }, orderBy: { createdAt: 'asc' } });
    expect(audit.map((a) => a.action)).toEqual(['CREATE', 'UPDATE', 'UPDATE', 'UPDATE']); // ouvrir, clôturer, rouvrir
    const reopenAudit = audit.at(-1) as unknown as { newValue: { reopenReason: string } };
    expect(reopenAudit.newValue.reopenReason).toBe('Correction après coup');
  });

  it('présences aux séances (S5.3a) : seuls les inscrits confirmés, un jour de cours dans la session, idempotent, droits', async () => {
    const w = await world();
    const s = await planned(w, { startDate: monday(3) });
    await api.call('POST', `/api/v1/sessions/${s.id}/open`, { ...w.manager, body: { version: 1 } });
    const { enrollmentId, learnerId } = await confirmedEnrollment(w, s);
    // Un second inscrit, jamais confirmé : ne doit pas apparaître sur la feuille.
    const pendingLearner = await api.call('POST', '/api/v1/learners', { ...w.manager, body: { kind: 'STUDENT', lastName: `EnAttente${unique()}`, firstName: 'Paul' } });
    created.learners.push(pendingLearner.body.id);
    const pendingEnrolled = await api.call('POST', '/api/v1/enrollments', { ...w.manager, body: { sessionId: s.id, learnerId: pendingLearner.body.id, payer: { kind: 'SELF' } } });
    created.enrollments.push(pendingEnrolled.body.id);

    const day = s.startDate;
    const put = (d: string, status: string) => api.call('PUT', `/api/v1/sessions/${s.id}/attendance/${enrollmentId}/${d}`, { ...w.manager, body: { status } });
    expect((await put(day, 'INCONNU')).status).toBe(400);
    expect((await put(addDays(day, 10), 'PRESENT')).status).toBe(400); // hors période
    expect((await put(addDays(day, 5), 'PRESENT')).status).toBe(400); // samedi : pas un jour de cours
    const recorded = await put(day, 'PRESENT');
    expect(recorded.status).toBe(200);
    expect(recorded.body).toMatchObject({ enrollmentId, day, status: 'PRESENT' });

    // Une seconde séance, saisie après la première : la feuille les rend dans l'ordre des jours, jamais l'inverse.
    const laterDay = addDays(day, 3); // jeudi : toujours un jour de cours
    await put(laterDay, 'ABSENT');

    const sheet = await api.call('GET', `/api/v1/sessions/${s.id}/attendance`, w.manager);
    expect(sheet.status).toBe(200);
    expect(sheet.body).toMatchObject({ sessionId: s.id, sessionStatus: 'OPEN', canRecord: true });
    expect(sheet.body.days).toEqual([day, addDays(day, 1), addDays(day, 2), addDays(day, 3), addDays(day, 4)]);
    expect(sheet.body.rows).toEqual([{ enrollmentId, learnerId, learnerName: expect.any(String), entries: [{ day, status: 'PRESENT' }, { day: laterDay, status: 'ABSENT' }] }]);

    // Corriger : idempotent (même valeur, pas de nouvelle trace), puis changement tracé avant/après, avec le dernier auteur (un autre compte) et la version qui augmente.
    const before = await t.prisma.db.auditLog.count({ where: { entityType: 'Attendance' } });
    await put(day, 'PRESENT');
    expect(await t.prisma.db.auditLog.count({ where: { entityType: 'Attendance' } })).toBe(before);
    const otherManager = await login(RoleCode.TrainingManager);
    const corrected = await api.call('PUT', `/api/v1/sessions/${s.id}/attendance/${enrollmentId}/${day}`, { ...otherManager, body: { status: 'LATE' } });
    expect(corrected.body).toMatchObject({ status: 'LATE' });
    const audit = await t.prisma.db.auditLog.findFirst({ where: { entityType: 'Attendance', action: 'UPDATE' }, orderBy: { createdAt: 'desc' } });
    expect(audit).toMatchObject({ oldValue: { status: 'PRESENT' }, newValue: { status: 'LATE' } });
    const row = await t.prisma.db.attendance.findFirst({ where: { enrollmentId, day: new Date(`${day}T00:00:00Z`) } });
    expect(row?.recordedByUserId).toBe(otherManager.userId); // le dernier auteur, pas le premier, est retenu EN BASE
    expect(row?.version).toBe(2); // incrémentée en base à chaque écriture (créée, puis corrigée une fois)

    // Unicité garantie par la base, au niveau du dépôt : deux présences distinctes pour le même (inscription, jour).
    const attendances = t.get(ATTENDANCE_REPOSITORY as never) as AttendanceRepository;
    const neverTouched = addDays(day, 2); // mercredi : jamais saisi jusqu'ici
    const first = Attendance.record({ id: randomUUID(), enrollmentId, day: neverTouched, status: 'PRESENT', recordedByUserId: w.manager.userId, now: new Date() });
    const second = Attendance.record({ id: randomUUID(), enrollmentId, day: neverTouched, status: 'LATE', recordedByUserId: w.manager.userId, now: new Date() });
    await attendances.save(first);
    await expect(attendances.save(second)).rejects.toMatchObject({ code: 'CONFLICT' });

    // Une inscription en attente de confirmation est « introuvable » pour la présence (comme un objet hors portée).
    expect((await api.call('PUT', `/api/v1/sessions/${s.id}/attendance/${pendingEnrolled.body.id}/${day}`, { ...w.manager, body: { status: 'PRESENT' } })).status).toBe(422);

    // Droits : Direction lit, ne saisit pas ; un chargé de compte ne voit ni ne saisit.
    const direction = await login(RoleCode.Direction);
    const am = await login(RoleCode.AccountManager);
    expect((await api.call('GET', `/api/v1/sessions/${s.id}/attendance`, direction)).status).toBe(200);
    expect((await api.call('PUT', `/api/v1/sessions/${s.id}/attendance/${enrollmentId}/${day}`, { ...direction, body: { status: 'ABSENT' } })).status).toBe(403);
    expect((await api.call('GET', `/api/v1/sessions/${s.id}/attendance`, am)).status).toBe(403);
  });

  it('présences : garanties de la base (unicité par inscription et par jour, clé vers l\'inscription)', async () => {
    const w = await world();
    const s = await planned(w, { startDate: monday(3) });
    await api.call('POST', `/api/v1/sessions/${s.id}/open`, { ...w.manager, body: { version: 1 } });
    const { enrollmentId } = await confirmedEnrollment(w, s);
    const db = t.prisma.db;
    await db.attendance.create({ data: { id: randomUUID(), enrollmentId, day: new Date(`${s.startDate}T00:00:00Z`), status: 'PRESENT', recordedByUserId: w.manager.userId } });
    await expect(db.attendance.create({ data: { id: randomUUID(), enrollmentId, day: new Date(`${s.startDate}T00:00:00Z`), status: 'ABSENT', recordedByUserId: w.manager.userId } })).rejects.toThrow(/attendances_enrollment_id_day_key/);
    await expect(
      db.attendance.create({ data: { id: randomUUID(), enrollmentId: '00000000-0000-7000-8000-000000000000', day: new Date(`${addDays(s.startDate, 1)}T00:00:00Z`), status: 'PRESENT', recordedByUserId: w.manager.userId } }),
    ).rejects.toThrow();
  });

  it('évaluations (S5.3b) : seuls les inscrits confirmés, une note sur 20, figée à la clôture, idempotente, droits', async () => {
    const w = await world();
    const s = await planned(w, { startDate: monday(3) });
    await api.call('POST', `/api/v1/sessions/${s.id}/open`, { ...w.manager, body: { version: 1 } });
    const { enrollmentId } = await confirmedEnrollment(w, s);
    const pendingLearner = await api.call('POST', '/api/v1/learners', { ...w.manager, body: { kind: 'STUDENT', lastName: `EnAttenteNote${unique()}`, firstName: 'Zoé' } });
    created.learners.push(pendingLearner.body.id);
    const pendingEnrolled = await api.call('POST', '/api/v1/enrollments', { ...w.manager, body: { sessionId: s.id, learnerId: pendingLearner.body.id, payer: { kind: 'SELF' } } });
    created.enrollments.push(pendingEnrolled.body.id);

    const put = (score: unknown, as = w.manager) => api.call('PUT', `/api/v1/sessions/${s.id}/evaluations/${enrollmentId}`, { ...as, body: { score } });
    expect((await put(21)).status).toBe(400); // hors barème
    expect((await put(-1)).status).toBe(400);
    const recorded = await put(15.5);
    expect(recorded.status).toBe(200);
    expect(recorded.body).toMatchObject({ enrollmentId, score: 15.5 });
    expect(recorded.body.version).toBeUndefined(); // pas de verrou optimiste exposé (comme la présence)

    // Idempotent : la même note ne réécrit rien.
    const before = await t.prisma.db.auditLog.count({ where: { entityType: 'Evaluation' } });
    await put(15.5);
    expect(await t.prisma.db.auditLog.count({ where: { entityType: 'Evaluation' } })).toBe(before);

    // Correction par un autre compte : l'avant/après est tracé, le dernier auteur est retenu EN BASE, la version augmente.
    const otherManager = await login(RoleCode.TrainingManager);
    const corrected = await api.call('PUT', `/api/v1/sessions/${s.id}/evaluations/${enrollmentId}`, { ...otherManager, body: { score: 8 } });
    expect(corrected.body).toMatchObject({ score: 8 });
    const audit = await t.prisma.db.auditLog.findFirst({ where: { entityType: 'Evaluation', action: 'UPDATE' }, orderBy: { createdAt: 'desc' } });
    expect(audit).toMatchObject({ oldValue: { score: 15.5 }, newValue: { score: 8 } });
    const row = await t.prisma.db.evaluation.findUnique({ where: { enrollmentId } });
    expect(row?.recordedByUserId).toBe(otherManager.userId);
    expect(row?.version).toBe(2);

    // Une inscription en attente de confirmation est « introuvable » pour l'évaluation (comme pour la présence).
    expect((await put(10, w.manager)).status).toBe(200); // remet une valeur connue avant de tester l'inscription en attente
    expect((await api.call('PUT', `/api/v1/sessions/${s.id}/evaluations/${pendingEnrolled.body.id}`, { ...w.manager, body: { score: 10 } })).status).toBe(422);

    // Figée à la clôture, de nouveau possible après réouverture.
    const closed = await api.call('POST', `/api/v1/sessions/${s.id}/close`, { ...w.manager, body: { version: 2 } });
    expect(closed.status).toBe(200);
    expect((await put(12)).status).toBe(422);
    await api.call('POST', `/api/v1/sessions/${s.id}/reopen`, { ...w.manager, body: { version: 3, reason: 'Correction après coup' } });
    expect((await put(12)).status).toBe(200);

    // Droits : Direction lit, ne saisit pas ; un chargé de compte ne voit ni ne saisit ; le formateur n'a ni l'un ni l'autre (S1/ADR-0016).
    const direction = await login(RoleCode.Direction);
    const am = await login(RoleCode.AccountManager);
    expect((await api.call('GET', `/api/v1/sessions/${s.id}/evaluations`, direction)).status).toBe(200);
    expect((await put(10, direction)).status).toBe(403);
    expect((await api.call('GET', `/api/v1/sessions/${s.id}/evaluations`, am)).status).toBe(403);
    expect((await put(10, w.trainerUser)).status).toBe(403);
    expect((await api.call('GET', `/api/v1/sessions/${s.id}/evaluations`, w.trainerUser)).status).toBe(403);

    // Unicité garantie par la base, au niveau du dépôt : deux évaluations distinctes pour la même inscription.
    const evaluations = t.get(EVALUATION_REPOSITORY as never) as EvaluationRepository;
    const { enrollmentId: otherEnrollmentId } = await confirmedEnrollment(w, s);
    const first = Evaluation.record({ id: randomUUID(), enrollmentId: otherEnrollmentId, score: 12, recordedByUserId: w.manager.userId, now: new Date() });
    const second = Evaluation.record({ id: randomUUID(), enrollmentId: otherEnrollmentId, score: 18, recordedByUserId: w.manager.userId, now: new Date() });
    await evaluations.save(first);
    await expect(evaluations.save(second)).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('évaluations : garanties de la base (unicité par inscription, note entre 0 et 20, clé vers l\'inscription)', async () => {
    const w = await world();
    const s = await planned(w, { startDate: monday(3) });
    await api.call('POST', `/api/v1/sessions/${s.id}/open`, { ...w.manager, body: { version: 1 } });
    const { enrollmentId } = await confirmedEnrollment(w, s);
    const db = t.prisma.db;
    await db.evaluation.create({ data: { id: randomUUID(), enrollmentId, score: 12, recordedByUserId: w.manager.userId } });
    await expect(db.evaluation.create({ data: { id: randomUUID(), enrollmentId, score: 5, recordedByUserId: w.manager.userId } })).rejects.toThrow(/evaluations_enrollment_id_key/);
    await expect(db.evaluation.update({ where: { enrollmentId }, data: { score: 21 } })).rejects.toThrow(/evaluations_score_range/);
    await expect(db.evaluation.update({ where: { enrollmentId }, data: { score: -1 } })).rejects.toThrow(/evaluations_score_range/);
    await expect(
      db.evaluation.create({ data: { id: randomUUID(), enrollmentId: '00000000-0000-7000-8000-000000000000', score: 10, recordedByUserId: w.manager.userId } }),
    ).rejects.toThrow();
  });

  it('seuils d\'éligibilité (S5.3b, D31) : calcul et suggestion à partir de la présence et de la note, jamais de délivrance', async () => {
    const w = await world();
    const s = await planned(w, { startDate: monday(3) }); // rythme DAY : exactement 5 jours de cours (lundi-vendredi)
    await api.call('POST', `/api/v1/sessions/${s.id}/open`, { ...w.manager, body: { version: 1 } });
    const days = [0, 1, 2, 3, 4].map((n) => addDays(s.startDate, n));

    const attendOn = async (enrollmentId: string, presentDays: readonly string[]) => {
      for (const d of days) {
        await api.call('PUT', `/api/v1/sessions/${s.id}/attendance/${enrollmentId}/${d}`, { ...w.manager, body: { status: presentDays.includes(d) ? 'PRESENT' : 'ABSENT' } });
      }
    };
    const scoreOf = (enrollmentId: string, score: number) => api.call('PUT', `/api/v1/sessions/${s.id}/evaluations/${enrollmentId}`, { ...w.manager, body: { score } });

    const certified = await confirmedEnrollment(w, s); // 5/5 présent (100 %), note 15 : seuils des deux côtés atteints
    await attendOn(certified.enrollmentId, days);
    await scoreOf(certified.enrollmentId, 15);

    const attested = await confirmedEnrollment(w, s); // 4/5 présent (80 %), note 5 : présence atteinte, pas la note
    await attendOn(attested.enrollmentId, days.slice(0, 4));
    await scoreOf(attested.enrollmentId, 5);

    const none = await confirmedEnrollment(w, s); // 2/5 présent (40 %) : aucun seuil atteint, même avec une bonne note
    await attendOn(none.enrollmentId, days.slice(0, 2));
    await scoreOf(none.enrollmentId, 18);

    // Un inscrit en attente de confirmation n'apparaît pas sur la feuille d'évaluation (comme pour la présence).
    const pendingLearner = await api.call('POST', '/api/v1/learners', { ...w.manager, body: { kind: 'STUDENT', lastName: `EnAttenteNote${unique()}`, firstName: 'Léna' } });
    created.learners.push(pendingLearner.body.id);
    const pendingEnrolled = await api.call('POST', '/api/v1/enrollments', { ...w.manager, body: { sessionId: s.id, learnerId: pendingLearner.body.id, payer: { kind: 'SELF' } } });
    created.enrollments.push(pendingEnrolled.body.id);

    const sheet = await api.call('GET', `/api/v1/sessions/${s.id}/evaluations`, w.manager);
    expect(sheet.status).toBe(200);
    expect(sheet.body.sessionId).toBe(s.id);
    expect(sheet.body.rows).toHaveLength(3); // l'inscrit en attente n'y figure pas
    const rowOf = (enrollmentId: string) => (sheet.body.rows as { enrollmentId: string }[]).find((r) => r.enrollmentId === enrollmentId);
    expect(rowOf(certified.enrollmentId)).toMatchObject({ score: 15, attendanceRatePercent: 100, suggestion: 'CERTIFICATE' });
    expect(rowOf(attested.enrollmentId)).toMatchObject({ score: 5, attendanceRatePercent: 80, suggestion: 'ATTESTATION' });
    expect(rowOf(none.enrollmentId)).toMatchObject({ score: 18, attendanceRatePercent: 40, suggestion: 'NONE' });
    expect(rowOf(pendingEnrolled.body.id)).toBeUndefined();

    // Réglages des seuils : lecture par défaut, modification avec verrou optimiste, droits réservés à qui gère (training.evaluation.manage).
    const defaults = await api.call('GET', '/api/v1/training/thresholds', w.manager);
    expect(defaults.status).toBe(200);
    expect(defaults.body).toMatchObject({ attendanceThresholdPercent: 80, scoreThreshold: 10 });
    const am = await login(RoleCode.AccountManager);
    expect((await api.call('PUT', '/api/v1/training/thresholds', { ...am, body: { version: defaults.body.version, attendanceThresholdPercent: 90, scoreThreshold: 12 } })).status).toBe(403);
    // Direction lit les seuils (training.evaluation.read) mais ne les gère pas (training.evaluation.manage) : deux droits distincts.
    const direction = await login(RoleCode.Direction);
    expect((await api.call('GET', '/api/v1/training/thresholds', direction)).status).toBe(200);
    expect((await api.call('PUT', '/api/v1/training/thresholds', { ...direction, body: { version: defaults.body.version, attendanceThresholdPercent: 90, scoreThreshold: 12 } })).status).toBe(403);
    expect((await api.call('PUT', '/api/v1/training/thresholds', { ...w.manager, body: { version: defaults.body.version, attendanceThresholdPercent: 101, scoreThreshold: 12 } })).status).toBe(400);
    const raised = await api.call('PUT', '/api/v1/training/thresholds', { ...w.manager, body: { version: defaults.body.version, attendanceThresholdPercent: 90, scoreThreshold: 12 } });
    expect(raised.body).toMatchObject({ attendanceThresholdPercent: 90, scoreThreshold: 12, version: defaults.body.version + 1 });
    // À 90 %, l'inscrit qui était à 80 % (attestation) retombe à « aucune suggestion ».
    const afterRaise = await api.call('GET', `/api/v1/sessions/${s.id}/evaluations`, w.manager);
    expect((afterRaise.body.rows as { enrollmentId: string; suggestion: string }[]).find((r) => r.enrollmentId === attested.enrollmentId)?.suggestion).toBe('NONE');
    expect((await api.call('PUT', '/api/v1/training/thresholds', { ...w.manager, body: { version: defaults.body.version, attendanceThresholdPercent: 85, scoreThreshold: 11 } })).status).toBe(409); // version périmée

    // Verrou optimiste garanti par le dépôt lui-même, pas seulement par le cas d'usage (qui vérifie déjà la version avant d'appeler le dépôt).
    const thresholdsRepo = t.get(TRAINING_THRESHOLDS_REPOSITORY as never) as TrainingThresholdsRepository;
    const beforeRepo = await thresholdsRepo.get();
    await expect(thresholdsRepo.save({ ...beforeRepo, version: beforeRepo.version + 99 })).rejects.toMatchObject({ code: 'CONFLICT' });

    // Remis à la valeur de départ pour ne pas affecter les autres tests (réglage partagé, une seule ligne).
    await api.call('PUT', '/api/v1/training/thresholds', { ...w.manager, body: { version: raised.body.version, attendanceThresholdPercent: 80, scoreThreshold: 10 } });
  });

  it('seuils d\'éligibilité : garanties de la base (une seule ligne)', async () => {
    const db = t.prisma.db;
    await expect(db.$executeRawUnsafe(`INSERT INTO training.training_thresholds (id, updated_at) VALUES (2, now())`)).rejects.toThrow();
  });

  it('certifications (S5.3c, CU-I-60/61) : seulement une session clôturée, seuils respectés, révocation justifiée, droits', async () => {
    const w = await world();
    const s = await planned(w, { startDate: monday(3) }); // rythme DAY : 5 jours de cours
    await api.call('POST', `/api/v1/sessions/${s.id}/open`, { ...w.manager, body: { version: 1 } });
    const days = [0, 1, 2, 3, 4].map((n) => addDays(s.startDate, n));
    const { enrollmentId } = await confirmedEnrollment(w, s);
    for (const d of days) await api.call('PUT', `/api/v1/sessions/${s.id}/attendance/${enrollmentId}/${d}`, { ...w.manager, body: { status: 'PRESENT' } });

    // Pas encore clôturée : refusé.
    expect((await api.call('POST', `/api/v1/sessions/${s.id}/certifications/${enrollmentId}`, { ...w.manager, body: { kind: 'ATTESTATION' } })).status).toBe(422);

    // Note insuffisante : attestation possible, certificat refusé.
    await api.call('PUT', `/api/v1/sessions/${s.id}/evaluations/${enrollmentId}`, { ...w.manager, body: { score: 5 } });
    const closed = await api.call('POST', `/api/v1/sessions/${s.id}/close`, { ...w.manager, body: { version: 2 } });
    expect(closed.status).toBe(200);
    expect((await api.call('POST', `/api/v1/sessions/${s.id}/certifications/${enrollmentId}`, { ...w.manager, body: { kind: 'CERTIFICATE' } })).status).toBe(422);
    const issued = await api.call('POST', `/api/v1/sessions/${s.id}/certifications/${enrollmentId}`, { ...w.manager, body: { kind: 'ATTESTATION' } });
    expect(issued.status).toBe(201);
    expect(issued.body).toMatchObject({ enrollmentId, kind: 'ATTESTATION', status: 'ISSUED', referenceNumber: expect.stringMatching(/^CERT-\d{4}-\d{6}$/) });

    // Une seconde délivrance pour la même inscription est refusée.
    expect((await api.call('POST', `/api/v1/sessions/${s.id}/certifications/${enrollmentId}`, { ...w.manager, body: { kind: 'ATTESTATION' } })).status).toBe(422);

    // Feuille des délivrances.
    const sheet = await api.call('GET', `/api/v1/sessions/${s.id}/certifications`, w.manager);
    expect(sheet.status).toBe(200);
    expect(sheet.body.rows).toEqual([{ enrollmentId, learnerId: expect.any(String), learnerName: expect.any(String), certification: issued.body }]);
    expect(sheet.body.canIssue).toBe(true);

    // Révocation : justification obligatoire, tracée, le document reste consultable.
    expect((await api.call('POST', `/api/v1/sessions/${s.id}/certifications/${enrollmentId}/revoke`, { ...w.manager, body: { reason: '' } })).status).toBe(400);
    const revoked = await api.call('POST', `/api/v1/sessions/${s.id}/certifications/${enrollmentId}/revoke`, { ...w.manager, body: { reason: 'Fraude constatée' } });
    expect(revoked.status).toBe(200);
    expect(revoked.body).toMatchObject({ status: 'REVOKED', revokeReason: 'Fraude constatée' });
    expect((await api.call('GET', `/api/v1/sessions/${s.id}/certifications`, w.manager)).body.rows[0].certification).toMatchObject({ status: 'REVOKED' });
    expect((await api.call('POST', `/api/v1/sessions/${s.id}/certifications/${enrollmentId}/revoke`, { ...w.manager, body: { reason: 'Encore' } })).status).toBe(422); // déjà révoquée

    // Droits : Direction lit, ne délivre ni ne révoque ; un chargé de compte ne voit ni ne délivre.
    const direction = await login(RoleCode.Direction);
    const am = await login(RoleCode.AccountManager);
    expect((await api.call('GET', `/api/v1/sessions/${s.id}/certifications`, direction)).status).toBe(200);
    expect((await api.call('POST', `/api/v1/sessions/${s.id}/certifications/${enrollmentId}`, { ...direction, body: { kind: 'ATTESTATION' } })).status).toBe(403);
    expect((await api.call('GET', `/api/v1/sessions/${s.id}/certifications`, am)).status).toBe(403);

    // Le formateur lié ne voit que ses propres sessions.
    expect((await api.call('GET', `/api/v1/sessions/${s.id}/certifications`, w.trainerUser)).status).toBe(200);
    const other = await planned(w, { startDate: monday(5), trainerId: w.external });
    expect((await api.call('GET', `/api/v1/sessions/${other.id}/certifications`, w.trainerUser)).status).toBe(404);

    // Aucune suggestion d'ambassadeur pour un apprenant sans entreprise (étudiant, payeur lui-même).
    const suggestion = await t.prisma.db.ambassadorSuggestion.findUnique({ where: { enrollmentId } });
    expect(suggestion).toBeNull();
  });

  it('certifications : garanties de la base (unicité par inscription et par numéro de référence, cohérence de la révocation, clé vers l\'inscription)', async () => {
    const w = await world();
    const s = await planned(w, { startDate: monday(3) });
    await api.call('POST', `/api/v1/sessions/${s.id}/open`, { ...w.manager, body: { version: 1 } });
    const { enrollmentId } = await confirmedEnrollment(w, s);
    const db = t.prisma.db;
    const now = new Date();
    await db.certification.create({ data: { id: randomUUID(), enrollmentId, kind: 'ATTESTATION', referenceNumber: `TEST-${unique()}`, issuedByUserId: w.manager.userId, issuedAt: now } });
    await expect(db.certification.create({ data: { id: randomUUID(), enrollmentId, kind: 'ATTESTATION', referenceNumber: `TEST-${unique()}`, issuedByUserId: w.manager.userId, issuedAt: now } })).rejects.toThrow(/certifications_enrollment_id_key/);
    await expect(
      db.certification.create({ data: { id: randomUUID(), enrollmentId: '00000000-0000-7000-8000-000000000000', kind: 'ATTESTATION', referenceNumber: `TEST-${unique()}`, issuedByUserId: w.manager.userId, issuedAt: now } }),
    ).rejects.toThrow();
    const { enrollmentId: otherEnrollmentId } = await confirmedEnrollment(w, s);
    const sameRef = `TEST-SAME-${unique()}`;
    await db.certification.create({ data: { id: randomUUID(), enrollmentId: otherEnrollmentId, kind: 'ATTESTATION', referenceNumber: sameRef, issuedByUserId: w.manager.userId, issuedAt: now } });
    const { enrollmentId: thirdEnrollmentId } = await confirmedEnrollment(w, s);
    await expect(
      db.certification.create({ data: { id: randomUUID(), enrollmentId: thirdEnrollmentId, kind: 'ATTESTATION', referenceNumber: sameRef, issuedByUserId: w.manager.userId, issuedAt: now } }),
    ).rejects.toThrow(/certifications_reference_number_key/);
    // Cohérence de la révocation : révoquée sans auteur/date/motif, ou délivrée avec l'un d'eux renseigné, est refusée.
    await expect(db.certification.update({ where: { enrollmentId }, data: { status: 'REVOKED' } })).rejects.toThrow(/certifications_revoke_coherent/);
    await expect(db.certification.update({ where: { enrollmentId }, data: { revokedByUserId: w.manager.userId } })).rejects.toThrow(/certifications_revoke_coherent/);
  });

  it('suggestions d\'ambassadeur (CU-I-62, S8) : lecture scindée des droits sur les certifications', async () => {
    const w = await world();
    const am = await login(RoleCode.AccountManager);
    const trainerOnly = w.trainerUser;
    expect((await api.call('GET', '/api/v1/ambassador-suggestions', w.manager)).status).toBe(200); // Responsable Investudy : portée Tous sur bd.ambassador.read
    expect((await api.call('GET', '/api/v1/ambassador-suggestions', trainerOnly)).status).toBe(403); // le formateur n'a aucun droit sur les ambassadeurs
    expect((await api.call('GET', '/api/v1/ambassador-suggestions', am)).status).toBe(200); // portée Own : liste vide si aucune suggestion ne lui appartient
  });
});
