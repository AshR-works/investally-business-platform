import 'reflect-metadata';
import { RoleCode } from '../src/modules/iam/domain/roles';
import { CLOCK } from '../src/shared-kernel';
import { buildPlan, FORMATION_CLIENTS, RH_EMAIL_DOMAIN, Who } from '../src/cli/seed/seed-plan';
import { ListHierarchyGapsHandler } from '../src/modules/hr/application/employee-use-cases';
import { GetLeaveBalanceHandler } from '../src/modules/hr/application/leave-use-cases';
import { AuthorizationService } from '../src/modules/iam/application/authorization.service';
import { CATALOGUE_MARKER, LEARNERS_MARKER, runSeed, SEED_MARKER, TRAINERS_MARKER } from '../src/cli/seed/run-seed';
import { INDIVIDUALS_EMAIL_DOMAIN } from '../src/cli/seed/seed-plan';
import { createUserWithRoles } from './support/rbac-http';
import { startTestApp, TestApp } from './support/test-app';

const describeDb = process.env.DATABASE_URL && process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;

/** Jeu de données de démonstration : rejoué à travers les vrais cas d'usage sur une base PostgreSQL jetable, puis vérifié état par état. */
describeDb('Jeu de données de démonstration (cas d’usage + PostgreSQL)', () => {
  let t: TestApp;
  let users: Record<Who, string>;
  const plan = buildPlan({ anchor: new Date() });

  beforeAll(async () => {
    t = await startTestApp();
    const commercial = await createUserWithRoles(t, [RoleCode.HeadOfSales], { name: 'Hugo Responsable Commercial' });
    const am = async (n: number) => (await createUserWithRoles(t, [RoleCode.AccountManager], { managerId: commercial.id, name: `Chargé de compte ${n}` })).id;
    const finance = await createUserWithRoles(t, [RoleCode.Finance], { name: 'Félix Finance' });
    const investudy = await createUserWithRoles(t, [RoleCode.TrainingManager], { name: 'Inès Investudy' });
    const rh = await createUserWithRoles(t, [RoleCode.Hr], { name: 'Rita Ressources Humaines' });
    users = { compte1: await am(1), compte2: await am(2), compte3: await am(3), commercial: commercial.id, finance: finance.id, investudy: investudy.id, rh: rh.id };
  }, 120_000);
  afterAll(async () => {
    // La base est partagée avec les autres suites : le jeu est retiré (dans l'ordre des dépendances) pour ne pas fausser leurs listes.
    const db = t.prisma.db;
    const owners = Object.values(users);
    const companies = (await db.company.findMany({ where: { ownerUserId: { in: owners } }, select: { id: true } })).map((c) => c.id);
    const offers = (await db.offer.findMany({ where: { companyId: { in: companies } }, select: { id: true } })).map((o) => o.id);
    await db.commissionPayout.deleteMany({ where: { companyId: { in: companies } } });
    // Une inscription peut ne tenir au jeu que par sa session (apprenant d'une autre entreprise) : on la retire aussi, sinon la session ne peut pas être supprimée plus bas.
    await db.enrollment.deleteMany({ where: { OR: [{ companyId: { in: companies } }, { learner: { emailKey: { endsWith: LEARNERS_MARKER } } }, { learner: { emailKey: { endsWith: INDIVIDUALS_EMAIL_DOMAIN } } }, { session: { trainer: { emailKey: { endsWith: TRAINERS_MARKER } } } }] } });
    await db.learner.deleteMany({ where: { OR: [{ companyId: { in: companies } }, { emailKey: { endsWith: LEARNERS_MARKER } }, { emailKey: { endsWith: INDIVIDUALS_EMAIL_DOMAIN } }] } });
    await db.approval.deleteMany({ where: { companyId: { in: companies } } });
    await db.appointment.deleteMany({ where: { companyId: { in: companies } } });
    await db.followup.deleteMany({ where: { offerId: { in: offers } } });
    await db.receipt.deleteMany({ where: { offerId: { in: offers } } });
    await db.offer.deleteMany({ where: { id: { in: offers } } });
    await db.opportunity.deleteMany({ where: { companyId: { in: companies } } });
    await db.ambassador.deleteMany({ where: { ownerUserId: { in: owners } } });
    await db.contact.deleteMany({ where: { companyId: { in: companies } } });
    await db.companyFacilitation.deleteMany({ where: { companyId: { in: companies } } });
    await db.facilitator.deleteMany({ where: { ownerUserId: { in: owners } } });
    await db.company.deleteMany({ where: { id: { in: companies } } });
    // Catalogue Investudy posé par le jeu : certificats (et leurs modules liés), modules, programme, salle.
    const programs = (await db.program.findMany({ where: { name: 'Certificats Marchés financiers' }, select: { id: true } })).map((p) => p.id);
    await db.trainingSession.deleteMany({ where: { trainer: { emailKey: { endsWith: TRAINERS_MARKER } } } });
    await db.training.deleteMany({ where: { programId: { in: programs } } });
    await db.program.deleteMany({ where: { id: { in: programs } } });
    await db.courseModule.deleteMany({ where: { trainings: { none: {} }, title: { in: ['Fondations Économiques & Architecture de la Place Financière', 'Ingénierie des Instruments Financiers, Données & Acteurs de Marché', 'Asset Management, Construction & Évaluation de Portefeuille', 'Pratique du Trading, Décision d’Investissement & Analyse Quantitative', 'Ingénierie Financière, IPO & Levées de Fonds en Zone CEMAC', 'Réglementation des Marchés Financiers en Zone CEMAC & Pouvoirs de la COSUMAF', 'Portfolio Engineering, Asset Allocation & Live Trading (Capstone Project)'] } } });
    await db.room.deleteMany({ where: { name: { in: ['Salle de marchés', 'Salle de réunion'] } } });
    await db.trainer.deleteMany({ where: { emailKey: { endsWith: TRAINERS_MARKER } } });
    await db.journeyTask.deleteMany({ where: { journey: { employee: { workEmail: { endsWith: RH_EMAIL_DOMAIN } } } } });
    await db.journey.deleteMany({ where: { employee: { workEmail: { endsWith: RH_EMAIL_DOMAIN } } } });
    await db.contract.deleteMany({ where: { employee: { workEmail: { endsWith: RH_EMAIL_DOMAIN } } } });
    await db.leaveRequest.deleteMany({ where: { employee: { workEmail: { endsWith: RH_EMAIL_DOMAIN } } } });
    await db.employee.updateMany({ where: { workEmail: { endsWith: RH_EMAIL_DOMAIN } }, data: { managerEmployeeId: null } });
    await db.employee.deleteMany({ where: { workEmail: { endsWith: RH_EMAIL_DOMAIN } } });
    await t.close();
  });

  it('charge tout le plan par les cas d’usage, sans erreur, puis refuse de recharger (idempotent)', async () => {
    const first = await runSeed(t.app as never, plan, { users });
    expect(first).toMatchObject({ skipped: false, executed: plan.length, loaded: ['crm', 'catalogue', 'formateurs', 'sessions', 'inscriptions', 'rh', 'conges', 'contrats', 'parcours', 'particuliers'] });
    const second = await runSeed(t.app as never, plan, { users });
    expect(second).toMatchObject({ skipped: true, executed: 0 });
    // Contrats et parcours : par les cas d'usage, dans les règles (un seul contrat en cours, motifs de la liste, coches datées).
    const mine = { employee: { workEmail: { endsWith: RH_EMAIL_DOMAIN } } };
    expect(await t.prisma.db.contract.count({ where: mine })).toBe(12);
    expect(await t.prisma.db.contract.count({ where: { ...mine, status: 'ENDED', endReason: 'FIXED_TERM_END' } })).toBe(2);
    expect(await t.prisma.db.contract.count({ where: { ...mine, status: 'ACTIVE' } })).toBe(10);
    expect(await t.prisma.db.journey.count({ where: mine })).toBe(3);
    expect(await t.prisma.db.journey.count({ where: { ...mine, status: 'COMPLETED' } })).toBe(1);
    expect(await t.prisma.db.journeyTask.count({ where: { journey: mine, doneAt: { not: null }, doneByUserId: { not: null } } })).toBe(3 + 6);
    expect(await t.prisma.db.company.count({ where: { name: SEED_MARKER } })).toBe(1);
  }, 600_000);

  it('une démo ANCIENNE (sans catalogue ni formateurs) reçoit ces blocs sans que le reste soit touché ; un nouveau passage ne fait rien', async () => {
    const db = t.prisma.db;
    // On simule une base chargée avant l'arrivée du catalogue : on retire les blocs récents (les étudiants et particuliers, qui reposent sur les sessions, aussi).
    await db.enrollment.deleteMany({ where: { learner: { emailKey: { endsWith: INDIVIDUALS_EMAIL_DOMAIN } } } });
    await db.learner.deleteMany({ where: { emailKey: { endsWith: INDIVIDUALS_EMAIL_DOMAIN } } });
    await db.enrollment.deleteMany({ where: { learner: { emailKey: { endsWith: LEARNERS_MARKER } } } });
    await db.learner.deleteMany({ where: { emailKey: { endsWith: LEARNERS_MARKER } } });
    const clients = (await db.company.findMany({ where: { name: { in: FORMATION_CLIENTS.map(([name]) => name) } }, select: { id: true } })).map((c) => c.id);
    await db.approval.deleteMany({ where: { companyId: { in: clients } } });
    await db.opportunity.deleteMany({ where: { companyId: { in: clients } } });
    await db.company.deleteMany({ where: { id: { in: clients } } });
    await db.trainingSession.deleteMany({ where: { trainer: { emailKey: { endsWith: TRAINERS_MARKER } } } });
    await db.training.deleteMany({ where: { program: { name: CATALOGUE_MARKER } } });
    await db.program.deleteMany({ where: { name: CATALOGUE_MARKER } });
    await db.courseModule.deleteMany({ where: { trainings: { none: {} } } });
    await db.room.deleteMany({ where: { name: { in: ['Salle de marchés', 'Salle de réunion'] } } });
    await db.trainer.deleteMany({ where: { emailKey: { endsWith: TRAINERS_MARKER } } });
    const companiesBefore = await db.company.count();
    const auditBefore = await db.auditLog.count({ where: { entityType: 'Company' } });

    const logs: string[] = [];
    const reload = await runSeed(t.app as never, plan, { users, log: (line) => logs.push(line) });
    expect(reload).toMatchObject({ skipped: false, loaded: ['catalogue', 'formateurs', 'sessions', 'inscriptions', 'particuliers'], executed: 1 + 7 + 5 + 2 + 5 + 14 + 73 + 8 });
    expect(reload.counts).toMatchObject({ program: 1, module: 7, training: 5, room: 2, trainer: 5, session: 7, sessionOpen: 5, sessionPostpone: 1, sessionCancel: 1, learner: 12, enroll: 14, company: 5, approval: 5, individual: 3, enrollIndividual: 3, individualConfirm: 2 });
    // Les inscriptions du jeu : confirmées pour les sessions passées, en attente et annulée sur la session ouverte, deux à replacer ou replacées sur la session annulée.
    const byStatus = await t.prisma.db.enrollment.groupBy({ by: ['status'], where: { learner: { emailKey: { endsWith: LEARNERS_MARKER } } }, _count: { _all: true } });
    expect(Object.fromEntries(byStatus.map((r) => [r.status, r._count._all]))).toMatchObject({ CONFIRMED: expect.any(Number), PENDING: expect.any(Number) });
    expect(await t.prisma.db.learner.count({ where: { emailKey: { endsWith: LEARNERS_MARKER } } })).toBe(12);
    expect(logs.filter((line) => /non créée|non fait/.test(line))).toEqual([]);
    // Quatorze inscriptions plus le replacement : aucune n'a manqué d'agrément.
    expect(await t.prisma.db.enrollment.count({ where: { learner: { emailKey: { endsWith: LEARNERS_MARKER } } } })).toBe(15);
    expect(await t.prisma.db.enrollment.count({ where: { status: 'TO_REPLACE', learner: { emailKey: { endsWith: LEARNERS_MARKER } } } })).toBe(1);
    expect(reload.counts.company).toBe(5); // seules les cinq entreprises clientes de formation du bloc « inscriptions » sont créées : le reste du jeu n'est pas touché
    expect(await db.company.count()).toBe(companiesBefore + 5);
    expect(await db.auditLog.count({ where: { entityType: 'Company' } })).toBeGreaterThan(auditBefore); // les cinq créations
    expect(await db.program.count({ where: { name: CATALOGUE_MARKER } })).toBe(1);
    expect(await db.trainer.count({ where: { emailKey: { endsWith: TRAINERS_MARKER } } })).toBe(5);

    expect(await runSeed(t.app as never, plan, { users })).toMatchObject({ skipped: true, executed: 0, loaded: [] });
  }, 300_000);

  it('le bloc des inscriptions se charge seul sur une démo plus ancienne dont les sessions ont d’autres dates (retrouvées par leur rang)', async () => {
    const db = t.prisma.db;
    // On retire le bloc des inscriptions, puis on décale de deux semaines les sessions déjà en base, comme dans une démo chargée plus tôt.
    await db.enrollment.deleteMany({ where: { learner: { emailKey: { endsWith: LEARNERS_MARKER } } } });
    await db.learner.deleteMany({ where: { emailKey: { endsWith: LEARNERS_MARKER } } });
    const clients = (await db.company.findMany({ where: { name: { in: FORMATION_CLIENTS.map(([name]) => name) } }, select: { id: true } })).map((c) => c.id);
    await db.approval.deleteMany({ where: { companyId: { in: clients } } });
    await db.opportunity.deleteMany({ where: { companyId: { in: clients } } });
    await db.company.deleteMany({ where: { id: { in: clients } } });
    await db.$executeRaw`UPDATE training.sessions SET start_date = start_date + 14, end_date = end_date + 14 WHERE trainer_id IN (SELECT id FROM training.trainers WHERE email_key LIKE ${'%' + TRAINERS_MARKER})`;

    const logs: string[] = [];
    const reload = await runSeed(t.app as never, plan, { users, log: (line) => logs.push(line) });
    expect(reload).toMatchObject({ skipped: false, loaded: ['inscriptions'] });
    // La session annulée l'est déjà dans cette démo : ses deux inscrits (et le replacement) ne sont pas recréés ; tout le reste l'est, sans autre manque.
    expect(logs.filter((line) => /non créée|non fait/.test(line)).filter((line) => !/inscription-1[34]|déjà annulée/.test(line))).toEqual([]);
    expect(logs.filter((line) => /déjà annulée/.test(line))).toHaveLength(2);
    expect(await db.enrollment.count({ where: { learner: { emailKey: { endsWith: LEARNERS_MARKER } } } })).toBe(12);
    expect(await runSeed(t.app as never, plan, { users })).toMatchObject({ skipped: true, loaded: [] });
  }, 300_000);

  it('le bloc « rh » : onze fiches fictives (dix en poste, une sortie), hiérarchie et comptes liés, un seul écart voulu ; il se charge seul sur une démo plus ancienne', async () => {
    const db = t.prisma.db;
    const rows = await db.employee.findMany({ where: { workEmail: { endsWith: RH_EMAIL_DOMAIN } } });
    expect(rows).toHaveLength(11);
    expect(rows.filter((e) => e.status === 'ACTIVE')).toHaveLength(10);
    const left = rows.filter((e) => e.status === 'ARCHIVED');
    expect(left).toHaveLength(1);
    expect(left[0]).toMatchObject({ archiveReason: expect.stringContaining('démonstration') });
    expect(left[0]!.leftOn).not.toBeNull();
    expect(rows.filter((e) => e.managerEmployeeId === null)).toHaveLength(1); // le directeur général seul n'a pas de responsable
    expect(new Set(rows.flatMap((e) => (e.userId ? [e.userId] : [])).sort())).toEqual(new Set([users.rh, users.finance, users.commercial, users.compte1, users.compte2, users.compte3, users.investudy].sort()));
    // La hiérarchie des comptes n'a pas été touchée ; un seul écart est signalé : la Finance (responsable RH : la DGA, compte sans responsable).
    const access = await t.get<AuthorizationService>(AuthorizationService as never).contextFor(users.rh);
    // La base est partagée : les écarts d'autres suites (leurs employés de test) ne comptent pas, on ne regarde que ceux du jeu de démonstration.
    const demoIds = new Set(rows.map((e) => e.id));
    const gaps = (await t.get<ListHierarchyGapsHandler>(ListHierarchyGapsHandler as never).execute({ access })).filter((g) => demoIds.has(g.employeeId));
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({ employeeName: expect.stringContaining('Nkodo'), hrManagerName: expect.stringContaining('Tchoumi'), accountManagerName: null });
    // Chargé seul sur une démo qui n'a pas de bloc RH.
    await db.journeyTask.deleteMany({ where: { journey: { employee: { workEmail: { endsWith: RH_EMAIL_DOMAIN } } } } });
    await db.journey.deleteMany({ where: { employee: { workEmail: { endsWith: RH_EMAIL_DOMAIN } } } });
    await db.contract.deleteMany({ where: { employee: { workEmail: { endsWith: RH_EMAIL_DOMAIN } } } });
    await db.leaveRequest.deleteMany({ where: { employee: { workEmail: { endsWith: RH_EMAIL_DOMAIN } } } });
    await db.employee.updateMany({ where: { workEmail: { endsWith: RH_EMAIL_DOMAIN } }, data: { managerEmployeeId: null } });
    await db.employee.deleteMany({ where: { workEmail: { endsWith: RH_EMAIL_DOMAIN } } });
    expect(await runSeed(t.app as never, plan, { users })).toMatchObject({ skipped: false, loaded: ['rh', 'conges', 'contrats', 'parcours'], executed: 12 + 9 + 14 + 12 });
    expect(await runSeed(t.app as never, plan, { users })).toMatchObject({ skipped: true, loaded: [] });
  }, 300_000);

  it('le bloc « conges » : sept demandes fictives par les cas d’usage, des soldes cohérents, trois en attente (dont une pour la RH), un refus motivé ; il se charge seul sur une démo qui a déjà le personnel', async () => {
    const db = t.prisma.db;
    const where = { employee: { workEmail: { endsWith: RH_EMAIL_DOMAIN } } };
    const rows = await db.leaveRequest.findMany({ where, include: { employee: true, leaveType: true } });
    expect(rows).toHaveLength(7);
    const count = (status: string) => rows.filter((r) => r.status === status).length;
    expect([count('PENDING'), count('APPROVED'), count('REJECTED')]).toEqual([3, 3, 1]);
    // Saisies par la RH (validées d’emblée) : l’absence passée et le congé du support.
    expect(rows.filter((r) => r.status === 'APPROVED' && r.employee.workEmail?.startsWith('sonia.manga'))).toHaveLength(1);
    const refused = rows.find((r) => r.status === 'REJECTED')!;
    expect(refused.decisionNote).toMatch(/clôture du trimestre/);
    expect(rows.find((r) => r.endHalf && r.startDate.getTime() === r.endDate.getTime())).toBeDefined(); // la demi-journée
    // Le solde de la RH voit les jours pris et en attente d’une personne du jeu.
    const access = await t.get<AuthorizationService>(AuthorizationService as never).contextFor(users.rh);
    const karim = rows.find((r) => r.employee.workEmail?.startsWith('karim.biya') && r.leaveType.code === 'ANNUAL')!;
    const balance = await t.get<GetLeaveBalanceHandler>(GetLeaveBalanceHandler as never).execute({ employeeId: karim.employeeId, year: karim.startDate.getUTCFullYear(), access });
    expect(balance.taken + balance.pending).toBeGreaterThan(0);
    expect(balance.available).toBeLessThan(balance.entitlement + balance.adjustments);
    // Chargé seul sur une démo qui a déjà le personnel mais pas ses absences.
    await db.leaveRequest.deleteMany({ where });
    expect(await runSeed(t.app as never, plan, { users })).toMatchObject({ skipped: false, loaded: ['conges'], executed: 9 });
    expect(await db.leaveRequest.count({ where })).toBe(7);
    expect(await runSeed(t.app as never, plan, { users })).toMatchObject({ skipped: true, loaded: [] });
  }, 300_000);

  it('le bloc « particuliers » : trois apprenants sans entreprise, trois inscriptions avec payeur (aucun agrément), deux confirmées ; il se charge seul', async () => {
    const db = t.prisma.db;
    const where = { kind: { not: 'COMPANY' as const }, emailKey: { endsWith: INDIVIDUALS_EMAIL_DOMAIN } };
    const people = await db.learner.findMany({ where });
    expect(people).toHaveLength(3);
    expect(people.every((p) => p.companyId === null && p.contactId === null)).toBe(true);
    expect(people.map((p) => p.kind).sort()).toEqual(['INDIVIDUAL', 'STUDENT', 'STUDENT']);
    const rows = await db.enrollment.findMany({ where: { learnerId: { in: people.map((p) => p.id) } } });
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.companyId === null && r.approvalId === null && r.chargedAmount !== null)).toBe(true);
    expect(rows.map((r) => r.payerKind).sort()).toEqual(['SELF', 'THIRD_PARTY', 'THIRD_PARTY']);
    expect(rows.filter((r) => r.status === 'CONFIRMED')).toHaveLength(2);
    expect(rows.filter((r) => r.status === 'PENDING')).toHaveLength(1);
    expect(rows.filter((r) => r.payerKind === 'THIRD_PARTY').map((r) => r.payerType).sort()).toEqual(['EMPLOYER', 'FAMILY']);
    // Chargé seul sur une démo qui n'a pas ce bloc.
    await db.enrollment.deleteMany({ where: { learnerId: { in: people.map((p) => p.id) } } });
    await db.learner.deleteMany({ where });
    expect(await runSeed(t.app as never, plan, { users })).toMatchObject({ skipped: false, loaded: ['particuliers'], executed: 3 + 3 + 2 });
    expect(await db.learner.count({ where })).toBe(3);
    expect(await runSeed(t.app as never, plan, { users })).toMatchObject({ skipped: true, loaded: [] });
  }, 300_000);

  it('l’horloge est rendue à son état normal après le chargement', () => {
    const clock = t.get(CLOCK as never) as unknown as { now(): Date };
    expect(Math.abs(clock.now().getTime() - Date.now())).toBeLessThan(1000);
  });

  it('répartit les entreprises entre les trois chargés de compte et sur douze mois', async () => {
    const db = t.prisma.db;
    const companies = await db.company.findMany({ where: { name: { in: ['Banque du Wouri Capital', 'Groupe Équateur Énergie'] } } });
    expect(companies).toHaveLength(2);
    const owners = await db.company.groupBy({ by: ['ownerUserId'], _count: true, where: { ownerUserId: { in: [users.compte1, users.compte2, users.compte3] } } });
    expect(owners).toHaveLength(3);
    for (const o of owners) expect(o._count).toBeGreaterThanOrEqual(10);
    const oldest = await db.company.aggregate({ _min: { createdAt: true } });
    expect((Date.now() - oldest._min.createdAt!.getTime()) / 86_400_000).toBeGreaterThan(330);
  });

  it('couvre chaque état métier : statuts d’entreprise, offres, relances, rendez-vous, opportunités, agréments, ambassadeurs', async () => {
    const db = t.prisma.db;
    const statuses = async (rows: Promise<{ status: string }[]>) => new Set((await rows).map((r) => r.status));
    const companyStatuses = await statuses(db.company.findMany({ where: { ownerUserId: { in: Object.values(users) } }, select: { status: true }, distinct: ['status'] }));
    expect([...companyStatuses].sort()).toEqual(['CLIENT', 'CONTACTED', 'QUALIFIED', 'TARGET']);
    expect(await statuses(db.offer.findMany({ select: { status: true }, distinct: ['status'] }))).toEqual(expect.objectContaining({}));
    const offers = await statuses(db.offer.findMany({ select: { status: true }, distinct: ['status'] }));
    for (const s of ['DRAFT', 'SUBMITTED', 'RECEIPT_RECEIVED', 'ACCEPTED', 'REFUSED', 'WITHDRAWN']) expect([s, offers.has(s)]).toEqual([s, true]);
    const followups = await statuses(db.followup.findMany({ select: { status: true }, distinct: ['status'] }));
    expect(followups.has('PLANNED')).toBe(true);
    expect(followups.has('CANCELLED')).toBe(true);
    const byOffer = await db.followup.groupBy({ by: ['offerId'], _count: true });
    expect(Math.max(...byOffer.map((g) => g._count))).toBeGreaterThanOrEqual(2);
    expect((await db.receipt.findMany({ select: { status: true }, distinct: ['status'] })).map((r) => r.status).sort()).toEqual(['CANCELLED', 'VALID']);
    const reassigned = await db.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM audit.audit_logs WHERE entity_type = 'Company' AND action = 'UPDATE' AND old_value->>'ownerUserId' IS DISTINCT FROM new_value->>'ownerUserId'`;
    expect(Number(reassigned[0]!.n)).toBeGreaterThanOrEqual(3);
    const duplicates = await db.contact.groupBy({ by: ['companyId', 'firstName', 'lastName'], _count: true, having: { companyId: { _count: { gt: 1 } } } });
    expect(duplicates.length).toBeGreaterThanOrEqual(3);
    expect(await db.ambassador.count({ where: { version: { gt: 1 } } })).toBeGreaterThanOrEqual(2);
    expect(followups.has('DONE')).toBe(true);
    const overdue = await db.followup.count({ where: { status: 'PLANNED', dueOn: { lt: new Date(Date.now() - 86_400_000) } } });
    const upcoming = await db.followup.count({ where: { status: 'PLANNED', dueOn: { gt: new Date() } } });
    expect(overdue).toBeGreaterThan(0);
    expect(upcoming).toBeGreaterThan(0);
    const appointments = await statuses(db.appointment.findMany({ select: { status: true }, distinct: ['status'] }));
    expect(appointments.has('HELD')).toBe(true);
    expect(appointments.has('PLANNED')).toBe(true);
    expect(appointments.has('CANCELLED')).toBe(true);
    expect(await db.appointment.count({ where: { status: 'PLANNED', startsAt: { gt: new Date() } } })).toBeGreaterThanOrEqual(6);
    expect(await db.appointment.count({ where: { status: 'PLANNED', startsAt: { gt: new Date() } } })).toBeGreaterThan(0);
    const opportunities = await db.opportunity.findMany({ select: { stage: true, status: true } });
    expect(new Set(opportunities.map((o) => o.stage)).size).toBeGreaterThanOrEqual(4);
    expect(new Set(opportunities.map((o) => o.status))).toEqual(expect.objectContaining({}));
    for (const s of ['OPEN', 'WON', 'LOST']) expect([s, opportunities.some((o) => o.status === s)]).toEqual([s, true]);
    const approvals = await statuses(db.approval.findMany({ select: { status: true }, distinct: ['status'] }));
    for (const s of ['RECEIVED', 'HONORED', 'EXPIRED', 'CANCELLED']) expect([s, approvals.has(s)]).toEqual([s, true]);
    expect(approvals.has('REQUESTED') || (await db.approval.count({ where: { payerName: { not: null } } })) > 0).toBe(true);
    expect(await db.approval.count({ where: { payerName: { not: null } } })).toBeGreaterThan(0);
    const ambassadors = await db.ambassador.findMany({ select: { origin: true } });
    expect(new Set(ambassadors.map((a) => a.origin))).toEqual(new Set(['CLIENT', 'LEARNER']));
    expect(await db.facilitator.count()).toBeGreaterThanOrEqual(3);
    const payouts = await statuses(db.commissionPayout.findMany({ select: { status: true }, distinct: ['status'] }));
    for (const s of ['DUE', 'ON_HOLD', 'RELEASED', 'CANCELLED']) expect([s, payouts.has(s)]).toEqual([s, true]);
    expect(await db.companyFacilitation.count({ where: { commissionType: { not: null } } })).toBeGreaterThan(0);

    // Catalogue Investudy : cinq certificats, sept modules partagés, ordre propre à chaque certificat, tarifs, salle de marchés.
    const certificates = await db.training.findMany({ where: { program: { name: 'Certificats Marchés financiers' } }, include: { modules: { orderBy: { position: 'asc' } } }, orderBy: { title: 'asc' } });
    expect(certificates).toHaveLength(5);
    expect(await db.courseModule.count({ where: { title: { contains: 'Zone CEMAC' } } })).toBeGreaterThanOrEqual(2);
    const expert = certificates.find((c) => c.title.includes('Expert'))!;
    expect([expert.priceAmount?.toFixed(2), expert.modulePriceAmount?.toFixed(2), expert.priceCurrency, expert.modules.length]).toEqual(['750000.00', '125000.00', 'XAF', 7]);
    const students = certificates.find((c) => c.title.includes('Étudiants'))!;
    expect([students.priceAmount?.toFixed(2), students.modulePriceAmount?.toFixed(2), students.modules.length]).toEqual(['250000.00', '75000.00', 5]);
    const room = await db.room.findFirstOrThrow({ where: { name: 'Salle de marchés' } });
    expect([room.kind, room.learnerSeats, room.unavailableSeats, room.trainerSeats]).toEqual(['WORKSTATIONS', 14, 1, 1]);
    const meeting = await db.room.findFirstOrThrow({ where: { name: 'Salle de réunion' } });
    expect([meeting.kind, meeting.learnerSeats, meeting.equipment]).toEqual(['CLASSROOM', 16, 'Écran 65 pouces (pas de vidéoprojecteur).']);
    expect((await db.courseModule.findMany({ where: { requiresWorkstations: true }, select: { title: true } })).map((m) => m.title.split(' ')[0]).sort()).toEqual(expect.arrayContaining(['Pratique', 'Portfolio']));
  });

  it('tous les numéros enregistrés respectent la règle, et le journal d’audit raconte le chargement', async () => {
    const db = t.prisma.db;
    const pattern = /^\+?[1-9][0-9]{7,14}$/;
    for (const row of await db.contact.findMany({ select: { phone: true } })) if (row.phone) expect(row.phone).toMatch(pattern);
    for (const row of await db.company.findMany({ select: { phone: true } })) if (row.phone) expect(row.phone).toMatch(pattern);
    for (const row of await db.facilitator.findMany({ select: { phone: true } })) expect(row.phone).toMatch(pattern);
    expect(await db.auditLog.count()).toBeGreaterThan(plan.length / 2);
  });
});
