import 'reflect-metadata';
import { PrismaLeaveRequestRepository } from '../src/modules/hr/infrastructure/prisma-leave.repositories';
import { RoleCode } from '../src/modules/iam/domain/roles';
import { Api, createUserWithRoles, mfaSession, startRbacApp } from './support/rbac-http';
import { TestApp } from './support/test-app';

const describeDb = process.env.DATABASE_URL && process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;
const NIL = '00000000-0000-4000-8000-000000000000';

/** Un lundi dans `weeks` semaines (jamais dans le passé : une demande ne se pose pas rétroactivement). */
function monday(weeks: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7));
  return d.toISOString().slice(0, 10);
}
const addDays = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const yearOf = (iso: string) => Number(iso.slice(0, 4));

/**
 * RH-2a : absences et congés de bout en bout (HTTP + PostgreSQL) : types et règles de départ, cycle demande, validation, annulation, droits et portée (responsable
 * de l'organigramme, RH, Direction, tiers), solde, calendrier d'équipe, verrou des demandes simultanées, règles garanties par la base, verrou optimiste, audit,
 * paramétrage par la RH.
 */
describeDb('Absences et congés (HTTP + PostgreSQL)', () => {
  let t: TestApp;
  let api: Api;
  let seq = 0;
  const ip = () => `10.95.${Math.floor(seq / 250)}.${(seq++ % 250) + 1}`;

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
  type As = { token: string; ip: string };
  const unique = () => Math.random().toString(36).slice(2, 8);

  async function world() {
    const hrUser = await createUserWithRoles(t, [RoleCode.Hr]);
    const dirUser = await createUserWithRoles(t, [RoleCode.Direction]);
    const bossUser = await createUserWithRoles(t, [RoleCode.HeadOfSales]);
    const memberUser = await createUserWithRoles(t, [RoleCode.AccountManager]);
    const colleagueUser = await createUserWithRoles(t, [RoleCode.AccountManager]);
    const strangerUser = await createUserWithRoles(t, [RoleCode.Support]);
    const [hr, dir, boss, member, colleague, stranger] = [await login(hrUser), await login(dirUser), await login(bossUser), await login(memberUser), await login(colleagueUser), await login(strangerUser)];
    const employee = async (name: string, userId: string | null, managerEmployeeId: string | null, department = 'Commercial', hiredOn = '2020-01-01') => {
      const res = await api.call('POST', '/api/v1/hr/employees', { ...hr, body: { lastName: `${name}-${unique()}`, firstName: name, jobTitle: 'Poste', department, hiredOn, ...(userId ? { userId } : {}), ...(managerEmployeeId ? { managerEmployeeId } : {}) } });
      expect(res.status).toBe(201);
      return res.body as { id: string; lastName: string };
    };
    const bossEmp = await employee('Bruno', bossUser.id, null);
    const memberEmp = await employee('Marie', memberUser.id, bossEmp.id);
    const colleagueEmp = await employee('Coralie', colleagueUser.id, bossEmp.id);
    const strangerEmp = await employee('Serge', strangerUser.id, null, 'Support');
    const types = (await api.call('GET', '/api/v1/hr/leave/types', hr)).body as { id: string; code: string }[];
    const annual = types.find((x) => x.code === 'ANNUAL')!.id;
    const sick = types.find((x) => x.code === 'SICK')!.id;
    return { hr, dir, boss, member, colleague, stranger, bossEmp, memberEmp, colleagueEmp, strangerEmp, annual, sick };
  }
  type World = Awaited<ReturnType<typeof world>>;
  const request = (as: As, body: Record<string, unknown>) => api.call('POST', '/api/v1/hr/leave/requests', { ...as, body });

  it('types, règles et jours fériés de départ : cinq types usuels, règles « à confirmer », aucun jour férié présumé', async () => {
    const w = await world();
    const types = (await api.call('GET', '/api/v1/hr/leave/types', w.member)).body as { code: string; deductsBalance: boolean; active: boolean }[];
    expect(types.map((x) => x.code)).toEqual(expect.arrayContaining(['ANNUAL', 'SICK', 'SPECIAL', 'UNPAID', 'PARENTAL']));
    expect(types.find((x) => x.code === 'ANNUAL')!.deductsBalance).toBe(true);
    for (const x of types.filter((y) => y.code !== 'ANNUAL' && ['SICK', 'SPECIAL', 'UNPAID', 'PARENTAL'].includes(y.code))) expect(x.deductsBalance).toBe(false);
    expect((await api.call('GET', '/api/v1/hr/leave/settings', w.member)).body).toMatchObject({ accrualDaysPerMonth: 1.5, countsSaturday: false, allowHalfDays: true, allowNegativeBalance: false });
    expect((await api.call('GET', `/api/v1/hr/leave/holidays?year=${yearOf(monday(1))}`, w.member)).body).toEqual([]);
  });

  it('cycle complet : demande → le responsable de l’organigramme valide → solde, calendrier → la RH annule avec un motif ; tout est audité', async () => {
    const w = await world();
    const start = monday(2);
    const end = addDays(start, 4);
    const asked = await request(w.member, { leaveTypeId: w.annual, start, end, note: 'Voyage' });
    expect(asked.status).toBe(201);
    expect(asked.body).toMatchObject({ employeeId: w.memberEmp.id, status: 'PENDING', days: 5, start, end, note: 'Voyage', version: 1 });

    // Le responsable voit la demande dans sa liste d'équipe ; la collègue, non ; l'employée la voit dans les siennes.
    expect(((await api.call('GET', '/api/v1/hr/leave/requests?view=team&status=PENDING', w.boss)).body.items as { id: string }[]).map((r) => r.id)).toEqual([asked.body.id]);
    expect((await api.call('GET', '/api/v1/hr/leave/requests?view=team', w.colleague)).body.items).toEqual([]);
    expect(((await api.call('GET', '/api/v1/hr/leave/requests', w.member)).body.items as { id: string }[]).map((r) => r.id)).toEqual([asked.body.id]);

    // Solde : 5 jours réservés.
    const year = yearOf(start);
    expect((await api.call('GET', `/api/v1/hr/leave/balance?year=${year}`, w.member)).body).toMatchObject({ entitlement: 18, taken: 0, pending: 5, available: 13 });

    const approved = await api.call('POST', `/api/v1/hr/leave/requests/${asked.body.id}/decision`, { ...w.boss, body: { decision: 'APPROVE', version: 1 } });
    expect(approved.status).toBe(200);
    expect(approved.body).toMatchObject({ status: 'APPROVED', version: 2 });
    expect((await api.call('GET', `/api/v1/hr/leave/balance?year=${year}`, w.member)).body).toMatchObject({ taken: 5, pending: 0, available: 13 });

    // Calendrier d'équipe : la collègue voit « absente » sans le type ; le responsable voit le type.
    const calendarOf = (as: As) => api.call('GET', `/api/v1/hr/leave/calendar?from=${start}&to=${end}`, as);
    const colleagueView = await calendarOf(w.colleague);
    expect(colleagueView.status).toBe(200);
    const entry = (colleagueView.body.entries as { employeeId: string; leaveTypeLabel: string | null }[]).find((e) => e.employeeId === w.memberEmp.id)!;
    expect(entry.leaveTypeLabel).toBeNull();
    expect((await calendarOf(w.boss)).body.entries.find((e: { employeeId: string }) => e.employeeId === w.memberEmp.id).leaveTypeLabel).toBe('Congé annuel');

    // Annulation par la RH d'une demande validée : motif obligatoire.
    const noReason = await api.call('POST', `/api/v1/hr/leave/requests/${asked.body.id}/cancel`, { ...w.hr, body: { version: 2 } });
    expect(noReason.status).toBe(400);
    const cancelled = await api.call('POST', `/api/v1/hr/leave/requests/${asked.body.id}/cancel`, { ...w.hr, body: { version: 2, reason: 'Erreur de saisie' } });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body).toMatchObject({ status: 'CANCELLED', cancelReason: 'Erreur de saisie' });
    expect((await api.call('GET', `/api/v1/hr/leave/balance?year=${year}`, w.member)).body).toMatchObject({ taken: 0, pending: 0, available: 18 });
    expect((await calendarOf(w.colleague)).body.entries).toEqual([]);

    // Audit : création, validation, annulation, avec avant et après.
    const logs = await t.prisma.db.auditLog.findMany({ where: { entityId: asked.body.id }, orderBy: { createdAt: 'asc' } });
    expect(logs.map((l) => l.action)).toEqual(['CREATE', 'UPDATE', 'UPDATE']);
    expect(logs[1]!.sessionId).toBe(w.boss.sessionId);
    expect(logs[2]!.sessionId).toBe(w.hr.sessionId);
  }, 120_000);

  it('droits et portée : un tiers reçoit « introuvable », la Direction lit mais ne valide pas, personne ne valide sa propre demande', async () => {
    const w = await world();
    const start = monday(3);
    const asked = await request(w.member, { leaveTypeId: w.annual, start, end: start });
    const id = asked.body.id as string;
    const strangerRead = await api.call('GET', `/api/v1/hr/leave/requests/${id}`, w.stranger);
    const missingRead = await api.call('GET', `/api/v1/hr/leave/requests/${NIL}`, w.stranger);
    expect([strangerRead.status, strangerRead.body]).toEqual([missingRead.status, missingRead.body]);
    expect(strangerRead.status).toBe(404);
    expect((await api.call('GET', `/api/v1/hr/leave/requests/${id}`, w.colleague)).status).toBe(404);
    expect((await api.call('POST', `/api/v1/hr/leave/requests/${id}/decision`, { ...w.colleague, body: { decision: 'APPROVE', version: 1 } })).status).toBe(404);
    for (const reader of [w.member, w.boss, w.hr, w.dir]) expect((await api.call('GET', `/api/v1/hr/leave/requests/${id}`, reader)).status).toBe(200);
    // La Direction voit tout mais n'est pas le responsable de Marie : « interdit ». Marie ne valide pas sa propre demande.
    expect((await api.call('POST', `/api/v1/hr/leave/requests/${id}/decision`, { ...w.dir, body: { decision: 'APPROVE', version: 1 } })).status).toBe(403);
    expect((await api.call('POST', `/api/v1/hr/leave/requests/${id}/decision`, { ...w.member, body: { decision: 'APPROVE', version: 1 } })).status).toBe(403);
    expect((await api.call('GET', `/api/v1/hr/leave/requests/${id}`, w.hr)).body.status).toBe('PENDING');
    // Lister toutes les demandes : RH et Direction seulement.
    expect((await api.call('GET', '/api/v1/hr/leave/requests?view=all', w.hr)).status).toBe(200);
    expect((await api.call('GET', '/api/v1/hr/leave/requests?view=all', w.dir)).status).toBe(200);
    for (const denied of [w.member, w.boss, w.stranger]) expect((await api.call('GET', '/api/v1/hr/leave/requests?view=all', denied)).status).toBe(403);
    // Sans connexion : 401.
    expect((await api.call('GET', '/api/v1/hr/leave/requests')).status).toBe(401);
    // Refus motivé par le responsable.
    expect((await api.call('POST', `/api/v1/hr/leave/requests/${id}/decision`, { ...w.boss, body: { decision: 'REJECT', version: 1 } })).status).toBe(400);
    const rejected = await api.call('POST', `/api/v1/hr/leave/requests/${id}/decision`, { ...w.boss, body: { decision: 'REJECT', note: 'Clôture annuelle', version: 1 } });
    expect(rejected.body).toMatchObject({ status: 'REJECTED', decisionNote: 'Clôture annuelle' });
    // Une demande refusée ne se rouvre pas.
    expect((await api.call('POST', `/api/v1/hr/leave/requests/${id}/decision`, { ...w.boss, body: { decision: 'APPROVE', version: 1 } })).status).toBe(409);
  }, 120_000);

  it('la RH saisit pour un employé (validée d’emblée) ; un employé ne saisit que pour lui ; le passé est réservé à la RH', async () => {
    const w = await world();
    const start = monday(4);
    const proxy = await request(w.hr, { employeeId: w.memberEmp.id, leaveTypeId: w.annual, start, end: start });
    expect(proxy.status).toBe(201);
    expect(proxy.body.status).toBe('APPROVED');
    const forOther = await request(w.member, { employeeId: w.colleagueEmp.id, leaveTypeId: w.annual, start, end: start });
    const forMissing = await request(w.member, { employeeId: NIL, leaveTypeId: w.annual, start, end: start });
    expect([forOther.status, forOther.body]).toEqual([forMissing.status, forMissing.body]);
    expect(forOther.status).toBe(404);
    const yesterday = addDays(new Date().toISOString().slice(0, 10), -3);
    const pastDay = new Date(`${yesterday}T00:00:00Z`).getUTCDay() === 0 ? addDays(yesterday, -2) : new Date(`${yesterday}T00:00:00Z`).getUTCDay() === 6 ? addDays(yesterday, -1) : yesterday;
    expect((await request(w.member, { leaveTypeId: w.annual, start: pastDay, end: pastDay })).status).toBe(400);
    expect((await request(w.hr, { employeeId: w.memberEmp.id, leaveTypeId: w.annual, start: pastDay, end: pastDay })).status).toBe(201);
  }, 120_000);

  it('validations : dates, identifiants, champs inconnus, période sans jour ouvré, chevauchement, solde', async () => {
    const w = await world();
    const start = monday(5);
    const post = (body: Record<string, unknown>) => request(w.member, body);
    expect((await post({ leaveTypeId: w.annual, start: '2026-02-30', end: '2026-03-02' })).status).toBe(400);
    expect((await post({ leaveTypeId: w.annual, start: 'demain', end: start })).status).toBe(400);
    expect((await post({ leaveTypeId: 'pas-un-uuid', start, end: start })).status).toBe(400);
    expect((await post({ leaveTypeId: w.annual, start, end: start, diagnostic: 'grippe' })).status).toBe(400);
    expect((await post({ leaveTypeId: w.annual, start: addDays(start, 1), end: addDays(start, 0) })).status).toBe(400);
    // Week-end seulement : aucun jour décompté.
    const saturday = addDays(start, 5);
    const weekend = await post({ leaveTypeId: w.annual, start: saturday, end: addDays(saturday, 1) });
    expect(weekend.status).toBe(400);
    expect(JSON.stringify(weekend.body)).toContain('Aucun jour décompté');
    // Chevauchement.
    expect((await post({ leaveTypeId: w.annual, start, end: addDays(start, 2) })).status).toBe(201);
    expect((await post({ leaveTypeId: w.sick, start: addDays(start, 2), end: addDays(start, 3) })).status).toBe(409);
    // Une matinée et un après-midi du même jour ne se chevauchent pas.
    const other = monday(6);
    expect((await post({ leaveTypeId: w.annual, start: other, end: other, endHalf: true })).body.days).toBe(0.5);
    expect((await post({ leaveTypeId: w.annual, start: other, end: other, startHalf: true })).body.days).toBe(0.5);
    expect((await post({ leaveTypeId: w.annual, start: other, end: other })).status).toBe(409);
    // Solde : une demande d'un an dépasse les 18 jours.
    const far = monday(8);
    const tooLong = await post({ leaveTypeId: w.annual, start: far, end: addDays(far, 40) });
    expect(tooLong.status).toBe(422);
    expect(JSON.stringify(tooLong.body)).toContain('Solde insuffisant');
    // Un type qui ne décompte pas le solde n'est pas limité par lui.
    expect((await post({ leaveTypeId: w.sick, start: far, end: addDays(far, 40) })).status).toBe(201);
  }, 120_000);

  it('deux demandes simultanées du même employé qui se chevauchent : une seule passe (verrou de sa fiche)', async () => {
    const w = await world();
    const start = monday(10);
    const results = await Promise.all([1, 2, 3].map(() => request(w.member, { leaveTypeId: w.sick, start, end: addDays(start, 1) })));
    expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409]);
    const mine = await api.call('GET', '/api/v1/hr/leave/requests', w.member);
    expect(mine.body.items.filter((r: { start: string }) => r.start === start)).toHaveLength(1);
  }, 120_000);

  it('les règles du responsable : seul le responsable DIRECT valide, jamais le supérieur du responsable', async () => {
    const w = await world();
    // Coralie rend compte à Bruno ; Bruno (HeadOfSales) n'a pas de responsable. Une employée dont le responsable est Marie : Marie valide, pas Bruno.
    const underlingUser = await createUserWithRoles(t, [RoleCode.AccountManager]);
    const underling = await login(underlingUser);
    const res = await api.call('POST', '/api/v1/hr/employees', { ...w.hr, body: { lastName: `Sous-${unique()}`, firstName: 'Sam', jobTitle: 'Poste', department: 'Commercial', hiredOn: '2020-01-01', userId: underlingUser.id, managerEmployeeId: w.memberEmp.id } });
    expect(res.status).toBe(201);
    const start = monday(11);
    const asked = await request(underling, { leaveTypeId: w.annual, start, end: start });
    expect(asked.status).toBe(201);
    expect((await api.call('POST', `/api/v1/hr/leave/requests/${asked.body.id}/decision`, { ...w.boss, body: { decision: 'APPROVE', version: 1 } })).status).toBe(404);
    expect((await api.call('POST', `/api/v1/hr/leave/requests/${asked.body.id}/decision`, { ...w.member, body: { decision: 'APPROVE', version: 1 } })).status).toBe(200);
  }, 120_000);

  it('paramétrage par la RH : types, règles, jours fériés, ajustements ; les autres sont refusés', async () => {
    const w = await world();
    const code = `STUDY_${unique().toUpperCase()}`;
    // Types.
    expect((await api.call('POST', '/api/v1/hr/leave/types', { ...w.member, body: { code, label: 'Formation' } })).status).toBe(403);
    const type = await api.call('POST', '/api/v1/hr/leave/types', { ...w.hr, body: { code, label: 'Formation', maxDaysPerRequest: 2 } });
    expect(type.status).toBe(201);
    expect(type.body).toMatchObject({ code, maxDaysPerRequest: 2, deductsBalance: false, requiresApproval: true, active: true, version: 1 });
    expect((await api.call('POST', '/api/v1/hr/leave/types', { ...w.hr, body: { code, label: 'Doublon' } })).status).toBe(409);
    expect((await api.call('POST', '/api/v1/hr/leave/types', { ...w.hr, body: { code: 'a b', label: 'Mauvais code' } })).status).toBe(400);
    const start = monday(12);
    expect((await request(w.member, { leaveTypeId: type.body.id, start, end: addDays(start, 2) })).status).toBe(400);
    const updated = await api.call('PUT', `/api/v1/hr/leave/types/${type.body.id}`, { ...w.hr, body: { version: 1, active: false } });
    expect(updated.body).toMatchObject({ active: false, version: 2 });
    expect((await api.call('PUT', `/api/v1/hr/leave/types/${type.body.id}`, { ...w.hr, body: { version: 1, label: 'Périmé' } })).status).toBe(409);
    expect((await request(w.member, { leaveTypeId: type.body.id, start, end: start })).status).toBe(400);
    expect(((await api.call('GET', '/api/v1/hr/leave/types', w.member)).body as { id: string }[]).map((x) => x.id)).not.toContain(type.body.id);
    expect(((await api.call('GET', '/api/v1/hr/leave/types?includeInactive=true', w.hr)).body as { id: string }[]).map((x) => x.id)).toContain(type.body.id);
    // Règles : saisie, version périmée, valeurs hors bornes.
    const current = (await api.call('GET', '/api/v1/hr/leave/settings', w.hr)).body as { version: number };
    expect((await api.call('PUT', '/api/v1/hr/leave/settings', { ...w.member, body: { version: current.version, accrualDaysPerMonth: 2, countsSaturday: false, allowHalfDays: true, allowNegativeBalance: false } })).status).toBe(403);
    expect((await api.call('PUT', '/api/v1/hr/leave/settings', { ...w.hr, body: { version: current.version, accrualDaysPerMonth: 6, countsSaturday: false, allowHalfDays: true, allowNegativeBalance: false } })).status).toBe(400);
    const saved = await api.call('PUT', '/api/v1/hr/leave/settings', { ...w.hr, body: { version: current.version, accrualDaysPerMonth: 2, countsSaturday: false, allowHalfDays: true, allowNegativeBalance: false } });
    expect(saved.body).toMatchObject({ accrualDaysPerMonth: 2, version: current.version + 1 });
    expect((await api.call('PUT', '/api/v1/hr/leave/settings', { ...w.hr, body: { version: current.version, accrualDaysPerMonth: 1.5, countsSaturday: false, allowHalfDays: true, allowNegativeBalance: false } })).status).toBe(409);
    expect((await api.call('GET', `/api/v1/hr/leave/balance?year=${yearOf(start)}`, w.member)).body.entitlement).toBe(24); // 12 mois × 2
    await api.call('PUT', '/api/v1/hr/leave/settings', { ...w.hr, body: { version: current.version + 1, accrualDaysPerMonth: 1.5, countsSaturday: false, allowHalfDays: true, allowNegativeBalance: false } });
    // Jours fériés : un seul par date, retirés avec une trace.
    const day = addDays(monday(30), 2);
    const holiday = await api.call('POST', '/api/v1/hr/leave/holidays', { ...w.hr, body: { day, label: 'Fête de test' } });
    expect(holiday.status).toBe(201);
    expect((await api.call('POST', '/api/v1/hr/leave/holidays', { ...w.hr, body: { day, label: 'Doublon' } })).status).toBe(409);
    expect((await api.call('POST', '/api/v1/hr/leave/holidays', { ...w.member, body: { day: addDays(day, 1), label: 'Interdit' } })).status).toBe(403);
    const listed = await api.call('GET', `/api/v1/hr/leave/holidays?year=${yearOf(day)}`, w.member);
    expect((listed.body as { day: string }[]).map((h) => h.day)).toContain(day);
    expect((await api.call('DELETE', `/api/v1/hr/leave/holidays/${holiday.body.id}`, { ...w.hr })).status).toBe(204);
    expect((await api.call('DELETE', `/api/v1/hr/leave/holidays/${holiday.body.id}`, { ...w.hr })).status).toBe(404);
    // Un jour férié n'est pas décompté.
    const holidayWeek = monday(31);
    const noel = await api.call('POST', '/api/v1/hr/leave/holidays', { ...w.hr, body: { day: addDays(holidayWeek, 1), label: 'Férié du mardi' } });
    expect(noel.status).toBe(201);
    expect((await request(w.member, { leaveTypeId: w.sick, start: holidayWeek, end: addDays(holidayWeek, 2) })).body.days).toBe(2);
    // Ajustements : RH seulement, motif obligatoire, visibles dans le solde.
    const year = yearOf(start);
    expect((await api.call('POST', '/api/v1/hr/leave/adjustments', { ...w.member, body: { employeeId: w.memberEmp.id, year, days: 5, reason: 'Je me donne des jours' } })).status).toBe(403);
    expect((await api.call('POST', '/api/v1/hr/leave/adjustments', { ...w.hr, body: { employeeId: w.memberEmp.id, year, days: 5, reason: '   ' } })).status).toBe(400);
    expect((await api.call('POST', '/api/v1/hr/leave/adjustments', { ...w.hr, body: { employeeId: w.memberEmp.id, year, days: 0, reason: 'Rien' } })).status).toBe(400);
    const adjusted = await api.call('POST', '/api/v1/hr/leave/adjustments', { ...w.hr, body: { employeeId: w.memberEmp.id, year, days: 5, reason: 'Report de l’année précédente' } });
    expect(adjusted.status).toBe(201);
    expect((await api.call('GET', `/api/v1/hr/leave/balance?year=${year}`, w.member)).body).toMatchObject({ adjustments: 5, available: expect.any(Number) });
    expect(((await api.call('GET', `/api/v1/hr/leave/adjustments?employeeId=${w.memberEmp.id}&year=${year}`, w.hr)).body as { days: number }[]).map((a) => a.days)).toEqual([5]);
    expect((await api.call('GET', `/api/v1/hr/leave/adjustments?employeeId=${w.memberEmp.id}&year=${year}`, w.member)).status).toBe(403);
    const audited = await t.prisma.db.auditLog.findMany({ where: { entityId: { in: [type.body.id, holiday.body.id, adjusted.body.id] } }, orderBy: { createdAt: 'asc' } });
    expect(audited.map((l) => l.action).sort()).toEqual(['CREATE', 'CREATE', 'CREATE', 'DELETE', 'UPDATE']);
  }, 180_000);

  it('aucune donnée de santé : la demande n’expose que ses champs, un motif libre reste facultatif', async () => {
    const w = await world();
    const start = monday(14);
    const asked = await request(w.member, { leaveTypeId: w.sick, start, end: start });
    expect(Object.keys(asked.body).sort()).toEqual([
      'cancelReason', 'cancelledAt', 'createdAt', 'days', 'decidedAt', 'decisionNote', 'employeeId', 'employeeName', 'end', 'endHalf', 'id', 'leaveTypeId', 'leaveTypeLabel', 'note', 'start', 'startHalf', 'status', 'version',
    ]);
    expect(asked.body.note).toBeNull();
    const columns = await t.prisma.db.$queryRawUnsafe<{ column_name: string }[]>(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'hr' AND table_name = 'leave_requests'`);
    expect(columns.map((c) => c.column_name).join(' ')).not.toMatch(/diagnos|health|sant|medic|pathol/i);
  }, 60_000);

  describe('règles garanties par la base (en plus de l’application)', () => {
    async function ids() {
      const w = await world();
      const type = w.annual;
      return { employee: w.memberEmp.id, type, userId: (await t.prisma.db.employee.findUnique({ where: { id: w.memberEmp.id } }))!.userId! };
    }
    const insert = (employee: string, type: string, user: string, over: Record<string, string> = {}) => {
      const row: Record<string, string> = { start_date: `'2030-03-04'`, end_date: `'2030-03-05'`, start_half: 'false', end_half: 'false', days: '2', leave_year: '2030', status: `'PENDING'`, ...over };
      const columns = ['id', 'employee_id', 'leave_type_id', 'requested_by_user_id', 'updated_at', ...Object.keys(row)];
      const values = ['gen_random_uuid()', `'${employee}'::uuid`, `'${type}'::uuid`, `'${user}'::uuid`, 'now()', ...Object.values(row)];
      return t.prisma.db.$executeRawUnsafe(`INSERT INTO hr.leave_requests (${columns.join(', ')}) VALUES (${values.join(', ')})`);
    };

    it('demandes : dates ordonnées, jours valides, demi-journées cohérentes, année, état cohérent', async () => {
      const { employee, type, userId } = await ids();
      await expect(insert(employee, type, userId)).resolves.toBeDefined();
      await expect(insert(employee, type, userId, { start_date: `'2030-03-05'`, end_date: `'2030-03-04'` })).rejects.toThrow(/leave_requests_dates_ordered/);
      for (const days of ['0', '-1', '1.3', '0.25', '3']) await expect(insert(employee, type, userId, { days })).rejects.toThrow();
      await expect(insert(employee, type, userId, { start_date: `'2030-03-04'`, end_date: `'2030-03-04'`, days: '1', start_half: 'true', end_half: 'true' })).rejects.toThrow();
      await expect(insert(employee, type, userId, { leave_year: '2031' })).rejects.toThrow();
      // État : une demande en attente ne porte ni décision ni annulation ; une refusée a un motif ; une validée n'est pas annulée.
      await expect(insert(employee, type, userId, { decided_at: 'now()' })).rejects.toThrow();
      await expect(insert(employee, type, userId, { status: `'APPROVED'` })).rejects.toThrow();
      await expect(insert(employee, type, userId, { status: `'APPROVED'`, decided_at: 'now()', cancelled_at: 'now()' })).rejects.toThrow();
      await expect(insert(employee, type, userId, { status: `'REJECTED'`, decided_at: 'now()' })).rejects.toThrow();
      await expect(insert(employee, type, userId, { status: `'REJECTED'`, decided_at: 'now()', decision_note: `'   '` })).rejects.toThrow();
      await expect(insert(employee, type, userId, { status: `'CANCELLED'` })).rejects.toThrow();
      await expect(insert(employee, type, userId, { status: `'APPROVED'`, decided_at: 'now()' })).resolves.toBeDefined();
      await expect(insert(employee, type, userId, { status: `'REJECTED'`, decided_at: 'now()', decision_note: `'Non'` })).resolves.toBeDefined();
      await expect(insert(employee, type, userId, { status: `'CANCELLED'`, cancelled_at: 'now()' })).resolves.toBeDefined();
      await expect(t.prisma.db.$executeRawUnsafe(`UPDATE hr.leave_requests SET version = 0`)).rejects.toThrow();
    });

    it('ajustements, types, règles, jours fériés', async () => {
      const { employee } = await ids();
      const adjust = (days: string, reason: string, year = '2026') => t.prisma.db.$executeRawUnsafe(`INSERT INTO hr.leave_adjustments (id, employee_id, year, days, reason, created_by_user_id) VALUES (gen_random_uuid(), '${employee}'::uuid, ${year}, ${days}, '${reason}', gen_random_uuid())`);
      await expect(adjust('5', 'Report')).resolves.toBeDefined();
      for (const days of ['0', '60.5', '-61', '0.3']) await expect(adjust(days, 'x')).rejects.toThrow();
      await expect(adjust('1', '   ')).rejects.toThrow();
      await expect(adjust('1', 'x', '1999')).rejects.toThrow();
      await expect(adjust('1', 'x', '2101')).rejects.toThrow();
      const type = (code: string, label: string, max = 'NULL') => t.prisma.db.$executeRawUnsafe(`INSERT INTO hr.leave_types (id, code, label, max_days_per_request, updated_at) VALUES (gen_random_uuid(), '${code}', '${label}', ${max}, now())`);
      await expect(type(`OK_${unique().toUpperCase()}`, 'Valide', '2.5')).resolves.toBeDefined();
      await expect(type('annual', 'Minuscules')).rejects.toThrow();
      await expect(type('A', 'Trop court')).rejects.toThrow();
      await expect(type(`X_${unique().toUpperCase()}`, '   ')).rejects.toThrow();
      await expect(type(`Y_${unique().toUpperCase()}`, 'Plafond nul', '0')).rejects.toThrow();
      await expect(type(`Z_${unique().toUpperCase()}`, 'Plafond au quart', '0.25')).rejects.toThrow();
      await expect(type('ANNUAL', 'Doublon')).rejects.toThrow();
      await expect(t.prisma.db.$executeRawUnsafe(`INSERT INTO hr.leave_settings (id, updated_at) VALUES (2, now())`)).rejects.toThrow();
      await expect(t.prisma.db.$executeRawUnsafe(`UPDATE hr.leave_settings SET accrual_days_per_month = 5.5`)).rejects.toThrow();
      await expect(t.prisma.db.$executeRawUnsafe(`UPDATE hr.leave_settings SET accrual_days_per_month = -1`)).rejects.toThrow();
      await expect(t.prisma.db.$executeRawUnsafe(`INSERT INTO hr.public_holidays (id, day, label) VALUES (gen_random_uuid(), '2031-01-01', '   ')`)).rejects.toThrow();
      await expect(t.prisma.db.$executeRawUnsafe(`INSERT INTO hr.public_holidays (id, day, label) VALUES (gen_random_uuid(), '2031-01-01', 'Nouvel an')`)).resolves.toBeDefined();
      await expect(t.prisma.db.$executeRawUnsafe(`INSERT INTO hr.public_holidays (id, day, label) VALUES (gen_random_uuid(), '2031-01-01', 'Doublon')`)).rejects.toThrow();
    });

    it('un employé ou un type qui a des demandes ne se supprime pas (RESTRICT)', async () => {
      const { employee, type, userId } = await ids();
      await insert(employee, type, userId);
      await expect(t.prisma.db.$executeRawUnsafe(`DELETE FROM hr.employees WHERE id = '${employee}'::uuid`)).rejects.toThrow();
      await expect(t.prisma.db.$executeRawUnsafe(`DELETE FROM hr.leave_types WHERE id = '${type}'::uuid`)).rejects.toThrow();
    });
  });

  it('recherche des chevauchements AU NIVEAU DE LA BASE : seules les demandes en cours qui touchent la période, et le filtre par année de la liste', async () => {
    const w = await world();
    const post = (start: string, end: string, type = w.sick) => request(w.member, { leaveTypeId: type, start, end });
    const early = monday(20);
    const mid = addDays(early, 14);
    const farYear = '2031-03-03';
    expect((await post(early, addDays(early, 1))).status).toBe(201);
    expect((await post(mid, addDays(mid, 1))).status).toBe(201);
    expect((await post(farYear, farYear)).status).toBe(201);
    const repository = new PrismaLeaveRequestRepository(t.prisma);
    // Une période qui ne touche que la première demande ne ramène QUE la première (pas celles qui se terminent avant ni commencent après).
    const hit = await repository.findActiveOverlapping(w.memberEmp.id, addDays(early, 1), addDays(early, 3));
    expect(hit.map((r) => r.start)).toEqual([early]);
    const after = await repository.findActiveOverlapping(w.memberEmp.id, addDays(mid, 2), addDays(mid, 5));
    expect(after).toEqual([]);
    // Le filtre par année de la liste.
    const in2031 = await api.call('GET', '/api/v1/hr/leave/requests?year=2031', w.member);
    expect((in2031.body.items as { start: string }[]).map((r) => r.start)).toEqual([farYear]);
    const inOther = await api.call('GET', `/api/v1/hr/leave/requests?year=${yearOf(early)}`, w.member);
    expect(inOther.body.items.map((r: { start: string }) => r.start).sort()).toEqual([early, mid].sort());
  }, 120_000);

  it('verrou optimiste AU NIVEAU DE LA BASE : deux décisions sur la même version, la seconde est refusée', async () => {
    const w = await world();
    const start = monday(15);
    const asked = await request(w.member, { leaveTypeId: w.annual, start, end: start });
    const repository = new PrismaLeaveRequestRepository(t.prisma);
    const first = (await repository.findById(asked.body.id))!;
    const second = (await repository.findById(asked.body.id))!;
    first.approve({ by: '00000000-0000-4000-8000-0000000000a1', now: new Date() });
    second.reject({ by: '00000000-0000-4000-8000-0000000000a2', note: 'Concurrent', now: new Date() });
    await repository.save(first);
    await expect(repository.save(second)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect((await repository.findById(asked.body.id))!.status).toBe('APPROVED');
  }, 60_000);
});
