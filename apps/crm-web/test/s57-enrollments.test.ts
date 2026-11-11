import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// Cohérence interface ↔ serveur : le domaine RÉEL de l'API est interrogé sur les mêmes cas.
import { Learner as ServerLearner } from '../../crm-api/src/modules/training/domain/learner';
import { availableModules } from '../lib/modules';
import {
  type ApprovalOption, coverText, EMPTY_ENROLL_FORM, EMPTY_LEARNER_FORM, type Enrollment, ENROLLMENT_STATUS, ENROLLMENT_STATUS_OPTIONS, enrollBody, enrollmentActions, formFromLearner,
  isFull, type Learner, learnerBody, type LearnerForm, seatsFill, validateCancelEnrollment, validateEnroll, validateLearner, validateReplace,
} from '../lib/enrollments';
import type { Profile } from '../lib/types';

const NOW = new Date('2026-11-06T09:00:00Z');
const valid = (errors: object) => Object.keys(errors).length === 0;
const serverAccepts = (build: () => unknown) => {
  try {
    build();
    return true;
  } catch {
    return false;
  }
};
const form = (over: Partial<LearnerForm> = {}): LearnerForm => ({ companyId: 'c1', withoutCompany: false, kind: 'STUDENT', lastName: 'Mbarga', firstName: 'Aïcha', email: '', phone: '', contactId: '', ...over });
const profileWith = (...permissions: string[]) => ({ permissions: permissions.map((code) => ({ code, scope: 'ALL' })) }) as unknown as Profile;

const option = (over: Partial<ApprovalOption> = {}): ApprovalOption => ({
  id: 'a1', label: 'Agrément du 2026-10-12 : 2 places', status: 'RECEIVED', places: 2, amount: null, currency: 'XAF', validUntil: null, receivedOn: '2026-10-12', payerName: null,
  eligible: true, reason: null, ...over,
});

const enrollment = (over: Partial<Enrollment> = {}): Enrollment => ({
  id: 'e1', sessionId: 's1', learnerId: 'l1', companyId: 'c1', approvalId: 'a1', payer: null, learnerKind: 'COMPANY', chargedAmount: null, status: 'PENDING', comment: null, cancelReason: null, confirmedAt: null, replacedById: null,
  trainingTitle: 'Certificat trading', sessionStart: '2026-11-16', sessionEnd: '2026-11-20', sessionStatus: 'OPEN', roomName: 'Salle de marchés', learnerName: 'Aïcha Mbarga', companyName: 'Banque Test',
  approvalLabel: 'Agrément du 2026-10-12 : 2 places', version: 1, createdAt: '2026-11-06T09:00:00.000Z', ...over,
});

