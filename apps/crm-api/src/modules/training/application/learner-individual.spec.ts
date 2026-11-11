import { actor, buildTrainingWorld } from '../../../../test/support/training-world';
import { DomainError } from '../../../shared-kernel';
import { AuditAction } from '../../audit';
import type { AccessContext } from '../../iam';
import { RoleCode, resolveGrants } from '../../iam/domain/roles';

/**
 * Lot B (option C) : étudiant ou particulier, sans entreprise ni agrément, avec un payeur désigné (lui-même ou un tiers). Les apprenants n'ont pas accès à la plateforme :
 * ce sont des fiches saisies par les employés, et seuls ceux dont le droit couvre tout (portée Tous) les voient.
 */
const as = (role: RoleCode, actorId: string, team: string[] = []): AccessContext => ({ actorId, grants: resolveGrants(role), teamMemberIds: team });
const am = as(RoleCode.AccountManager, 'am1');
const chef = as(RoleCode.HeadOfSales, 'chef', ['am1']);
const inv = as(RoleCode.TrainingManager, 'inv');
const direction = as(RoleCode.Direction, 'dir');
const support = as(RoleCode.Support, 'sup');
const finance = as(RoleCode.Finance, 'fin');

const rejects = async (promise: Promise<unknown>, code: string, message?: RegExp) => {
  const error = await promise.then(() => null, (e: unknown) => e);
  expect(error).toBeInstanceOf(DomainError);
  expect((error as DomainError).code).toBe(code);
  if (message) expect((error as DomainError).message).toMatch(message);
};

async function setup() {
  const w = await buildTrainingWorld({ now: () => new Date('2026-11-06T09:00:00Z') });
  w.directory.companies.set('c1', { id: 'c1', name: 'Banque Test', ownerUserId: 'am1', archived: false });
  w.directory.approvals.set('ap1', { id: 'ap1', companyId: 'c1', status: 'RECEIVED', amount: null, places: 10, currency: 'XAF', validUntil: null, receivedOn: '2026-10-12', payerName: null } as never);
  const student = (lastName: string, firstName: string, access = inv, kind: 'STUDENT' | 'INDIVIDUAL' = 'STUDENT') => w.registerLearner.execute({ kind, lastName, firstName, access, actor });
  const company = (lastName: string, firstName: string) => w.registerLearner.execute({ companyId: 'c1', lastName, firstName, access: am, actor });
  const session = async (over: Record<string, unknown> = {}) => {
    const planned = await w.plan.execute({ trainingId: w.certTrading.id, rhythm: 'DAY', startDate: '2026-11-16', roomId: w.salleMarches.id, trainerId: w.interne.id, capacity: 2, actor, ...over } as never);
    return w.open.execute({ id: planned.id, version: planned.version, actor });
  };
  return { w, student, company, session };
}

