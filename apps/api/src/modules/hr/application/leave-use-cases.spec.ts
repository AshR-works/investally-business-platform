import { InMemoryEmployees } from '../../../../test/support/in-memory-employees';
import { InMemoryLeaveAdjustments, InMemoryLeaveConfig, InMemoryLeaveRequests } from '../../../../test/support/in-memory-leave';
import { ActorContext } from '../../../shared-kernel';
import { AuditAction, AuditRecord } from '../../audit';
import type { AccessContext } from '../../iam';
import { RoleCode, Scope, resolveGrants } from '../../iam';
import { Employee } from '../domain/employee';
import { LeaveType } from '../domain/leave-config';
import { LeaveRequest, LeaveStatus } from '../domain/leave-request';
import {
  AddHolidayUseCase, AdjustBalanceUseCase, CancelLeaveUseCase, CreateLeaveTypeUseCase, DecideLeaveUseCase, GetLeaveBalanceHandler, GetLeaveRequestHandler, GetLeaveSettingsHandler,
  GetTeamCalendarHandler, ListAdjustmentsHandler, ListHolidaysHandler, ListLeaveRequestsHandler, ListLeaveTypesHandler, RemoveHolidayUseCase, RequestLeaveUseCase,
  UpdateLeaveSettingsUseCase, UpdateLeaveTypeUseCase,
} from './leave-use-cases';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const actor: ActorContext = { userId: 'u-x', sessionId: 's1', ipAddress: '10.0.0.1', device: 'jest' };
const as = (role: RoleCode, actorId: string, teamMemberIds: string[] = []): AccessContext => ({ actorId, grants: resolveGrants(role), teamMemberIds });
const now = new Date('2026-11-10T09:00:00Z'); // un mardi

// Décembre 2026 : lundi 7, 14, 21, 28 ; samedi 5, 12, 19, 26.
const boss = as(RoleCode.Direction, 'u-boss');
const claire = as(RoleCode.AccountManager, 'u-claire');
const paul = as(RoleCode.AccountManager, 'u-paul');
const sam = as(RoleCode.Support, 'u-sam');
const ines = as(RoleCode.Finance, 'u-ines');
const hr = as(RoleCode.Hr, 'u-hr');
const root = as(RoleCode.SuperAdmin, 'u-root');
const nobody: AccessContext = { actorId: 'u-none', grants: [], teamMemberIds: [] };

const ID = { boss: uuid(1), claire: uuid(2), paul: uuid(3), sam: uuid(4), ines: uuid(5), hr: uuid(6), ghost: uuid(7) };
const TYPE = { annual: uuid(101), sick: uuid(102), special: uuid(103), auto: uuid(104), old: uuid(105) };

function build() {
  const employees = new InMemoryEmployees();
  const requests = new InMemoryLeaveRequests();
  const config = new InMemoryLeaveConfig();
  const adjustments = new InMemoryLeaveAdjustments();
  const audit: AuditRecord[] = [];
  let seq = 0;
  const recorder = { record: async (r: AuditRecord) => { audit.push(r); } };
  const unitOfWork = { run: <T>(work: () => Promise<T>) => work() };
  const clock = { now: () => now };
  const ids = { next: () => uuid(900 + ++seq) };

  const person = (key: keyof typeof ID, firstName: string, department: string, user: string | null, manager: string | null, hiredOn = '2020-01-01') =>
    employees.items.push(Employee.register({ id: ID[key], lastName: 'Test', firstName, jobTitle: 'Poste', department, managerEmployeeId: manager, userId: user, hiredOn, now }));
  person('boss', 'Bruno', 'Direction', 'u-boss', null);
  person('claire', 'Claire', 'Commercial', 'u-claire', ID.boss, '2026-03-02');
  person('paul', 'Paul', 'Commercial', 'u-paul', ID.boss);
  person('sam', 'Sam', 'Commercial', 'u-sam', ID.claire);
  person('ines', 'Inès', 'Finance', 'u-ines', ID.boss);
  person('hr', 'Hélène', 'RH', 'u-hr', null);
  person('ghost', 'Gaël', 'Commercial', null, ID.boss);

  const type = (id: string, code: string, label: string, extra: Record<string, unknown> = {}) => config.typeList.push(LeaveType.create({ id, code, label, now, ...extra } as Parameters<typeof LeaveType.create>[0]));
  type(TYPE.annual, 'ANNUAL', 'Congé annuel', { deductsBalance: true, sortOrder: 10 });
  type(TYPE.sick, 'SICK', 'Maladie', { sortOrder: 20 });
  type(TYPE.special, 'SPECIAL', 'Permission exceptionnelle', { maxDaysPerRequest: 3, sortOrder: 30 });
  type(TYPE.auto, 'AUTO', 'Sans validation', { requiresApproval: false, sortOrder: 40 });
  type(TYPE.old, 'OLD', 'Ancien type', { sortOrder: 50 });
  config.typeList[4]!.update({ active: false });

  return {
    employees, requests, config, adjustments, audit, locks: () => requests.locks,
    request: new RequestLeaveUseCase(employees, requests, config, adjustments, recorder, unitOfWork, clock, ids),
    decide: new DecideLeaveUseCase(employees, requests, config, adjustments, recorder, unitOfWork, clock),
    cancel: new CancelLeaveUseCase(employees, requests, config, recorder, unitOfWork, clock),
    get: new GetLeaveRequestHandler(employees, requests, config),
    list: new ListLeaveRequestsHandler(employees, requests, config),
    balance: new GetLeaveBalanceHandler(employees, requests, config, adjustments, clock),
    calendar: new GetTeamCalendarHandler(employees, requests, config),
    types: new ListLeaveTypesHandler(config),
    createType: new CreateLeaveTypeUseCase(config, recorder, unitOfWork, clock, ids),
    updateType: new UpdateLeaveTypeUseCase(config, recorder, unitOfWork),
    settings: new GetLeaveSettingsHandler(config),
    updateSettings: new UpdateLeaveSettingsUseCase(config, recorder, unitOfWork),
    holidays: new ListHolidaysHandler(config),
    addHoliday: new AddHolidayUseCase(config, recorder, unitOfWork, ids),
    removeHoliday: new RemoveHolidayUseCase(config, recorder, unitOfWork),
    adjust: new AdjustBalanceUseCase(employees, adjustments, recorder, unitOfWork, clock, ids),
    listAdjustments: new ListAdjustmentsHandler(employees, adjustments),
  };
}
type World = ReturnType<typeof build>;

