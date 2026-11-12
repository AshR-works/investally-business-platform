import { describe, expect, it } from 'vitest';
// Cohérence interface ↔ serveur : le domaine RÉEL de l'agrément valide les mêmes saisies.
import { Approval } from '../../api/src/modules/business-development/domain/approval';
import {
  APPROVAL_ACTION_LABEL, PAYER_TYPES, payerText, validateReceivedOn,
  APPROVAL_STATUS, approvalActions, buildApprovalBody, coverageText, eligibleOpportunities, EMPTY_APPROVAL_FORM, validateApprovalFields, validateReason,
  type ApprovalForm,
} from '../lib/approvals';
import type { Opportunity } from '../lib/types';

const now = new Date('2026-11-07T10:00:00Z');
const today = '2026-11-07';
const form = (patch: Partial<ApprovalForm> = {}): ApprovalForm => ({ opportunityId: 'op1', amount: '12 500 000', places: '', currency: 'XAF', receivedOn: '2026-11-05', validUntil: '', requested: false, payerName: '', payerType: '', ...patch });
const serverAccepts = (f: ApprovalForm): boolean => {
  try {
    Approval.register({
      id: 'x', companyId: 'c1', opportunityId: f.opportunityId || 'op1', amount: f.amount || null, places: f.places ? Number(f.places) : null,
      currency: f.currency, receivedOn: f.receivedOn, validUntil: f.validUntil || null, payerName: f.payerName || null, payerType: f.payerType || null, now,
    });
    return true;
  } catch {
    return false;
  }
};
const opp = (patch: Partial<Opportunity>): Opportunity => ({ id: 'o', stage: 'QUALIFICATION', status: 'OPEN', ...patch }) as Opportunity;

describe('agrément : saisie', () => {
  it('le formulaire vide propose XAF et la date du jour', () => {
    expect(EMPTY_APPROVAL_FORM({}, now)).toMatchObject({ currency: 'XAF', receivedOn: today, opportunityId: '', amount: '', places: '', validUntil: '' });
  });
  it('accepte une saisie complète, avec montant seul, places seules ou les deux', () => {
    expect(validateApprovalFields(form(), { today })).toEqual({});
    expect(validateApprovalFields(form({ amount: '', places: '12' }), { today })).toEqual({});
    expect(validateApprovalFields(form({ places: '12' }), { today })).toEqual({});
  });
  it('refuse sans opportunité, sans montant ni places, un montant ou des places invalides', () => {
    expect(validateApprovalFields(form({ opportunityId: '' }), { today }).opportunityId).toMatch(/opportunité/);
    expect(validateApprovalFields(form({ amount: '' }), { today }).amount).toMatch(/montant couvert/);
    expect(validateApprovalFields(form({ amount: '0' }), { today }).amount).toMatch(/positif/);
    expect(validateApprovalFields(form({ amount: '1.234' }), { today }).amount).toMatch(/positif/);
    expect(validateApprovalFields(form({ amount: '', places: '0' }), { today }).places).toMatch(/entier positif/);
    expect(validateApprovalFields(form({ amount: '', places: '2,5' }), { today }).places).toMatch(/entier positif/);
  });
  it('contrôle la devise et les dates (réception pas dans le futur ; validité pas avant la réception)', () => {
    expect(validateApprovalFields(form({ currency: 'EURO' }), { today }).currency).toMatch(/trois lettres/);
    expect(validateApprovalFields(form({ currency: 'fcfa' }), { today })).toEqual({});
    expect(validateApprovalFields(form({ receivedOn: '' }), { today }).receivedOn).toMatch(/obligatoire/);
    expect(validateApprovalFields(form({ receivedOn: '2026-02-31' }), { today }).receivedOn).toMatch(/pas valide/);
    expect(validateApprovalFields(form({ receivedOn: '2026-11-08' }), { today }).receivedOn).toMatch(/futur/);
    expect(validateApprovalFields(form({ validUntil: '2026-11-04' }), { today }).validUntil).toMatch(/précéder/);
    expect(validateApprovalFields(form({ validUntil: '2027-13-01' }), { today }).validUntil).toMatch(/pas valide/);
    expect(validateApprovalFields(form({ validUntil: '2027-03-31' }), { today })).toEqual({});
  });
  it('construit un corps où seuls les champs renseignés partent', () => {
    expect(buildApprovalBody(form({ places: '8', validUntil: '2027-03-31' }))).toEqual({ opportunityId: 'op1', receivedOn: '2026-11-05', amount: '12 500 000', places: 8, currency: 'XAF', validUntil: '2027-03-31' });
    expect(buildApprovalBody(form({ amount: '', places: '8', currency: '' }))).toEqual({ opportunityId: 'op1', receivedOn: '2026-11-05', places: 8 });
  });
});

