import { actor, buildTrainingWorld, TrainingWorld } from '../../../../test/support/training-world';
import { DomainError } from '../../../shared-kernel';
import { AuditAction } from '../../audit';
import type { AccessContext } from '../../iam';
import { RoleCode, resolveGrants } from '../../iam/domain/roles';
import { TrainingSession } from '../domain/training-session';

let currentNow = new Date('2026-11-06T09:00:00Z'); // vendredi
const as = (role: RoleCode, actorId: string, team: string[] = []): AccessContext => ({ actorId, grants: resolveGrants(role), teamMemberIds: team });
const am = as(RoleCode.AccountManager, 'am1'); // propriétaire de l'entreprise c1
const otherAm = as(RoleCode.AccountManager, 'am2'); // propriétaire de c2
const chef = as(RoleCode.HeadOfSales, 'chef', ['am1']);
const inv = as(RoleCode.TrainingManager, 'inv');
const direction = as(RoleCode.Direction, 'dir');

const rejects = async (promise: Promise<unknown>, code: string, message?: RegExp) => {
  const error = await promise.then(() => null, (e: unknown) => e);
  expect(error).toBeInstanceOf(DomainError);
  expect((error as DomainError).code).toBe(code);
  if (message) expect((error as DomainError).message).toMatch(message);
};

async function setup() {
  const w = await buildTrainingWorld({ now: () => currentNow });
  w.directory.companies.set('c1', { id: 'c1', name: 'Banque Test', ownerUserId: 'am1', archived: false });
  w.directory.companies.set('c2', { id: 'c2', name: 'Assurance Test', ownerUserId: 'am2', archived: false });
  const approval = (id: string, companyId: string, over: Record<string, unknown> = {}) =>
    w.directory.approvals.set(id, { id, companyId, status: 'RECEIVED', amount: null, places: 10, currency: 'XAF', validUntil: null, receivedOn: '2026-10-12', payerName: null, ...over } as never);
  approval('ap-places', 'c1'); // 10 places
  approval('ap-sum', 'c1', { places: null, amount: '1500000.00' }); // deux certificats trading exactement
  approval('ap-c2', 'c2');
  const learner = (lastName: string, firstName: string, companyId = 'c1', access = am) => w.registerLearner.execute({ companyId, lastName, firstName, access, actor });
  const session = async (over: Record<string, unknown> = {}, open = true) => {
    const planned = await w.plan.execute({
      trainingId: w.certTrading.id, rhythm: 'DAY', startDate: '2026-11-16', roomId: w.salleMarches.id, trainerId: w.interne.id, capacity: 2, actor, ...over,
    } as never);
    return open ? w.open.execute({ id: planned.id, version: planned.version, actor }) : planned;
  };
  return { w, approval, learner, session };
}

beforeEach(() => { currentNow = new Date('2026-11-06T09:00:00Z'); });

