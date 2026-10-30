import { Offer, OfferStatus } from './offer';

const now = new Date('2026-10-30T10:00:00Z');
const draft = (extra: Record<string, unknown> = {}) =>
  Offer.create({ id: 'o1', reference: 'OFF-2026-0001', companyId: 'c1', subject: 'Formation analyse financière', amount: '4 500 000', now, ...extra });

describe('Offre — création', () => {
  it('commence en brouillon, montant à deux décimales, devise XAF par défaut, version 1', () => {
    const o = draft();
    expect(o).toMatchObject({ status: OfferStatus.Draft, amount: '4500000.00', currency: 'XAF', version: 1, submittedAt: null, note: null });
  });
  it('accepte la virgule décimale, « FCFA » (= XAF) et une autre devise en trois lettres', () => {
    expect(draft({ amount: '1250,5' }).amount).toBe('1250.50');
    expect(draft({ currency: 'fcfa' }).currency).toBe('XAF');
    expect(draft({ currency: 'eur' }).currency).toBe('EUR');
  });
  it.each([
    [{ subject: '' }], [{ subject: '   ' }], [{ subject: 'x'.repeat(201) }], [{ amount: '0' }], [{ amount: '-5' }], [{ amount: 'abc' }],
    [{ amount: '1.234' }], [{ amount: '1234567890123' }], [{ currency: 'EURO' }], [{ currency: '12' }], [{ note: 'x'.repeat(1001) }], [{ companyId: '' }],
  ])('refuse %j', (patch) => {
    expect(() => draft(patch)).toThrow(expect.objectContaining({ code: 'VALIDATION' }));
  });
});

describe('Offre — modification', () => {
  it('un brouillon se modifie champ par champ ; absent = inchangé, note vide = effacée', () => {
    const o = draft({ note: 'à relire' });
    o.edit({ subject: '  Nouvel   objet ', amount: '100' });
    expect(o).toMatchObject({ subject: 'Nouvel objet', amount: '100.00', note: 'à relire' });
    o.edit({ note: '' });
    expect(o.note).toBeNull();
  });
  it('tout ou rien : une erreur de saisie ne modifie aucun champ', () => {
    const o = draft();
    expect(() => o.edit({ subject: 'Valide', amount: 'xx' })).toThrow();
    expect(o.subject).toBe('Formation analyse financière');
  });
  it.each([OfferStatus.Submitted, OfferStatus.Accepted, OfferStatus.Refused, OfferStatus.Withdrawn])('une offre %s ne se modifie plus', (status) => {
    const o = Offer.rehydrate({ ...snapshot(draft()), status, submittedAt: status === OfferStatus.Withdrawn ? null : now, withdrawnReason: status === OfferStatus.Withdrawn ? 'motif' : null });
    expect(() => o.edit({ subject: 'Autre' })).toThrow(expect.objectContaining({ code: 'INVARIANT_VIOLATION' }));
  });
});

function snapshot(o: Offer) {
  return {
    id: o.id, reference: o.reference, companyId: o.companyId, subject: o.subject, amount: o.amount, currency: o.currency, status: o.status,
    note: o.note, submittedAt: o.submittedAt, decidedAt: o.decidedAt, withdrawnReason: o.withdrawnReason, createdAt: o.createdAt, version: o.version,
  };
}

describe('Offre — transitions', () => {
  it('brouillon → déposée (date de dépôt) → acceptée (date de réponse)', () => {
    const o = draft();
    o.submit(now);
    expect(o).toMatchObject({ status: OfferStatus.Submitted, submittedAt: now, isOpen: true });
    const later = new Date('2026-11-02T08:00:00Z');
    o.accept(later);
    expect(o).toMatchObject({ status: OfferStatus.Accepted, decidedAt: later, isOpen: false });
  });
  it('déposée → décharge reçue → refusée', () => {
    const o = draft();
    o.submit(now);
    o.receiptReceived();
    expect(o.status).toBe(OfferStatus.ReceiptReceived);
    o.refuse(now);
    expect(o.status).toBe(OfferStatus.Refused);
  });
  it('un brouillon ne peut ni être accepté, ni refusé, ni marqué « décharge reçue »', () => {
    for (const act of [(o: Offer) => o.accept(now), (o: Offer) => o.refuse(now), (o: Offer) => o.receiptReceived()]) {
      expect(() => act(draft())).toThrow(expect.objectContaining({ code: 'INVARIANT_VIOLATION' }));
    }
  });
  it('on ne dépose qu’une fois', () => {
    const o = draft();
    o.submit(now);
    expect(() => o.submit(now)).toThrow(expect.objectContaining({ code: 'INVARIANT_VIOLATION' }));
  });
  it('les états définitifs ne bougent plus', () => {
    const accepted = draft(); accepted.submit(now); accepted.accept(now);
    for (const act of [(o: Offer) => o.accept(now), (o: Offer) => o.refuse(now), (o: Offer) => o.withdraw('motif', now), (o: Offer) => o.submit(now)]) {
      expect(() => act(accepted)).toThrow(expect.objectContaining({ code: 'INVARIANT_VIOLATION' }));
    }
  });
  it('retrait : motif obligatoire, possible en brouillon, déposée ou décharge reçue, pas après la réponse du client', () => {
    const a = draft();
    expect(() => a.withdraw('', now)).toThrow(expect.objectContaining({ code: 'VALIDATION' }));
    expect(() => a.withdraw('ok', now)).toThrow(expect.objectContaining({ code: 'VALIDATION' }));
    expect(() => a.withdraw('x'.repeat(501), now)).toThrow(expect.objectContaining({ code: 'VALIDATION' }));
    a.withdraw('  Client indisponible ', now);
    expect(a).toMatchObject({ status: OfferStatus.Withdrawn, withdrawnReason: 'Client indisponible', decidedAt: now });
    const b = draft(); b.submit(now); b.receiptReceived(); b.withdraw('Offre remplacée', now);
    expect(b.status).toBe(OfferStatus.Withdrawn);
    const c = draft(); c.submit(now); c.refuse(now);
    expect(() => c.withdraw('trop tard', now)).toThrow(expect.objectContaining({ code: 'INVARIANT_VIOLATION' }));
  });
  it('un retrait refusé ne change rien à l’offre (motif invalide)', () => {
    const o = draft();
    expect(() => o.withdraw('', now)).toThrow();
    expect(o).toMatchObject({ status: OfferStatus.Draft, withdrawnReason: null });
  });
});