describe('cohérence avec le domaine réel du serveur', () => {
  const cases: Partial<ApprovalForm>[] = [
    {}, { amount: '', places: '12' }, { places: '12' }, { amount: '' }, { amount: '0' }, { amount: '1.234' }, { amount: '', places: '0' }, { amount: '', places: '2,5' },
    { currency: 'EURO' }, { currency: 'fcfa' }, { receivedOn: '2026-02-31' }, { receivedOn: '2026-11-08' }, { validUntil: '2026-11-04' }, { validUntil: '2027-03-31' }, { validUntil: '2027-13-01' },
    { payerName: 'Banque X', payerType: 'ORGANISM' }, { payerName: 'Banque X' }, { payerType: 'LANDLORD' }, { payerName: 'x'.repeat(201), payerType: 'EMPLOYER' }, { payerName: 'Banque X', payerType: 'AUTRE' },
  ];
  it.each(cases.map((c, i) => [i, c] as const))('saisie %i : l’interface et le serveur décident pareil', (_i, patch) => {
    const f = form(patch);
    expect(Object.keys(validateApprovalFields(f, { today })).length === 0).toBe(serverAccepts(f));
  });
});

describe('agrément : lecture et actions', () => {
  it('libellés d’état', () => {
    expect(Object.keys(APPROVAL_STATUS).sort()).toEqual(['CANCELLED', 'EXPIRED', 'HONORED', 'RECEIVED', 'REQUESTED']);
    expect(APPROVAL_STATUS.HONORED!.label).toBe('Honoré');
  });
  it('décrit la couverture : montant, places, ou les deux', () => {
    expect(coverageText({ amount: '12500000.00', currency: 'XAF', places: null }).replace(/[  ]/g, ' ')).toMatch(/^12 500 000/);
    expect(coverageText({ amount: null, currency: 'XAF', places: 1 })).toBe('1 place');
    expect(coverageText({ amount: null, currency: 'XAF', places: 8 })).toBe('8 places');
    expect(coverageText({ amount: '1000.00', currency: 'XAF', places: 3 })).toContain(' · 3 places');
  });
  it('les opportunités éligibles ont franchi l’accord de principe et ne sont pas perdues', () => {
    const items = [opp({ id: 'a', stage: 'NEGOTIATION' }), opp({ id: 'b', stage: 'AGREEMENT_IN_PRINCIPLE' }), opp({ id: 'c', stage: 'ACCREDITATION' }), opp({ id: 'd', stage: 'ACCREDITATION', status: 'LOST' }), opp({ id: 'e', stage: 'ACCREDITATION', status: 'WON' })];
    expect(eligibleOpportunities(items).map((o) => o.id)).toEqual(['b', 'c', 'e']);
  });
  it('seul un agrément reçu se clôt ; honorer et annuler ont chacun leur droit', () => {
    expect(approvalActions({ status: 'RECEIVED' }, { honor: true, cancel: true })).toEqual(['honor', 'expire', 'cancel']);
    expect(approvalActions({ status: 'RECEIVED' }, { honor: false, cancel: true })).toEqual(['expire', 'cancel']);
    expect(approvalActions({ status: 'RECEIVED' }, { honor: true, cancel: false })).toEqual(['honor']);
    expect(approvalActions({ status: 'RECEIVED' }, { honor: false, cancel: false })).toEqual([]);
    for (const status of ['HONORED', 'EXPIRED', 'CANCELLED']) expect(approvalActions({ status }, { honor: true, cancel: true })).toEqual([]);
  });
  it('le motif exige trois caractères et au plus 500', () => {
    expect(validateReason('')).toMatch(/obligatoire/);
    expect(validateReason(' ab ')).toMatch(/obligatoire/);
    expect(validateReason('Erreur de saisie')).toBeNull();
    expect(validateReason('x'.repeat(501))).toMatch(/500/);
  });
});