describe('Apprenants', () => {
  it('crée un apprenant dans la portée du chargé de compte, trace la création, refuse une entreprise hors portée ou archivée', async () => {
    const { w, learner } = await setup();
    const view = await learner('Mbarga', 'Aïcha');
    expect(view).toMatchObject({ companyId: 'c1', companyName: 'Banque Test', lastName: 'Mbarga', firstName: 'Aïcha', version: 1 });
    expect(w.audit.at(-1)).toMatchObject({ action: AuditAction.Create, entityType: 'Learner', module: 'training' });
    await rejects(learner('Fotso', 'Paul', 'c2'), 'NOT_FOUND', /Entreprise introuvable/); // c2 appartient à un autre chargé de compte
    await rejects(learner('Fotso', 'Paul', 'inconnue'), 'NOT_FOUND', /Entreprise introuvable/);
    w.directory.companies.set('c1', { id: 'c1', name: 'Banque Test', ownerUserId: 'am1', archived: true });
    await rejects(learner('Fotso', 'Paul'), 'INVARIANT_VIOLATION', /archivée/);
  });

  it('rattache un contact seulement s\'il appartient à la même entreprise', async () => {
    const { w } = await setup();
    w.directory.contacts.set('k1', 'c1');
    w.directory.contacts.set('k2', 'c2');
    await expect(w.registerLearner.execute({ companyId: 'c1', lastName: 'Mbarga', firstName: 'Aïcha', contactId: 'k1', access: am, actor })).resolves.toMatchObject({ contactId: 'k1' });
    await rejects(w.registerLearner.execute({ companyId: 'c1', lastName: 'Nkomo', firstName: 'Brice', contactId: 'k2', access: am, actor }), 'VALIDATION', /contact/);
  });

  it('signale un doublon probable (même nom ou même e-mail dans l\'entreprise) et permet de créer quand même', async () => {
    const { w, learner } = await setup();
    await w.registerLearner.execute({ companyId: 'c1', lastName: 'Mbarga', firstName: 'Aïcha', email: 'aicha@exemple.test', access: am, actor });
    await rejects(learner('MBARGA', 'aïcha'), 'CONFLICT', /existe déjà/);
    await rejects(w.registerLearner.execute({ companyId: 'c1', lastName: 'Autre', firstName: 'Nom', email: 'AICHA@exemple.test', access: am, actor }), 'CONFLICT', /même nom ou même e-mail/);
    await expect(w.registerLearner.execute({ companyId: 'c1', lastName: 'Mbarga', firstName: 'Aïcha', allowDuplicate: true, access: am, actor })).resolves.toBeDefined();
    await expect(learner('Mbarga', 'Aïcha', 'c2', otherAm)).resolves.toMatchObject({ companyId: 'c2' }); // même nom dans une autre entreprise : pas un doublon
  });

  it('modifie un apprenant (l\'entreprise ne change pas), contrôle la version, la portée et les doublons', async () => {
    const { w, learner } = await setup();
    const a = await learner('Mbarga', 'Aïcha');
    await learner('Nkomo', 'Brice');
    const updated = await w.updateLearner.execute({ id: a.id, version: 1, firstName: 'Aïssatou', phone: '+237 699 00 11 22', access: am, actor });
    expect(updated).toMatchObject({ firstName: 'Aïssatou', phone: '+237699001122', companyId: 'c1' });
    expect(w.audit.at(-1)).toMatchObject({ action: AuditAction.Update, oldValue: { firstName: 'Aïcha' }, newValue: { firstName: 'Aïssatou' } });
    await rejects(w.updateLearner.execute({ id: a.id, version: 9, firstName: 'X', access: am, actor }), 'CONFLICT', /modifié par un autre utilisateur/);
    await rejects(w.updateLearner.execute({ id: a.id, version: 1, firstName: 'Brice', lastName: 'Nkomo', access: am, actor }), 'CONFLICT', /existe déjà/);
    await rejects(w.updateLearner.execute({ id: a.id, version: 1, firstName: 'X', access: otherAm, actor }), 'NOT_FOUND', /Apprenant introuvable/);
  });

  it('supprime logiquement (Investudy seulement), refuse avec une inscription confirmée, et l\'apprenant disparaît des lectures', async () => {
    const { w, learner, session } = await setup();
    const a = await learner('Mbarga', 'Aïcha');
    const s = await session();
    const enrolled = await w.enroll.execute({ sessionId: s.id, learnerId: a.id, approvalId: 'ap-places', access: am, actor });
    await rejects(w.deleteLearner.execute({ id: a.id, version: 1, access: am, actor }), 'NOT_FOUND', /Apprenant introuvable/); // le chargé de compte n'a pas ce droit
    await w.confirm.execute({ id: enrolled.id, version: 1, access: inv, actor });
    await rejects(w.deleteLearner.execute({ id: a.id, version: 1, access: inv, actor }), 'INVARIANT_VIOLATION', /inscription confirmée/);
    await w.cancelEnrollment.execute({ id: enrolled.id, version: 1, reason: 'Désistement', access: inv, actor });
    await w.deleteLearner.execute({ id: a.id, version: 1, access: inv, actor });
    expect(w.audit.at(-1)).toMatchObject({ action: AuditAction.Delete, entityType: 'Learner' });
    await rejects(w.getLearner.execute({ id: a.id, access: inv }), 'NOT_FOUND', /Apprenant introuvable/);
    expect((await w.listLearners.execute({ page: 1, pageSize: 20, access: inv })).total).toBe(0);
    // L'inscription annulée garde le nom de l'apprenant supprimé.
    expect((await w.getEnrollment.execute({ id: enrolled.id, access: inv })).learnerName).toBe('Aïcha Mbarga');
  });

  it('liste selon la portée : chargé de compte (les siens), Responsable commercial (son équipe), Investudy et Direction (tous)', async () => {
    const { w, learner } = await setup();
    await learner('Mbarga', 'Aïcha');
    await learner('Fotso', 'Paul', 'c2', otherAm);
    const total = async (access: AccessContext) => (await w.listLearners.execute({ page: 1, pageSize: 20, access })).items.map((l) => l.lastName);
    expect(await total(am)).toEqual(['Mbarga']);
    expect(await total(otherAm)).toEqual(['Fotso']);
    expect(await total(chef)).toEqual(['Mbarga']);
    expect((await total(inv)).sort()).toEqual(['Fotso', 'Mbarga']);
    expect((await total(direction)).sort()).toEqual(['Fotso', 'Mbarga']);
    await rejects(w.listLearners.execute({ page: 1, pageSize: 20, companyId: 'c2', access: am }), 'NOT_FOUND', /Entreprise introuvable/);
    await rejects(w.getLearner.execute({ id: (await w.listLearners.execute({ page: 1, pageSize: 20, access: inv })).items[0].id, access: otherAm }), 'NOT_FOUND', /Apprenant introuvable/);
  });
});

