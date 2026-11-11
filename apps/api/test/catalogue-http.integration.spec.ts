import 'reflect-metadata';
import { RoleCode } from '../src/modules/iam/domain/roles';
import { Api, createUserWithRoles, mfaSession, startRbacApp } from './support/rbac-http';
import { TestApp } from './support/test-app';

const describeDb = process.env.DATABASE_URL && process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;

/** S5.1 : catalogue Investudy de bout en bout (HTTP + PostgreSQL) : programmes, formations, salles, formateurs ; droits, validations, conflits, règles de la base, audit. */
describeDb('Catalogue Investudy (HTTP + PostgreSQL)', () => {
  let t: TestApp;
  let api: Api;
  let seq = 0;
  const ip = () => `10.97.${Math.floor(seq / 250)}.${(seq++ % 250) + 1}`;
  const unique = () => Math.random().toString(36).slice(2, 8);
  type As = { token: string; ip: string; sessionId: string };
  const created: { programs: string[]; modules: string[]; rooms: string[]; trainers: string[] } = { programs: [], modules: [], rooms: [], trainers: [] };

  beforeAll(async () => {
    ({ t, api } = await startRbacApp());
  }, 60_000);
  afterAll(async () => {
    const db = t.prisma.db;
    await db.training.deleteMany({ where: { programId: { in: created.programs } } });
    await db.program.deleteMany({ where: { id: { in: created.programs } } });
    await db.courseModule.deleteMany({ where: { id: { in: created.modules } } });
    await db.room.deleteMany({ where: { id: { in: created.rooms } } });
    await db.trainer.deleteMany({ where: { id: { in: created.trainers } } });
    await t.close();
  });

  const login = async (role: RoleCode): Promise<As> => {
    const user = await createUserWithRoles(t, [role]);
    const addr = ip();
    const session = await mfaSession(t, api, user.email, addr);
    return { token: session.token, ip: addr, sessionId: session.sessionId as string };
  };
  const roles = async () => ({
    manager: await login(RoleCode.TrainingManager),
    am: await login(RoleCode.AccountManager),
    support: await login(RoleCode.Support),
    trainer: await login(RoleCode.Trainer),
    direction: await login(RoleCode.Direction),
  });

  async function program(as: As, extra: Record<string, unknown> = {}) {
    const res = await api.call('POST', '/api/v1/programs', { ...as, body: { name: `Programme ${unique()}`, ...extra } });
    expect(res.status).toBe(201);
    created.programs.push(res.body.id);
    return res.body as { id: string; name: string; version: number };
  }

  it('cycle complet : programme, formation avec prix, salle, formateur interne ; lecture, modification, archivage, réactivation', async () => {
    const w = await roles();
    const p = await program(w.manager, { description: 'Pour les cadres', audience: 'Cadres' });
    expect(p).toMatchObject({ status: 'ACTIVE', version: 1, activeTrainings: 0 });

    const modules = [] as { id: string; title: string }[];
    for (const title of ['Fondations économiques', 'Instruments financiers', 'Réglementation CEMAC']) {
      const m = await api.call('POST', '/api/v1/modules', { ...w.manager, body: { title: `${title} ${unique()}`, requiresWorkstations: title.startsWith('Instruments') } });
      expect(m.status).toBe(201);
      expect(m.body.requiresWorkstations).toBe(title.startsWith('Instruments'));
      created.modules.push(m.body.id);
      modules.push(m.body);
    }
    const tr = await api.call('POST', '/api/v1/trainings', { ...w.manager, body: { programId: p.id, title: 'Certificat Expert', prerequisites: 'Aucun', priceAmount: '750000', modulePriceAmount: '125000', moduleIds: [modules[2]!.id, modules[0]!.id] } });
    expect(tr.status).toBe(201);
    expect(tr.body).toMatchObject({ programName: p.name, pricing: { currency: 'XAF', full: '750000.00', perModule: '125000.00' }, status: 'ACTIVE' });
    expect(tr.body.modules.map((m: { title: string; position: number }) => [m.position, m.title.split(' ')[0]])).toEqual([[1, 'Réglementation'], [2, 'Fondations']]);
    expect((await api.call('GET', `/api/v1/programs/${p.id}`, w.manager)).body.activeTrainings).toBe(1);

    const edited = await api.call('PUT', `/api/v1/trainings/${tr.body.id}`, { ...w.manager, body: { version: 1, priceAmount: null, moduleIds: modules.map((m) => m.id) } });
    expect(edited.status).toBe(200);
    expect(edited.body).toMatchObject({ pricing: { currency: 'XAF', full: null, perModule: '125000.00' }, version: 2 });
    expect(edited.body.modules.map((m: { title: string }) => m.title.split(' ')[0])).toEqual(['Fondations', 'Instruments', 'Réglementation']);
    expect((await api.call('GET', `/api/v1/trainings/${tr.body.id}`, w.manager)).body.modules).toHaveLength(3);
    expect((await api.call('GET', `/api/v1/trainings?programId=${p.id}`, w.manager)).body.items[0].modules).toHaveLength(3);

    const archived = await api.call('POST', `/api/v1/trainings/${tr.body.id}/status`, { ...w.manager, body: { version: 2, action: 'archive' } });
    expect(archived.body).toMatchObject({ status: 'ARCHIVED', version: 3 });
    expect((await api.call('GET', `/api/v1/programs/${p.id}`, w.manager)).body.activeTrainings).toBe(0);
    expect((await api.call('PUT', `/api/v1/trainings/${tr.body.id}`, { ...w.manager, body: { version: 3, title: 'Autre' } })).status).toBe(422);
    expect((await api.call('POST', `/api/v1/trainings/${tr.body.id}/status`, { ...w.manager, body: { version: 3, action: 'reactivate' } })).body.status).toBe('ACTIVE');

    const room = await api.call('POST', '/api/v1/rooms', { ...w.manager, body: { name: `Salle de marchés ${unique()}`, learnerSeats: 14, unavailableSeats: 1, trainerSeats: 1, equipment: 'Terminaux de marché' } });
    expect(room.status).toBe(201);
    created.rooms.push(room.body.id);
    expect(room.body).toMatchObject({ kind: 'WORKSTATIONS', learnerSeats: 14, unavailableSeats: 1, trainerSeats: 1, usableSeats: 13 });
    const meeting = await api.call('POST', '/api/v1/rooms', { ...w.manager, body: { name: `Salle de réunion ${unique()}`, kind: 'CLASSROOM', learnerSeats: 16, trainerSeats: 0, equipment: 'Écran 65 pouces' } });
    expect(meeting.status).toBe(201);
    created.rooms.push(meeting.body.id);
    expect(meeting.body).toMatchObject({ kind: 'CLASSROOM', usableSeats: 16, trainerSeats: 0 });
    // Relue depuis la base (la réponse de création vient de l'objet en mémoire) : le type est bien enregistré.
    expect((await api.call('GET', `/api/v1/rooms/${meeting.body.id}`, w.manager)).body).toMatchObject({ kind: 'CLASSROOM', learnerSeats: 16, trainerSeats: 0 });
    expect((await api.call('GET', `/api/v1/rooms/${room.body.id}`, w.manager)).body.kind).toBe('WORKSTATIONS');
    expect((await api.call('POST', '/api/v1/rooms', { ...w.manager, body: { name: `Salle ${unique()}`, kind: 'AMPHI', learnerSeats: 5 } })).status).toBe(400);
    const toggled = await api.call('PUT', `/api/v1/modules/${modules[0]!.id}`, { ...w.manager, body: { version: 1, requiresWorkstations: true } });
    expect(toggled.body.requiresWorkstations).toBe(true);
    const rhythms = await api.call('GET', '/api/v1/rhythms', w.manager);
    expect(rhythms.status).toBe(200);
    expect(rhythms.body.map((r: { code: string; open: boolean; totalHours: number }) => [r.code, r.open, r.totalHours])).toEqual([['DAY', true, 35], ['EVENING', false, 30]]);
    const user = await createUserWithRoles(t, [RoleCode.Trainer]);
    const trainer = await api.call('POST', '/api/v1/trainers', { ...w.manager, body: { lastName: 'Mballa', firstName: 'Estelle', email: `Estelle.${unique()}@exemple.test`, phone: '+237 6 70 11 22 33', userId: user.id } });
    expect(trainer.status).toBe(201);
    created.trainers.push(trainer.body.id);
    expect(trainer.body).toMatchObject({ internal: true, phone: '+237670112233' });
    const external = await api.call('POST', '/api/v1/trainers', { ...w.manager, body: { lastName: 'Ewane', firstName: 'Luc', specialties: 'Fiscalité' } });
    expect(external.status).toBe(201);
    created.trainers.push(external.body.id);
    expect(external.body).toMatchObject({ internal: false, email: null });
    expect((await api.call('GET', `/api/v1/trainers?search=Ewane`, w.manager)).body.items.map((x: { id: string }) => x.id)).toContain(external.body.id);
  }, 240_000);

  it('droits : le Responsable Investudy gère ; le chargé de compte lit les programmes seulement ; le formateur lit les salles ; le Support n’a rien', async () => {
    const w = await roles();
    const p = await program(w.manager);
    const get = (as: As, path: string) => api.call('GET', `/api/v1${path}`, as).then((r) => r.status);
    expect(await get(w.am, '/programs')).toBe(200);
    expect(await get(w.am, `/programs/${p.id}`)).toBe(200);
    expect(await get(w.am, '/trainings')).toBe(403);
    expect(await get(w.am, '/modules')).toBe(403);
    expect(await get(w.am, '/rhythms')).toBe(200);
    expect(await get(w.support, '/rhythms')).toBe(403);
    expect(await get(w.trainer, '/rooms')).toBe(200);
    expect(await get(w.trainer, '/trainers')).toBe(403);
    expect(await get(w.support, '/programs')).toBe(403);
    expect(await get(w.direction, '/programs')).toBe(200);
    for (const as of [w.am, w.trainer, w.support, w.direction]) {
      expect((await api.call('POST', '/api/v1/programs', { ...as, body: { name: `Refusé ${unique()}` } })).status).toBe(403);
      expect((await api.call('POST', '/api/v1/rooms', { ...as, body: { name: `Refusée ${unique()}`, learnerSeats: 5 } })).status).toBe(403);
      expect((await api.call('POST', '/api/v1/modules', { ...as, body: { title: `Refusé ${unique()}` } })).status).toBe(403);
      expect((await api.call('PUT', `/api/v1/programs/${p.id}`, { ...as, body: { version: 1, name: 'Piraté' } })).status).toBe(403);
      expect((await api.call('POST', `/api/v1/programs/${p.id}/status`, { ...as, body: { version: 1, action: 'archive' } })).status).toBe(403);
    }
    expect((await api.call('GET', `/api/v1/programs/${p.id}`, w.manager)).body).toMatchObject({ name: p.name, status: 'ACTIVE', version: 1 });
  }, 240_000);

  it('validation : corps invalide ou champ inconnu = 400 ; doublons = 409 ; élément inconnu = 404 ; version périmée = 409 ; programme archivé = 422', async () => {
    const w = await roles();
    const p = await program(w.manager);
    const post = (path: string, body: Record<string, unknown>) => api.call('POST', `/api/v1${path}`, { ...w.manager, body }).then((r) => r.status);
    expect(await post('/programs', { name: '' })).toBe(400);
    expect(await post('/programs', { name: 'X', owner: 'moi' })).toBe(400);
    expect(await post('/programs', { name: p.name.toUpperCase() })).toBe(409);
    expect(await post('/trainings', { programId: p.id, title: 'A', durationDays: 5 })).toBe(400);
    expect(await post('/trainings', { programId: p.id, title: 'A', priceAmount: '-1' })).toBe(400);
    expect(await post('/trainings', { programId: p.id, title: 'A', modulePriceAmount: '0' })).toBe(400);
    expect(await post('/trainings', { programId: p.id, title: 'A', priceCurrency: 'XAF' })).toBe(400);
    expect(await post('/trainings', { programId: p.id, title: 'A', moduleIds: ['pas-un-uuid'] })).toBe(400);
    expect(await post('/trainings', { programId: p.id, title: 'A', moduleIds: ['3f0c8a52-6a9a-4d2e-9a0a-1b2c3d4e5f60'] })).toBe(404);
    expect(await post('/trainings', { programId: '3f0c8a52-6a9a-4d2e-9a0a-1b2c3d4e5f60', title: 'A' })).toBe(404);
    expect(await post('/trainings', { programId: p.id, title: 'Doublon' })).toBe(201);
    expect(await post('/trainings', { programId: p.id, title: 'DOUBLON' })).toBe(409);
    const moduleTitle = `Module ${unique()}`;
    const module = await api.call('POST', '/api/v1/modules', { ...w.manager, body: { title: moduleTitle } });
    expect(module.status).toBe(201);
    created.modules.push(module.body.id);
    expect(await post('/modules', { title: moduleTitle.toUpperCase() })).toBe(409);
    expect(await post('/modules', { title: '' })).toBe(400);
    expect(await post('/trainings', { programId: p.id, title: 'Module en double', moduleIds: [module.body.id, module.body.id] })).toBe(400);
    expect((await api.call('POST', `/api/v1/modules/${module.body.id}/status`, { ...w.manager, body: { version: 1, action: 'archive' } })).status).toBe(200);
    expect(await post('/trainings', { programId: p.id, title: 'Module archivé', moduleIds: [module.body.id] })).toBe(422);
    const roomName = `Salle ${unique()}`;
    expect(await post('/rooms', { name: roomName, learnerSeats: 0 })).toBe(400);
    expect(await post('/rooms', { name: roomName, learnerSeats: 10, unavailableSeats: 11 })).toBe(400);
    expect(await post('/rooms', { name: roomName, learnerSeats: 10 })).toBe(201);
    expect(await post('/rooms', { name: roomName.toLowerCase(), learnerSeats: 10 })).toBe(409);
    expect(await post('/trainers', { lastName: 'A', firstName: 'B', email: 'pas-un-email' })).toBe(400);
    expect(await post('/trainers', { lastName: 'A', firstName: 'B', phone: '123' })).toBe(400);
    expect((await api.call('GET', '/api/v1/programs/3f0c8a52-6a9a-4d2e-9a0a-1b2c3d4e5f60', w.manager)).status).toBe(404);
    expect((await api.call('PUT', `/api/v1/programs/${p.id}`, { ...w.manager, body: { version: 9, name: 'Autre' } })).status).toBe(409);
    expect((await api.call('POST', `/api/v1/programs/${p.id}/status`, { ...w.manager, body: { version: 1, action: 'archive' } })).status).toBe(200);
    expect(await post('/trainings', { programId: p.id, title: 'Tardive' })).toBe(422);
    expect((await api.call('PUT', `/api/v1/programs/${p.id}`, { ...w.manager, body: { version: 2, name: 'Renommé' } })).status).toBe(422);
  }, 240_000);

  it('un e-mail et un compte utilisateur ne servent qu’à un seul formateur', async () => {
    const w = await roles();
    const email = `unique.${unique()}@exemple.test`;
    const user = await createUserWithRoles(t, [RoleCode.Trainer]);
    const first = await api.call('POST', '/api/v1/trainers', { ...w.manager, body: { lastName: 'A', firstName: 'B', email, userId: user.id } });
    expect(first.status).toBe(201);
    created.trainers.push(first.body.id);
    const sameEmail = await api.call('POST', '/api/v1/trainers', { ...w.manager, body: { lastName: 'C', firstName: 'D', email: email.toUpperCase() } });
    expect(sameEmail.status).toBe(409);
    const sameUser = await api.call('POST', '/api/v1/trainers', { ...w.manager, body: { lastName: 'C', firstName: 'D', userId: user.id } });
    expect(sameUser.status).toBe(409);
    const unlink = await api.call('PUT', `/api/v1/trainers/${first.body.id}`, { ...w.manager, body: { version: 1, userId: null } });
    expect(unlink.body).toMatchObject({ internal: false, userId: null, version: 2 });
  }, 240_000);

  it('règles garanties par la base : durée, prix, capacité, téléphone, e-mail, unicité, version, programme existant', async () => {
    const w = await roles();
    const p = await program(w.manager);
    const t1 = await api.call('POST', '/api/v1/trainings', { ...w.manager, body: { programId: p.id, title: 'Base', priceAmount: '1000', modulePriceAmount: '300' } });
    const room = await api.call('POST', '/api/v1/rooms', { ...w.manager, body: { name: `Salle ${unique()}`, learnerSeats: 10 } });
    created.rooms.push(room.body.id);
    const trainer = await api.call('POST', '/api/v1/trainers', { ...w.manager, body: { lastName: 'A', firstName: 'B', email: `base.${unique()}@exemple.test` } });
    created.trainers.push(trainer.body.id);
    const db = t.prisma.db;
    const sql = (q: string) => expect(db.$executeRawUnsafe(q)).rejects.toThrow();
    const mod = await api.call('POST', '/api/v1/modules', { ...w.manager, body: { title: `Module ${unique()}` } });
    created.modules.push(mod.body.id);
    await db.trainingModule.create({ data: { trainingId: t1.body.id, moduleId: mod.body.id, position: 1 } });
    await sql(`UPDATE training.training_modules SET position = 0 WHERE training_id = '${t1.body.id}'::uuid`);
    const mod2 = await api.call('POST', '/api/v1/modules', { ...w.manager, body: { title: `Module ${unique()}` } });
    created.modules.push(mod2.body.id);
    await sql(`INSERT INTO training.training_modules (training_id, module_id, position) VALUES ('${t1.body.id}'::uuid, '${mod2.body.id}'::uuid, 1)`);
    await sql(`INSERT INTO training.training_modules (training_id, module_id, position) VALUES ('${t1.body.id}'::uuid, '${'0'.repeat(8)}-0000-4000-8000-${'0'.repeat(12)}'::uuid, 2)`);
    await sql(`DELETE FROM training.modules WHERE id = '${mod.body.id}'::uuid`);
    await sql(`UPDATE training.modules SET version = 0 WHERE id = '${mod.body.id}'::uuid`);
    await sql(`UPDATE training.trainings SET module_price_amount = 0 WHERE id = '${t1.body.id}'::uuid`);
    await sql(`UPDATE training.trainings SET module_price_amount = NULL, price_amount = NULL, price_currency = 'XAF' WHERE id = '${t1.body.id}'::uuid`);
    await sql(`UPDATE training.trainings SET price_amount = 0 WHERE id = '${t1.body.id}'::uuid`);
    await sql(`UPDATE training.trainings SET price_currency = NULL WHERE id = '${t1.body.id}'::uuid`);
    await sql(`UPDATE training.trainings SET version = 0 WHERE id = '${t1.body.id}'::uuid`);
    await sql(`UPDATE training.trainings SET program_id = '${'0'.repeat(8)}-0000-4000-8000-${'0'.repeat(12)}'::uuid WHERE id = '${t1.body.id}'::uuid`);
    await sql(`INSERT INTO training.trainings (id, program_id, title, title_key, status, version, updated_at) VALUES (gen_random_uuid(), '${p.id}'::uuid, 'Base', 'base', 'ACTIVE', 1, now())`);
    await sql(`UPDATE training.rooms SET learner_seats = 0 WHERE id = '${room.body.id}'::uuid`);
    await sql(`UPDATE training.rooms SET learner_seats = 1001 WHERE id = '${room.body.id}'::uuid`);
    await sql(`UPDATE training.rooms SET unavailable_seats = 11 WHERE id = '${room.body.id}'::uuid`);
    await sql(`UPDATE training.rooms SET unavailable_seats = -1 WHERE id = '${room.body.id}'::uuid`);
    await sql(`UPDATE training.rooms SET trainer_seats = 11 WHERE id = '${room.body.id}'::uuid`);
    await sql(`UPDATE training.trainers SET phone = '12' WHERE id = '${trainer.body.id}'::uuid`);
    await sql(`UPDATE training.trainers SET email = NULL WHERE id = '${trainer.body.id}'::uuid`);
    await sql(`UPDATE training.programs SET name_key = (SELECT name_key FROM training.programs WHERE id <> '${p.id}'::uuid LIMIT 1) WHERE id = '${p.id}'::uuid`);
  }, 240_000);

  it('verrou optimiste AU NIVEAU DE LA BASE : deux modifications sur la même version, la seconde est refusée', async () => {
    const { PrismaRoomRepository } = await import('../src/modules/training/infrastructure/prisma-catalogue.repositories');
    const w = await roles();
    const room = await api.call('POST', '/api/v1/rooms', { ...w.manager, body: { name: `Salle ${unique()}`, learnerSeats: 10 } });
    created.rooms.push(room.body.id);
    const repository = new PrismaRoomRepository(t.prisma);
    const first = (await repository.findById(room.body.id))!;
    const second = (await repository.findById(room.body.id))!;
    first.update({ learnerSeats: 11 });
    second.update({ learnerSeats: 12 });
    await repository.save(first);
    await expect(repository.save(second)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect((await repository.findById(room.body.id))!.learnerSeats).toBe(11);
  }, 240_000);

  it('audit : création et chaque modification sont tracées, ancienne et nouvelle valeur, avec la session', async () => {
    const w = await roles();
    const p = await program(w.manager);
    await api.call('PUT', `/api/v1/programs/${p.id}`, { ...w.manager, body: { version: 1, audience: 'Directeurs' } });
    await api.call('POST', `/api/v1/programs/${p.id}/status`, { ...w.manager, body: { version: 2, action: 'archive' } });
    const logs = await t.prisma.db.auditLog.findMany({ where: { entityId: p.id }, orderBy: { createdAt: 'asc' } });
    expect(logs.map((l) => l.action)).toEqual(['CREATE', 'UPDATE', 'UPDATE']);
    expect(logs.every((l) => l.sessionId === w.manager.sessionId)).toBe(true);
    expect((logs[1]!.newValue as { audience: string }).audience).toBe('Directeurs');
    expect((logs[2]!.oldValue as { status: string }).status).toBe('ACTIVE');
    expect((logs[2]!.newValue as { status: string }).status).toBe('ARCHIVED');
  }, 240_000);
});
