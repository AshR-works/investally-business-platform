import { describe, expect, it } from 'vitest';
// Cohérence interface ↔ serveur : le domaine RÉEL de l'offre valide les mêmes saisies.
import { Offer as OfferDomain, OfferStatus } from '../../api/src/modules/business-development/domain/offer';
import { availableActions, buildOfferBody, EMPTY_OFFER_FORM, formatAmount, formFromOffer, isValidAmount, normalizeAmount, validateOfferFields } from '../lib/offers';
import { OFFER_STATUS } from '../lib/status';
import type { Offer } from '../lib/types';

const form = (patch: Partial<typeof EMPTY_OFFER_FORM> = {}) => ({ ...EMPTY_OFFER_FORM, companyId: 'c1', subject: 'Formation', amount: '4 500 000', ...patch });
const offer: Offer = {
  id: 'o1', reference: 'OFF-2026-0001', companyId: 'c1', companyName: 'Atlas', subject: 'Formation', amount: '4500000.00', currency: 'XAF', status: 'DRAFT',
  note: null, submittedAt: null, decidedAt: null, withdrawnReason: null, createdAt: '2026-10-30T10:00:00Z', version: 3,
};

describe('offres : montants', () => {
  it('normalise la saisie : espaces retirés, virgule en point', () => {
    expect(normalizeAmount('4 500 000,5')).toBe('4500000.5');
    expect(normalizeAmount(' 12 ')).toBe('12');
  });
  it('accepte un montant positif à deux décimales au plus, refuse le reste', () => {
    for (const ok of ['1', '4 500 000', '1250,50', '0.01', '999999999999']) expect(isValidAmount(ok), ok).toBe(true);
    for (const bad of ['', '0', '0,00', '-5', 'abc', '1.234', '1 000 000 000 000 0', '1e5', '12,', ',5']) expect(isValidAmount(bad), bad).toBe(false);
  });
  it('affiche « FCFA » pour XAF, les autres devises telles quelles, les décimales seulement si elles existent', () => {
    expect(formatAmount('4500000.00', 'XAF').replace(/\s/g, ' ')).toBe('4 500 000 FCFA');
    expect(formatAmount('1250.50', 'EUR').replace(/\s/g, ' ')).toBe('1 250,50 EUR');
    expect(formatAmount('pas un nombre', 'XAF')).toBe('—');
  });
});

describe('offres : saisie', () => {
  it('une saisie complète est valide', () => {
    expect(validateOfferFields(form())).toEqual({});
  });
  it('signale chaque champ non conforme, dans l’ordre de la page', () => {
    const errors = validateOfferFields({ companyId: '', subject: '  ', amount: '-3', currency: 'EURO', note: 'x'.repeat(1001) });
    expect(Object.keys(errors)).toEqual(['companyId', 'subject', 'amount', 'currency', 'note']);
  });
  it('objet trop long, montant absent, devise « FCFA » acceptée', () => {
    expect(validateOfferFields(form({ subject: 'x'.repeat(201) })).subject).toMatch(/200/);
    expect(validateOfferFields(form({ amount: '' })).amount).toMatch(/obligatoire/);
    expect(validateOfferFields(form({ currency: 'fcfa' })).currency).toBeUndefined();
    expect(validateOfferFields(form({ currency: '' })).currency).toBeUndefined();
  });
  it('corps de création : entreprise incluse, montant normalisé, note vide omise', () => {
    const body = buildOfferBody(form({ amount: '4 500 000,50', currency: 'xaf' }));
    expect(body).toEqual({ subject: 'Formation', amount: '4500000.50', currency: 'XAF', companyId: 'c1' });
  });
  it('corps de modification : version lue, jamais l’entreprise, note vidée envoyée vide pour être effacée', () => {
    const body = buildOfferBody(form({ note: '' }), { version: 3 });
    expect(body).toEqual({ subject: 'Formation', amount: '4500000', currency: 'XAF', note: '', version: 3 });
    expect(body).not.toHaveProperty('companyId');
  });
  it('préremplit la modification avec l’offre', () => {
    expect(formFromOffer({ ...offer, note: 'à relire' })).toEqual({ companyId: 'c1', subject: 'Formation', amount: '4500000.00', currency: 'XAF', note: 'à relire' });
  });
});

