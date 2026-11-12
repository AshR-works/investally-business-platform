import { InMemoryEmployees } from '../../../../test/support/in-memory-employees';
import { InMemoryLeaveRequests } from '../../../../test/support/in-memory-leave';
import { InMemoryPresences } from '../../../../test/support/in-memory-presences';
import { ActorContext } from '../../../shared-kernel';
import { AuditAction, AuditRecord } from '../../audit';
import type { AccessContext } from '../../iam';
import { RoleCode, Scope, resolveGrants } from '../../iam';
import { Employee } from '../domain/employee';
import { LeaveRequest } from '../domain/leave-request';
import { PresenceDeclaration } from '../domain/presence';
import { DeclarePresenceUseCase, GetPresenceBoardHandler, RemovePresenceUseCase } from './presence-use-cases';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const actorOf = (userId: string): ActorContext => ({ userId, sessionId: 's1', ipAddress: '10.0.0.1', device: 'jest' });
const as = (role: RoleCode, actorId: string): AccessContext => ({ actorId, grants: resolveGrants(role), teamMemberIds: [] });
// 2026-11-10 est un mardi.
const now = new Date('2026-11-10T09:00:00Z');
const TODAY = '2026-11-10';

const boss = as(RoleCode.Direction, 'u-boss');
const claire = as(RoleCode.AccountManager, 'u-claire'); // responsable directe de Sam
const sam = as(RoleCode.Support, 'u-sam');
const paul = as(RoleCode.Support, 'u-paul'); // collègue de Sam, sans lien hiérarchique
const hr = as(RoleCode.Hr, 'u-hr');
const root = as(RoleCode.SuperAdmin, 'u-root');
const nobody: AccessContext = { actorId: 'u-none', grants: [], teamMemberIds: [] };
// Droit de déclarer accordé en portée Équipe : il ne suffit jamais, déclarer pour un autre exige la portée Tous.
const teamDeclare: AccessContext = { actorId: 'u-team', grants: [{ permission: 'hr.presence.declare', scope: Scope.Team }, { permission: 'hr.presence.read', scope: Scope.Own }], teamMemberIds: [uuid(2)] };

const ID = { boss: uuid(1), claire: uuid(2), sam: uuid(4), paul: uuid(5), hr: uuid(6), left: uuid(8), newbie: uuid(9) };

function build() {
  const employees = new InMemoryEmployees();
  const presences = new InMemoryPresences();
  const leave = new InMemoryLeaveRequests();
  const audit: AuditRecord[] = [];
  let seq = 0;
  const recorder = { record: async (r: AuditRecord) => { audit.push(r); } };
  const unitOfWork = { run: <T>(work: () => Promise<T>) => work() };
  const clock = { now: () => now };
  const ids = { next: () => uuid(900 + ++seq) };

  const person = (key: keyof typeof ID, firstName: string, user: string | null, over: { manager?: string; hiredOn?: string; department?: string } = {}) =>
    employees.items.push(Employee.register({ id: ID[key], lastName: 'Test', firstName, jobTitle: 'Poste', department: over.department ?? 'Dép', managerEmployeeId: over.manager ?? null, userId: user, hiredOn: over.hiredOn ?? '2020-01-01', now }));
  person('boss', 'Bruno', 'u-boss');
  person('claire', 'Claire', 'u-claire');
  person('sam', 'Sam', 'u-sam', { manager: ID.claire });
  person('paul', 'Paul', 'u-paul', { department: 'Autre' });
  person('hr', 'Hélène', 'u-hr');
  person('left', 'Léa', 'u-left');
  employees.items[5]!.archive({ leftOn: '2026-06-30', reason: 'Départ', now });
  person('newbie', 'Nina', 'u-newbie', { hiredOn: '2026-11-12' });

  return {
    employees, presences, leave, audit,
    declare: new DeclarePresenceUseCase(employees, presences, leave, recorder, unitOfWork, clock, ids),
    remove: new RemovePresenceUseCase(employees, presences, recorder, unitOfWork, clock),
    board: new GetPresenceBoardHandler(employees, presences, leave),
  };
}

