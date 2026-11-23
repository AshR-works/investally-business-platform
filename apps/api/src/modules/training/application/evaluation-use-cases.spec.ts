import { actor, buildTrainingWorld } from '../../../../test/support/training-world';
import { DomainError } from '../../../shared-kernel';
import { AuditAction } from '../../audit';
import type { AccessContext } from '../../iam';
import { RoleCode, resolveGrants } from '../../iam/domain/roles';

let currentNow = new Date('2026-11-06T09:00:00Z'); // vendredi
const as = (role: RoleCode, actorId: string): AccessContext => ({ actorId, grants: resolveGrants(role), teamMemberIds: [] });
const inv = as(RoleCode.TrainingManager, 'inv');
const am = as(RoleCode.AccountManager, 'am1');

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
  const aicha = await w.registerLearner.execute({ companyId: 'c1', lastName: 'Mbarga', firstName: 'Aïcha', access: am, actor });
  const brice = await w.registerLearner.execute({ companyId: 'c1', lastName: 'Nkomo', firstName: 'Brice', access: am, actor });
  const planned = await w.plan.execute({ trainingId: w.certTrading.id, rhythm: 'DAY', startDate: '2026-11-16', roomId: w.salleMarches.id, trainerId: w.interne.id, capacity: 5, actor });
  await w.open.execute({ id: planned.id, version: 1, actor });
  const enrolledA = await w.enroll.execute({ sessionId: planned.id, learnerId: aicha.id, approvalId: 'ap-places', access: am, actor });
  await w.confirm.execute({ id: enrolledA.id, version: 1, access: inv, actor });
  // Brice reste « en attente » (jamais confirmé) : il ne doit pas apparaître sur la feuille d'évaluation.
  const enrolledB = await w.enroll.execute({ sessionId: planned.id, learnerId: brice.id, approvalId: 'ap-places', access: am, actor });
  return { w, planned, enrolledA, enrolledB, aicha, brice };
}

describe('Évaluations (S5.3b)', () => {
  it('se saisit pour un inscrit confirmé, idempotent, avec audit', async () => {
    const { w, planned, enrolledA } = await setup();
    const view = await w.recordEvaluation.execute({ sessionId: planned.id, enrollmentId: enrolledA.id, score: 15.5, access: inv, actor });
    expect(view).toMatchObject({ enrollmentId: enrolledA.id, score: 15.5 });
    expect(w.audit.at(-1)).toMatchObject({ action: AuditAction.Create, entityType: 'Evaluation', module: 'training' });
    const before = w.audit.length;
    // Resaisir la même note n'écrit rien dans le journal (idempotent, comme la présence).
    await w.recordEvaluation.execute({ sessionId: planned.id, enrollmentId: enrolledA.id, score: 15.5, access: inv, actor });
    expect(w.audit.length).toBe(before);
  });

  it('corrige une note déjà saisie, garde le dernier auteur, trace avant/après', async () => {
    const { w, planned, enrolledA } = await setup();
    await w.recordEvaluation.execute({ sessionId: planned.id, enrollmentId: enrolledA.id, score: 15, access: inv, actor });
    const corrected = await w.recordEvaluation.execute({ sessionId: planned.id, enrollmentId: enrolledA.id, score: 8, access: inv, actor });
    expect(corrected.score).toBe(8);
    expect(w.audit.at(-1)).toMatchObject({ action: AuditAction.Update, entityType: 'Evaluation', oldValue: { score: 15 }, newValue: { score: 8 } });
  });

  it('une inscription confirmée d\'une autre session est « introuvable », pas évaluable ici', async () => {
    const { w, enrolledA } = await setup();
    const other = await w.plan.execute({ trainingId: w.certTrading.id, rhythm: 'DAY', startDate: '2026-11-23', roomId: w.salleMarches.id, trainerId: w.interne.id, capacity: 5, actor });
    await w.open.execute({ id: other.id, version: 1, actor });
    await rejects(w.recordEvaluation.execute({ sessionId: other.id, enrollmentId: enrolledA.id, score: 10, access: inv, actor }), 'NOT_FOUND', /Inscription introuvable/);
  });

  it('refuse une inscription non confirmée (en attente), et une session inexistante', async () => {
    const { w, planned, enrolledB } = await setup();
    await rejects(w.recordEvaluation.execute({ sessionId: planned.id, enrollmentId: enrolledB.id, score: 10, access: inv, actor }), 'INVARIANT_VIOLATION', /confirmés/);
    await rejects(w.recordEvaluation.execute({ sessionId: 'inconnue', enrollmentId: enrolledB.id, score: 10, access: inv, actor }), 'NOT_FOUND', /Session introuvable/);
  });

  it('refuse toute saisie une fois la session clôturée, et l\'accepte de nouveau après réouverture', async () => {
    const { w, planned, enrolledA } = await setup();
    await w.recordEvaluation.execute({ sessionId: planned.id, enrollmentId: enrolledA.id, score: 10, access: inv, actor });
    await w.close.execute({ id: planned.id, version: 1, actor });
    await rejects(w.recordEvaluation.execute({ sessionId: planned.id, enrollmentId: enrolledA.id, score: 12, access: inv, actor }), 'INVARIANT_VIOLATION', /figées/);
    await w.reopenSession.execute({ id: planned.id, version: 1, reason: 'Correction après coup', actor });
    await expect(w.recordEvaluation.execute({ sessionId: planned.id, enrollmentId: enrolledA.id, score: 12, access: inv, actor })).resolves.toMatchObject({ score: 12 });
  });
});

