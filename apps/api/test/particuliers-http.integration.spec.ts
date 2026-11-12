import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { RoleCode } from '../src/modules/iam/domain/roles';
import { Api, createUserWithRoles, mfaSession, startRbacApp } from './support/rbac-http';
import { TestApp } from './support/test-app';

const describeDb = process.env.DATABASE_URL && process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;

/** Un lundi dans `weeksAhead` semaines au moins (les tests utilisent la vraie horloge). */
function monday(weeksAhead: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + weeksAhead * 7);
  d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7));
  return d.toISOString().slice(0, 10);
}

/**
 * Lot B (option C) de bout en bout (HTTP + PostgreSQL) : étudiants et particuliers sans entreprise ni agrément, avec un payeur désigné (lui-même ou un tiers) ;
 * visibles seulement de ceux dont le droit couvre tout ; règles garanties par la base.
 */
describeDb('Étudiants et particuliers (HTTP + PostgreSQL)', () => {
  let t: TestApp;
  let api: Api;
  let seq = 0;
  const ip = () => `10.98.${Math.floor(seq / 250)}.${(seq++ % 250) + 1}`;
  const unique = () => Math.random().toString(36).slice(2, 8);
  type As = { token: string; ip: string; sessionId: string; userId: string };

  beforeAll(async () => {
    ({ t, api } = await startRbacApp());
  }, 60_000);
  afterAll(() => t.close());

  const login = async (role: RoleCode, managerId?: string): Promise<As> => {
    const user = await createUserWithRoles(t, [role], { managerId: managerId ?? null });
    const addr = ip();
    const session = await mfaSession(t, api, user.email, addr);
    return { token: session.token, ip: addr, sessionId: session.sessionId as string, userId: user.id };
  };

  async function world() {
    const manager = await login(RoleCode.TrainingManager);
    const chef = await login(RoleCode.HeadOfSales);
    const marie = await login(RoleCode.AccountManager, chef.userId);
    const direction = await login(RoleCode.Direction);
    const support = await login(RoleCode.Support);
    const finance = await login(RoleCode.Finance);
    const program = await api.call('POST', '/api/v1/programs', { ...manager, body: { name: `Programme particuliers ${unique()}` } });
    const training = await api.call('POST', '/api/v1/trainings', { ...manager, body: { programId: program.body.id, title: `Certificat particuliers ${unique()}`, priceAmount: '100000' } });
    const room = await api.call('POST', '/api/v1/rooms', { ...manager, body: { name: `Salle particuliers ${unique()}`, kind: 'CLASSROOM', learnerSeats: 20, trainerSeats: 0 } });
    const trainer = await api.call('POST', '/api/v1/trainers', { ...manager, body: { lastName: `Formateur${unique()}`, firstName: 'Eli' } });
    for (const res of [program, training, room, trainer]) expect(res.status).toBe(201);
    const session = async (weeks: number, capacity = 3) => {
      const planned = await api.call('POST', '/api/v1/sessions', { ...manager, body: { trainingId: training.body.id, rhythm: 'DAY', startDate: monday(weeks), roomId: room.body.id, trainerId: trainer.body.id, capacity } });
      expect(planned.status).toBe(201);
      const opened = await api.call('POST', `/api/v1/sessions/${planned.body.id}/open`, { ...manager, body: { version: 1 } });
      expect(opened.status).toBe(200);
      return opened.body as { id: string; version: number };
    };
    const student = async (kind: 'STUDENT' | 'INDIVIDUAL' = 'STUDENT', as: As = manager) => {
      const res = await api.call('POST', '/api/v1/learners', { ...as, body: { kind, lastName: `Etudiant${unique()}`, firstName: 'Léa' } });
      return res;
    };
    const enroll = (as: As, sessionId: string, learnerId: string, extra: Record<string, unknown>) => api.call('POST', '/api/v1/enrollments', { ...as, body: { sessionId, learnerId, ...extra } });
    return { manager, chef, marie, direction, support, finance, session, student, enroll, trainingId: training.body.id as string };
  }

  it('inscrit un étudiant sans agrément : payeur lui-même, puis un particulier avec un tiers ; montant dû = prix complet ; confirmation, annulation, audit', async () => {
    const w = await world();
    const s = await w.session(1);
    const lea = await w.student('STUDENT');
    expect(lea.status).toBe(201);
    expect(lea.body).toMatchObject({ kind: 'STUDENT', companyId: null, companyName: '', version: 1 });
    const own = await w.enroll(w.manager, s.id, lea.body.id, { payer: { kind: 'SELF' } });
    expect(own.status).toBe(201);
    expect(own.body).toMatchObject({ status: 'PENDING', companyId: null, approvalId: null, learnerKind: 'STUDENT', chargedAmount: '100000.00', payer: { kind: 'SELF', name: null, type: null } });
    expect((await api.call('POST', `/api/v1/enrollments/${own.body.id}/confirm`, { ...w.manager, body: { version: 1 } })).body.status).toBe('CONFIRMED');

    const marc = await w.student('INDIVIDUAL');
    const third = await w.enroll(w.manager, s.id, marc.body.id, { payer: { kind: 'THIRD_PARTY', name: 'Famille Ndongo', type: 'FAMILY' } });
    expect(third.status).toBe(201);
    expect(third.body.payer).toEqual({ kind: 'THIRD_PARTY', name: 'Famille Ndongo', type: 'FAMILY' });
    expect((await api.call('POST', `/api/v1/enrollments/${third.body.id}/cancel`, { ...w.manager, body: { version: 1, reason: 'Désistement' } })).body.status).toBe('CANCELLED');

    const audit = await t.prisma.db.auditLog.findMany({ where: { entityId: { in: [own.body.id, third.body.id] }, action: 'CREATE' } });
    expect(audit).toHaveLength(2);
    expect(JSON.stringify(audit.map((a) => a.newValue))).toContain('Famille Ndongo');
  });

  it('refuse un payeur mal désigné, un agrément pour un étudiant, un payeur pour un apprenant d’entreprise ; messages en 400', async () => {
    const w = await world();
    const s = await w.session(2);
    const lea = await w.student();
    expect((await w.enroll(w.manager, s.id, lea.body.id, {})).status).toBe(400);
    expect((await w.enroll(w.manager, s.id, lea.body.id, { payer: { kind: 'THIRD_PARTY', type: 'FAMILY' } })).status).toBe(400);
    expect((await w.enroll(w.manager, s.id, lea.body.id, { payer: { kind: 'THIRD_PARTY', name: 'Oncle', type: 'VOISIN' } })).status).toBe(400);
    expect((await w.enroll(w.manager, s.id, lea.body.id, { payer: { kind: 'SELF', name: 'Quelqu’un' } })).status).toBe(400);
    expect((await w.enroll(w.manager, s.id, lea.body.id, { approvalId: randomUUID(), payer: { kind: 'SELF' } })).status).toBe(400);
    const company = await api.call('POST', '/api/v1/companies', { ...w.marie, body: { name: `Société particuliers ${unique()}` } });
    const worker = await api.call('POST', '/api/v1/learners', { ...w.marie, body: { companyId: company.body.id, lastName: `Salarie${unique()}`, firstName: 'Aïcha' } });
    expect((await w.enroll(w.marie, s.id, worker.body.id, { payer: { kind: 'SELF' } })).status).toBe(400);
    expect((await api.call('POST', '/api/v1/learners', { ...w.manager, body: { kind: 'STUDENT', companyId: company.body.id, lastName: 'Piège', firstName: 'Paul' } })).status).toBe(400);
    expect((await api.call('POST', '/api/v1/learners', { ...w.manager, body: { kind: 'COMPANY', lastName: 'Sans', firstName: 'Entreprise' } })).status).toBe(400);
    expect((await api.call('POST', '/api/v1/learners', { ...w.manager, body: { kind: 'AUTRE', lastName: 'X', firstName: 'Y' } })).status).toBe(400);
  });

  it('portée : seuls ceux dont le droit couvre tout voient et gèrent un étudiant ; les autres reçoivent « introuvable » ou « interdit »', async () => {
    const w = await world();
    const s = await w.session(3);
    const lea = await w.student();
    const enrolled = await w.enroll(w.manager, s.id, lea.body.id, { payer: { kind: 'SELF' } });
    for (const who of [w.manager, w.direction, w.support]) expect((await api.call('GET', `/api/v1/learners/${lea.body.id}`, who)).status).toBe(200);
    for (const who of [w.marie, w.chef]) {
      expect((await api.call('GET', `/api/v1/learners/${lea.body.id}`, who)).status).toBe(404);
      expect((await api.call('GET', `/api/v1/enrollments/${enrolled.body.id}`, who)).status).toBe(404);
      expect((await api.call('POST', `/api/v1/enrollments/${enrolled.body.id}/cancel`, { ...who, body: { version: 1, reason: 'x' } })).status).toBe(403); // ce rôle n'a pas le droit d'annuler, quel que soit l'objet
      const list = await api.call('GET', '/api/v1/learners?kind=STUDENT', who);
      expect(list.status).toBe(200);
      expect(list.body.items.map((l: { id: string }) => l.id)).not.toContain(lea.body.id);
    }
    for (const who of [w.marie, w.chef, w.direction, w.support]) expect((await w.student('STUDENT', who)).status).toBe(403);
    const mine = await api.call('GET', '/api/v1/learners?kind=STUDENT&pageSize=100', w.manager);
    expect(mine.body.items.map((l: { id: string }) => l.id)).toContain(lea.body.id);
    expect(mine.body.items.every((l: { kind: string }) => l.kind === 'STUDENT')).toBe(true);
    expect((await api.call('GET', `/api/v1/enrollments/${enrolled.body.id}`, w.finance)).status).toBe(200); // la Finance lit les inscriptions (portée Tous)
    // Un doublon parmi les étudiants est signalé.
    const same = await api.call('POST', '/api/v1/learners', { ...w.manager, body: { kind: 'INDIVIDUAL', lastName: lea.body.lastName, firstName: 'LÉA' } });
    expect(same.status).toBe(409);
  });

  it('règles garanties par la base : apprenant sans entreprise cohérent, inscription soit sous agrément soit avec payeur, montant dû, tiers nommé', async () => {
    const w = await world();
    const s = await w.session(4);
    const lea = await w.student();
    const db = t.prisma.db;
    const refused = async (work: Promise<unknown>, name: string) => {
      await expect(work).rejects.toThrow(new RegExp(name));
    };
    const learnerData = (over: Record<string, unknown>) => ({ id: randomUUID(), lastName: 'Base', firstName: 'Test', nameKey: `base test ${unique()}`, ...over });
    await refused(db.learner.create({ data: learnerData({ kind: 'STUDENT', companyId: randomUUID() }) as never }), 'learners_kind_company_coherent');
    await refused(db.learner.create({ data: learnerData({ kind: 'COMPANY', companyId: null }) as never }), 'learners_kind_company_coherent');
    await refused(db.learner.create({ data: learnerData({ kind: 'INDIVIDUAL', contactId: randomUUID() }) as never }), 'learners_kind_company_coherent');
    const row = (over: Record<string, unknown>) => ({ id: randomUUID(), sessionId: s.id, learnerId: lea.body.id, status: 'CANCELLED', cancelReason: 'x', ...over });
    await refused(db.enrollment.create({ data: row({ companyId: null, approvalId: null, payerKind: null, chargedAmount: '100000' }) as never }), 'enrollments_payer_coherent'); // ni agrément ni payeur
    await refused(db.enrollment.create({ data: row({ companyId: randomUUID(), approvalId: randomUUID(), payerKind: 'SELF', chargedAmount: '100000' }) as never }), 'enrollments_payer_coherent'); // les deux
    await refused(db.enrollment.create({ data: row({ companyId: null, approvalId: null, payerKind: 'SELF', chargedAmount: null }) as never }), 'enrollments_payer_coherent'); // montant dû absent
    await refused(db.enrollment.create({ data: row({ companyId: null, approvalId: null, payerKind: 'SELF', payerName: 'Qui', chargedAmount: '100000' }) as never }), 'enrollments_payer_coherent'); // lui-même avec un nom
    await refused(db.enrollment.create({ data: row({ companyId: null, approvalId: null, payerKind: 'THIRD_PARTY', payerName: ' ', payerType: 'FAMILY', chargedAmount: '100000' }) as never }), 'enrollments_payer_coherent'); // tiers sans nom
    await refused(db.enrollment.create({ data: row({ companyId: null, approvalId: null, payerKind: 'THIRD_PARTY', payerName: 'Oncle', payerType: null, chargedAmount: '100000' }) as never }), 'enrollments_payer_coherent'); // tiers sans nature
    await refused(db.enrollment.create({ data: row({ companyId: randomUUID(), approvalId: null, payerKind: 'SELF', chargedAmount: '100000' }) as never }), 'enrollments_payer_coherent'); // entreprise sans agrément
    // Les formes valides passent.
    await expect(db.enrollment.create({ data: row({ companyId: null, approvalId: null, payerKind: 'SELF', chargedAmount: '100000' }) as never })).resolves.toBeDefined();
  });
});