describe('offres : actions disponibles selon l’état et les droits', () => {
  const all = { update: true, withdraw: true };
  it('un brouillon se modifie, se dépose ou se retire', () => {
    expect(availableActions('DRAFT', all)).toEqual(['edit', 'submit', 'withdraw']);
  });
  it('une offre déposée ou à décharge reçue attend la réponse du client ou se retire', () => {
    expect(availableActions('SUBMITTED', all)).toEqual(['accept', 'refuse', 'withdraw']);
    expect(availableActions('RECEIPT_RECEIVED', all)).toEqual(['accept', 'refuse', 'withdraw']);
  });
  it('les états définitifs n’ont aucune action, même pour qui a tous les droits', () => {
    for (const status of ['ACCEPTED', 'REFUSED', 'WITHDRAWN', 'INCONNU']) expect(availableActions(status, all), status).toEqual([]);
  });
  it('sans le droit de modifier : seul le retrait reste proposé ; sans aucun droit : rien', () => {
    expect(availableActions('DRAFT', { update: false, withdraw: true })).toEqual(['withdraw']);
    expect(availableActions('SUBMITTED', { update: false, withdraw: true })).toEqual(['withdraw']);
    expect(availableActions('DRAFT', { update: true, withdraw: false })).toEqual(['edit', 'submit']);
    expect(availableActions('SUBMITTED', { update: false, withdraw: false })).toEqual([]);
  });
});

describe('offres : états affichés', () => {
  it('chaque état de l’API a un libellé français ; le sens ne repose jamais sur la seule couleur', () => {
    expect(Object.keys(OFFER_STATUS).sort()).toEqual(['ACCEPTED', 'DRAFT', 'RECEIPT_RECEIVED', 'REFUSED', 'SUBMITTED', 'WITHDRAWN']);
    expect(OFFER_STATUS.RECEIPT_RECEIVED?.label).toBe('Décharge reçue');
    expect(new Set(Object.values(OFFER_STATUS).map((s) => s.label)).size).toBe(6);
  });
});

const serverAccepts = (f: ReturnType<typeof form>): boolean => {
  try {
    OfferDomain.create({ id: 'x', reference: 'OFF-2026-0001', companyId: f.companyId, subject: f.subject, amount: f.amount, currency: f.currency, note: f.note, now: new Date() });
    return true;
  } catch {
    return false;
  }
};

describe('offres : mêmes règles de saisie que le domaine réel du serveur', () => {
  it.each([
    [{}], [{ subject: '' }], [{ subject: '   ' }], [{ subject: 'x'.repeat(200) }], [{ subject: 'x'.repeat(201) }],
    [{ amount: '' }], [{ amount: '0' }], [{ amount: '-5' }], [{ amount: 'abc' }], [{ amount: '1,5' }], [{ amount: '1.234' }], [{ amount: '4 500 000' }], [{ amount: '999999999999' }], [{ amount: '9999999999999' }],
    [{ currency: '' }], [{ currency: 'fcfa' }], [{ currency: 'EUR' }], [{ currency: 'EURO' }], [{ currency: '12' }],
    [{ note: 'x'.repeat(1000) }], [{ note: 'x'.repeat(1001) }],
  ])('%j : l’interface et le serveur répondent pareil', (patch) => {
    const f = form(patch);
    expect(Object.keys(validateOfferFields(f)).length === 0, JSON.stringify(patch)).toBe(serverAccepts(f));
  });
  it('les états de l’interface sont exactement ceux du serveur', () => {
    expect(Object.keys(OFFER_STATUS).sort()).toEqual(Object.values(OfferStatus).sort());
  });
});