describe('apprenants : saisie', () => {
  it('accepte une saisie complète et la prépare pour l\'API (téléphone sans espace, contact vide = aucun)', () => {
    expect(valid(validateLearner(form({ email: 'aicha@exemple.test', phone: '+237 699 00 11 22' }), false))).toBe(true);
    expect(learnerBody(form({ phone: '+237 699 00 11 22', email: ' aicha@exemple.test ' }))).toEqual({
      companyId: 'c1', lastName: 'Mbarga', firstName: 'Aïcha', email: 'aicha@exemple.test', phone: '+237699001122', contactId: null,
    });
  });

  it('exige l\'entreprise à la création seulement, le nom et le prénom, un e-mail et un téléphone valides', () => {
    expect(Object.keys(validateLearner(EMPTY_LEARNER_FORM(), false))).toEqual(['companyId', 'lastName', 'firstName']);
    expect(valid(validateLearner(form({ companyId: '' }), true))).toBe(true); // à la modification l'entreprise ne change pas
    expect(validateLearner(form({ email: 'pas-un-email' }), false).email).toMatch(/pas valide/);
    expect(validateLearner(form({ phone: '0699123456' }), false).phone).toMatch(/0/);
    expect(validateLearner(form({ lastName: 'x'.repeat(101) }), false).lastName).toMatch(/100/);
  });

  it('suit le domaine réel du serveur sur les noms, e-mails et téléphones', () => {
    const cases = [
      { lastName: 'Mbarga', firstName: 'Aïcha', email: '', phone: '' }, { lastName: ' ', firstName: 'A', email: '', phone: '' }, { lastName: 'A', firstName: '', email: '', phone: '' },
      { lastName: 'A', firstName: 'B', email: 'a@b.cd', phone: '' }, { lastName: 'A', firstName: 'B', email: 'a@b', phone: '' }, { lastName: 'A', firstName: 'B', email: 'sans-arobase', phone: '' },
      { lastName: 'A', firstName: 'B', email: '', phone: '+237 699 00 11 22' }, { lastName: 'A', firstName: 'B', email: '', phone: '0699123456' }, { lastName: 'A', firstName: 'B', email: '', phone: '+12' },
      { lastName: 'A'.repeat(101), firstName: 'B', email: '', phone: '' },
    ];
    for (const c of cases) {
      const client = valid(validateLearner(form(c), false));
      const server = serverAccepts(() => ServerLearner.create({ id: 'l', companyId: 'c', lastName: c.lastName, firstName: c.firstName, email: c.email, phone: c.phone, now: NOW }));
      expect([c, client]).toEqual([c, server]);
    }
  });

  it('à la modification n\'envoie que la version et les champs, jamais l\'entreprise ; « créer quand même » ajoute l\'indicateur de doublon', () => {
    const learner: Learner = { id: 'l1', kind: 'COMPANY', companyId: 'c1', companyName: 'Banque Test', contactId: 'k1', lastName: 'Mbarga', firstName: 'Aïcha', email: null, phone: null, version: 3, createdAt: '2026-11-06T09:00:00.000Z' };
    const body = learnerBody(formFromLearner(learner), { version: 3, allowDuplicate: true });
    expect(body).toMatchObject({ version: 3, allowDuplicate: true, contactId: 'k1' });
    expect(body).not.toHaveProperty('companyId');
  });
});

describe('inscriptions : saisie', () => {
  it('exige l\'apprenant, la session et un agrément qui peut couvrir l\'inscription', () => {
    expect(Object.keys(validateEnroll(EMPTY_ENROLL_FORM(), []))).toEqual(['learnerId', 'sessionId', 'approvalId']);
    const ok = { ...EMPTY_ENROLL_FORM('l1', 's1'), approvalId: 'a1' };
    expect(valid(validateEnroll(ok, [option()]))).toBe(true);
    expect(validateEnroll(ok, [option({ eligible: false, reason: "L'agrément est seulement demandé : la promesse de paiement n'est pas encore signée" })]).approvalId).toMatch(/seulement demandé/);
    expect(validateEnroll({ ...ok, comment: 'x'.repeat(501) }, [option()]).comment).toMatch(/500/);
    expect(enrollBody({ ...ok, comment: '  Prise en charge  ' })).toEqual({ learnerId: 'l1', sessionId: 's1', approvalId: 'a1', comment: 'Prise en charge' });
    expect(enrollBody(ok)).not.toHaveProperty('comment');
  });

  it('un replacement exige une autre session et un agrément qui peut couvrir', () => {
    const current = enrollment();
    expect(validateReplace({ sessionId: '', approvalId: 'a1' }, current, [option()]).sessionId).toMatch(/nouvelle session/);
    expect(validateReplace({ sessionId: 's1', approvalId: 'a1' }, current, [option()]).sessionId).toMatch(/autre session/);
    expect(valid(validateReplace({ sessionId: 's2', approvalId: 'a1' }, current, [option()]))).toBe(true);
    expect(validateReplace({ sessionId: 's2', approvalId: 'a1' }, current, [option({ eligible: false, reason: "Le montant restant de l'agrément ne couvre pas le prix" })]).approvalId).toMatch(/montant restant/);
  });

  it('exige un motif d\'annulation', () => {
    expect(validateCancelEnrollment(' ')).toMatch(/obligatoire/);
    expect(validateCancelEnrollment('x'.repeat(501))).toMatch(/500/);
    expect(validateCancelEnrollment('Désistement')).toBeUndefined();
  });

  it('décrit ce que couvre un agrément et la jauge de places', () => {
    expect(coverText({ places: 2, amount: null, currency: 'XAF' })).toBe('2 places');
    expect(coverText({ places: 1, amount: null, currency: 'XAF' })).toBe('1 place');
    expect(coverText({ places: null, amount: '1500000.00', currency: 'XAF' })).toBe('1 500 000 XAF');
    expect(coverText({ places: 5, amount: '100000.00', currency: 'EUR' })).toBe('5 places et 100 000 EUR');
    expect(seatsFill(5, 13)).toBe('5 / 13');
    expect(isFull(13, 13)).toBe(true);
    expect(isFull(12, 13)).toBe(false);
  });
});