describe('agrément : demandé et payeur tiers (D41)', () => {
  it('un agrément demandé n’exige ni date de réception ni fichier ; le corps n’envoie pas de date', () => {
    expect(validateApprovalFields(form({ requested: true, receivedOn: '' }), { today })).toEqual({});
    expect(buildApprovalBody(form({ requested: true, receivedOn: '' }))).toEqual({ opportunityId: 'op1', requested: true, amount: '12 500 000', currency: 'XAF' });
  });
  it('le payeur tiers : nom et type ensemble, ou aucun (le client paie) ; le corps les envoie ensemble', () => {
    expect(validateApprovalFields(form({ payerName: 'Banque X' }), { today }).payerName).toMatch(/nom et le type/);
    expect(validateApprovalFields(form({ payerType: 'LANDLORD' }), { today }).payerName).toMatch(/nom et le type/);
    expect(validateApprovalFields(form({ payerName: 'x'.repeat(201), payerType: 'EMPLOYER' }), { today }).payerName).toMatch(/200/);
    expect(buildApprovalBody(form({ payerName: ' Banque X ', payerType: 'ORGANISM' }))).toMatchObject({ payerName: 'Banque X', payerType: 'ORGANISM' });
    expect(buildApprovalBody(form())).not.toHaveProperty('payerName');
    expect(payerText({ payerName: null, payerType: null })).toBe('Le client');
    expect(payerText({ payerName: 'Banque X', payerType: 'ORGANISM' })).toBe('Banque X (Organisme)');
    expect(Object.keys(PAYER_TYPES)).toEqual(['EMPLOYER', 'ORGANISM', 'LANDLORD']);
  });
  it('actions d’un agrément demandé : déclarer reçu (droit de création) et annuler ; ni honorer ni expirer', () => {
    expect(approvalActions({ status: 'REQUESTED' }, { honor: true, cancel: true, receive: true })).toEqual(['receive', 'cancel']);
    expect(approvalActions({ status: 'REQUESTED' }, { honor: true, cancel: false, receive: true })).toEqual(['receive']);
    expect(approvalActions({ status: 'REQUESTED' }, { honor: true, cancel: true })).toEqual(['cancel']);
    expect(approvalActions({ status: 'REQUESTED' }, { honor: true, cancel: false })).toEqual([]);
    expect(APPROVAL_ACTION_LABEL.receive).toBe('Déclarer reçu');
  });
  it('date de réception : obligatoire, réelle, pas future, pas après la fin de validité', () => {
    expect(validateReceivedOn('', { today })).toMatch(/obligatoire/);
    expect(validateReceivedOn('2026-02-31', { today })).toMatch(/pas valide/);
    expect(validateReceivedOn('2026-11-08', { today })).toMatch(/futur/);
    expect(validateReceivedOn('2026-11-05', { today, validUntil: '2026-11-01' })).toMatch(/fin de validité/);
    expect(validateReceivedOn('2026-11-05', { today, validUntil: '2027-03-31' })).toBeNull();
  });
});
