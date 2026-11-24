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
  const planned = await w.plan.execute({ trainingId: w.certTrading.id, rhythm: 'DAY', startDate: '2026-11-16', roomId: w.salleMarches.id, trainerId: w.interne.id, capacity: 5, actor });
  await w.open.execute({ id: planned.id, version: 1, actor });
  const enrolled = await w.enroll.execute({ sessionId: planned.id, learnerId: aicha.id, approvalId: 'ap-places', access: am, actor });
  await w.confirm.execute({ id: enrolled.id, version: 1, access: inv, actor });
  // Tous les jours de cours présents, note 15 : certificat et attestation deviennent tous deux éligibles.
  for (const day of ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20']) {
    await w.recordAttendance.execute({ sessionId: planned.id, enrollmentId: enrolled.id, day, status: 'PRESENT', access: inv, actor });
  }
  await w.recordEvaluation.execute({ sessionId: planned.id, enrollmentId: enrolled.id, score: 15, access: inv, actor });
  return { w, planned, enrolled, aicha };
}

async function setupClosed() {
  const ctx = await setup();
  await ctx.w.close.execute({ id: ctx.planned.id, version: 1, actor });
  return ctx;
}

describe('Délivrance d\'un certificat ou d\'une attestation (S5.3c, CU-I-60)', () => {
  it('délivre un certificat une fois la session clôturée, les deux seuils atteints ; trace l\'audit', async () => {
    const { w, planned, enrolled } = await setupClosed();
    const view = await w.issueCertification.execute({ sessionId: planned.id, enrollmentId: enrolled.id, kind: 'CERTIFICATE', access: inv, actor });
    expect(view).toMatchObject({ enrollmentId: enrolled.id, kind: 'CERTIFICATE', status: 'ISSUED', referenceNumber: expect.any(String) });
    expect(w.audit.find((a) => a.entityType === 'Certification')).toMatchObject({ action: AuditAction.Create, module: 'training' });
  });

  it('refuse tant que la session n\'est pas clôturée', async () => {
    const { w, planned, enrolled } = await setup();
    await rejects(w.issueCertification.execute({ sessionId: planned.id, enrollmentId: enrolled.id, kind: 'ATTESTATION', access: inv, actor }), 'INVARIANT_VIOLATION', /clôturée/);
  });

  it('refuse un certificat si la note n\'atteint pas le seuil, même avec la présence', async () => {
    const { w, planned, enrolled } = await setup();
    await w.recordEvaluation.execute({ sessionId: planned.id, enrollmentId: enrolled.id, score: 5, access: inv, actor }); // sous le seuil (10)
    await w.close.execute({ id: planned.id, version: 1, actor });
    await rejects(w.issueCertification.execute({ sessionId: planned.id, enrollmentId: enrolled.id, kind: 'CERTIFICATE', access: inv, actor }), 'INVARIANT_VIOLATION', /seuils/);
    // Une attestation reste possible : la présence seule est atteinte.
    await expect(w.issueCertification.execute({ sessionId: planned.id, enrollmentId: enrolled.id, kind: 'ATTESTATION', access: inv, actor })).resolves.toMatchObject({ kind: 'ATTESTATION' });
  });

  it('refuse toute délivrance si même la présence est insuffisante', async () => {
    const w2 = await buildTrainingWorld({ now: () => currentNow });
    w2.directory.companies.set('c1', { id: 'c1', name: 'Banque Test', ownerUserId: 'am1', archived: false });
    w2.directory.approvals.set('ap-places', { id: 'ap-places', companyId: 'c1', status: 'RECEIVED', amount: null, places: 10, currency: 'XAF', validUntil: null, receivedOn: '2026-10-12', payerName: null } as never);
    const learner = await w2.registerLearner.execute({ companyId: 'c1', lastName: 'Sarr', firstName: 'Brice', access: am, actor });
    const session = await w2.plan.execute({ trainingId: w2.certTrading.id, rhythm: 'DAY', startDate: '2026-11-16', roomId: w2.salleMarches.id, trainerId: w2.interne.id, capacity: 5, actor });
    await w2.open.execute({ id: session.id, version: 1, actor });
    const enrollment = await w2.enroll.execute({ sessionId: session.id, learnerId: learner.id, approvalId: 'ap-places', access: am, actor });
    await w2.confirm.execute({ id: enrollment.id, version: 1, access: inv, actor });
    await w2.close.execute({ id: session.id, version: 1, actor }); // aucune présence saisie : 0 %
    await rejects(w2.issueCertification.execute({ sessionId: session.id, enrollmentId: enrollment.id, kind: 'ATTESTATION', access: inv, actor }), 'INVARIANT_VIOLATION', /seuils/);
  });

  it('refuse une seconde délivrance pour la même inscription', async () => {
    const { w, planned, enrolled } = await setupClosed();
    await w.issueCertification.execute({ sessionId: planned.id, enrollmentId: enrolled.id, kind: 'CERTIFICATE', access: inv, actor });
    await rejects(w.issueCertification.execute({ sessionId: planned.id, enrollmentId: enrolled.id, kind: 'ATTESTATION', access: inv, actor }), 'INVARIANT_VIOLATION', /existe déjà/);
  });

  it('crée une suggestion d\'ambassadeur pour le chargé de compte propriétaire, seulement pour un apprenant d\'entreprise', async () => {
    const { w, planned, enrolled } = await setupClosed();
    await w.issueCertification.execute({ sessionId: planned.id, enrollmentId: enrolled.id, kind: 'CERTIFICATE', access: inv, actor });
    expect(w.ambassadorSuggestions.items).toHaveLength(1);
    expect(w.ambassadorSuggestions.items[0]).toMatchObject({ enrollmentId: enrolled.id, companyId: 'c1', ownerUserId: 'am1' });
  });
});

