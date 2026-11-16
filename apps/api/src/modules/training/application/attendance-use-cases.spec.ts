import { actor, buildTrainingWorld } from '../../../../test/support/training-world';
import { DomainError } from '../../../shared-kernel';
import { AuditAction } from '../../audit';
import type { AccessContext } from '../../iam';
import { RoleCode, resolveGrants } from '../../iam/domain/roles';

let currentNow = new Date('2026-11-06T09:00:00Z'); // vendredi
const as = (role: RoleCode, actorId: string): AccessContext => ({ actorId, grants: resolveGrants(role), teamMemberIds: [] });
const inv = as(RoleCode.TrainingManager, 'inv');

const rejects = async (promise: Promise<unknown>, code: string, message?: RegExp) => {
  const error = await promise.then(() => null, (e: unknown) => e);
  expect(error).toBeInstanceOf(DomainError);
  expect((error as DomainError).code).toBe(code);
  if (message) expect((error as DomainError).message).toMatch(message);
};

beforeEach(() => { currentNow = new Date('2026-11-06T09:00:00Z'); });

async function setup() {
  const w = await buildTrainingWorld({ now: () => currentNow });
  w.directory.companies.set('c1', { id: 'c1', name: 'Banque Test', ownerUserId: 'am1', archived: false });
  w.directory.approvals.set('ap-places', { id: 'ap-places', companyId: 'c1', status: 'RECEIVED', amount: null, places: 10, currency: 'XAF', validUntil: null, receivedOn: '2026-10-12', payerName: null } as never);
  const am = as(RoleCode.AccountManager, 'am1');
  const aicha = await w.registerLearner.execute({ companyId: 'c1', lastName: 'Mbarga', firstName: 'Aïcha', access: am, actor });
  const brice = await w.registerLearner.execute({ companyId: 'c1', lastName: 'Nkomo', firstName: 'Brice', access: am, actor });
  const planned = await w.plan.execute({ trainingId: w.certTrading.id, rhythm: 'DAY', startDate: '2026-11-16', roomId: w.salleMarches.id, trainerId: w.interne.id, capacity: 5, actor });
  await w.open.execute({ id: planned.id, version: 1, actor });
  const enrolledA = await w.enroll.execute({ sessionId: planned.id, learnerId: aicha.id, approvalId: 'ap-places', access: am, actor });
  await w.confirm.execute({ id: enrolledA.id, version: 1, access: inv, actor });
  // Brice reste « en attente » (jamais confirmé) : il ne doit pas apparaître sur la feuille de présence.
  const enrolledB = await w.enroll.execute({ sessionId: planned.id, learnerId: brice.id, approvalId: 'ap-places', access: am, actor });
  return { w, planned, enrolledA, enrolledB, aicha, brice };
}

describe('Présences aux séances (S5.3a)', () => {
  it('se saisit pour un inscrit confirmé, idempotent, avec audit', async () => {
    const { w, planned, enrolledA } = await setup();
    const view = await w.recordAttendance.execute({ sessionId: planned.id, enrollmentId: enrolledA.id, day: '2026-11-17', status: 'PRESENT', access: inv, actor });
    expect(view).toMatchObject({ enrollmentId: enrolledA.id, day: '2026-11-17', status: 'PRESENT' });
    expect(w.audit.at(-1)).toMatchObject({ action: AuditAction.Create, entityType: 'Attendance', module: 'training' });
    const before = w.audit.length;
    // Redéclarer la même valeur n'écrit rien dans le journal (idempotent, comme les présences RH).
    await w.recordAttendance.execute({ sessionId: planned.id, enrollmentId: enrolledA.id, day: '2026-11-17', status: 'PRESENT', access: inv, actor });
    expect(w.audit.length).toBe(before);
  });

  it('corrige une présence déjà saisie, garde le dernier auteur, trace avant/après', async () => {
    const { w, planned, enrolledA } = await setup();
    await w.recordAttendance.execute({ sessionId: planned.id, enrollmentId: enrolledA.id, day: '2026-11-17', status: 'PRESENT', access: inv, actor });
    const corrected = await w.recordAttendance.execute({ sessionId: planned.id, enrollmentId: enrolledA.id, day: '2026-11-17', status: 'ABSENT', access: inv, actor });
    expect(corrected.status).toBe('ABSENT');
    expect(w.audit.at(-1)).toMatchObject({ action: AuditAction.Update, entityType: 'Attendance', oldValue: { status: 'PRESENT' }, newValue: { status: 'ABSENT' } });
  });

  it('refuse une inscription non confirmée (en attente), un jour hors session, et une session inexistante', async () => {
    const { w, planned, enrolledB } = await setup();
    await rejects(w.recordAttendance.execute({ sessionId: planned.id, enrollmentId: enrolledB.id, day: '2026-11-17', status: 'PRESENT', access: inv, actor }), 'INVARIANT_VIOLATION', /confirmés/);
    const { enrolledA } = await setup();
    await rejects(w.recordAttendance.execute({ sessionId: planned.id, enrollmentId: enrolledA.id, day: '2026-11-21', status: 'PRESENT', access: inv, actor }), 'VALIDATION', /hors de la période/);
    await rejects(w.recordAttendance.execute({ sessionId: 'inconnue', enrollmentId: enrolledA.id, day: '2026-11-17', status: 'PRESENT', access: inv, actor }), 'NOT_FOUND', /Session introuvable/);
  });

  it('refuse toute saisie une fois la session clôturée, et l\'accepte de nouveau après réouverture', async () => {
    const { w, planned, enrolledA } = await setup();
    await w.recordAttendance.execute({ sessionId: planned.id, enrollmentId: enrolledA.id, day: '2026-11-17', status: 'PRESENT', access: inv, actor });
    await w.close.execute({ id: planned.id, version: 1, actor });
    await rejects(w.recordAttendance.execute({ sessionId: planned.id, enrollmentId: enrolledA.id, day: '2026-11-18', status: 'PRESENT', access: inv, actor }), 'INVARIANT_VIOLATION', /figées/);
    await w.reopenSession.execute({ id: planned.id, version: 1, reason: 'Correction après coup', actor });
    await expect(w.recordAttendance.execute({ sessionId: planned.id, enrollmentId: enrolledA.id, day: '2026-11-18', status: 'LATE', access: inv, actor })).resolves.toMatchObject({ status: 'LATE' });
  });
});

describe('Feuille de présence (S5.3a)', () => {
  it('ne montre que les inscrits confirmés, une colonne par jour de cours de la session', async () => {
    const { w, planned, enrolledA } = await setup();
    await w.recordAttendance.execute({ sessionId: planned.id, enrollmentId: enrolledA.id, day: '2026-11-17', status: 'LATE', access: inv, actor });
    const sheet = await w.attendanceSheet.execute({ sessionId: planned.id });
    expect(sheet.days).toEqual(['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20']);
    expect(sheet.rows).toHaveLength(1); // Brice (en attente) n'y figure pas
    expect(sheet.rows[0]).toMatchObject({ enrollmentId: enrolledA.id, learnerName: 'Aïcha Mbarga', entries: [{ day: '2026-11-17', status: 'LATE' }] });
    expect(sheet.canRecord).toBe(true);
  });

  it('une session inexistante est « introuvable »', async () => {
    const { w } = await setup();
    await rejects(w.attendanceSheet.execute({ sessionId: 'inconnue' }), 'NOT_FOUND', /Session introuvable/);
  });
});
