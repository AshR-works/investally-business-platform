import { describe, expect, it } from 'vitest';
// Cohérence interface ↔ serveur : le domaine RÉEL de l'API est interrogé sur les mêmes cas.
import { normalizePayer } from '../../crm-api/src/modules/training/domain/enrollment';
import { Learner as ServerLearner } from '../../crm-api/src/modules/training/domain/learner';
import {
  EMPTY_ENROLL_FORM, EMPTY_LEARNER_FORM, enrollBody, type EnrollForm, formFromLearner, INDIVIDUAL_KINDS, isIndividual, LEARNER_KIND_FILTERS, LEARNER_KIND_LABEL, learnerBody, learnerOrigin,
  type Learner, type LearnerForm, PAYER_TYPE_OPTIONS, payerText, validateEnroll, validateLearner,
} from '../lib/enrollments';

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
const form = (over: Partial<LearnerForm> = {}): LearnerForm => ({ ...EMPTY_LEARNER_FORM(), lastName: 'Essomba', firstName: 'Léa', ...over });
const learner = (over: Partial<Learner> = {}): Learner => ({
  id: 'l1', kind: 'STUDENT', companyId: null, companyName: '', contactId: null, lastName: 'Essomba', firstName: 'Léa', email: null, phone: null, version: 1, createdAt: '2026-11-06T09:00:00.000Z', ...over,
});

describe('apprenant sans entreprise : saisie', () => {
  it('la case « sans entreprise » dispense de l’entreprise, qui reste exigée sinon', () => {
    expect(validateLearner(form({ companyId: '', withoutCompany: true }), false)).toEqual({});
    expect(validateLearner(form({ companyId: '', withoutCompany: false }), false).companyId).toMatch(/sans entreprise/);
    expect(validateLearner(form({ companyId: 'c1', withoutCompany: false }), false)).toEqual({});
  });

  it('envoie la nature et ni entreprise ni contact pour un étudiant ou un particulier', () => {
    expect(learnerBody(form({ withoutCompany: true, kind: 'INDIVIDUAL', companyId: 'c1', contactId: 'k1' }))).toEqual({ lastName: 'Essomba', firstName: 'Léa', email: '', phone: '', kind: 'INDIVIDUAL' });
    expect(learnerBody(form({ withoutCompany: true, kind: 'STUDENT' }))).toMatchObject({ kind: 'STUDENT' });
    expect(learnerBody(form({ companyId: 'c1', contactId: 'k1' }))).toMatchObject({ companyId: 'c1', contactId: 'k1' });
    expect(learnerBody(form({ companyId: 'c1', contactId: 'k1' }))).not.toHaveProperty('kind');
  });

  it('à la modification n’envoie ni nature ni entreprise, et reprend la nature de la fiche', () => {
    const body = learnerBody(formFromLearner(learner({ kind: 'INDIVIDUAL' })), { version: 4 });
    expect(body).toMatchObject({ version: 4 });
    for (const key of ['kind', 'companyId', 'contactId']) expect(body).not.toHaveProperty(key);
    expect(formFromLearner(learner({ kind: 'INDIVIDUAL' }))).toMatchObject({ withoutCompany: true, kind: 'INDIVIDUAL', companyId: '' });
    expect(formFromLearner(learner({ kind: 'STUDENT' }))).toMatchObject({ withoutCompany: true, kind: 'STUDENT' });
    expect(formFromLearner(learner({ kind: 'COMPANY', companyId: 'c9', companyName: 'Banque' }))).toMatchObject({ withoutCompany: false, companyId: 'c9' });
  });

  it('suit le domaine réel du serveur : une nature sans entreprise n’a ni entreprise ni contact', () => {
    for (const kind of ['STUDENT', 'INDIVIDUAL'] as const) {
      const client = valid(validateLearner(form({ withoutCompany: true, kind }), false));
      const server = serverAccepts(() => ServerLearner.create({ id: 'l', kind, lastName: 'Essomba', firstName: 'Léa', now: NOW }));
      expect([kind, client]).toEqual([kind, server]);
      expect(serverAccepts(() => ServerLearner.create({ id: 'l', kind, companyId: 'c1', lastName: 'A', firstName: 'B', now: NOW }))).toBe(false);
    }
    expect(serverAccepts(() => ServerLearner.create({ id: 'l', lastName: 'A', firstName: 'B', now: NOW }))).toBe(false); // un apprenant d'entreprise sans entreprise
  });

  it('dit la nature, propose Étudiant et Particulier, et filtre dans l’ordre de la liste', () => {
    expect(LEARNER_KIND_LABEL).toEqual({ COMPANY: 'Entreprise', STUDENT: 'Étudiant', INDIVIDUAL: 'Particulier' });
    expect(INDIVIDUAL_KINDS.map((k) => [k.value, k.label])).toEqual([['STUDENT', 'Étudiant'], ['INDIVIDUAL', 'Particulier']]);
    expect(LEARNER_KIND_FILTERS.map((k) => k.value)).toEqual(['', 'COMPANY', 'STUDENT', 'INDIVIDUAL']);
    expect(isIndividual({ kind: 'STUDENT' })).toBe(true);
    expect(isIndividual({ kind: 'INDIVIDUAL' })).toBe(true);
    expect(isIndividual({ kind: 'COMPANY' })).toBe(false);
    expect(learnerOrigin({ kind: 'COMPANY', companyName: 'Banque Test' })).toBe('Banque Test');
    expect(learnerOrigin({ kind: 'STUDENT', companyName: '' })).toBe('Étudiant');
    expect(learnerOrigin({ kind: 'INDIVIDUAL', companyName: '' })).toBe('Particulier');
  });
});