describe('inscriptions : actions selon l\'état, la session et les droits', () => {
  const full = { confirm: true, cancel: true };
  it('une inscription en attente sur une session ouverte : tout est possible', () => {
    expect(enrollmentActions(enrollment(), full)).toEqual({ confirm: true, cancel: true, replace: true });
  });
  it('une inscription confirmée ne se confirme plus mais s\'annule et se replace', () => {
    expect(enrollmentActions(enrollment({ status: 'CONFIRMED' }), full)).toEqual({ confirm: false, cancel: true, replace: true });
  });
  it('une inscription à replacer se replace ou s\'annule, mais ne se confirme pas', () => {
    expect(enrollmentActions(enrollment({ status: 'TO_REPLACE', sessionStatus: 'CANCELLED' }), full)).toEqual({ confirm: false, cancel: true, replace: true });
  });
  it('une inscription annulée, ou d\'une session clôturée, n\'offre plus rien', () => {
    expect(enrollmentActions(enrollment({ status: 'CANCELLED' }), full)).toEqual({ confirm: false, cancel: false, replace: false });
    expect(enrollmentActions(enrollment({ sessionStatus: 'CLOSED' }), full)).toEqual({ confirm: false, cancel: false, replace: false });
  });
  it('sans droit, aucune action ; confirmer et annuler ont chacun leur droit', () => {
    expect(enrollmentActions(enrollment(), { confirm: false, cancel: false })).toEqual({ confirm: false, cancel: false, replace: false });
    expect(enrollmentActions(enrollment(), { confirm: true, cancel: false })).toEqual({ confirm: true, cancel: false, replace: false });
    expect(enrollmentActions(enrollment(), { confirm: false, cancel: true })).toEqual({ confirm: false, cancel: true, replace: true });
  });
});

describe('inscriptions : libellés, hub et pages', () => {
  it('chaque état a un libellé ; les filtres couvrent toutes, en attente, confirmées, à replacer, annulées', () => {
    expect(Object.values(ENROLLMENT_STATUS).map((s) => s.label)).toEqual(['En attente de confirmation', 'Confirmée', 'Annulée', 'À replacer']);
    expect(ENROLLMENT_STATUS_OPTIONS.map((o) => o.label)).toEqual(['Toutes', 'En attente', 'Confirmées', 'À replacer', 'Annulées']);
  });

  it('les modules « Apprenants » et « Inscriptions » n\'apparaissent que pour qui peut les lire', () => {
    const ids = (p: Profile) => availableModules(p).map((m) => m.id);
    expect(ids(profileWith('training.learner.read'))).toContain('learners');
    expect(ids(profileWith('training.learner.read'))).not.toContain('enrollments');
    expect(ids(profileWith('training.enrollment.read'))).toContain('enrollments');
    expect(ids(profileWith('training.program.read'))).not.toContain('learners');
  });

  it('les pages lisent leurs droits : création d\'apprenant, suppression, inscription, fiche de session', () => {
    const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
    const learners = read('app/(app)/training/learners/page.tsx');
    expect(learners).toContain('ENROLLMENT_PERMISSIONS.createLearner');
    expect(learners).toContain('canDelete &&');
    expect(learners).toContain('canEnroll &&');
    const sheet = read('app/(app)/training/sessions/[id]/page.tsx');
    expect(sheet).toContain("session.status === 'OPEN'");
    expect(sheet).toContain('disabled={full}');
    const table = read('components/training/enrollments-table.tsx');
    expect(table).toContain('enrollmentActions(e, rights)');
    expect(read('app/(app)/training/enrollments/page.tsx')).toContain('defaultStatus="PENDING"');
  });
});
