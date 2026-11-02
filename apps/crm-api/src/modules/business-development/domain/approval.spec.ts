import { DomainError } from '../../../shared-kernel';
import { Approval, ApprovalStatus } from './approval';

const now = new Date('2026-11-07T10:00:00Z');
const base = { id: 'a1', companyId: 'c1', opportunityId: 'op1', receivedOn: '2026-11-05', now };
const register = (patch: Partial<Parameters<typeof Approval.register>[0]> = {}) => Approval.register({ ...base, amount: '12500000', ...patch });

describe('Approval — enregistrement', () => {
  it('enregistre un agrément reçu avec montant : devise XAF par défaut, montant à deux décimales, version 1', () => {
    const a = register();
    expect(a).toMatchObject({ status: ApprovalStatus.Received, amount: '12500000.00', currency: 'XAF', places: null, validUntil: null, closedReason: null, closedAt: null, version: 1 });
  });

  it('accepte un nombre de places seul, ou les deux (D1) ; refuse ni l’un ni l’autre', () => {
    expect(register({ amount: undefined, places: 12 })).toMatchObject({ amount: null, places: 12 });
    expect(register({ places: 12 })).toMatchObject({ amount: '12500000.00', places: 12 });
    expect(() => register({ amount: undefined, places: undefined })).toThrow(/montant couvert, le nombre de places/);
    expect(() => register({ amount: '  ', places: null })).toThrow(DomainError);
  });

  it('refuse un montant nul, négatif, mal écrit ou trop précis, et un nombre de places non entier ou nul', () => {
    for (const amount of ['0', '-5', 'abc', '1.234', '1000000000000000']) expect(() => register({ amount })).toThrow(/montant de l'agrément/);
    for (const places of [0, -1, 2.5, 100001]) expect(() => register({ amount: undefined, places })).toThrow(/nombre de places/);
  });

  it('normalise le montant saisi avec espaces et virgule, et la devise (FCFA = XAF)', () => {
    expect(register({ amount: '12 500 000,5' }).amount).toBe('12500000.50');
    expect(register({ currency: 'fcfa' }).currency).toBe('XAF');
    expect(register({ currency: 'eur' }).currency).toBe('EUR');
    expect(() => register({ currency: 'EURO' })).toThrow(/trois lettres/);
  });

  it('refuse une date de réception impossible, mal écrite ou dans le futur', () => {
    expect(() => register({ receivedOn: '2026-02-31' })).toThrow(/date valide/);
    expect(() => register({ receivedOn: '05/11/2026' })).toThrow(/date valide/);
    expect(() => register({ receivedOn: '2026-11-08' })).toThrow(/futur/);
    expect(register({ receivedOn: '2026-11-07' }).receivedOn).toBe('2026-11-07');
  });

  it('la fin de validité est facultative, valide, et ne précède pas la réception', () => {
    expect(register({ validUntil: '2027-03-31' }).validUntil).toBe('2027-03-31');
    expect(register({ validUntil: '' }).validUntil).toBeNull();
    expect(register({ validUntil: '2026-11-05' }).validUntil).toBe('2026-11-05');
    expect(() => register({ validUntil: '2026-11-04' })).toThrow(/précéder/);
    expect(() => register({ validUntil: '2027-13-01' })).toThrow(/date valide/);
  });

  it('exige une entreprise et une opportunité', () => {
    expect(() => register({ companyId: '' })).toThrow(/entreprise/);
    expect(() => register({ opportunityId: '' })).toThrow(/opportunité/);
  });

  it('enregistre l’événement « agrément accordé » destiné à Investudy', () => {
    const events = register().pullEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ name: 'bd.approval.received', aggregateType: 'Approval', aggregateId: 'a1', companyId: 'c1', opportunityId: 'op1' });
  });
});

describe('Approval — cycle', () => {
  it('honorer : reçu → honoré, daté, sans motif', () => {
    const a = register();
    a.honor(now);
    expect(a).toMatchObject({ status: ApprovalStatus.Honored, closedAt: now, closedReason: null });
  });

  it('expirer et annuler exigent un motif de trois caractères au moins, et le conservent', () => {
    const e = register();
    expect(() => e.expire('  ', now)).toThrow(/obligatoire/);
    expect(() => e.expire('ab', now)).toThrow(/obligatoire/);
    expect(e.status).toBe(ApprovalStatus.Received);
    e.expire('Validité dépassée sans paiement', now);
    expect(e).toMatchObject({ status: ApprovalStatus.Expired, closedReason: 'Validité dépassée sans paiement', closedAt: now });
    const c = register();
    expect(() => c.cancel(undefined, now)).toThrow(/obligatoire/);
    expect(() => c.cancel('x'.repeat(501), now)).toThrow(/500/);
    c.cancel('Saisie erronée', now);
    expect(c).toMatchObject({ status: ApprovalStatus.Cancelled, closedReason: 'Saisie erronée' });
  });

  it('honoré, expiré et annulé sont définitifs', () => {
    for (const close of [(a: Approval) => a.honor(now), (a: Approval) => a.expire('Expiré', now), (a: Approval) => a.cancel('Annulé', now)]) {
      const a = register();
      close(a);
      expect(() => a.honor(now)).toThrow(/ne peut plus être honoré/);
      expect(() => a.expire('Encore', now)).toThrow(/ne peut plus être déclaré expiré/);
      expect(() => a.cancel('Encore', now)).toThrow(/ne peut plus être annulé/);
    }
  });

  it('un motif invalide ne laisse aucune modification', () => {
    const a = register();
    expect(() => a.cancel('', now)).toThrow(DomainError);
    expect(a).toMatchObject({ status: ApprovalStatus.Received, closedAt: null, closedReason: null });
  });

  it('signale une validité dépassée sans changer l’état (l’expiration est manuelle, D3)', () => {
    const a = register({ validUntil: '2026-11-06' });
    expect(a.isPastValidity('2026-11-07')).toBe(true);
    expect(a.isPastValidity('2026-11-06')).toBe(false);
    expect(a.status).toBe(ApprovalStatus.Received);
    expect(register().isPastValidity('2099-01-01')).toBe(false);
    a.honor(now);
    expect(a.isPastValidity('2027-01-01')).toBe(false);
  });
});