describe('inscription d’un étudiant ou d’un particulier : le payeur', () => {
  const enroll = (over: Partial<EnrollForm> = {}): EnrollForm => ({ ...EMPTY_ENROLL_FORM('l1', 's1'), ...over });

  it('exige de désigner qui règle, et ne demande aucun agrément', () => {
    expect(validateEnroll(enroll(), [], true).payerKind).toMatch(/qui règle/);
    expect(validateEnroll(enroll({ payerKind: 'SELF' }), [], true)).toEqual({});
    expect(validateEnroll(enroll({ payerKind: 'SELF' }), [], true)).not.toHaveProperty('approvalId');
    expect(validateEnroll(enroll(), [], false).approvalId).toBeDefined(); // un apprenant d'entreprise reste sous agrément
  });

  it('un tiers a un nom (200 au plus) et une nature', () => {
    expect(validateEnroll(enroll({ payerKind: 'THIRD_PARTY' }), [], true)).toMatchObject({ payerName: expect.stringMatching(/nom du payeur/), payerType: expect.stringMatching(/nature/) });
    expect(validateEnroll(enroll({ payerKind: 'THIRD_PARTY', payerName: 'Famille Ndongo', payerType: 'FAMILY' }), [], true)).toEqual({});
    expect(validateEnroll(enroll({ payerKind: 'THIRD_PARTY', payerName: 'x'.repeat(200), payerType: 'FAMILY' }), [], true)).toEqual({});
    expect(validateEnroll(enroll({ payerKind: 'THIRD_PARTY', payerName: 'x'.repeat(201), payerType: 'FAMILY' }), [], true).payerName).toMatch(/200/);
    expect(validateEnroll(enroll({ payerKind: 'THIRD_PARTY', payerName: '  ', payerType: 'FAMILY' }), [], true).payerName).toBeDefined();
  });

  it('prépare le corps de la requête : le payeur pour un étudiant, l’agrément pour un apprenant d’entreprise', () => {
    expect(enrollBody(enroll({ payerKind: 'SELF' }), true)).toEqual({ learnerId: 'l1', sessionId: 's1', payer: { kind: 'SELF' } });
    expect(enrollBody(enroll({ payerKind: 'THIRD_PARTY', payerName: ' Fondation ', payerType: 'ORGANISM', comment: ' ok ' }), true)).toEqual({
      learnerId: 'l1', sessionId: 's1', payer: { kind: 'THIRD_PARTY', name: 'Fondation', type: 'ORGANISM' }, comment: 'ok',
    });
    expect(enrollBody(enroll({ approvalId: 'a1' }), false)).toEqual({ learnerId: 'l1', sessionId: 's1', approvalId: 'a1' });
    expect(enrollBody(enroll({ approvalId: 'a1' }))).not.toHaveProperty('payer');
  });

  it('suit le domaine réel du serveur sur le payeur', () => {
    const cases: Array<[Partial<EnrollForm>, { kind?: string; name?: string; type?: string }]> = [
      [{ payerKind: 'SELF' }, { kind: 'SELF' }],
      [{ payerKind: 'THIRD_PARTY', payerName: 'Oncle Paul', payerType: 'FAMILY' }, { kind: 'THIRD_PARTY', name: 'Oncle Paul', type: 'FAMILY' }],
      [{ payerKind: 'THIRD_PARTY', payerName: '', payerType: 'FAMILY' }, { kind: 'THIRD_PARTY', name: '', type: 'FAMILY' }],
      [{ payerKind: 'THIRD_PARTY', payerName: 'Oncle Paul', payerType: '' }, { kind: 'THIRD_PARTY', name: 'Oncle Paul', type: '' }],
      [{ payerKind: 'THIRD_PARTY', payerName: 'x'.repeat(201), payerType: 'EMPLOYER' }, { kind: 'THIRD_PARTY', name: 'x'.repeat(201), type: 'EMPLOYER' }],
      [{ payerKind: '' }, {}],
    ];
    for (const [input, server] of cases) {
      const client = valid(validateEnroll(enroll(input), [], true));
      expect([input, client]).toEqual([input, serverAccepts(() => normalizePayer(server))]);
    }
    for (const option of PAYER_TYPE_OPTIONS) expect(serverAccepts(() => normalizePayer({ kind: 'THIRD_PARTY', name: 'X', type: option.value }))).toBe(true);
  });

  it('dit le payeur en clair', () => {
    expect(payerText(null)).toBe('');
    expect(payerText({ kind: 'SELF', name: null, type: null })).toBe('Lui-même');
    expect(payerText({ kind: 'THIRD_PARTY', name: 'Famille Ndongo', type: 'FAMILY' })).toBe('Famille Ndongo (famille ou proche)');
    expect(payerText({ kind: 'THIRD_PARTY', name: 'Mairie', type: 'ORGANISM' })).toBe('Mairie (organisme)');
    expect(PAYER_TYPE_OPTIONS.map((o) => o.value)).toEqual(['EMPLOYER', 'ORGANISM', 'LANDLORD', 'FAMILY']);
  });
});