describe('Révocation (CU-I-61)', () => {
  it('révoque avec justification, trace l\'avant/après ; le document reste consultable', async () => {
    const { w, planned, enrolled } = await setupClosed();
    await w.issueCertification.execute({ sessionId: planned.id, enrollmentId: enrolled.id, kind: 'CERTIFICATE', access: inv, actor });
    const revoked = await w.revokeCertification.execute({ sessionId: planned.id, enrollmentId: enrolled.id, reason: 'Fraude constatée', access: inv, actor });
    expect(revoked).toMatchObject({ status: 'REVOKED', revokeReason: 'Fraude constatée' });
    expect(w.audit.at(-1)).toMatchObject({ action: AuditAction.Update, entityType: 'Certification', oldValue: { status: 'ISSUED' }, newValue: { status: 'REVOKED' } });
    const sheet = await w.certificationSheet.execute({ sessionId: planned.id, access: inv });
    expect(sheet.rows[0]?.certification).toMatchObject({ status: 'REVOKED' }); // toujours consultable
  });

  it('refuse sans justification, et sur une inscription sans délivrance', async () => {
    const { w, planned, enrolled } = await setupClosed();
    await rejects(w.revokeCertification.execute({ sessionId: planned.id, enrollmentId: enrolled.id, reason: '', access: inv, actor }), 'NOT_FOUND');
    await w.issueCertification.execute({ sessionId: planned.id, enrollmentId: enrolled.id, kind: 'CERTIFICATE', access: inv, actor });
    await rejects(w.revokeCertification.execute({ sessionId: planned.id, enrollmentId: enrolled.id, reason: '  ', access: inv, actor }), 'VALIDATION', /justification/);
  });
});

describe('Feuille de délivrances (portée du formateur)', () => {
  it('le formateur lié ne voit que ses propres sessions ; une autre session est « introuvable »', async () => {
    const { w, planned } = await setupClosed();
    const trainerUser = as(RoleCode.Trainer, 'user-ida'); // lié au formateur « interne » du monde de test
    const sheet = await w.certificationSheet.execute({ sessionId: planned.id, access: trainerUser });
    expect(sheet.sessionId).toBe(planned.id);
    const other = await w.plan.execute({ trainingId: w.certTrading.id, rhythm: 'DAY', startDate: '2026-11-23', roomId: w.salleMarches.id, trainerId: w.externe.id, capacity: 5, actor });
    await rejects(w.certificationSheet.execute({ sessionId: other.id, access: trainerUser }), 'NOT_FOUND', /Session introuvable/);
  });

  it('le Responsable commercial (portée Équipe) voit la session (déjà en portée Tous sur la lecture des sessions), mais seulement les inscrits de son équipe', async () => {
    const { w, planned, enrolled } = await setupClosed();
    await w.issueCertification.execute({ sessionId: planned.id, enrollmentId: enrolled.id, kind: 'CERTIFICATE', access: inv, actor });
    const headOfSales = as(RoleCode.HeadOfSales, 'hos1'); // ne dirige pas 'am1', propriétaire de l'entreprise de l'inscrit
    const sheet = await w.certificationSheet.execute({ sessionId: planned.id, access: headOfSales });
    expect(sheet.sessionId).toBe(planned.id); // jamais « introuvable » : training.session.read est en portée Tous pour ce rôle
    expect(sheet.rows).toEqual([]); // mais aucun inscrit de son équipe
  });
});

describe('Suggestions d\'ambassadeur (CU-I-62, S8)', () => {
  it('le chargé de compte propriétaire voit sa suggestion ; un autre chargé de compte, aucune', async () => {
    const { w, planned, enrolled } = await setupClosed();
    await w.issueCertification.execute({ sessionId: planned.id, enrollmentId: enrolled.id, kind: 'CERTIFICATE', access: inv, actor });
    const mine = await w.ambassadorSuggestionsHandler.execute({ access: am });
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ companyId: 'c1', companyName: 'Banque Test', learnerName: 'Aïcha Mbarga' });
    const other = await w.ambassadorSuggestionsHandler.execute({ access: as(RoleCode.AccountManager, 'am2') });
    expect(other).toHaveLength(0);
  });

  it('un rôle sans aucun droit sur les ambassadeurs est refusé', async () => {
    const { w } = await setup();
    await rejects(w.ambassadorSuggestionsHandler.execute({ access: as(RoleCode.Trainer, 'user-ida') }), 'FORBIDDEN');
  });
});
