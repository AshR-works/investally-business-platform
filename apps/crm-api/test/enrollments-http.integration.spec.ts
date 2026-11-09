import 'reflect-metadata';
import { RoleCode } from '../src/modules/iam/domain/roles';
import { ENROLLMENT_REPOSITORY, EnrollmentRepository } from '../src/modules/training/domain/enrollment-repositories';
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

/** S5.2b : apprenants et inscriptions de bout en bout (HTTP + PostgreSQL) : agrément, places, concurrence, portée, replacement, annulation de session, règles de la base. */
describeDb('Apprenants et inscriptions (HTTP + PostgreSQL)', () => {
  let t: TestApp;
  let api: Api;
  let seq = 0;
  const ip = () => `10.99.${Math.floor(seq / 250)}.${(seq++ % 250) + 1}`;
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

  /** Un monde propre à chaque test : une entreprise de Marie avec deux agréments (places, somme), un certificat à 100 000, une session ouverte de deux places. */
  async function world(capacity = 2) {
    const manager = await login(RoleCode.TrainingManager);
    const chef = await login(RoleCode.HeadOfSales);
    const marie = await login(RoleCode.AccountManager, chef.userId);
    const paul = await login(RoleCode.AccountManager); // autre équipe
    const finance = await login(RoleCode.Finance);
    const company = await api.call('POST', '/api/v1/companies', { ...marie, body: { name: `Société inscriptions ${unique()}` } });
    expect(company.status).toBe(201);
    const approvalOf = async (body: Record<string, unknown>) => {
      const opportunity = await api.call('POST', '/api/v1/opportunities', { ...marie, body: { companyId: company.body.id, title: `Opportunité ${unique()}`, amount: '5000000', source: 'EVENT' } });
      expect(opportunity.status).toBe(201);
      await t.prisma.db.opportunity.update({ where: { id: opportunity.body.id }, data: { stage: 'AGREEMENT_IN_PRINCIPLE' } });
      const approval = await api.call('POST', '/api/v1/approvals', { ...marie, body: { opportunityId: opportunity.body.id, receivedOn: new Date().toISOString().slice(0, 10), ...body } });
      expect(approval.status).toBe(201);
      return approval.body.id as string;
    };
    const places = await approvalOf({ places: 2 });
    const sum = await approvalOf({ amount: '150000' }); // couvre un seul certificat à 100 000
    const program = await api.call('POST', '/api/v1/programs', { ...manager, body: { name: `Programme inscriptions ${unique()}` } });
    const training = await api.call('POST', '/api/v1/trainings', { ...manager, body: { programId: program.body.id, title: `Certificat inscriptions ${unique()}`, priceAmount: '100000' } });
    const room = await api.call('POST', '/api/v1/rooms', { ...manager, body: { name: `Salle inscriptions ${unique()}`, kind: 'CLASSROOM', learnerSeats: 20, trainerSeats: 0 } });
    const trainer = await api.call('POST', '/api/v1/trainers', { ...manager, body: { lastName: `Formateur${unique()}`, firstName: 'Eli' } });
    for (const res of [program, training, room, trainer]) expect(res.status).toBe(201);
    const sessionAt = async (weeks: number, cap = capacity, open = true) => {
      const planned = await api.call('POST', '/api/v1/sessions', {
        ...manager, body: { trainingId: training.body.id, rhythm: 'DAY', startDate: monday(weeks), roomId: room.body.id, trainerId: trainer.body.id, capacity: cap },
      });
      expect(planned.status).toBe(201);
      if (!open) return planned.body as { id: string; version: number };
      const opened = await api.call('POST', `/api/v1/sessions/${planned.body.id}/open`, { ...manager, body: { version: 1 } });
      expect(opened.status).toBe(200);
      return opened.body as { id: string; version: number };
    };
    const learnerOf = async (lastName: string, firstName = 'Alain', as: As = marie) => {
      const res = await api.call('POST', '/api/v1/learners', { ...as, body: { companyId: company.body.id, lastName, firstName } });
      expect(res.status).toBe(201);
      return res.body as { id: string; version: number };
    };
    const enroll = (as: As, sessionId: string, learnerId: string, approvalId: string) => api.call('POST', '/api/v1/enrollments', { ...as, body: { sessionId, learnerId, approvalId } });
    return { manager, chef, marie, paul, finance, company: company.body.id as string, places, sum, sessionAt, learnerOf, enroll, trainingId: training.body.id as string };
  }

  it('apprenants : créer, doublon, modifier, supprimer logiquement ; contact de la même entreprise ; portée', async () => {
    const w = await world();
    const a = await w.learnerOf(`Mbarga${unique()}`, 'Aïcha');
    expect(a).toMatchObject({ version: 1 });
    const same = await api.call('POST', '/api/v1/learners', { ...w.marie, body: { companyId: w.company, lastName: (await api.call('GET', `/api/v1/learners/${a.id}`, w.marie)).body.lastName, firstName: 'AÏCHA' } });
    expect(same.status).toBe(409);
    expect((await api.call('POST', '/api/v1/learners', { ...w.marie, body: { companyId: w.company, lastName: (await api.call('GET', `/api/v1/learners/${a.id}`, w.marie)).body.lastName, firstName: 'AÏCHA', allowDuplicate: true } })).status).toBe(201);

    const contact = await api.call('POST', '/api/v1/contacts', { ...w.marie, body: { companyId: w.company, lastName: `Contact${unique()}`, firstName: 'Carine', email: `c.${unique()}@exemple.test` } });
    expect(contact.status).toBe(201);
    const linked = await api.call('PUT', `/api/v1/learners/${a.id}`, { ...w.marie, body: { version: 1, contactId: contact.body.id, phone: '+237 699 00 11 22', allowDuplicate: true } });
    expect(linked.body).toMatchObject({ contactId: contact.body.id, phone: '+237699001122', version: 2 });
    const other = await api.call('POST', '/api/v1/companies', { ...w.paul, body: { name: `Autre société ${unique()}` } });
    expect((await api.call('POST', '/api/v1/learners', { ...w.paul, body: { companyId: other.body.id, lastName: 'Piège', firstName: 'Paul', contactId: contact.body.id } })).status).toBe(400);

    // Portée : Paul (autre équipe) ne voit rien de Marie ; le Responsable commercial voit son équipe ; Investudy lit tout ; la Finance lit les inscriptions mais pas les fiches d'apprenants.
    expect((await api.call('GET', `/api/v1/learners/${a.id}`, w.paul)).status).toBe(404);
    expect((await api.call('GET', `/api/v1/learners?companyId=${w.company}`, w.paul)).status).toBe(404);
    expect((await api.call('GET', `/api/v1/learners/${a.id}`, w.chef)).status).toBe(200);
    expect((await api.call('GET', `/api/v1/learners/${a.id}`, w.manager)).status).toBe(200);
    expect((await api.call('GET', `/api/v1/learners/${a.id}`, w.finance)).status).toBe(403); // la Finance lit les inscriptions, pas les fiches d'apprenants
    expect((await api.call('PUT', `/api/v1/learners/${a.id}`, { ...w.paul, body: { version: 2, firstName: 'Piraté' } })).status).toBe(404);
    expect((await api.call('PUT', `/api/v1/learners/${a.id}`, { ...w.finance, body: { version: 2, firstName: 'Piraté' } })).status).toBe(403);
    expect((await api.call('PUT', `/api/v1/learners/${a.id}`, { ...w.marie, body: { version: 1, firstName: 'Périmé' } })).status).toBe(409);

    // Suppression logique : le chargé de compte n'a pas ce droit ; le Responsable Investudy supprime, l'apprenant disparaît.
    expect((await api.call('DELETE', `/api/v1/learners/${a.id}`, { ...w.marie, body: { version: 2 } })).status).toBe(403);
    expect((await api.call('DELETE', `/api/v1/learners/${a.id}`, { ...w.manager, body: { version: 2 } })).status).toBe(204);
    expect((await api.call('GET', `/api/v1/learners/${a.id}`, w.manager)).status).toBe(404);
    expect(await t.prisma.db.learner.count({ where: { id: a.id, deletedAt: { not: null } } })).toBe(1); // jamais effacé
  });

  it('inscription : en attente, place prise, confirmation par Investudy seul, annulation motivée, audit', async () => {
    const w = await world();
    const s = await w.sessionAt(3);
    const a = await w.learnerOf(`Mbarga${unique()}`);
    const enrolled = await w.enroll(w.marie, s.id, a.id, w.places);
    expect(enrolled.status).toBe(201);
    expect(enrolled.body).toMatchObject({ status: 'PENDING', chargedAmount: null, learnerId: a.id, version: 1 });
    expect((await api.call('GET', `/api/v1/sessions/${s.id}`, w.manager)).body.enrolled).toBe(1);

    expect((await api.call('POST', `/api/v1/enrollments/${enrolled.body.id}/confirm`, { ...w.marie, body: { version: 1 } })).status).toBe(403);
    expect((await api.call('POST', `/api/v1/enrollments/${enrolled.body.id}/confirm`, { ...w.manager, body: { version: 9 } })).status).toBe(409);
    const confirmed = await api.call('POST', `/api/v1/enrollments/${enrolled.body.id}/confirm`, { ...w.manager, body: { version: 1 } });
    expect(confirmed.body).toMatchObject({ status: 'CONFIRMED', version: 2 });
    expect(confirmed.body.confirmedAt).not.toBeNull();
    expect((await api.call('POST', `/api/v1/enrollments/${enrolled.body.id}/confirm`, { ...w.manager, body: { version: 2 } })).status).toBe(422);

    expect((await api.call('POST', `/api/v1/enrollments/${enrolled.body.id}/cancel`, { ...w.marie, body: { version: 2, reason: 'x' } })).status).toBe(403);
    expect((await api.call('POST', `/api/v1/enrollments/${enrolled.body.id}/cancel`, { ...w.manager, body: { version: 2, reason: ' ' } })).status).toBe(400);
    const cancelled = await api.call('POST', `/api/v1/enrollments/${enrolled.body.id}/cancel`, { ...w.manager, body: { version: 2, reason: 'Désistement du client' } });
    expect(cancelled.body).toMatchObject({ status: 'CANCELLED', cancelReason: 'Désistement du client' });
    expect((await api.call('GET', `/api/v1/sessions/${s.id}`, w.manager)).body.enrolled).toBe(0);

    const audit = await t.prisma.db.auditLog.findMany({ where: { entityType: 'Enrollment', entityId: enrolled.body.id }, orderBy: { createdAt: 'asc' } });
    expect(audit.map((r) => r.action)).toEqual(['CREATE', 'UPDATE', 'UPDATE']);
  });

  it('agrément : places et somme consommées, libérées par une annulation ; agrément demandé, expiré ou d\'une autre entreprise refusés', async () => {
    const w = await world(5);
    const s = await w.sessionAt(4);
    const [a, b, c] = [await w.learnerOf(`A${unique()}`), await w.learnerOf(`B${unique()}`), await w.learnerOf(`C${unique()}`)];
    // Agrément en places (2) : deux inscriptions, la troisième est refusée.
    const first = await w.enroll(w.marie, s.id, a.id, w.places);
    expect((await w.enroll(w.marie, s.id, b.id, w.places)).status).toBe(201);
    const refused = await w.enroll(w.marie, s.id, c.id, w.places);
    expect(refused.status).toBe(422);
    expect(refused.body.detail).toMatch(/n'a plus de place \(2 utilisées sur 2\)/);
    // Une annulation libère la place de l'agrément.
    await api.call('POST', `/api/v1/enrollments/${first.body.id}/cancel`, { ...w.manager, body: { version: 1, reason: 'Désistement' } });
    expect((await w.enroll(w.marie, s.id, c.id, w.places)).status).toBe(201);
    // Agrément en somme (150 000) : un certificat à 100 000 passe, le second est refusé avec le reste.
    const paid = await w.enroll(w.marie, (await w.sessionAt(5)).id, a.id, w.sum);
    expect(paid.body).toMatchObject({ status: 'PENDING', chargedAmount: '100000.00' });
    const tooMuch = await w.enroll(w.marie, (await w.sessionAt(6)).id, b.id, w.sum);
    expect(tooMuch.status).toBe(422);
    expect(tooMuch.body.detail).toMatch(/montant restant.*50 000.*100 000/);
    // Agrément d'une autre entreprise, inconnu, ou seulement demandé.
    const other = await api.call('POST', '/api/v1/companies', { ...w.paul, body: { name: `Autre société ${unique()}` } });
    expect(other.status).toBe(201);
    const d = await w.learnerOf(`D${unique()}`);
    expect((await w.enroll(w.marie, s.id, d.id, '00000000-0000-7000-8000-000000000000')).status).toBe(404);
    const asked = await t.prisma.db.approval.findFirstOrThrow({ where: { id: w.sum } });
    await t.prisma.db.approval.update({ where: { id: asked.id }, data: { status: 'REQUESTED' } });
    const requested = await w.enroll(w.marie, (await w.sessionAt(7)).id, b.id, w.sum);
    expect(requested.status).toBe(422);
    expect(requested.body.detail).toMatch(/seulement demandé/);
  });

  it('session : complète refusée, session non ouverte refusée, recouvrement refusé, doublon refusé', async () => {
    const w = await world(1);
    const s = await w.sessionAt(8);
    const planned = await w.sessionAt(9, 5, false);
    const [a, b] = [await w.learnerOf(`A${unique()}`), await w.learnerOf(`B${unique()}`)];
    expect((await w.enroll(w.marie, planned.id, a.id, w.places)).status).toBe(422); // pas encore ouverte
    expect((await w.enroll(w.marie, s.id, a.id, w.places)).status).toBe(201);
    expect((await w.enroll(w.marie, s.id, a.id, w.places)).status).toBe(409); // doublon
    const full = await w.enroll(w.marie, s.id, b.id, w.places);
    expect(full.status).toBe(422);
    expect(full.body.detail).toMatch(/La session est complète \(1 place sur 1\)/);
    // Une inscription annulée ne garde pas sa place : le second apprenant entre.
    const first = await t.prisma.db.enrollment.findFirstOrThrow({ where: { sessionId: s.id, learnerId: a.id } });
    expect((await api.call('POST', `/api/v1/enrollments/${first.id}/cancel`, { ...w.manager, body: { version: first.version, reason: 'Désistement' } })).status).toBe(200);
    expect((await w.enroll(w.marie, s.id, b.id, w.places)).status).toBe(201);
    expect((await w.enroll(w.paul, s.id, b.id, w.places)).status).toBe(404); // apprenant d'une autre équipe
    expect((await w.enroll(w.finance, s.id, b.id, w.places)).status).toBe(403);
  });

  it('deux inscriptions simultanées sur la dernière place : une seule réussit (la session est verrouillée) ; de même pour la dernière place d\'un agrément', async () => {
    const w = await world(1);
    const s = await w.sessionAt(10);
    const [a, b] = [await w.learnerOf(`A${unique()}`), await w.learnerOf(`B${unique()}`)];
    const results = await Promise.all([w.enroll(w.marie, s.id, a.id, w.places), w.enroll(w.marie, s.id, b.id, w.places)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 422]);
    expect(await t.prisma.db.enrollment.count({ where: { sessionId: s.id, status: { in: ['PENDING', 'CONFIRMED'] } } })).toBe(1);

    // L'agrément en somme ne couvre qu'un certificat : deux inscriptions simultanées sur deux sessions, une seule passe.
    const [s1, s2] = [await w.sessionAt(11, 5), await w.sessionAt(12, 5)];
    const [c, d] = [await w.learnerOf(`C${unique()}`), await w.learnerOf(`D${unique()}`)];
    const both = await Promise.all([w.enroll(w.marie, s1.id, c.id, w.sum), w.enroll(w.marie, s2.id, d.id, w.sum)]);
    expect(both.map((r) => r.status).sort()).toEqual([201, 422]);
    const used = await t.prisma.db.enrollment.findMany({ where: { approvalId: w.sum, status: { in: ['PENDING', 'CONFIRMED'] } } });
    expect(used).toHaveLength(1);
  });

  it('replacer une inscription : l\'ancienne est annulée et liée à la nouvelle ; rien ne change si le contrôle échoue', async () => {
    const w = await world();
    const [first, second] = [await w.sessionAt(13), await w.sessionAt(14)];
    const full = await w.sessionAt(15, 1);
    const [a, b] = [await w.learnerOf(`A${unique()}`), await w.learnerOf(`B${unique()}`)];
    const e1 = await w.enroll(w.marie, first.id, a.id, w.places);
    await w.enroll(w.marie, full.id, b.id, w.places);
    // Session cible complète : refus, et l'ancienne inscription est intacte (la transaction est annulée).
    const refused = await api.call('POST', `/api/v1/enrollments/${e1.body.id}/replace`, { ...w.manager, body: { version: 1, sessionId: full.id } });
    expect(refused.status).toBe(422);
    expect((await api.call('GET', `/api/v1/enrollments/${e1.body.id}`, w.manager)).body).toMatchObject({ status: 'PENDING', version: 1, replacedById: null });
    expect((await api.call('POST', `/api/v1/enrollments/${e1.body.id}/replace`, { ...w.marie, body: { version: 1, sessionId: second.id } })).status).toBe(403);
    const replaced = await api.call('POST', `/api/v1/enrollments/${e1.body.id}/replace`, { ...w.manager, body: { version: 1, sessionId: second.id } });
    expect(replaced.status).toBe(201);
    expect(replaced.body).toMatchObject({ status: 'PENDING', sessionId: second.id });
    const old = await api.call('GET', `/api/v1/enrollments/${e1.body.id}`, w.manager);
    expect(old.body).toMatchObject({ status: 'CANCELLED', replacedById: replaced.body.id });
    expect((await api.call('GET', `/api/v1/sessions/${first.id}`, w.manager)).body.enrolled).toBe(0);
    expect((await api.call('GET', `/api/v1/sessions/${second.id}`, w.manager)).body.enrolled).toBe(1);
  });

  it('annuler une session place ses inscriptions « à replacer » ; reporter les conserve ; la capacité ne descend pas sous les inscrits', async () => {
    const w = await world(5);
    const [toCancel, toMove] = [await w.sessionAt(16), await w.sessionAt(18)];
    const [a, b] = [await w.learnerOf(`A${unique()}`), await w.learnerOf(`B${unique()}`)];
    const e1 = await w.enroll(w.marie, toCancel.id, a.id, w.places);
    await api.call('POST', `/api/v1/enrollments/${e1.body.id}/confirm`, { ...w.manager, body: { version: 1 } });
    const e2 = await w.enroll(w.marie, toMove.id, b.id, w.places);
    expect((await api.call('PUT', `/api/v1/sessions/${toMove.id}`, { ...w.manager, body: { version: 2, capacity: 0 } })).status).toBe(400);
    const shrink = await api.call('PUT', `/api/v1/sessions/${toMove.id}`, { ...w.manager, body: { version: 2, capacity: 1 } });
    expect(shrink.status).toBe(200); // un inscrit pour une capacité de 1 : permis
    const moved = await api.call('POST', `/api/v1/sessions/${toMove.id}/postpone`, { ...w.manager, body: { version: 3, startDate: monday(19), reason: 'Salle indisponible' } });
    expect(moved.status).toBe(200);
    expect(moved.body.enrolled).toBe(1);
    expect((await api.call('GET', `/api/v1/enrollments/${e2.body.id}`, w.manager)).body.status).toBe('PENDING');

    const cancelled = await api.call('POST', `/api/v1/sessions/${toCancel.id}/cancel`, { ...w.manager, body: { version: 2, reason: 'Pas assez d\'inscrits' } });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.enrolled).toBe(0);
    expect((await api.call('GET', `/api/v1/enrollments/${e1.body.id}`, w.manager)).body).toMatchObject({ status: 'TO_REPLACE', confirmedAt: null });
    expect(await t.prisma.db.enrollment.count({ where: { sessionId: toCancel.id } })).toBe(1); // rien n'est supprimé
    // L'inscription « à replacer » se replace sur une autre session.
    const replaced = await api.call('POST', `/api/v1/enrollments/${e1.body.id}/replace`, { ...w.manager, body: { version: 3, sessionId: toMove.id } });
    expect(replaced.status).toBe(422); // la session reportée est de capacité 1 et déjà complète
    const roomy = await w.sessionAt(20);
    expect((await api.call('POST', `/api/v1/enrollments/${e1.body.id}/replace`, { ...w.manager, body: { version: 3, sessionId: roomy.id } })).status).toBe(201);
  });

  it('portée des inscriptions : chargé de compte (les siennes), Responsable commercial (son équipe), autre équipe (rien), Investudy et Finance (lecture)', async () => {
    const w = await world();
    const s = await w.sessionAt(21);
    const a = await w.learnerOf(`A${unique()}`);
    const e = await w.enroll(w.marie, s.id, a.id, w.places);
    const ids = async (as: As, query = '') => ((await api.call('GET', `/api/v1/enrollments?pageSize=100${query}`, as)).body.items as { id: string }[]).map((x) => x.id);
    expect(await ids(w.marie, `&sessionId=${s.id}`)).toEqual([e.body.id]);
    expect(await ids(w.chef, `&sessionId=${s.id}`)).toEqual([e.body.id]);
    expect(await ids(w.manager, `&sessionId=${s.id}`)).toEqual([e.body.id]);
    expect(await ids(w.finance, `&sessionId=${s.id}`)).toEqual([e.body.id]);
    expect(await ids(w.paul, `&sessionId=${s.id}`)).toEqual([]);
    expect((await api.call('GET', `/api/v1/enrollments/${e.body.id}`, w.paul)).status).toBe(404);
    expect((await api.call('GET', `/api/v1/enrollments?companyId=${w.company}`, w.paul)).status).toBe(404);
    expect((await api.call('GET', `/api/v1/enrollments?status=CONFIRMED&sessionId=${s.id}`, w.manager)).body.items).toEqual([]);
  });

  it('verrou optimiste au niveau de la base : deux lectures de la même version, la seconde écriture est refusée', async () => {
    const w = await world();
    const s = await w.sessionAt(23);
    const a = await w.learnerOf(`A${unique()}`);
    const e = await w.enroll(w.marie, s.id, a.id, w.places);
    const repository = t.get(ENROLLMENT_REPOSITORY as never) as EnrollmentRepository;
    const first = (await repository.findById(e.body.id))!;
    const second = (await repository.findById(e.body.id))!;
    first.cancel('Premier désistement');
    second.cancel('Second désistement');
    await repository.save(first);
    await expect(repository.save(second)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect((await api.call('GET', `/api/v1/enrollments/${e.body.id}`, w.manager)).body).toMatchObject({ cancelReason: 'Premier désistement', version: 2 });
  });

  it('règles garanties par la base : une inscription vivante par apprenant et par session, motif d\'annulation, confirmation, montant, clés internes au module', async () => {
    const w = await world();
    const s = await w.sessionAt(22);
    const a = await w.learnerOf(`A${unique()}`);
    const e = await w.enroll(w.marie, s.id, a.id, w.sum);
    const db = t.prisma.db;
    const refuses = async (data: Record<string, unknown>, name: RegExp) => {
      await expect(db.enrollment.update({ where: { id: e.body.id }, data })).rejects.toThrow(name);
    };
    await refuses({ status: 'CANCELLED' }, /enrollments_cancel_reason_coherent/);
    await refuses({ cancelReason: 'Motif sans annulation' }, /enrollments_cancel_reason_coherent/);
    await refuses({ status: 'CONFIRMED' }, /enrollments_confirmed_at_coherent/);
    await refuses({ chargedAmount: '0' }, /enrollments_charged_amount_positive/);
    await refuses({ version: 0 }, /enrollments_version_positive/);
    // Deux inscriptions vivantes du même apprenant à la même session : refusées par l'index unique (même en contournant l'application).
    await expect(db.enrollment.create({ data: { id: '0198a1b2-0000-7000-8000-00000000aa01', sessionId: s.id, learnerId: a.id, companyId: w.company, approvalId: w.places } })).rejects.toThrow();
    // Jamais de suppression physique d'un apprenant ou d'une session qui a des inscriptions (clés internes au module Formation). Les références vers
    // le module commercial (entreprise, contact, agrément) n'ont PAS de clé étrangère (invariant des frontières entre schémas, D161) : l'application ne
    // supprime jamais une entreprise ni un agrément, et aucune route ne le permet.
    await expect(db.learner.delete({ where: { id: a.id } })).rejects.toThrow();
    await expect(db.trainingSession.delete({ where: { id: s.id } })).rejects.toThrow();
    await expect(db.learner.update({ where: { id: a.id }, data: { phone: '0699' } })).rejects.toThrow(/learners_phone_format/);
    // Un doublon vivant est possible une fois l'inscription annulée.
    await api.call('POST', `/api/v1/enrollments/${e.body.id}/cancel`, { ...w.manager, body: { version: 1, reason: 'Désistement' } });
    expect((await w.enroll(w.marie, s.id, a.id, w.places)).status).toBe(201);
  });
});