describe('Inscriptions — admission', () => {
  it('inscrit en attente, occupe une place, compte le prix complet pour un agrément en somme, trace la création', async () => {
    const { w, learner, session } = await setup();
    const a = await learner('Mbarga', 'Aïcha');
    const s = await session();
    const free = await w.enroll.execute({ sessionId: s.id, learnerId: a.id, approvalId: 'ap-places', comment: ' Prise en charge employeur ', access: am, actor });
    expect(free).toMatchObject({
      status: 'PENDING', chargedAmount: null, comment: 'Prise en charge employeur', learnerName: 'Aïcha Mbarga', companyName: 'Banque Test', trainingTitle: 'Certificat trading', sessionStart: '2026-11-16', version: 1,
    });
    expect(w.audit.at(-1)).toMatchObject({ action: AuditAction.Create, entityType: 'Enrollment' });
    expect((await w.get.execute({ id: s.id, access: inv })).enrolled).toBe(1);
    const b = await learner('Nkomo', 'Brice');
    const paid = await w.enroll.execute({ sessionId: s.id, learnerId: b.id, approvalId: 'ap-sum', access: am, actor });
    expect(paid.chargedAmount).toBe('750000.00');
    expect(w.enrollments.locks).toBe(2);
    expect(w.directory.locks).toBe(2);
  });

  it('exige une session ouverte, refuse une session complète, un doublon et un apprenant occupé sur des dates qui se recouvrent', async () => {
    const { w, learner, session } = await setup();
    const a = await learner('Mbarga', 'Aïcha');
    const b = await learner('Nkomo', 'Brice');
    const c = await learner('Kamga', 'Carine');
    const planned = await session({}, false);
    await rejects(w.enroll.execute({ sessionId: planned.id, learnerId: a.id, approvalId: 'ap-places', access: am, actor }), 'INVARIANT_VIOLATION', /pas encore ouverte/);
    await rejects(w.enroll.execute({ sessionId: 'inconnue', learnerId: a.id, approvalId: 'ap-places', access: am, actor }), 'NOT_FOUND', /Session introuvable/);
    const open = await w.open.execute({ id: planned.id, version: 1, actor });
    await w.enroll.execute({ sessionId: open.id, learnerId: a.id, approvalId: 'ap-places', access: am, actor });
    await rejects(w.enroll.execute({ sessionId: open.id, learnerId: a.id, approvalId: 'ap-places', access: am, actor }), 'CONFLICT', /est déjà inscrit\(e\) à cette session/);
    await w.enroll.execute({ sessionId: open.id, learnerId: b.id, approvalId: 'ap-places', access: am, actor });
    await rejects(w.enroll.execute({ sessionId: open.id, learnerId: c.id, approvalId: 'ap-places', access: am, actor }), 'INVARIANT_VIOLATION', /La session est complète \(2 places sur 2\)/);
    // Une autre session aux mêmes dates (autre salle, autre formateur) : Aïcha y est déjà occupée.
    const parallel = await session({ trainingId: w.certTheory.id, roomId: w.salleCours.id, trainerId: w.externe.id, capacity: 5 });
    await rejects(w.enroll.execute({ sessionId: parallel.id, learnerId: a.id, approvalId: 'ap-places', access: am, actor }), 'CONFLICT', /déjà inscrit\(e\) à « Certificat trading ».*recouvre/);
    await expect(w.enroll.execute({ sessionId: parallel.id, learnerId: c.id, approvalId: 'ap-places', access: am, actor })).resolves.toBeDefined();
  });

  it('refuse une session annulée', async () => {
    const { w, learner, session } = await setup();
    const a = await learner('Mbarga', 'Aïcha');
    const s = await session();
    await w.cancel.execute({ id: s.id, version: 1, reason: 'Annulée', actor });
    await rejects(w.enroll.execute({ sessionId: s.id, learnerId: a.id, approvalId: 'ap-places', access: am, actor }), 'INVARIANT_VIOLATION', /annulée/);
  });

  it('n\'accepte que les agréments Reçu ou Honoré, valides à la date de début, de la même entreprise', async () => {
    const { w, approval, learner, session } = await setup();
    const a = await learner('Mbarga', 'Aïcha');
    const s = await session();
    approval('ap-req', 'c1', { status: 'REQUESTED' });
    approval('ap-exp', 'c1', { status: 'EXPIRED' });
    approval('ap-can', 'c1', { status: 'CANCELLED' });
    approval('ap-old', 'c1', { validUntil: '2026-11-15' });
    approval('ap-edge', 'c1', { validUntil: '2026-11-16', status: 'HONORED' });
    const enroll = (approvalId: string) => w.enroll.execute({ sessionId: s.id, learnerId: a.id, approvalId, access: am, actor });
    await rejects(enroll('ap-req'), 'INVARIANT_VIOLATION', /seulement demandé/);
    await rejects(enroll('ap-exp'), 'INVARIANT_VIOLATION', /expiré/);
    await rejects(enroll('ap-can'), 'INVARIANT_VIOLATION', /annulé/);
    await rejects(enroll('ap-old'), 'INVARIANT_VIOLATION', /expire le 2026-11-15/);
    await rejects(enroll('ap-c2'), 'NOT_FOUND', /Agrément introuvable/); // l'agrément d'une autre entreprise
    await rejects(enroll('inconnu'), 'NOT_FOUND', /Agrément introuvable/);
    await expect(enroll('ap-edge')).resolves.toMatchObject({ approvalId: 'ap-edge' });
  });

  it('plafonne la consommation de l\'agrément : places, somme, prix manquant, devise', async () => {
    const { w, approval, learner, session } = await setup();
    const [a, b] = [await learner('Mbarga', 'Aïcha'), await learner('Nkomo', 'Brice')];
    const s = await session({ capacity: 5 });
    approval('ap-one', 'c1', { places: 1 });
    approval('ap-1m', 'c1', { places: null, amount: '1000000.00' });
    approval('ap-eur', 'c1', { places: null, amount: '5000000.00', currency: 'EUR' });
    const enroll = (learnerId: string, approvalId: string, sessionId = s.id) => w.enroll.execute({ sessionId, learnerId, approvalId, access: am, actor });
    await enroll(a.id, 'ap-one');
    await rejects(enroll(b.id, 'ap-one'), 'INVARIANT_VIOLATION', /n'a plus de place \(1 utilisée sur 1\)/);
    await enroll(a.id, 'ap-1m', (await session({ startDate: '2026-11-23', capacity: 5 })).id);
    await rejects(enroll(b.id, 'ap-1m', (await session({ startDate: '2026-11-30', capacity: 5 })).id), 'INVARIANT_VIOLATION', /montant restant.*250 000.*750 000/);
    await rejects(enroll(b.id, 'ap-eur'), 'INVARIANT_VIOLATION', /EUR.*XAF|aucune conversion/);
    const unpriced = await w.createTraining.execute({ programId: w.program.id, title: 'Certificat sans prix', actor });
    const noPrice = await session({ trainingId: unpriced.id, roomId: w.salleCours.id, trainerId: w.externe.id, startDate: '2026-12-07', capacity: 5 });
    await rejects(enroll(b.id, 'ap-1m', noPrice.id), 'INVARIANT_VIOLATION', /pas de prix complet/);
    await expect(enroll(b.id, 'ap-one', noPrice.id)).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' }); // ap-one est déjà épuisé
    await expect(enroll(b.id, 'ap-places', noPrice.id)).resolves.toMatchObject({ chargedAmount: null }); // un agrément en places couvre un certificat sans prix
  });

  it('refuse un apprenant hors de la portée de l\'appelant et une entreprise archivée', async () => {
    const { w, learner, session } = await setup();
    const a = await learner('Mbarga', 'Aïcha');
    const s = await session();
    await rejects(w.enroll.execute({ sessionId: s.id, learnerId: a.id, approvalId: 'ap-places', access: otherAm, actor }), 'NOT_FOUND', /Apprenant introuvable/);
    w.directory.companies.set('c1', { id: 'c1', name: 'Banque Test', ownerUserId: 'am1', archived: true });
    await rejects(w.enroll.execute({ sessionId: s.id, learnerId: a.id, approvalId: 'ap-places', access: am, actor }), 'INVARIANT_VIOLATION', /archivée/);
  });
});

describe('Inscriptions — confirmer, annuler, replacer', () => {
  it('seul le Responsable Investudy confirme, une seule fois, version contrôlée ; l\'agrément doit rester valide', async () => {
    const { w, approval, learner, session } = await setup();
    const a = await learner('Mbarga', 'Aïcha');
    const b = await learner('Nkomo', 'Brice');
    const s = await session();
    const e1 = await w.enroll.execute({ sessionId: s.id, learnerId: a.id, approvalId: 'ap-places', access: am, actor });
    await rejects(w.confirm.execute({ id: e1.id, version: 1, access: am, actor }), 'NOT_FOUND', /Inscription introuvable/); // le chargé de compte n'a pas ce droit
    await rejects(w.confirm.execute({ id: e1.id, version: 7, access: inv, actor }), 'CONFLICT', /modifiée|modifié par un autre/);
    const confirmed = await w.confirm.execute({ id: e1.id, version: 1, access: inv, actor });
    expect(confirmed).toMatchObject({ status: 'CONFIRMED', confirmedAt: currentNow.toISOString() });
    await rejects(w.confirm.execute({ id: e1.id, version: 1, access: inv, actor }), 'INVARIANT_VIOLATION', /déjà confirmée/);
    approval('ap-late', 'c1');
    const e2 = await w.enroll.execute({ sessionId: s.id, learnerId: b.id, approvalId: 'ap-late', access: am, actor });
    approval('ap-late', 'c1', { status: 'CANCELLED' });
    await rejects(w.confirm.execute({ id: e2.id, version: 1, access: inv, actor }), 'INVARIANT_VIOLATION', /annulé/);
  });

  it('annule avec un motif, libère la place et l\'agrément, et le chargé de compte n\'a pas ce droit', async () => {
    const { w, approval, learner, session } = await setup();
    const a = await learner('Mbarga', 'Aïcha');
    const b = await learner('Nkomo', 'Brice');
    approval('ap-one', 'c1', { places: 1 });
    const s = await session({ capacity: 1 });
    const e1 = await w.enroll.execute({ sessionId: s.id, learnerId: a.id, approvalId: 'ap-one', access: am, actor });
    await rejects(w.enroll.execute({ sessionId: s.id, learnerId: b.id, approvalId: 'ap-one', access: am, actor }), 'INVARIANT_VIOLATION', /complète/);
    await rejects(w.cancelEnrollment.execute({ id: e1.id, version: 1, reason: 'x', access: am, actor }), 'NOT_FOUND', /Inscription introuvable/);
    await rejects(w.cancelEnrollment.execute({ id: e1.id, version: 1, reason: '  ', access: inv, actor }), 'VALIDATION', /motif/);
    const cancelled = await w.cancelEnrollment.execute({ id: e1.id, version: 1, reason: 'Désistement du client', access: inv, actor });
    expect(cancelled).toMatchObject({ status: 'CANCELLED', cancelReason: 'Désistement du client' });
    await rejects(w.cancelEnrollment.execute({ id: e1.id, version: 1, reason: 'Encore', access: inv, actor }), 'INVARIANT_VIOLATION', /déjà annulée/);
    // La place et l'agrément sont libres : Brice entre, et Aïcha peut être de nouveau inscrite plus tard.
    await expect(w.enroll.execute({ sessionId: s.id, learnerId: b.id, approvalId: 'ap-one', access: am, actor })).resolves.toMatchObject({ status: 'PENDING' });
  });

  it('replace une inscription sur une autre session : l\'ancienne est annulée et liée à la nouvelle, les contrôles s\'appliquent', async () => {
    const { w, learner, session } = await setup();
    const a = await learner('Mbarga', 'Aïcha');
    const b = await learner('Nkomo', 'Brice');
    const first = await session();
    const second = await session({ startDate: '2026-11-23' });
    const e1 = await w.enroll.execute({ sessionId: first.id, learnerId: a.id, approvalId: 'ap-places', access: am, actor });
    await rejects(w.replace.execute({ id: e1.id, version: 1, sessionId: first.id, access: inv, actor }), 'VALIDATION', /autre session/);
    await rejects(w.replace.execute({ id: e1.id, version: 1, sessionId: second.id, access: am, actor }), 'NOT_FOUND', /Inscription introuvable/);
    const replacement = await w.replace.execute({ id: e1.id, version: 1, sessionId: second.id, access: inv, actor });
    expect(replacement).toMatchObject({ status: 'PENDING', sessionId: second.id, learnerId: a.id, approvalId: 'ap-places' });
    const old = await w.getEnrollment.execute({ id: e1.id, access: inv });
    expect(old).toMatchObject({ status: 'CANCELLED', cancelReason: 'Replacée sur une autre session', replacedById: replacement.id });
    expect((await w.get.execute({ id: first.id, access: inv })).enrolled).toBe(0);
    expect((await w.get.execute({ id: second.id, access: inv })).enrolled).toBe(1);
    await rejects(w.replace.execute({ id: e1.id, version: 1, sessionId: second.id, access: inv, actor }), 'INVARIANT_VIOLATION', /inscrivez de nouveau/);
    // Session cible complète : le replacement est refusé.
    const full = await session({ startDate: '2026-11-30', capacity: 1 });
    await w.enroll.execute({ sessionId: full.id, learnerId: b.id, approvalId: 'ap-places', access: am, actor });
    await rejects(w.replace.execute({ id: replacement.id, version: 1, sessionId: full.id, access: inv, actor }), 'INVARIANT_VIOLATION', /complète/);
  });
});

describe('Inscriptions — choix de l’agrément et session clôturée', () => {
  it('liste les agréments de l’entreprise de l’apprenant avec ce qui empêche chacun de couvrir l’inscription', async () => {
    const { w, approval, learner, session } = await setup();
    const a = await learner('Mbarga', 'Aïcha');
    const s = await session();
    approval('ap-req', 'c1', { status: 'REQUESTED', receivedOn: null });
    approval('ap-old', 'c1', { validUntil: '2026-11-15' });
    const options = await w.approvalOptions.execute({ learnerId: a.id, sessionId: s.id, access: am });
    const byId = new Map(options.map((o) => [o.id, o]));
    expect(byId.get('ap-places')).toMatchObject({ eligible: true, reason: null, places: 10 });
    expect(byId.get('ap-sum')).toMatchObject({ eligible: true, amount: '1500000.00', label: 'Agrément du 2026-10-12 : 1 500 000 XAF' });
    expect(byId.get('ap-req')).toMatchObject({ eligible: false, reason: expect.stringMatching(/seulement demandé/), label: 'Agrément demandé : 10 places' });
    expect(byId.get('ap-old')).toMatchObject({ eligible: false, reason: expect.stringMatching(/expire le 2026-11-15/) });
    expect(byId.has('ap-c2')).toBe(false); // l'agrément d'une autre entreprise n'est jamais proposé
    // Une inscription déjà prise consomme : l'agrément en places le dit.
    await w.enroll.execute({ sessionId: s.id, learnerId: a.id, approvalId: 'ap-sum', access: am, actor });
    const b = await learner('Nkomo', 'Brice');
    const after = await w.approvalOptions.execute({ learnerId: b.id, sessionId: s.id, access: inv });
    expect(after.find((o) => o.id === 'ap-sum')).toMatchObject({ eligible: true });
    await rejects(w.approvalOptions.execute({ learnerId: a.id, sessionId: s.id, access: otherAm }), 'NOT_FOUND', /Apprenant introuvable/);
    await rejects(w.approvalOptions.execute({ learnerId: a.id, sessionId: 'inconnue', access: am }), 'NOT_FOUND', /Session introuvable/);
  });

  it('une inscription d’une session clôturée ne se confirme plus, ne s’annule plus et ne se replace plus', async () => {
    const { w, learner, session } = await setup();
    const a = await learner('Mbarga', 'Aïcha');
    const s = await session();
    const other = await session({ startDate: '2026-11-23' });
    const e = await w.enroll.execute({ sessionId: s.id, learnerId: a.id, approvalId: 'ap-places', access: am, actor });
    // La clôture arrive en S5.3 : on la simule en remplaçant la session par sa version clôturée.
    const stored = (await w.sessions.findById(s.id))!;
    w.sessions.items[w.sessions.items.indexOf(stored)] = TrainingSession.rehydrate({
      id: s.id, trainingId: stored.trainingId, rhythm: 'DAY', startDate: stored.startDate, endDate: stored.endDate, roomId: stored.roomId, trainerId: stored.trainerId,
      capacity: stored.capacity, status: 'CLOSED', cancelReason: null, createdAt: currentNow, version: 1,
    });
    await rejects(w.confirm.execute({ id: e.id, version: 1, access: inv, actor }), 'INVARIANT_VIOLATION', /plus ouverte/);
    await rejects(w.cancelEnrollment.execute({ id: e.id, version: 1, reason: 'x', access: inv, actor }), 'INVARIANT_VIOLATION', /clôturée/);
    await rejects(w.replace.execute({ id: e.id, version: 1, sessionId: other.id, access: inv, actor }), 'INVARIANT_VIOLATION', /clôturée/);
    await rejects(w.enroll.execute({ sessionId: s.id, learnerId: (await learner('Autre', 'Paul')).id, approvalId: 'ap-places', access: am, actor }), 'INVARIANT_VIOLATION', /clôturée/);
  });
});

describe('Inscriptions — liens avec les sessions', () => {
  it('annuler une session place ses inscriptions « à replacer » sans les supprimer, libère l\'agrément et trace chacune', async () => {
    const { w, learner, session } = await setup();
    const a = await learner('Mbarga', 'Aïcha');
    const b = await learner('Nkomo', 'Brice');
    const s = await session();
    const e1 = await w.enroll.execute({ sessionId: s.id, learnerId: a.id, approvalId: 'ap-sum', access: am, actor });
    const e2 = await w.enroll.execute({ sessionId: s.id, learnerId: b.id, approvalId: 'ap-sum', access: am, actor });
    await w.confirm.execute({ id: e2.id, version: 1, access: inv, actor });
    const cancelled = await w.cancel.execute({ id: s.id, version: 1, reason: 'Pas assez d\'inscrits', actor });
    expect(cancelled.enrolled).toBe(0);
    expect(w.enrollments.locks).toBeGreaterThanOrEqual(3);
    expect((await w.getEnrollment.execute({ id: e1.id, access: inv })).status).toBe('TO_REPLACE');
    expect((await w.getEnrollment.execute({ id: e2.id, access: inv })).status).toBe('TO_REPLACE');
    expect(w.audit.filter((r) => r.entityType === 'Enrollment' && r.action === AuditAction.Update && (r.newValue as { status?: string } | undefined)?.status === 'TO_REPLACE')).toHaveLength(2);
    // L'agrément est libéré : il couvre de nouveau deux certificats ; un « à replacer » se replace sur une autre session.
    const next = await session({ startDate: '2026-11-23' });
    await expect(w.replace.execute({ id: e1.id, version: 1, sessionId: next.id, access: inv, actor })).resolves.toMatchObject({ status: 'PENDING', sessionId: next.id });
    await rejects(w.confirm.execute({ id: e2.id, version: 1, access: inv, actor }), 'INVARIANT_VIOLATION', /Seule une inscription en attente/);
  });

  it('la capacité d\'une session ne descend pas sous le nombre d\'inscrits', async () => {
    const { w, learner, session } = await setup();
    const [a, b] = [await learner('Mbarga', 'Aïcha'), await learner('Nkomo', 'Brice')];
    const s = await session({ capacity: 5 });
    await w.enroll.execute({ sessionId: s.id, learnerId: a.id, approvalId: 'ap-places', access: am, actor });
    await w.enroll.execute({ sessionId: s.id, learnerId: b.id, approvalId: 'ap-places', access: am, actor });
    await rejects(w.update.execute({ id: s.id, version: 1, capacity: 1, actor }), 'INVARIANT_VIOLATION', /inférieure au nombre d'inscrits \(2\)/);
    await expect(w.update.execute({ id: s.id, version: 1, capacity: 2, actor })).resolves.toMatchObject({ capacity: 2, enrolled: 2 });
  });

  it('reporter une session conserve les inscrits, sauf si l\'un d\'eux serait inscrit à deux sessions qui se recouvrent', async () => {
    const { w, learner, session } = await setup();
    const a = await learner('Mbarga', 'Aïcha');
    const s = await session();
    const other = await session({ trainingId: w.certTheory.id, roomId: w.salleCours.id, trainerId: w.externe.id, startDate: '2026-11-23', capacity: 5 });
    await w.enroll.execute({ sessionId: s.id, learnerId: a.id, approvalId: 'ap-places', access: am, actor });
    await w.enroll.execute({ sessionId: other.id, learnerId: a.id, approvalId: 'ap-places', access: am, actor });
    await rejects(w.postpone.execute({ id: s.id, version: 1, startDate: '2026-11-23', reason: 'Salle indisponible', actor }), 'CONFLICT', /déjà inscrit à une autre session/);
    const moved = await w.postpone.execute({ id: s.id, version: 1, startDate: '2026-11-30', reason: 'Formateur indisponible', actor });
    expect(moved).toMatchObject({ startDate: '2026-11-30', enrolled: 1 });
  });

  it('liste et lit les inscriptions selon la portée de l\'entreprise ; filtre par état', async () => {
    const { w, learner, session } = await setup();
    const a = await learner('Mbarga', 'Aïcha');
    const c2learner = await learner('Fotso', 'Paul', 'c2', otherAm);
    const s = await session({ capacity: 5 });
    const mine = await w.enroll.execute({ sessionId: s.id, learnerId: a.id, approvalId: 'ap-places', access: am, actor });
    const theirs = await w.enroll.execute({ sessionId: s.id, learnerId: c2learner.id, approvalId: 'ap-c2', access: otherAm, actor });
    const ids = async (access: AccessContext, extra: Record<string, unknown> = {}) => (await w.listEnrollments.execute({ page: 1, pageSize: 20, access, ...extra })).items.map((e) => e.id).sort();
    expect(await ids(am)).toEqual([mine.id]);
    expect(await ids(otherAm)).toEqual([theirs.id]);
    expect(await ids(chef)).toEqual([mine.id]);
    expect(await ids(inv)).toEqual([mine.id, theirs.id].sort());
    expect(await ids(direction, { status: 'CONFIRMED' })).toEqual([]);
    expect(await ids(inv, { sessionId: s.id, status: 'PENDING' })).toHaveLength(2);
    await rejects(w.getEnrollment.execute({ id: theirs.id, access: am }), 'NOT_FOUND', /Inscription introuvable/);
    await rejects(w.listEnrollments.execute({ page: 1, pageSize: 20, companyId: 'c2', access: am }), 'NOT_FOUND', /Entreprise introuvable/);
    await rejects(w.listEnrollments.execute({ page: 1, pageSize: 20, learnerId: c2learner.id, access: am }), 'NOT_FOUND', /Apprenant introuvable/);
  });
});

export type { TrainingWorld };
