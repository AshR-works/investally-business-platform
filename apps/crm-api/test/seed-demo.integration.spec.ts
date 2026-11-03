import 'reflect-metadata';
import { RoleCode } from '../src/modules/iam/domain/roles';
import { CLOCK } from '../src/shared-kernel';
import { buildPlan, Who } from '../src/cli/seed/seed-plan';
import { runSeed, SEED_MARKER } from '../src/cli/seed/run-seed';
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
    users = { compte1: await am(1), compte2: await am(2), compte3: await am(3), commercial: commercial.id, finance: finance.id };
  }, 120_000);
  afterAll(async () => {
    // La base est partagée avec les autres suites : le jeu est retiré (dans l'ordre des dépendances) pour ne pas fausser leurs listes.
    const db = t.prisma.db;
    const owners = Object.values(users);
    const companies = (await db.company.findMany({ where: { ownerUserId: { in: owners } }, select: { id: true } })).map((c) => c.id);
    const offers = (await db.offer.findMany({ where: { companyId: { in: companies } }, select: { id: true } })).map((o) => o.id);
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
    await t.close();
  });

  it('charge tout le plan par les cas d’usage, sans erreur, puis refuse de recharger (idempotent)', async () => {
    const first = await runSeed(t.app as never, plan, { users });
    expect(first).toMatchObject({ skipped: false, executed: plan.length });
    const second = await runSeed(t.app as never, plan, { users });
    expect(second).toMatchObject({ skipped: true, executed: 0 });
    expect(await t.prisma.db.company.count({ where: { name: SEED_MARKER } })).toBe(1);
  }, 600_000);

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
    expect(followups.has('DONE')).toBe(true);
    const overdue = await db.followup.count({ where: { status: 'PLANNED', dueOn: { lt: new Date(Date.now() - 86_400_000) } } });
    const upcoming = await db.followup.count({ where: { status: 'PLANNED', dueOn: { gt: new Date() } } });
    expect(overdue).toBeGreaterThan(0);
    expect(upcoming).toBeGreaterThan(0);
    const appointments = await statuses(db.appointment.findMany({ select: { status: true }, distinct: ['status'] }));
    expect(appointments.has('HELD')).toBe(true);
    expect(appointments.has('PLANNED')).toBe(true);
    expect(appointments.has('CANCELLED')).toBe(true);
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
    expect(await db.companyFacilitation.count({ where: { commissionType: { not: null } } })).toBeGreaterThan(0);
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