let leaveSeq = 0;
const approvedLeave = (employeeId: string, start: string, end: string, over: { startHalf?: boolean; endHalf?: boolean } = {}) =>
  LeaveRequest.create({ id: uuid(700 + (leaveSeq += 1)), employeeId, leaveTypeId: uuid(300), start, end, startHalf: over.startHalf ?? false, endHalf: over.endHalf ?? false, days: 1, requestedByUserId: 'u-hr', now, approvedBy: 'u-hr' });

describe('Présences : déclarer', () => {
  it('l’employé déclare sa présence du jour ; audit', async () => {
    const w = build();
    const view = await w.declare.execute({ day: TODAY, mode: 'REMOTE', access: sam, actor: actorOf('u-sam') });
    expect(view).toMatchObject({ employeeId: ID.sam, employeeName: 'Sam Test', day: TODAY, mode: 'REMOTE', enteredByOther: false });
    expect(w.presences.items).toHaveLength(1);
    expect(w.audit).toHaveLength(1);
    expect(w.audit[0]).toMatchObject({ module: 'hr', entityType: 'PresenceDeclaration', action: AuditAction.Create });
  });

  it('redéclarer un autre mode le change et écrit avant/après ; le même mode ne change rien et n’écrit rien', async () => {
    const w = build();
    await w.declare.execute({ day: TODAY, mode: 'REMOTE', access: sam, actor: actorOf('u-sam') });
    const same = await w.declare.execute({ day: TODAY, mode: 'REMOTE', access: sam, actor: actorOf('u-sam') });
    expect(same.mode).toBe('REMOTE');
    expect(w.audit).toHaveLength(1);
    const changed = await w.declare.execute({ day: TODAY, mode: 'ON_SITE', access: sam, actor: actorOf('u-sam') });
    expect(changed.mode).toBe('ON_SITE');
    expect(w.presences.items).toHaveLength(1);
    expect(w.audit).toHaveLength(2);
    expect(w.audit[1]).toMatchObject({ action: AuditAction.Update, oldValue: { mode: 'REMOTE' }, newValue: { mode: 'ON_SITE' } });
  });

  it('la RH déclare pour un autre : la saisie est marquée « par un autre », l’employé voit la trace', async () => {
    const w = build();
    const view = await w.declare.execute({ employeeId: ID.sam, day: TODAY, mode: 'TRAVEL', access: hr, actor: actorOf('u-hr') });
    expect(view).toMatchObject({ employeeId: ID.sam, mode: 'TRAVEL', enteredByOther: true });
    const own = await w.declare.execute({ day: TODAY, mode: 'ON_SITE', access: sam, actor: actorOf('u-sam') });
    expect(own.enteredByOther).toBe(false);
  });

  it('refuse sans le droit, et sans fiche liée au compte', async () => {
    const w = build();
    await expect(w.declare.execute({ day: TODAY, mode: 'REMOTE', access: nobody, actor: actorOf('u-none') })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const stranger = as(RoleCode.Support, 'u-stranger');
    await expect(w.declare.execute({ day: TODAY, mode: 'REMOTE', access: stranger, actor: actorOf('u-stranger') })).rejects.toMatchObject({ code: 'VALIDATION', message: expect.stringMatching(/fiche employé/) });
    expect(w.presences.items).toHaveLength(0);
    expect(w.audit).toHaveLength(0);
  });

  it.each([['collègue', paul], ['responsable', claire], ['Direction', boss], ['droit en portée Équipe', teamDeclare]])('%s ne déclare pas pour un autre : « introuvable »', async (_l, access) => {
    const w = build();
    await expect(w.declare.execute({ employeeId: ID.sam, day: TODAY, mode: 'REMOTE', access, actor: actorOf(access.actorId) })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(w.presences.items).toHaveLength(0);
    expect(w.audit).toHaveLength(0);
  });

  it('un employé inexistant est « introuvable » (même réponse qu’un employé hors périmètre)', async () => {
    const w = build();
    await expect(w.declare.execute({ employeeId: uuid(999), day: TODAY, mode: 'REMOTE', access: hr, actor: actorOf('u-hr') })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('le Super administrateur déclare pour tous', async () => {
    const w = build();
    expect((await w.declare.execute({ employeeId: ID.paul, day: TODAY, mode: 'REMOTE', access: root, actor: actorOf('u-root') })).employeeId).toBe(ID.paul);
  });

  it('refuse un mode inconnu, un jour invalide, un employé archivé', async () => {
    const w = build();
    await expect(w.declare.execute({ day: TODAY, mode: 'HEURES', access: sam, actor: actorOf('u-sam') })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(w.declare.execute({ day: '2026-13-01', mode: 'REMOTE', access: sam, actor: actorOf('u-sam') })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(w.declare.execute({ employeeId: ID.left, day: '2026-06-01', mode: 'REMOTE', access: hr, actor: actorOf('u-hr') })).rejects.toMatchObject({ code: 'CONFLICT', message: expect.stringMatching(/archivé/) });
    expect(w.presences.items).toHaveLength(0);
  });

  describe('fenêtre de saisie', () => {
    it('employé : 7 jours en arrière et 30 en avant, bornes comprises', async () => {
      const w = build();
      for (const day of ['2026-11-03', '2026-12-10']) {
        const view = await w.declare.execute({ day, mode: 'REMOTE', access: sam, actor: actorOf('u-sam') });
        expect(view.day).toBe(day);
      }
      await expect(w.declare.execute({ day: '2026-11-02', mode: 'REMOTE', access: sam, actor: actorOf('u-sam') })).rejects.toMatchObject({ code: 'VALIDATION', message: expect.stringMatching(/trop ancien.*7 jours/) });
      await expect(w.declare.execute({ day: '2026-12-11', mode: 'REMOTE', access: sam, actor: actorOf('u-sam') })).rejects.toMatchObject({ code: 'VALIDATION', message: expect.stringMatching(/trop lointain.*30 jours/) });
    });

    it('RH : 90 jours en arrière et en avant, bornes comprises', async () => {
      const w = build();
      for (const day of ['2026-08-12', '2027-02-08']) {
        expect((await w.declare.execute({ employeeId: ID.sam, day, mode: 'REMOTE', access: hr, actor: actorOf('u-hr') })).day).toBe(day);
      }
      await expect(w.declare.execute({ employeeId: ID.sam, day: '2026-08-11', mode: 'REMOTE', access: hr, actor: actorOf('u-hr') })).rejects.toMatchObject({ code: 'VALIDATION', message: expect.stringMatching(/90 jours/) });
      await expect(w.declare.execute({ employeeId: ID.sam, day: '2027-02-09', mode: 'REMOTE', access: hr, actor: actorOf('u-hr') })).rejects.toMatchObject({ code: 'VALIDATION', message: expect.stringMatching(/90 jours/) });
    });

    it('jamais avant l’entrée ni après le départ de l’employé', async () => {
      const w = build();
      await expect(w.declare.execute({ day: '2026-11-11', mode: 'REMOTE', access: as(RoleCode.Support, 'u-newbie'), actor: actorOf('u-newbie') })).rejects.toMatchObject({ code: 'VALIDATION', message: expect.stringMatching(/avant la date d'entrée/) });
      expect((await w.declare.execute({ day: '2026-11-12', mode: 'REMOTE', access: as(RoleCode.Support, 'u-newbie'), actor: actorOf('u-newbie') })).day).toBe('2026-11-12');
    });
  });

  describe('absences validées', () => {
    it('une absence validée sur la journée entière interdit la déclaration', async () => {
      const w = build();
      await w.leave.save(approvedLeave(ID.sam, '2026-11-10', '2026-11-12'));
      for (const day of ['2026-11-10', '2026-11-11', '2026-11-12']) {
        await expect(w.declare.execute({ day, mode: 'REMOTE', access: sam, actor: actorOf('u-sam') })).rejects.toMatchObject({ code: 'CONFLICT', message: expect.stringMatching(/absence validée/) });
      }
      expect((await w.declare.execute({ day: '2026-11-13', mode: 'REMOTE', access: sam, actor: actorOf('u-sam') })).day).toBe('2026-11-13');
      expect((await w.declare.execute({ day: '2026-11-09', mode: 'REMOTE', access: sam, actor: actorOf('u-sam') })).day).toBe('2026-11-09');
    });

    it('une demi-journée d’absence laisse déclarer l’autre moitié', async () => {
      const w = build();
      await w.leave.save(approvedLeave(ID.sam, '2026-11-10', '2026-11-12', { startHalf: true, endHalf: true }));
      expect((await w.declare.execute({ day: '2026-11-10', mode: 'REMOTE', access: sam, actor: actorOf('u-sam') })).day).toBe('2026-11-10');
      expect((await w.declare.execute({ day: '2026-11-12', mode: 'REMOTE', access: sam, actor: actorOf('u-sam') })).day).toBe('2026-11-12');
      await expect(w.declare.execute({ day: '2026-11-11', mode: 'REMOTE', access: sam, actor: actorOf('u-sam') })).rejects.toMatchObject({ code: 'CONFLICT' });
    });

    it('une demande en attente ne bloque pas ; l’absence d’un autre employé non plus', async () => {
      const w = build();
      const pending = LeaveRequest.create({ id: uuid(777), employeeId: ID.sam, leaveTypeId: uuid(300), start: TODAY, end: TODAY, startHalf: false, endHalf: false, days: 1, requestedByUserId: 'u-sam', now });
      await w.leave.save(pending);
      await w.leave.save(approvedLeave(ID.paul, TODAY, TODAY));
      expect((await w.declare.execute({ day: TODAY, mode: 'REMOTE', access: sam, actor: actorOf('u-sam') })).mode).toBe('REMOTE');
    });
  });
});

describe('Présences : retirer', () => {
  it('la RH retire une présence restée après le départ d’un employé archivé ; déclarer pour lui reste refusé', async () => {
    const w = build();
    w.presences.items.push(PresenceDeclaration.declare({ id: uuid(800), employeeId: ID.left, day: '2026-11-08', mode: 'REMOTE', declaredByUserId: 'u-hr', now }));
    await expect(w.declare.execute({ employeeId: ID.left, day: '2026-11-09', mode: 'REMOTE', access: hr, actor: actorOf('u-hr') })).rejects.toMatchObject({ code: 'CONFLICT' });
    await w.remove.execute({ employeeId: ID.left, day: '2026-11-08', access: hr, actor: actorOf('u-hr') });
    expect(w.presences.items).toHaveLength(0);
  });

  it('l’employé retire sa déclaration ; audit avec l’ancienne valeur', async () => {
    const w = build();
    await w.declare.execute({ day: TODAY, mode: 'REMOTE', access: sam, actor: actorOf('u-sam') });
    await w.remove.execute({ day: TODAY, access: sam, actor: actorOf('u-sam') });
    expect(w.presences.items).toHaveLength(0);
    expect(w.audit[1]).toMatchObject({ action: AuditAction.Delete, entityType: 'PresenceDeclaration', oldValue: { mode: 'REMOTE', day: TODAY } });
  });

  it('la RH retire celle d’un autre ; pas un collègue ni une absence de déclaration', async () => {
    const w = build();
    await w.declare.execute({ day: TODAY, mode: 'REMOTE', access: sam, actor: actorOf('u-sam') });
    await expect(w.remove.execute({ employeeId: ID.sam, day: TODAY, access: paul, actor: actorOf('u-paul') })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(w.presences.items).toHaveLength(1);
    await w.remove.execute({ employeeId: ID.sam, day: TODAY, access: hr, actor: actorOf('u-hr') });
    expect(w.presences.items).toHaveLength(0);
    await expect(w.remove.execute({ employeeId: ID.sam, day: TODAY, access: hr, actor: actorOf('u-hr') })).rejects.toMatchObject({ code: 'NOT_FOUND', message: expect.stringMatching(/Aucune présence/) });
  });

  it('refuse sans le droit, et hors de la fenêtre de saisie', async () => {
    const w = build();
    await expect(w.remove.execute({ day: TODAY, access: nobody, actor: actorOf('u-none') })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(w.remove.execute({ day: '2026-10-01', access: sam, actor: actorOf('u-sam') })).rejects.toMatchObject({ code: 'VALIDATION', message: expect.stringMatching(/trop ancien/) });
  });
});

describe('Présences : tableau', () => {
  const period = { from: '2026-11-09', to: '2026-11-15' };

  async function seeded() {
    const w = build();
    await w.declare.execute({ day: '2026-11-10', mode: 'REMOTE', access: sam, actor: actorOf('u-sam') });
    await w.declare.execute({ day: '2026-11-11', mode: 'ON_SITE', access: sam, actor: actorOf('u-sam') });
    await w.declare.execute({ day: '2026-11-10', mode: 'TRAVEL', access: paul, actor: actorOf('u-paul') });
    await w.leave.save(approvedLeave(ID.claire, '2026-11-12', '2026-11-20'));
    await w.leave.save(approvedLeave(ID.claire, '2026-11-01', '2026-11-09', { endHalf: true }));
    return w;
  }

  it('la RH et la Direction voient tout le personnel en poste, par ordre alphabétique, avec les jours d’absence validée', async () => {
    const w = await seeded();
    for (const access of [hr, boss, root]) {
      const view = await w.board.execute({ ...period, access });
      expect(view.rows.map((r) => r.employeeName)).toEqual(['Bruno Test', 'Claire Test', 'Hélène Test', 'Nina Test', 'Paul Test', 'Sam Test']);
      expect(view.rows.find((r) => r.employeeId === ID.sam)!.entries).toEqual([{ day: '2026-11-10', mode: 'REMOTE' }, { day: '2026-11-11', mode: 'ON_SITE' }]);
      expect(view.rows.find((r) => r.employeeId === ID.claire)!.leaveDays).toEqual(['2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']);
      expect(view.rows.find((r) => r.employeeId === ID.boss)).toMatchObject({ entries: [], leaveDays: [] });
    }
  });

  it('un employé voit seulement sa ligne ; son responsable voit la sienne et celles de ses subordonnés directs', async () => {
    const w = await seeded();
    expect((await w.board.execute({ ...period, access: sam })).rows.map((r) => r.employeeName)).toEqual(['Sam Test']);
    expect((await w.board.execute({ ...period, access: paul })).rows.map((r) => r.employeeName)).toEqual(['Paul Test']);
    const manager = await w.board.execute({ ...period, access: claire });
    expect(manager.rows.map((r) => r.employeeName)).toEqual(['Claire Test', 'Sam Test']);
    expect(manager.rows.find((r) => r.employeeId === ID.sam)!.entries).toHaveLength(2);
  });

  it('indique la fiche du demandeur et s’il peut déclarer pour tous', async () => {
    const w = await seeded();
    expect(await w.board.execute({ ...period, access: sam })).toMatchObject({ viewerEmployeeId: ID.sam, canDeclareForAll: false });
    expect(await w.board.execute({ ...period, access: hr })).toMatchObject({ viewerEmployeeId: ID.hr, canDeclareForAll: true });
    expect(await w.board.execute({ ...period, access: boss })).toMatchObject({ viewerEmployeeId: ID.boss, canDeclareForAll: false });
  });

  it('un compte sans fiche liée ne voit personne en portée réduite', async () => {
    const w = await seeded();
    const view = await w.board.execute({ ...period, access: as(RoleCode.Support, 'u-stranger') });
    expect(view).toMatchObject({ rows: [], viewerEmployeeId: null });
  });

  it('filtre par service (sans tenir compte de la casse), y compris pour le responsable', async () => {
    const w = await seeded();
    expect((await w.board.execute({ ...period, department: 'AUTRE', access: hr })).rows.map((r) => r.employeeName)).toEqual(['Paul Test']);
    expect((await w.board.execute({ ...period, department: ' dép ', access: claire })).rows.map((r) => r.employeeName)).toEqual(['Claire Test', 'Sam Test']);
    expect((await w.board.execute({ ...period, department: 'Autre', access: claire })).rows).toEqual([]);
  });

  it('la période est bornée : dates valides, fin après début, 93 jours au plus', async () => {
    const w = build();
    await expect(w.board.execute({ from: '2026-11-15', to: '2026-11-09', access: hr })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(w.board.execute({ from: '2026-11-31', to: '2026-12-02', access: hr })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(w.board.execute({ from: '2026-01-01', to: '2026-04-04', access: hr })).rejects.toMatchObject({ code: 'VALIDATION', message: expect.stringMatching(/93 jours/) });
    expect((await w.board.execute({ from: '2026-01-01', to: '2026-04-03', access: hr })).rows.length).toBeGreaterThan(0);
  });

  it('refuse sans le droit de lecture', async () => {
    const w = build();
    await expect(w.board.execute({ ...period, access: nobody })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
