import { Receipt, ReceiptStatus } from './receipt';

const now = new Date('2026-11-04T10:00:00Z');
const submitted = new Date('2026-11-02T09:00:00Z');
const make = (extra: Record<string, unknown> = {}) =>
  Receipt.register({ id: 'r1', offerId: 'o1', receivedOn: '2026-11-03', receivedBy: '  Alain   Fotso ', offerSubmittedAt: submitted, now, ...extra });

describe('Décharge — enregistrement', () => {
  it('est valide dès l’enregistrement ; le nom est nettoyé, la version vaut 1', () => {
    expect(make()).toMatchObject({ status: ReceiptStatus.Valid, receivedOn: '2026-11-03', receivedBy: 'Alain Fotso', version: 1, cancelledReason: null, cancelledAt: null });
  });
  it('accepte le jour du dépôt et le jour même', () => {
    expect(make({ receivedOn: '2026-11-02' }).receivedOn).toBe('2026-11-02');
    expect(make({ receivedOn: '2026-11-04' }).receivedOn).toBe('2026-11-04');
  });
  it.each([
    [{ receivedOn: '2026-11-05' }, 'futur'],
    [{ receivedOn: '2026-11-01' }, 'avant le dépôt'],
    [{ receivedOn: '2026-02-31' }, 'date inexistante'],
    [{ receivedOn: '03/11/2026' }, 'format'],
    [{ receivedOn: '' }, 'vide'],
    [{ receivedBy: '' }, 'nom vide'],
    [{ receivedBy: '   ' }, 'nom blanc'],
    [{ receivedBy: 'x'.repeat(151) }, 'nom trop long'],
    [{ offerId: '' }, 'sans offre'],
  ] as [Record<string, unknown>, string][])('refuse %j (%s)', (patch) => {
    expect(() => make(patch)).toThrow(expect.objectContaining({ code: 'VALIDATION' }));
  });
  it('sans date de dépôt connue, seule la date future est refusée', () => {
    expect(make({ offerSubmittedAt: null, receivedOn: '2020-01-01' }).receivedOn).toBe('2020-01-01');
  });
});

describe('Décharge — annulation', () => {
  it('annule avec un motif nettoyé et une date', () => {
    const r = make();
    r.cancel('  Mauvais fichier  ', now);
    expect(r).toMatchObject({ status: ReceiptStatus.Cancelled, cancelledReason: 'Mauvais fichier', cancelledAt: now });
  });
  it.each([[undefined], [''], ['ok'], ['x'.repeat(501)]])('refuse le motif %j sans rien changer', (reason) => {
    const r = make();
    expect(() => r.cancel(reason as string | undefined, now)).toThrow(expect.objectContaining({ code: 'VALIDATION' }));
    expect(r.status).toBe(ReceiptStatus.Valid);
  });
  it('une décharge annulée ne s’annule pas deux fois', () => {
    const r = make();
    r.cancel('Mauvais fichier', now);
    expect(() => r.cancel('Encore', now)).toThrow(expect.objectContaining({ code: 'INVARIANT_VIOLATION' }));
    expect(r.cancelledReason).toBe('Mauvais fichier');
  });
});
