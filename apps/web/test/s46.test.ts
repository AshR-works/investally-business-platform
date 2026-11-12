import { describe, expect, it } from 'vitest';
// Cohérence interface ↔ serveur : le domaine RÉEL de la décharge valide les mêmes saisies.
import { Receipt } from '../../api/src/modules/business-development/domain/receipt';
import { availableActions, OFFER_ACTION_LABEL } from '../lib/offers';
import { buildReceiptBody, EMPTY_RECEIPT_FORM, isRealDate, type ReceiptForm, todayIso, validateReceiptFields } from '../lib/receipts';

const now = new Date('2026-11-04T10:00:00Z');
const submitted = new Date('2026-11-02T09:00:00Z');
const context = { today: todayIso(now), submittedOn: '2026-11-02' };
const form = (patch: Partial<ReceiptForm> = {}): ReceiptForm => ({ receivedOn: '2026-11-03', receivedBy: 'Alain Fotso', ...patch });
const serverAccepts = (f: ReceiptForm): boolean => {
  try {
    Receipt.register({ id: 'x', offerId: 'o1', receivedOn: f.receivedOn, receivedBy: f.receivedBy, offerSubmittedAt: submitted, now });
    return true;
  } catch {
    return false;
  }
};

describe('décharges : saisie', () => {
  it('la date du jour est celle de l’UTC, au format AAAA-MM-JJ, et le formulaire vide la propose', () => {
    expect(todayIso(now)).toBe('2026-11-04');
    expect(EMPTY_RECEIPT_FORM(now)).toEqual({ receivedOn: '2026-11-04', receivedBy: '' });
  });
  it('reconnaît les dates qui existent', () => {
    for (const ok of ['2026-11-04', '2028-02-29']) expect(isRealDate(ok), ok).toBe(true);
    for (const bad of ['', '2026-02-31', '2027-02-29', '04/11/2026', '2026-13-01', 'demain']) expect(isRealDate(bad), bad).toBe(false);
  });
  it('signale chaque champ non conforme avec un message précis', () => {
    expect(validateReceiptFields(form(), context)).toEqual({});
    expect(validateReceiptFields(form({ receivedOn: '' }), context).receivedOn).toMatch(/obligatoire/);
    expect(validateReceiptFields(form({ receivedOn: '2026-11-05' }), context).receivedOn).toMatch(/futur/);
    expect(validateReceiptFields(form({ receivedOn: '2026-11-01' }), context).receivedOn).toMatch(/dépôt/);
    expect(validateReceiptFields(form({ receivedOn: '2026-02-31' }), context).receivedOn).toMatch(/valide/);
    expect(validateReceiptFields(form({ receivedBy: '  ' }), context).receivedBy).toMatch(/obligatoire/);
    expect(validateReceiptFields(form({ receivedBy: 'x'.repeat(151) }), context).receivedBy).toMatch(/150/);
  });
  it('sans date de dépôt connue, seule la date future est refusée', () => {
    expect(validateReceiptFields(form({ receivedOn: '2020-01-01' }), { today: context.today, submittedOn: null })).toEqual({});
  });
  it('corps de la requête : l’offre, la date et le nom, sans espaces superflus', () => {
    expect(buildReceiptBody('o1', form({ receivedBy: '  Alain Fotso ' }))).toEqual({ offerId: 'o1', receivedOn: '2026-11-03', receivedBy: 'Alain Fotso' });
  });
});

describe('décharges : mêmes règles que le domaine réel du serveur', () => {
  it.each([
    [{}], [{ receivedOn: '2026-11-02' }], [{ receivedOn: '2026-11-04' }], [{ receivedOn: '2026-11-05' }], [{ receivedOn: '2026-11-01' }],
    [{ receivedOn: '' }], [{ receivedOn: '2026-02-31' }], [{ receivedOn: '03/11/2026' }], [{ receivedOn: 'demain' }],
    [{ receivedBy: '' }], [{ receivedBy: '   ' }], [{ receivedBy: 'x'.repeat(150) }], [{ receivedBy: 'x'.repeat(151) }],
  ])('%j : l’interface et le serveur répondent pareil', (patch) => {
    const f = form(patch);
    expect(Object.keys(validateReceiptFields(f, context)).length === 0, JSON.stringify(patch)).toBe(serverAccepts(f));
  });
});

describe('offres : actions liées aux décharges et aux documents', () => {
  const all = { update: true, withdraw: true, receiptRead: true, documentsRead: true };
  it('une offre déposée propose la décharge avant la réponse du client', () => {
    expect(availableActions('SUBMITTED', all)).toEqual(['receipt', 'accept', 'refuse', 'withdraw', 'documents']);
    expect(availableActions('RECEIPT_RECEIVED', all)).toEqual(['receipt', 'accept', 'refuse', 'withdraw', 'documents']);
  });
  it('un brouillon n’a pas de décharge ; une offre définitive ne garde que la consultation', () => {
    expect(availableActions('DRAFT', all)).toEqual(['edit', 'submit', 'withdraw', 'documents']);
    for (const status of ['ACCEPTED', 'REFUSED', 'WITHDRAWN']) expect(availableActions(status, all), status).toEqual(['receipt', 'documents']);
    expect(availableActions('INCONNU', all)).toEqual(['documents']);
  });
  it('sans le droit de lire les décharges ou les documents, ces entrées disparaissent', () => {
    expect(availableActions('SUBMITTED', { update: true, withdraw: true })).toEqual(['accept', 'refuse', 'withdraw']);
    expect(availableActions('ACCEPTED', { update: true, withdraw: true })).toEqual([]);
    expect(availableActions('SUBMITTED', { update: false, withdraw: false, receiptRead: true })).toEqual(['receipt']);
  });
  it('chaque action a un libellé français', () => {
    expect(OFFER_ACTION_LABEL.receipt).toBe('Décharge signée');
    expect(OFFER_ACTION_LABEL.documents).toBe('Documents de l’offre');
    expect(Object.values(OFFER_ACTION_LABEL).every((l) => l.length > 3)).toBe(true);
  });
});