describe('Étudiant ou particulier — la fiche', () => {
  it('se crée sans entreprise ni contact, et la création est tracée', async () => {
    const { w, student } = await setup();
    const view = await student('Essomba', 'Léa');
    expect(view).toMatchObject({ kind: 'STUDENT', companyId: null, companyName: '', contactId: null, version: 1 });
    expect(w.audit.at(-1)).toMatchObject({ action: AuditAction.Create, entityType: 'Learner', newValue: { kind: 'STUDENT', companyId: null } });
    expect((await student('Ndongo', 'Marc', inv, 'INDIVIDUAL')).kind).toBe('INDIVIDUAL');
  });

  it('refuse les incohérences : une entreprise ou un contact pour un étudiant, aucune entreprise pour un apprenant d’entreprise', async () => {
    const { w } = await setup();
    await rejects(w.registerLearner.execute({ kind: 'STUDENT', companyId: 'c1', lastName: 'A', firstName: 'B', access: inv, actor }), 'VALIDATION', /n'a pas d'entreprise/);
    await rejects(w.registerLearner.execute({ kind: 'INDIVIDUAL', contactId: 'k1', lastName: 'A', firstName: 'B', access: inv, actor }), 'VALIDATION', /pas de contact/);
    await rejects(w.registerLearner.execute({ kind: 'COMPANY', lastName: 'A', firstName: 'B', access: inv, actor }), 'VALIDATION', /entreprise de l'apprenant est obligatoire/);
    await rejects(w.registerLearner.execute({ lastName: 'A', firstName: 'B', access: inv, actor }), 'VALIDATION', /entreprise de l'apprenant est obligatoire/);
  });

  it('seuls ceux qui gèrent tous les apprenants l’inscrivent : le chargé de compte et le Responsable commercial non', async () => {
    const { student } = await setup();
    for (const who of [am, chef, direction, support]) await rejects(student('Essomba', 'Léa', who), 'FORBIDDEN', /gèrent tous les apprenants/);
  });

  it('est visible du Responsable Investudy, du Support et de la Direction, jamais du chargé de compte ni du Responsable commercial : « introuvable »', async () => {
    const { w, student } = await setup();
    const view = await student('Essomba', 'Léa');
    for (const who of [inv, direction, support]) await expect(w.getLearner.execute({ id: view.id, access: who })).resolves.toMatchObject({ kind: 'STUDENT' });
    for (const who of [am, chef]) await rejects(w.getLearner.execute({ id: view.id, access: who }), 'NOT_FOUND', /Apprenant introuvable/);
    const ids = async (access: AccessContext) => (await w.listLearners.execute({ page: 1, pageSize: 20, access })).items.map((l) => l.lastName);
    expect(await ids(inv)).toEqual(['Essomba']);
    expect(await ids(direction)).toEqual(['Essomba']);
    expect(await ids(am)).toEqual([]);
    expect(await ids(chef)).toEqual([]);
  });

  it('se filtre par nature dans la liste', async () => {
    const { w, student, company } = await setup();
    await student('Essomba', 'Léa');
    await student('Ndongo', 'Marc', inv, 'INDIVIDUAL');
    await company('Mbarga', 'Aïcha');
    const names = async (kind?: 'COMPANY' | 'STUDENT' | 'INDIVIDUAL') => (await w.listLearners.execute({ page: 1, pageSize: 20, kind, access: inv })).items.map((l) => l.lastName).sort();
    expect(await names()).toEqual(['Essomba', 'Mbarga', 'Ndongo']);
    expect(await names('STUDENT')).toEqual(['Essomba']);
    expect(await names('INDIVIDUAL')).toEqual(['Ndongo']);
    expect(await names('COMPANY')).toEqual(['Mbarga']);
  });

  it('signale un doublon parmi les étudiants et les particuliers, pas avec un apprenant d’entreprise', async () => {
    const { w, student, company } = await setup();
    await student('Essomba', 'Léa');
    await company('Nkomo', 'Brice');
    await rejects(student('ESSOMBA', 'léa', inv, 'INDIVIDUAL'), 'CONFLICT', /parmi les étudiants et les particuliers/);
    await expect(student('Nkomo', 'Brice')).resolves.toMatchObject({ kind: 'STUDENT' }); // même nom qu'un apprenant d'entreprise : pas un doublon
    await expect(w.registerLearner.execute({ kind: 'STUDENT', lastName: 'Essomba', firstName: 'Léa', allowDuplicate: true, access: inv, actor })).resolves.toBeDefined();
  });

  it('se modifie, sans jamais gagner un contact, et se supprime logiquement', async () => {
    const { w, student } = await setup();
    const view = await student('Essomba', 'Léa');
    const updated = await w.updateLearner.execute({ id: view.id, version: 1, email: 'lea@exemple.test', access: inv, actor });
    expect(updated).toMatchObject({ kind: 'STUDENT', companyId: null, email: 'lea@exemple.test' });
    // Les versions ne sont pas incrémentées par le dépôt en mémoire (travail de la base) : la version lue reste 1.
    await rejects(w.updateLearner.execute({ id: view.id, version: 1, contactId: 'k1', access: inv, actor }), 'VALIDATION', /pas de contact/);
    await rejects(w.updateLearner.execute({ id: view.id, version: 1, firstName: 'X', access: am, actor }), 'NOT_FOUND', /Apprenant introuvable/);
    await w.deleteLearner.execute({ id: view.id, version: 1, access: inv, actor });
    await rejects(w.getLearner.execute({ id: view.id, access: inv }), 'NOT_FOUND', /Apprenant introuvable/);
  });
});

describe('Étudiant ou particulier — l’inscription et son payeur', () => {
  it('inscrit sans agrément : le payeur est désigné et le montant dû est le prix complet du certificat', async () => {
    const { w, student, session } = await setup();
    const s = await session();
    const learner = await student('Essomba', 'Léa');
    const view = await w.enroll.execute({ sessionId: s.id, learnerId: learner.id, payer: { kind: 'SELF' }, access: inv, actor });
    expect(view).toMatchObject({ status: 'PENDING', companyId: null, approvalId: null, approvalLabel: '', companyName: '', learnerKind: 'STUDENT', chargedAmount: '750000.00', payer: { kind: 'SELF', name: null, type: null } });
    expect(w.audit.at(-1)).toMatchObject({ action: AuditAction.Create, entityType: 'Enrollment', newValue: { payer: { kind: 'SELF' }, chargedAmount: '750000.00' } });
  });

  it('désigne un tiers avec son nom et sa nature (employeur, organisme, bailleur, famille ou proche)', async () => {
    const { w, student, session } = await setup();
    const s = await session({ capacity: 5 });
    for (const [i, type] of (['EMPLOYER', 'ORGANISM', 'LANDLORD', 'FAMILY'] as const).entries()) {
      const learner = await student(`Nom${i}`, `Prénom${i}`, inv, i % 2 ? 'INDIVIDUAL' : 'STUDENT');
      const view = await w.enroll.execute({ sessionId: s.id, learnerId: learner.id, payer: { kind: 'THIRD_PARTY', name: '  Fondation Avenir ', type }, access: inv, actor });
      expect(view.payer).toEqual({ kind: 'THIRD_PARTY', name: 'Fondation Avenir', type });
      if (i === 3) break;
      if (i === 1) await w.cancelEnrollment.execute({ id: view.id, version: 1, reason: 'Libérer une place', access: inv, actor });
    }
  });

  it('refuse un payeur mal désigné, et un agrément pour un étudiant', async () => {
    const { w, student, session } = await setup();
    const s = await session({ capacity: 5 });
    const learner = await student('Essomba', 'Léa');
    const enroll = (extra: Record<string, unknown>) => w.enroll.execute({ sessionId: s.id, learnerId: learner.id, access: inv, actor, ...extra } as never);
    await rejects(enroll({}), 'VALIDATION', /Indiquez qui règle les frais/);
    await rejects(enroll({ payer: { kind: 'SELF', name: 'Quelqu’un' } }), 'VALIDATION', /aucun nom ni type/);
    await rejects(enroll({ payer: { kind: 'THIRD_PARTY', type: 'FAMILY' } }), 'VALIDATION', /nom du payeur tiers est obligatoire/);
    await rejects(enroll({ payer: { kind: 'THIRD_PARTY', name: 'Oncle Paul' } }), 'VALIDATION', /nature du payeur tiers est obligatoire/);
    await rejects(enroll({ payer: { kind: 'THIRD_PARTY', name: 'Oncle Paul', type: 'VOISIN' } }), 'VALIDATION', /nature du payeur tiers est obligatoire/);
    await rejects(enroll({ payer: { kind: 'THIRD_PARTY', name: 'x'.repeat(201), type: 'FAMILY' } }), 'VALIDATION', /ne peut dépasser/);
    await rejects(enroll({ approvalId: 'ap1', payer: { kind: 'SELF' } }), 'VALIDATION', /ne s'inscrit pas sous un agrément/);
    expect(w.enrollments.items).toHaveLength(0);
  });

  it('un apprenant d’entreprise ne désigne pas de payeur et garde son agrément obligatoire', async () => {
    const { w, company, session } = await setup();
    const s = await session();
    const learner = await company('Mbarga', 'Aïcha');
    await rejects(w.enroll.execute({ sessionId: s.id, learnerId: learner.id, approvalId: 'ap1', payer: { kind: 'SELF' }, access: am, actor }), 'VALIDATION', /agrément en tient lieu/);
    await rejects(w.enroll.execute({ sessionId: s.id, learnerId: learner.id, access: am, actor }), 'VALIDATION', /Choisissez l'agrément/);
    const ok = await w.enroll.execute({ sessionId: s.id, learnerId: learner.id, approvalId: 'ap1', access: am, actor });
    expect(ok).toMatchObject({ companyId: 'c1', approvalId: 'ap1', payer: null, learnerKind: 'COMPANY' });
  });

  it('refuse un certificat sans prix : le montant dû serait inconnu', async () => {
    const { w, student } = await setup();
    const free = await w.createTraining.execute({ programId: w.program.id, title: 'Certificat sans prix', moduleIds: w.certTheory.modules.map((m: { id: string }) => m.id), actor });
    const planned = await w.plan.execute({ trainingId: free.id, rhythm: 'DAY', startDate: '2026-11-23', roomId: w.salleMarches.id, trainerId: w.interne.id, capacity: 2, actor } as never);
    const s = await w.open.execute({ id: planned.id, version: planned.version, actor });
    const learner = await student('Essomba', 'Léa');
    await rejects(w.enroll.execute({ sessionId: s.id, learnerId: learner.id, payer: { kind: 'SELF' }, access: inv, actor }), 'INVARIANT_VIOLATION', /pas de prix complet/);
  });

  it('garde les règles communes : une place, pas deux fois la même session, pas de session qui recouvre', async () => {
    const { w, student, session } = await setup();
    const s = await session({ capacity: 1 });
    const a = await student('Essomba', 'Léa');
    const b = await student('Ndongo', 'Marc', inv, 'INDIVIDUAL');
    await w.enroll.execute({ sessionId: s.id, learnerId: a.id, payer: { kind: 'SELF' }, access: inv, actor });
    await rejects(w.enroll.execute({ sessionId: s.id, learnerId: a.id, payer: { kind: 'SELF' }, access: inv, actor }), 'CONFLICT', /déjà inscrit/);
    await rejects(w.enroll.execute({ sessionId: s.id, learnerId: b.id, payer: { kind: 'SELF' }, access: inv, actor }), 'INVARIANT_VIOLATION', /complète/);
    const overlapping = await session({ startDate: '2026-11-17', trainingId: w.certTheory.id, roomId: w.salleCours.id, trainerId: w.externe.id });
    await rejects(w.enroll.execute({ sessionId: overlapping.id, learnerId: a.id, payer: { kind: 'SELF' }, access: inv, actor }), 'CONFLICT', /recouvre/);
  });

  it('se confirme sans agrément, s’annule avec un motif et se replace en gardant son payeur', async () => {
    const { w, student, session } = await setup();
    const first = await session();
    const second = await session({ startDate: '2026-12-07' });
    const learner = await student('Essomba', 'Léa');
    const payer = { kind: 'THIRD_PARTY' as const, name: 'Mairie de Douala', type: 'ORGANISM' as const };
    const enrolled = await w.enroll.execute({ sessionId: first.id, learnerId: learner.id, payer, access: inv, actor });
    expect((await w.confirm.execute({ id: enrolled.id, version: 1, access: inv, actor })).status).toBe('CONFIRMED');
    const replaced = await w.replace.execute({ id: enrolled.id, version: 1, sessionId: second.id, access: inv, actor });
    expect(replaced).toMatchObject({ status: 'PENDING', approvalId: null, companyId: null, chargedAmount: '750000.00', payer: { kind: 'THIRD_PARTY', name: 'Mairie de Douala', type: 'ORGANISM' } });
    expect((await w.getEnrollment.execute({ id: enrolled.id, access: inv })).status).toBe('CANCELLED');
    await rejects(w.cancelEnrollment.execute({ id: replaced.id, version: 1, reason: ' ', access: inv, actor }), 'VALIDATION', /motif/);
  });

  it('n’offre aucun agrément à choisir pour un étudiant', async () => {
    const { w, student, session } = await setup();
    const s = await session();
    const learner = await student('Essomba', 'Léa');
    await expect(w.approvalOptions.execute({ learnerId: learner.id, sessionId: s.id, access: inv })).resolves.toEqual([]);
  });

  it('l’inscription n’est visible que de ceux qui voient tout : le chargé de compte et le Responsable commercial ne la voient ni ne la gèrent', async () => {
    const { w, student, session } = await setup();
    const s = await session();
    const learner = await student('Essomba', 'Léa');
    const enrolled = await w.enroll.execute({ sessionId: s.id, learnerId: learner.id, payer: { kind: 'SELF' }, access: inv, actor });
    for (const who of [inv, direction, support, finance]) await expect(w.getEnrollment.execute({ id: enrolled.id, access: who })).resolves.toMatchObject({ learnerKind: 'STUDENT' });
    for (const who of [am, chef]) {
      await rejects(w.getEnrollment.execute({ id: enrolled.id, access: who }), 'NOT_FOUND', /Inscription introuvable/);
      await rejects(w.cancelEnrollment.execute({ id: enrolled.id, version: 1, reason: 'x', access: who, actor }), 'NOT_FOUND', /Inscription introuvable/);
      await rejects(w.enroll.execute({ sessionId: s.id, learnerId: learner.id, payer: { kind: 'SELF' }, access: who, actor }), 'NOT_FOUND', /Apprenant introuvable/);
      expect((await w.listEnrollments.execute({ page: 1, pageSize: 20, access: who })).total).toBe(0);
    }
    expect((await w.listEnrollments.execute({ page: 1, pageSize: 20, access: inv })).total).toBe(1);
  });
});