describe('Feuille d\'évaluation (S5.3b)', () => {
  it('ne montre que les inscrits confirmés ; calcule le taux de présence (un retard compte comme présent, S3) et suggère selon les seuils', async () => {
    const { w, planned, enrolledA } = await setup();
    // 3 jours présent, 1 jour en retard sur 5 jours de cours = 80 %, au seuil par défaut (80 %) : sans note, c'est une attestation.
    for (const day of ['2026-11-16', '2026-11-17', '2026-11-18']) {
      await w.recordAttendance.execute({ sessionId: planned.id, enrollmentId: enrolledA.id, day, status: 'PRESENT', access: inv, actor });
    }
    await w.recordAttendance.execute({ sessionId: planned.id, enrollmentId: enrolledA.id, day: '2026-11-19', status: 'LATE', access: inv, actor });
    let sheet = await w.evaluationSheet.execute({ sessionId: planned.id });
    expect(sheet.rows).toHaveLength(1); // Brice (en attente) n'y figure pas
    expect(sheet.rows[0]).toMatchObject({ enrollmentId: enrolledA.id, learnerName: 'Aïcha Mbarga', score: null, attendanceRatePercent: 80, suggestion: 'ATTESTATION' });
    expect(sheet.canRecord).toBe(true);

    await w.recordEvaluation.execute({ sessionId: planned.id, enrollmentId: enrolledA.id, score: 12, access: inv, actor });
    sheet = await w.evaluationSheet.execute({ sessionId: planned.id });
    expect(sheet.rows[0]).toMatchObject({ score: 12, suggestion: 'CERTIFICATE' });
  });

  it('classe les lignes par nom d\'apprenant, jamais l\'inverse', async () => {
    const { w, planned } = await setup();
    const zoe = await w.registerLearner.execute({ companyId: 'c1', lastName: 'Zola', firstName: 'Zoé', access: am, actor });
    const enrolledZ = await w.enroll.execute({ sessionId: planned.id, learnerId: zoe.id, approvalId: 'ap-places', access: am, actor });
    await w.confirm.execute({ id: enrolledZ.id, version: 1, access: inv, actor });
    const sheet = await w.evaluationSheet.execute({ sessionId: planned.id });
    expect(sheet.rows.map((r) => r.learnerName)).toEqual(['Aïcha Mbarga', 'Zoé Zola']); // ordre alphabétique, jamais l'inverse
  });

  it('figée à la clôture (canRecord), de nouveau possible après réouverture', async () => {
    const { w, planned } = await setup();
    await w.close.execute({ id: planned.id, version: 1, actor });
    expect((await w.evaluationSheet.execute({ sessionId: planned.id })).canRecord).toBe(false);
    await w.reopenSession.execute({ id: planned.id, version: 1, reason: 'Correction après coup', actor });
    expect((await w.evaluationSheet.execute({ sessionId: planned.id })).canRecord).toBe(true);
  });

  it('une session inexistante est « introuvable »', async () => {
    const { w } = await setup();
    await rejects(w.evaluationSheet.execute({ sessionId: 'inconnue' }), 'NOT_FOUND', /Session introuvable/);
  });
});

describe('Seuils d\'éligibilité (S5, D31)', () => {
  it('lecture et modification réservées à qui en a le droit', async () => {
    const { w } = await setup();
    await rejects(w.getThresholds.execute({ access: as(RoleCode.AccountManager, 'am1') }), 'FORBIDDEN', /seuils/);
    await rejects(
      w.updateThresholds.execute({ version: 1, attendanceThresholdPercent: 90, scoreThreshold: 12, access: as(RoleCode.AccountManager, 'am1'), actor }),
      'FORBIDDEN', /seuils/,
    );
  });

  it('se modifient avec un verrou optimiste, une trace d\'audit, et des valeurs bornées', async () => {
    const { w } = await setup();
    const current = await w.getThresholds.execute({ access: inv });
    expect(current).toMatchObject({ attendanceThresholdPercent: 80, scoreThreshold: 10, version: 1 });
    await rejects(w.updateThresholds.execute({ version: 1, attendanceThresholdPercent: 101, scoreThreshold: 10, access: inv, actor }), 'VALIDATION', /pourcentage entre 0 et 100/);
    const saved = await w.updateThresholds.execute({ version: 1, attendanceThresholdPercent: 90, scoreThreshold: 12, access: inv, actor });
    expect(saved).toMatchObject({ attendanceThresholdPercent: 90, scoreThreshold: 12, version: 2 });
    expect(w.audit.at(-1)).toMatchObject({ action: AuditAction.Update, entityType: 'TrainingThresholds', oldValue: { attendanceThresholdPercent: 80 }, newValue: { attendanceThresholdPercent: 90 } });
    await rejects(
      w.updateThresholds.execute({ version: 1, attendanceThresholdPercent: 85, scoreThreshold: 11, access: inv, actor }),
      'CONFLICT', /modifiés par un autre utilisateur/,
    );
  });
});