const week = { start: '2026-12-14', end: '2026-12-18' };
const ask = (w: World, access: AccessContext, extra: Record<string, unknown> = {}) =>
  w.request.execute({ leaveTypeId: TYPE.annual, ...week, access, actor, ...extra } as Parameters<RequestLeaveUseCase['execute']>[0]);
const decide = (w: World, id: string, access: AccessContext, extra: Record<string, unknown> = {}) =>
  w.decide.execute({ id, decision: 'APPROVE', version: 1, access, actor, ...extra } as Parameters<DecideLeaveUseCase['execute']>[0]);
const cancel = (w: World, id: string, access: AccessContext, extra: Record<string, unknown> = {}) => w.cancel.execute({ id, version: 1, access, actor, ...extra } as Parameters<CancelLeaveUseCase['execute']>[0]);
const first = { page: 1, pageSize: 50 };

describe('Absences — demander', () => {
  it('l’employé demande : en attente, jours décomptés, noms résolus, verrou de sa fiche, audit', async () => {
    const w = build();
    const view = await ask(w, claire, { note: 'Voyage' });
    expect(view).toMatchObject({ employeeId: ID.claire, employeeName: 'Claire Test', leaveTypeLabel: 'Congé annuel', status: 'PENDING', days: 5, start: '2026-12-14', end: '2026-12-18', note: 'Voyage', version: 1 });
    expect(w.locks()).toEqual([ID.claire]);
    expect(w.audit).toHaveLength(1);
    expect(w.audit[0]).toMatchObject({ module: 'hr', action: AuditAction.Create, entityType: 'LeaveRequest', entityId: view.id, newValue: expect.objectContaining({ status: 'PENDING', days: 5, employeeId: ID.claire }) });
  });

  it('refuse sans le droit de demander', async () => {
    const w = build();
    await expect(ask(w, nobody)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(w.requests.items).toHaveLength(0);
  });

  it('refuse quand aucune fiche employé n’est liée au compte', async () => {
    const w = build();
    await expect(ask(w, as(RoleCode.Support, 'u-sans-fiche'))).rejects.toMatchObject({ code: 'VALIDATION', message: expect.stringContaining('liée à votre compte') });
  });

  it('un employé ne demande que pour lui : la fiche d’un autre est « introuvable », comme un identifiant inexistant', async () => {
    const w = build();
    const other = await ask(w, claire, { employeeId: ID.paul }).catch((e) => e);
    const missing = await ask(w, claire, { employeeId: uuid(999) }).catch((e) => e);
    expect(other).toMatchObject({ code: 'NOT_FOUND' });
    expect(other.message).toBe(missing.message);
    expect(w.requests.items).toHaveLength(0);
  });

  it('la RH saisit pour un employé : validée d’emblée, par elle', async () => {
    const w = build();
    const view = await ask(w, hr, { employeeId: ID.paul });
    expect(view).toMatchObject({ employeeId: ID.paul, status: 'APPROVED' });
    expect(w.requests.items[0]).toMatchObject({ decidedByUserId: 'u-hr', requestedByUserId: 'u-hr' });
    // Le Super administrateur aussi.
    expect((await ask(w, root, { employeeId: ID.sam, start: '2026-12-21', end: '2026-12-21' })).status).toBe('APPROVED');
  });

  it('la RH qui demande POUR ELLE-MÊME attend une autre personne', async () => {
    const w = build();
    expect((await ask(w, hr)).status).toBe('PENDING');
  });

  it('un type sans validation est validé d’emblée', async () => {
    const w = build();
    expect((await ask(w, claire, { leaveTypeId: TYPE.auto })).status).toBe('APPROVED');
  });

  it('refuse un type inconnu ou désactivé', async () => {
    const w = build();
    await expect(ask(w, claire, { leaveTypeId: uuid(555) })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(ask(w, claire, { leaveTypeId: TYPE.old })).rejects.toMatchObject({ code: 'VALIDATION', message: expect.stringContaining('désactivé') });
  });

  it('refuse un employé archivé', async () => {
    const w = build();
    w.employees.items.find((e) => e.id === ID.paul)!.archive({ now });
    await expect(ask(w, hr, { employeeId: ID.paul })).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('refuse une période qui ne contient que des week-ends ou des jours fériés', async () => {
    const w = build();
    await expect(ask(w, claire, { start: '2026-12-19', end: '2026-12-20' })).rejects.toMatchObject({ code: 'VALIDATION', message: expect.stringContaining('Aucun jour décompté') });
    await w.addHoliday.execute({ day: '2026-12-25', label: 'Noël', access: hr, actor });
    await expect(ask(w, claire, { start: '2026-12-25', end: '2026-12-25' })).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('exclut les jours fériés saisis par la RH et le samedi selon la règle', async () => {
    const w = build();
    await w.addHoliday.execute({ day: '2026-12-25', label: 'Noël', access: hr, actor });
    expect((await ask(w, paul, { start: '2026-12-24', end: '2026-12-28' })).days).toBe(2);
    await w.updateSettings.execute({ version: 1, accrualDaysPerMonth: 1.5, countsSaturday: true, allowHalfDays: true, allowNegativeBalance: false, access: hr, actor });
    expect((await ask(w, sam, { start: '2026-12-17', end: '2026-12-22' })).days).toBe(5);
  });

  it('gère les demi-journées, et les refuse quand la règle l’interdit', async () => {
    const w = build();
    expect((await ask(w, paul, { start: '2026-12-14', end: '2026-12-15', startHalf: true, endHalf: true })).days).toBe(1);
    await w.updateSettings.execute({ version: 1, accrualDaysPerMonth: 1.5, countsSaturday: false, allowHalfDays: false, allowNegativeBalance: false, access: hr, actor });
    await expect(ask(w, sam, { startHalf: true })).rejects.toMatchObject({ code: 'VALIDATION', message: expect.stringContaining('demi-journées') });
    await expect(ask(w, sam, { endHalf: true })).rejects.toMatchObject({ code: 'VALIDATION' });
    expect((await ask(w, sam)).days).toBe(5);
  });

  it('une seule journée ne commence pas l’après-midi et ne finit pas à midi à la fois', async () => {
    const w = build();
    await expect(ask(w, paul, { start: '2026-12-14', end: '2026-12-14', startHalf: true, endHalf: true })).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('respecte le plafond du type (permission exceptionnelle : 3 jours)', async () => {
    const w = build();
    await expect(ask(w, paul, { leaveTypeId: TYPE.special, end: '2026-12-17' })).rejects.toMatchObject({ code: 'VALIDATION', message: expect.stringContaining('limité à 3') });
    expect((await ask(w, paul, { leaveTypeId: TYPE.special, end: '2026-12-16' })).days).toBe(3);
  });

  it('refuse une demande dans le passé, sauf pour la RH ; aujourd’hui est permis', async () => {
    const w = build();
    await expect(ask(w, paul, { start: '2026-11-09', end: '2026-11-09' })).rejects.toMatchObject({ code: 'VALIDATION', message: expect.stringContaining('passé') });
    expect((await ask(w, paul, { start: '2026-11-10', end: '2026-11-10' })).status).toBe('PENDING');
    expect((await ask(w, hr, { employeeId: ID.sam, start: '2026-11-09', end: '2026-11-09' })).status).toBe('APPROVED');
  });

  it('refuse une période qui commence avant l’entrée de l’employé', async () => {
    const w = build();
    await expect(ask(w, hr, { employeeId: ID.claire, start: '2026-02-27', end: '2026-02-27' })).rejects.toMatchObject({ code: 'VALIDATION', message: expect.stringContaining('entrée') });
    expect((await ask(w, hr, { employeeId: ID.claire, start: '2026-03-02', end: '2026-03-02' })).status).toBe('APPROVED');
  });

  it('refuse un chevauchement, à la demi-journée près', async () => {
    const w = build();
    await ask(w, paul);
    await expect(ask(w, paul, { start: '2026-12-18', end: '2026-12-22' })).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(ask(w, paul, { start: '2026-12-10', end: '2026-12-14' })).rejects.toMatchObject({ code: 'CONFLICT' });
    // Même un type sans solde ne peut pas se superposer.
    await expect(ask(w, paul, { leaveTypeId: TYPE.sick, start: '2026-12-16', end: '2026-12-16' })).rejects.toMatchObject({ code: 'CONFLICT' });
    // Jointif d'une demi-journée : l'une finit à midi, l'autre commence l'après-midi.
    const w2 = build();
    await ask(w2, paul, { start: '2026-12-14', end: '2026-12-16', endHalf: true });
    expect((await ask(w2, paul, { start: '2026-12-16', end: '2026-12-18', startHalf: true })).status).toBe('PENDING');
    await expect(ask(w2, paul, { start: '2026-12-16', end: '2026-12-18' })).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('les demandes refusées ou annulées ne bloquent pas, celles des autres non plus', async () => {
    const w = build();
    const refused = await ask(w, paul);
    await decide(w, refused.id, boss, { decision: 'REJECT', note: 'non' });
    expect((await ask(w, paul)).status).toBe('PENDING');
    const cancelled = await ask(w, sam);
    await cancel(w, cancelled.id, sam);
    expect((await ask(w, sam)).status).toBe('PENDING');
    expect((await ask(w, claire)).status).toBe('PENDING');
  });

  it('refuse quand le solde est insuffisant, en comptant les demandes en attente', async () => {
    const w = build();
    // Claire est entrée le 2 mars 2026 : 9 mois × 1,5 = 13,5 jours pour 2026.
    expect((await ask(w, claire)).days).toBe(5);
    expect((await ask(w, claire, { start: '2026-12-21', end: '2026-12-25' })).days).toBe(5);
    await expect(ask(w, claire, { start: '2026-12-28', end: '2026-12-31' })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION', message: expect.stringContaining('Solde insuffisant : 3.5 jour(s) disponible(s), 4 demandé(s)') });
    expect((await ask(w, claire, { start: '2026-12-28', end: '2026-12-30' })).days).toBe(3);
  });

  it('le solde peut être épuisé exactement (jusqu’à zéro, pas au-delà)', async () => {
    const w = build();
    await ask(w, claire);
    await ask(w, claire, { start: '2026-12-21', end: '2026-12-25' });
    // 13,5 − 10 = 3,5 : le jeudi 31 à midi donne exactement 3,5 jours.
    const exact = await ask(w, claire, { start: '2026-12-28', end: '2026-12-31', endHalf: true });
    expect(exact.days).toBe(3.5);
    expect(await w.balance.execute({ access: claire, year: 2026 })).toMatchObject({ pending: 13.5, available: 0 });
    // Une demi-journée de plus (l'après-midi du 31, libre) dépasse le solde : refusée. L'année suivante a son propre solde.
    await expect(ask(w, claire, { start: '2026-12-31', end: '2026-12-31', startHalf: true })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
    expect((await ask(w, claire, { start: '2027-01-01', end: '2027-01-01' })).days).toBe(1);
  });

  it('un type qui ne décompte pas le solde n’est pas limité par lui', async () => {
    const w = build();
    await ask(w, claire);
    await ask(w, claire, { start: '2026-12-21', end: '2026-12-25' });
    expect((await ask(w, claire, { leaveTypeId: TYPE.sick, start: '2026-12-28', end: '2026-12-31' })).days).toBe(4);
  });

  it('la règle « solde négatif autorisé » lève la limite', async () => {
    const w = build();
    await w.updateSettings.execute({ version: 1, accrualDaysPerMonth: 1.5, countsSaturday: false, allowHalfDays: true, allowNegativeBalance: true, access: hr, actor });
    await ask(w, claire);
    await ask(w, claire, { start: '2026-12-21', end: '2026-12-25' });
    expect((await ask(w, claire, { start: '2026-12-28', end: '2026-12-31' })).days).toBe(4);
  });

  it('les ajustements de la RH comptent dans le solde', async () => {
    const w = build();
    await w.adjust.execute({ employeeId: ID.claire, year: 2026, days: 3, reason: 'Report', access: hr, actor });
    await ask(w, claire);
    await ask(w, claire, { start: '2026-12-21', end: '2026-12-25' });
    expect((await ask(w, claire, { start: '2026-12-28', end: '2026-12-31' })).days).toBe(4);
  });

  it('le solde se calcule pour l’année de la date de début', async () => {
    const w = build();
    // Paul, entré en 2020 : 18 jours en 2027 aussi ; Claire en 2027 : 12 mois.
    expect((await ask(w, claire, { start: '2027-01-04', end: '2027-01-15' })).days).toBe(10);
    await expect(ask(w, claire, { start: '2027-01-18', end: '2027-01-29' })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
  });

  it('plusieurs demandes d’un même employé verrouillent chaque fois sa fiche', async () => {
    const w = build();
    await ask(w, paul);
    await ask(w, paul, { start: '2027-02-01', end: '2027-02-01' });
    expect(w.locks()).toEqual([ID.paul, ID.paul]);
  });
});

describe('Absences — décider', () => {
  it('le responsable de l’organigramme valide : audit avant et après, version renvoyée', async () => {
    const w = build();
    const asked = await ask(w, sam);
    const view = await decide(w, asked.id, claire);
    expect(view).toMatchObject({ status: 'APPROVED', id: asked.id });
    expect(w.requests.items[0]).toMatchObject({ decidedByUserId: 'u-claire', status: LeaveStatus.Approved });
    expect(w.audit.at(-1)).toMatchObject({ action: AuditAction.Update, entityType: 'LeaveRequest', entityId: asked.id, oldValue: expect.objectContaining({ status: 'PENDING' }), newValue: expect.objectContaining({ status: 'APPROVED' }) });
  });

  it('la RH valide n’importe quelle demande, y compris celle d’un employé sans compte désigné par la RH', async () => {
    const w = build();
    const asked = await ask(w, paul);
    expect((await decide(w, asked.id, hr)).status).toBe('APPROVED');
    expect((await decide(w, (await ask(w, sam)).id, root)).status).toBe('APPROVED');
  });

  it('un refus exige un motif', async () => {
    const w = build();
    const asked = await ask(w, paul);
    await expect(decide(w, asked.id, boss, { decision: 'REJECT' })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(decide(w, asked.id, boss, { decision: 'REJECT', note: '   ' })).rejects.toMatchObject({ code: 'VALIDATION' });
    const view = await decide(w, asked.id, boss, { decision: 'REJECT', note: 'Clôture annuelle' });
    expect(view).toMatchObject({ status: 'REJECTED', decisionNote: 'Clôture annuelle' });
  });

  it('personne ne valide sa propre demande, pas même la RH ni le Super administrateur', async () => {
    const w = build();
    for (const who of [paul, hr]) {
      const asked = await ask(w, who);
      await expect(decide(w, asked.id, who)).rejects.toMatchObject({ code: 'FORBIDDEN' });
      expect(w.requests.items.find((r) => r.id === asked.id)!.status).toBe(LeaveStatus.Pending);
    }
  });

  it('un collègue qui n’est pas le responsable reçoit « introuvable » ; la Direction, qui voit tout mais n’est pas responsable, « interdit »', async () => {
    const w = build();
    const asked = await ask(w, sam);
    const colleague = await decide(w, asked.id, paul).catch((e) => e);
    const missing = await decide(w, uuid(999), paul).catch((e) => e);
    expect(colleague).toMatchObject({ code: 'NOT_FOUND' });
    expect(colleague.message).toBe(missing.message);
    await expect(decide(w, asked.id, boss)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(decide(w, asked.id, ines)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(w.requests.items[0]!.status).toBe(LeaveStatus.Pending);
  });

  it('seul le responsable DIRECT valide : le supérieur du responsable n’est pas dans l’équipe', async () => {
    const w = build();
    const asked = await ask(w, sam); // Sam rend compte à Claire, qui rend compte à Bruno
    await expect(decide(w, asked.id, boss)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('refuse une version périmée', async () => {
    const w = build();
    const asked = await ask(w, paul);
    await expect(decide(w, asked.id, boss, { version: 2 })).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('une demande décidée ne se décide plus', async () => {
    const w = build();
    const asked = await ask(w, paul);
    await decide(w, asked.id, boss);
    await expect(decide(w, asked.id, boss)).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(decide(w, asked.id, boss, { decision: 'REJECT', note: 'non' })).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('à la validation, revérifie le chevauchement (une absence validée posée entre-temps)', async () => {
    const w = build();
    const asked = await ask(w, paul);
    // Une absence validée qui croise la demande en attente existe maintenant en base (posée par un autre chemin que le contrôle de la demande).
    await w.requests.save(LeaveRequest.create({ id: uuid(777), employeeId: ID.paul, leaveTypeId: TYPE.sick, start: '2026-12-16', end: '2026-12-16', startHalf: false, endHalf: false, days: 1, requestedByUserId: 'u-hr', now, approvedBy: 'u-hr' }));
    await expect(decide(w, asked.id, boss)).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION', message: expect.stringContaining('chevauchement') });
    expect(w.requests.items.find((r) => r.id === asked.id)!.status).toBe(LeaveStatus.Pending);
    // Un refus reste possible.
    expect((await decide(w, asked.id, boss, { decision: 'REJECT', note: 'Chevauchement' })).status).toBe('REJECTED');
  });

  it('à la validation, revérifie le solde sans compter la demande deux fois', async () => {
    const w = build();
    const a = await ask(w, claire);
    const b = await ask(w, claire, { start: '2026-12-21', end: '2026-12-25' });
    // 13,5 acquis, 10 en attente : valider chacune est permis (3,5 restants + sa propre part).
    expect((await decide(w, a.id, boss)).status).toBe('APPROVED');
    expect((await decide(w, b.id, boss)).status).toBe('APPROVED');
    // Le solde diminue ensuite (ajustement négatif de la RH) : une troisième demande, déjà posée, ne peut plus être validée.
    const w2 = build();
    const c = await ask(w2, claire, { start: '2026-12-28', end: '2026-12-31' });
    await w2.adjust.execute({ employeeId: ID.claire, year: 2026, days: -11, reason: 'Correction', access: hr, actor });
    await expect(decide(w2, c.id, boss)).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION', message: expect.stringContaining('Solde insuffisant') });
  });

  it('un type qui ne décompte pas le solde se valide même sans solde', async () => {
    const w = build();
    const asked = await ask(w, claire, { leaveTypeId: TYPE.sick });
    await w.adjust.execute({ employeeId: ID.claire, year: 2026, days: -13.5, reason: 'Solde épuisé', access: hr, actor });
    expect((await decide(w, asked.id, boss)).status).toBe('APPROVED');
  });
});

describe('Absences — annuler', () => {
  it('l’employé annule sa demande en attente, sans motif', async () => {
    const w = build();
    const asked = await ask(w, paul);
    const view = await cancel(w, asked.id, paul);
    expect(view).toMatchObject({ status: 'CANCELLED', cancelReason: null });
    expect(w.audit.at(-1)).toMatchObject({ action: AuditAction.Update, oldValue: expect.objectContaining({ status: 'PENDING' }), newValue: expect.objectContaining({ status: 'CANCELLED' }) });
  });

  it('une demande validée et pas commencée s’annule avec un motif', async () => {
    const w = build();
    const asked = await ask(w, paul, { leaveTypeId: TYPE.auto });
    await expect(cancel(w, asked.id, paul)).rejects.toMatchObject({ code: 'VALIDATION' });
    expect((await cancel(w, asked.id, paul, { reason: 'Voyage reporté' })).status).toBe('CANCELLED');
  });

  it('une demande validée dont la première journée est aujourd’hui ou passée ne s’annule plus par l’employé', async () => {
    const w = build();
    const today = await ask(w, hr, { employeeId: ID.paul, start: '2026-11-10', end: '2026-11-10' });
    await expect(cancel(w, today.id, paul, { reason: 'x' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const past = await ask(w, hr, { employeeId: ID.sam, start: '2026-11-02', end: '2026-11-02' });
    await expect(cancel(w, past.id, sam, { reason: 'x' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    // Une demande validée qui commence demain, oui.
    const tomorrow = await ask(w, hr, { employeeId: ID.ines, start: '2026-11-11', end: '2026-11-11' });
    expect((await cancel(w, tomorrow.id, ines, { reason: 'x' })).status).toBe('CANCELLED');
  });

  it('une demande en attente déjà commencée s’annule encore par l’employé', async () => {
    const w = build();
    const asked = await ask(w, paul, { start: '2026-11-10', end: '2026-11-10' });
    expect((await cancel(w, asked.id, paul)).status).toBe('CANCELLED');
  });

  it('la RH annule n’importe quelle demande en cours ou validée, avec un motif pour une validée', async () => {
    const w = build();
    const started = await ask(w, hr, { employeeId: ID.paul, start: '2026-11-10', end: '2026-11-10' });
    await expect(cancel(w, started.id, hr)).rejects.toMatchObject({ code: 'VALIDATION' });
    expect((await cancel(w, started.id, hr, { reason: 'Erreur de saisie' })).status).toBe('CANCELLED');
    const pending = await ask(w, sam);
    expect((await cancel(w, pending.id, root)).status).toBe('CANCELLED');
  });

  it('le responsable et la Direction voient la demande mais ne l’annulent pas : « interdit »', async () => {
    const w = build();
    const asked = await ask(w, sam);
    await expect(cancel(w, asked.id, claire)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(cancel(w, asked.id, boss)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('un tiers reçoit « introuvable », comme pour un identifiant inexistant', async () => {
    const w = build();
    const asked = await ask(w, sam);
    const stranger = await cancel(w, asked.id, paul).catch((e) => e);
    const missing = await cancel(w, uuid(999), paul).catch((e) => e);
    expect(stranger).toMatchObject({ code: 'NOT_FOUND' });
    expect(stranger.message).toBe(missing.message);
    expect(w.requests.items[0]!.status).toBe(LeaveStatus.Pending);
  });

  it('refuse une version périmée, et une demande déjà terminée', async () => {
    const w = build();
    const asked = await ask(w, paul);
    await expect(cancel(w, asked.id, paul, { version: 2 })).rejects.toMatchObject({ code: 'CONFLICT' });
    await cancel(w, asked.id, paul);
    await expect(cancel(w, asked.id, paul)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(cancel(w, asked.id, hr, { reason: 'x' })).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('une demande annulée libère le solde et la période', async () => {
    const w = build();
    const asked = await ask(w, claire);
    await cancel(w, asked.id, claire);
    expect((await w.balance.execute({ access: claire, year: 2026 }))).toMatchObject({ taken: 0, pending: 0, available: 13.5 });
    expect((await ask(w, claire)).status).toBe('PENDING');
  });
});

describe('Absences — lire et lister', () => {
  it('une demande se lit par l’employé, son responsable, la RH, la Direction ; un tiers : « introuvable »', async () => {
    const w = build();
    const asked = await ask(w, sam);
    for (const who of [sam, claire, hr, boss, root]) expect((await w.get.execute({ id: asked.id, access: who })).id).toBe(asked.id);
    for (const who of [paul, ines]) await expect(w.get.execute({ id: asked.id, access: who })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(w.get.execute({ id: uuid(999), access: hr })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('« mine » (défaut) : les siennes seulement, triées de la plus récente ; sans fiche, rien', async () => {
    const w = build();
    await ask(w, paul, { start: '2026-12-14', end: '2026-12-14' });
    await ask(w, paul, { start: '2027-01-11', end: '2027-01-11' });
    await ask(w, sam);
    const mine = await w.list.execute({ ...first, access: paul });
    expect(mine.items.map((r) => r.start)).toEqual(['2027-01-11', '2026-12-14']);
    expect(mine.total).toBe(2);
    expect((await w.list.execute({ ...first, access: as(RoleCode.Support, 'u-sans-fiche') })).items).toEqual([]);
  });

  it('« team » : les demandes de ses collaborateurs directs ; sans le droit de valider, refusé ; sans fiche, rien', async () => {
    const w = build();
    await ask(w, sam);
    await ask(w, paul);
    await ask(w, claire);
    expect((await w.list.execute({ ...first, view: 'team', access: claire })).items.map((r) => r.employeeName)).toEqual(['Sam Test']);
    expect((await w.list.execute({ ...first, view: 'team', access: boss })).items.map((r) => r.employeeName).sort()).toEqual(['Claire Test', 'Paul Test']);
    expect((await w.list.execute({ ...first, view: 'team', access: as(RoleCode.Support, 'u-sans-fiche') })).items).toEqual([]);
    await expect(w.list.execute({ ...first, view: 'team', access: nobody })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('« all » : la RH et la Direction seulement', async () => {
    const w = build();
    await ask(w, sam);
    await ask(w, paul);
    for (const who of [hr, boss, root]) expect((await w.list.execute({ ...first, view: 'all', access: who })).total).toBe(2);
    for (const who of [claire, sam, ines]) await expect(w.list.execute({ ...first, view: 'all', access: who })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('filtre par état et par année, et pagine', async () => {
    const w = build();
    const a = await ask(w, paul);
    await ask(w, paul, { start: '2027-01-11', end: '2027-01-12' });
    await ask(w, paul, { start: '2027-02-01', end: '2027-02-01' });
    await decide(w, a.id, boss, { decision: 'REJECT', note: 'non' });
    expect((await w.list.execute({ ...first, view: 'all', access: hr, status: LeaveStatus.Rejected })).total).toBe(1);
    expect((await w.list.execute({ ...first, view: 'all', access: hr, year: 2027 })).total).toBe(2);
    expect((await w.list.execute({ ...first, view: 'all', access: hr, year: 2026, status: LeaveStatus.Pending })).total).toBe(0);
    const page = await w.list.execute({ page: 2, pageSize: 2, view: 'all', access: hr });
    expect(page).toMatchObject({ total: 3, page: 2, pageSize: 2 });
    expect(page.items).toHaveLength(1);
    // Taille de page bornée.
    expect((await w.list.execute({ page: 1, pageSize: 1000, view: 'all', access: hr })).pageSize).toBe(100);
    expect((await w.list.execute({ page: 0, pageSize: 0, view: 'all', access: hr }))).toMatchObject({ page: 1, pageSize: 1 });
  });

  it('refuse l’accès sans le droit de lire', async () => {
    const w = build();
    await expect(w.list.execute({ ...first, access: nobody })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('Absences — solde', () => {
  it('l’employé voit le sien : acquis, ajustements, pris, en attente, disponible', async () => {
    const w = build();
    const a = await ask(w, claire);
    await decide(w, a.id, boss);
    await ask(w, claire, { start: '2026-12-21', end: '2026-12-22' });
    await w.adjust.execute({ employeeId: ID.claire, year: 2026, days: 1, reason: 'Report', access: hr, actor });
    expect(await w.balance.execute({ access: claire, year: 2026 })).toEqual({
      employeeId: ID.claire, employeeName: 'Claire Test', year: 2026, entitlement: 13.5, adjustments: 1, taken: 5, pending: 2, available: 7.5,
    });
  });

  it('seul le congé annuel consomme le solde : une maladie, une permission ou un type sans validation n\u2019y touchent pas', async () => {
    const w = build();
    await decide(w, (await ask(w, claire, { leaveTypeId: TYPE.sick, start: '2026-12-14', end: '2026-12-15' })).id, boss);
    await ask(w, claire, { leaveTypeId: TYPE.special, start: '2026-12-16', end: '2026-12-16' });
    await ask(w, claire, { leaveTypeId: TYPE.auto, start: '2026-12-17', end: '2026-12-17' });
    expect(await w.balance.execute({ access: claire, year: 2026 })).toMatchObject({ taken: 0, pending: 0, available: 13.5 });
    // Le congé annuel, lui, décompte : validé il devient « pris », en attente il est réservé.
    await decide(w, (await ask(w, claire, { start: '2026-12-21', end: '2026-12-22' })).id, boss);
    await ask(w, claire, { start: '2026-12-28', end: '2026-12-28' });
    expect(await w.balance.execute({ access: claire, year: 2026 })).toMatchObject({ taken: 2, pending: 1, available: 10.5 });
  });

  it('l’année par défaut est l’année en cours', async () => {
    const w = build();
    expect((await w.balance.execute({ access: paul })).year).toBe(2026);
  });

  it('le responsable, la RH et la Direction voient celui d’un employé ; un tiers : « introuvable »', async () => {
    const w = build();
    for (const who of [claire, hr, boss]) expect((await w.balance.execute({ employeeId: ID.sam, year: 2026, access: who })).employeeId).toBe(ID.sam);
    for (const who of [paul, ines]) await expect(w.balance.execute({ employeeId: ID.sam, year: 2026, access: who })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(w.balance.execute({ employeeId: uuid(999), access: hr })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(w.balance.execute({ access: as(RoleCode.Support, 'u-sans-fiche') })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('refuse une année hors de 2000 à 2100', async () => {
    const w = build();
    for (const year of [1999, 2101, 2026.5]) await expect(w.balance.execute({ access: paul, year })).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('un employé sorti n’acquiert plus après sa sortie', async () => {
    const w = build();
    w.employees.items.find((e) => e.id === ID.paul)!.archive({ leftOn: '2026-06-30', now });
    expect((await w.balance.execute({ employeeId: ID.paul, year: 2026, access: hr })).entitlement).toBe(9);
  });

  it('suit la règle d’acquisition modifiée par la RH', async () => {
    const w = build();
    await w.updateSettings.execute({ version: 1, accrualDaysPerMonth: 2.5, countsSaturday: false, allowHalfDays: true, allowNegativeBalance: false, access: hr, actor });
    expect((await w.balance.execute({ access: paul, year: 2026 })).entitlement).toBe(30);
  });
});

describe('Absences — calendrier d’équipe', () => {
  const range = { from: '2026-12-01', to: '2026-12-31' };

  async function populated() {
    const w = build();
    const a = await ask(w, sam, { leaveTypeId: TYPE.sick, start: '2026-12-14', end: '2026-12-15' });
    await decide(w, a.id, claire);
    const b = await ask(w, paul, { start: '2026-12-21', end: '2026-12-22' });
    await decide(w, b.id, boss);
    await ask(w, claire); // en attente : n'apparaît pas
    const c = await ask(w, ines, { start: '2026-12-16', end: '2026-12-16' });
    await decide(w, c.id, boss);
    return w;
  }

  it('un collègue voit « absent » sans le type ; seuls l’employé, son responsable, la RH et la Direction voient le type', async () => {
    const w = await populated();
    const asColleague = await w.calendar.execute({ ...range, access: paul });
    expect(asColleague.department).toBe('Commercial');
    const sick = asColleague.entries.find((e) => e.employeeName === 'Sam Test')!;
    expect(sick).toMatchObject({ start: '2026-12-14', end: '2026-12-15', leaveTypeLabel: null });
    expect(asColleague.entries.find((e) => e.employeeName === 'Paul Test')!.leaveTypeLabel).toBe('Congé annuel');
    const asManager = await w.calendar.execute({ ...range, access: claire });
    expect(asManager.entries.find((e) => e.employeeName === 'Sam Test')!.leaveTypeLabel).toBe('Maladie');
    for (const who of [hr, boss]) expect((await w.calendar.execute({ ...range, access: who })).entries.find((e) => e.employeeName === 'Sam Test')!.leaveTypeLabel).toBe('Maladie');
  });

  it('seules les absences VALIDÉES apparaissent, triées par date puis par nom', async () => {
    const w = await populated();
    const entries = (await w.calendar.execute({ ...range, access: hr })).entries;
    expect(entries.map((e) => [e.start, e.employeeName])).toEqual([['2026-12-14', 'Sam Test'], ['2026-12-16', 'Inès Test'], ['2026-12-21', 'Paul Test']]);
  });

  it('hors portée Tous, on ne voit que le service de sa fiche ; la RH et la Direction choisissent', async () => {
    const w = await populated();
    expect((await w.calendar.execute({ ...range, access: paul, department: 'Finance' })).entries.map((e) => e.department)).toEqual(['Commercial', 'Commercial']);
    expect((await w.calendar.execute({ ...range, access: hr, department: 'Finance' })).entries.map((e) => e.employeeName)).toEqual(['Inès Test']);
    expect((await w.calendar.execute({ ...range, access: boss, department: 'finance' })).entries.map((e) => e.employeeName)).toEqual(['Inès Test']);
    expect((await w.calendar.execute({ ...range, access: hr })).entries).toHaveLength(3);
    expect((await w.calendar.execute({ ...range, access: hr })).department).toBeNull();
  });

  it('sans fiche employé, un employé ne voit personne ; la RH, elle, voit', async () => {
    const w = await populated();
    expect((await w.calendar.execute({ ...range, access: as(RoleCode.Support, 'u-sans-fiche') })).entries).toEqual([]);
  });

  it('ne montre pas les employés sortis, et rend les jours fériés de la période', async () => {
    const w = await populated();
    w.employees.items.find((e) => e.id === ID.sam)!.archive({ now });
    await w.addHoliday.execute({ day: '2026-12-25', label: 'Noël', access: hr, actor });
    const view = await w.calendar.execute({ ...range, access: hr });
    expect(view.entries.map((e) => e.employeeName)).not.toContain('Sam Test');
    expect(view.holidays).toEqual([expect.objectContaining({ day: '2026-12-25', label: 'Noël' })]);
  });

  it('ne rend que les absences qui touchent la période', async () => {
    const w = await populated();
    const view = await w.calendar.execute({ from: '2026-12-15', to: '2026-12-15', access: hr });
    expect(view.entries.map((e) => e.employeeName)).toEqual(['Sam Test']);
  });

  it('refuse une période mal formée, trop longue (93 jours), ou sans droit', async () => {
    const w = build();
    await expect(w.calendar.execute({ from: '2026-12-31', to: '2026-12-01', access: hr })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(w.calendar.execute({ from: '2026-13-01', to: '2026-14-01', access: hr })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(w.calendar.execute({ from: '2026-02-30', to: '2026-03-02', access: hr })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(w.calendar.execute({ from: 'demain', to: '2026-12-01', access: hr })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(w.calendar.execute({ from: '2026-12-01', to: '2027-03-04', access: hr })).rejects.toMatchObject({ code: 'VALIDATION', message: expect.stringContaining('93') });
    await expect(w.calendar.execute({ from: '2026-12-01', to: '2027-03-03', access: hr })).resolves.toBeDefined();
    await expect(w.calendar.execute({ ...range, access: nobody })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('Absences — paramétrage (RH)', () => {
  it('paramétrer exige la portée Tous : le droit de gestion en portée Propre ne suffit pas', async () => {
    const w = build();
    const narrow: AccessContext = { actorId: 'u-etroit', grants: [{ permission: 'hr.leave.manage', scope: Scope.Own }, { permission: 'hr.leave.read', scope: Scope.Own }], teamMemberIds: [] };
    await expect(w.createType.execute({ code: 'NOPE', label: 'Non', access: narrow, actor })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(w.addHoliday.execute({ day: '2026-12-25', label: 'Non', access: narrow, actor })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(w.adjust.execute({ employeeId: ID.paul, year: 2026, days: 1, reason: 'x', access: narrow, actor })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    // Même sort pour l'annulation d'une demande d'autrui.
    const asked = await ask(w, sam);
    await expect(cancel(w, asked.id, narrow)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('les types actifs se lisent par tous ceux qui demandent, triés ; la RH voit aussi les désactivés', async () => {
    const w = build();
    expect((await w.types.execute({ access: paul })).map((t) => t.code)).toEqual(['ANNUAL', 'SICK', 'SPECIAL', 'AUTO']);
    expect((await w.types.execute({ access: paul, includeInactive: true })).map((t) => t.code)).toEqual(['ANNUAL', 'SICK', 'SPECIAL', 'AUTO']);
    expect((await w.types.execute({ access: hr, includeInactive: true })).map((t) => t.code)).toEqual(['ANNUAL', 'SICK', 'SPECIAL', 'AUTO', 'OLD']);
    await expect(w.types.execute({ access: nobody })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('la RH crée un type : code unique, audit ; les autres sont refusés', async () => {
    const w = build();
    const view = await w.createType.execute({ code: 'study', label: 'Formation', deductsBalance: false, access: hr, actor });
    expect(view).toMatchObject({ code: 'STUDY', label: 'Formation', active: true, version: 1 });
    expect(w.audit.at(-1)).toMatchObject({ action: AuditAction.Create, entityType: 'LeaveType', entityId: view.id });
    await expect(w.createType.execute({ code: 'STUDY', label: 'Doublon', access: hr, actor })).rejects.toMatchObject({ code: 'CONFLICT' });
    for (const who of [boss, claire, ines]) await expect(w.createType.execute({ code: 'NOPE', label: 'Non', access: who, actor })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect((await w.createType.execute({ code: 'ROOT', label: 'Super', access: root, actor })).code).toBe('ROOT');
  });

  it('la RH modifie ou désactive un type : version contrôlée, audit avant et après ; un type désactivé ne se demande plus', async () => {
    const w = build();
    const view = await w.updateType.execute({ id: TYPE.special, version: 1, label: 'Permission', active: false, access: hr, actor });
    expect(view).toMatchObject({ label: 'Permission', active: false });
    expect(w.audit.at(-1)).toMatchObject({ action: AuditAction.Update, entityType: 'LeaveType', oldValue: expect.objectContaining({ label: 'Permission exceptionnelle', active: true }), newValue: expect.objectContaining({ label: 'Permission', active: false }) });
    await expect(ask(w, paul, { leaveTypeId: TYPE.special })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(w.updateType.execute({ id: TYPE.special, version: 5, label: 'X', access: hr, actor })).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(w.updateType.execute({ id: uuid(999), version: 1, label: 'X', access: hr, actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(w.updateType.execute({ id: TYPE.sick, version: 1, label: 'X', access: boss, actor })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('les règles se lisent par tous ceux qui demandent et se modifient par la RH, version contrôlée, audit avant et après', async () => {
    const w = build();
    expect(await w.settings.execute({ access: paul })).toEqual({ accrualDaysPerMonth: 1.5, countsSaturday: false, allowHalfDays: true, allowNegativeBalance: false, version: 1 });
    await expect(w.settings.execute({ access: nobody })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const after = await w.updateSettings.execute({ version: 1, accrualDaysPerMonth: 2, countsSaturday: true, allowHalfDays: false, allowNegativeBalance: true, access: hr, actor });
    expect(after).toEqual({ accrualDaysPerMonth: 2, countsSaturday: true, allowHalfDays: false, allowNegativeBalance: true, version: 2 });
    expect(w.audit.at(-1)).toMatchObject({ action: AuditAction.Update, entityType: 'LeaveSettings', oldValue: expect.objectContaining({ accrualDaysPerMonth: 1.5 }), newValue: expect.objectContaining({ accrualDaysPerMonth: 2, version: 2 }) });
    await expect(w.updateSettings.execute({ version: 1, accrualDaysPerMonth: 3, countsSaturday: false, allowHalfDays: true, allowNegativeBalance: false, access: hr, actor })).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(w.updateSettings.execute({ version: 2, accrualDaysPerMonth: 6, countsSaturday: false, allowHalfDays: true, allowNegativeBalance: false, access: hr, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(w.updateSettings.execute({ version: 2, accrualDaysPerMonth: 1, countsSaturday: false, allowHalfDays: true, allowNegativeBalance: false, access: boss, actor })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('les jours fériés : la RH les saisit (un par date) et les retire, tous les lisent ; audit', async () => {
    const w = build();
    const noel = await w.addHoliday.execute({ day: '2026-12-25', label: 'Noël', access: hr, actor });
    expect(w.audit.at(-1)).toMatchObject({ action: AuditAction.Create, entityType: 'PublicHoliday', entityId: noel.id });
    await expect(w.addHoliday.execute({ day: '2026-12-25', label: 'Doublon', access: hr, actor })).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(w.addHoliday.execute({ day: '2026-02-30', label: 'X', access: hr, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(w.addHoliday.execute({ day: '2026-12-26', label: 'X', access: boss, actor })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await w.addHoliday.execute({ day: '2027-01-01', label: 'Nouvel an', access: root, actor });
    expect((await w.holidays.execute({ year: 2026, access: paul })).map((h) => h.day)).toEqual(['2026-12-25']);
    expect((await w.holidays.execute({ year: 2027, access: paul })).map((h) => h.label)).toEqual(['Nouvel an']);
    await expect(w.holidays.execute({ year: 1999, access: paul })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(w.holidays.execute({ year: 2026, access: nobody })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await w.removeHoliday.execute({ id: noel.id, access: hr, actor });
    expect(w.audit.at(-1)).toMatchObject({ action: AuditAction.Delete, entityType: 'PublicHoliday', entityId: noel.id });
    expect(await w.holidays.execute({ year: 2026, access: hr })).toEqual([]);
    await expect(w.removeHoliday.execute({ id: noel.id, access: hr, actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(w.removeHoliday.execute({ id: noel.id, access: boss, actor })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('retirer un jour férié ne modifie pas les jours déjà décomptés d’une demande', async () => {
    const w = build();
    const noel = await w.addHoliday.execute({ day: '2026-12-25', label: 'Noël', access: hr, actor });
    const asked = await ask(w, paul, { start: '2026-12-24', end: '2026-12-28' });
    await w.removeHoliday.execute({ id: noel.id, access: hr, actor });
    expect((await w.get.execute({ id: asked.id, access: paul })).days).toBe(2);
  });

  it('un ajustement : RH seulement, motif obligatoire, ajout seul, audité ; la liste est réservée à la RH', async () => {
    const w = build();
    const view = await w.adjust.execute({ employeeId: ID.paul, year: 2027, days: 4, reason: 'Report 2026', access: hr, actor });
    expect(view).toMatchObject({ employeeId: ID.paul, year: 2027, days: 4, reason: 'Report 2026' });
    expect(w.audit.at(-1)).toMatchObject({ action: AuditAction.Create, entityType: 'LeaveAdjustment', entityId: view.id });
    expect(w.adjustments.items[0]).toMatchObject({ createdByUserId: 'u-hr', createdAt: now });
    await expect(w.adjust.execute({ employeeId: ID.paul, year: 2027, days: 0, reason: 'x', access: hr, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(w.adjust.execute({ employeeId: ID.paul, year: 2027, days: 1, reason: ' ', access: hr, actor })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(w.adjust.execute({ employeeId: uuid(999), year: 2027, days: 1, reason: 'x', access: hr, actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    for (const who of [boss, claire, paul]) await expect(w.adjust.execute({ employeeId: ID.paul, year: 2027, days: 1, reason: 'x', access: who, actor })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect((await w.listAdjustments.execute({ employeeId: ID.paul, year: 2027, access: hr })).map((a) => a.days)).toEqual([4]);
    expect(await w.listAdjustments.execute({ employeeId: ID.paul, year: 2026, access: hr })).toEqual([]);
    await expect(w.listAdjustments.execute({ employeeId: ID.paul, year: 2027, access: boss })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(w.listAdjustments.execute({ employeeId: uuid(999), year: 2027, access: hr })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
