import { DomainError } from '../../../shared-kernel';
import { CommissionType } from './commission';
import { CommissionPayout, PayoutStatus, percentOf } from './commission-payout';

const now = new Date('2026-11-10T10:00:00Z');
const base = { id: 'p1', companyId: 'c1', facilitatorId: 'f1', approvalId: 'a1', approvalCurrency: 'XAF', now };
const fixed = (value = '150000.00', currency: string | null = 'XAF') => ({ type: CommissionType.Fixed, value, currency });
const percent = (value = '5.00') => ({ type: CommissionType.Percent, value, currency: null });
const due = (commission = fixed(), approvalAmount: string | null = '12500000.00') => CommissionPayout.due({ ...base, commission, approvalAmount });
const released = () => { const p = due(); p.release(); return p; };

describe('percentOf — pourcentage d’un montant, arrondi au centime', () => {
  it('calcule en entiers, sans flottant', () => {
    expect(percentOf('12500000.00', '5.00')).toBe('625000.00');
    expect(percentOf('12500000.00', '3.33')).toBe('416250.00');
    expect(percentOf('100.00', '12.50')).toBe('12.50');
    expect(percentOf('0.10', '10.00')).toBe('0.01');
    expect(percentOf('0.05', '50.00')).toBe('0.03'); // 0,025 arrondi au plus proche, vers le haut
    expect(percentOf('99999999999.99', '100.00')).toBe('99999999999.99');
  });
});

describe('CommissionPayout — naissance', () => {
  it('un montant fixe est repris tel quel, dans sa devise ; l’état est « à verser » et la version 1', () => {
    expect(due(fixed('150000.00', 'EUR'))).toMatchObject({ status: PayoutStatus.Due, amount: '150000.00', currency: 'EUR', commissionType: 'FIXED', commissionValue: '150000.00', version: 1, paidOn: null });
  });

  it('un pourcentage s’applique au montant de l’agrément, dans sa devise', () => {
    expect(due(percent('5.00'), '12500000.00')).toMatchObject({ amount: '625000.00', currency: 'XAF', commissionType: 'PERCENT', commissionCurrency: null });
    expect(CommissionPayout.due({ ...base, approvalCurrency: 'EUR', commission: percent('10.00'), approvalAmount: '2000.00' })).toMatchObject({ amount: '200.00', currency: 'EUR' });
  });

  it('un pourcentage sans montant d’agrément (places seules) laisse le montant à fixer', () => {
    expect(due(percent('5.00'), null)).toMatchObject({ amount: null, status: PayoutStatus.Due });
  });

  it('refuse une commission calculée nulle (aucun versement à créer)', () => {
    expect(() => due(percent('0.01'), '0.10')).toThrow(DomainError);
  });
});

describe('CommissionPayout — montant à fixer', () => {
  it('se fixe une fois, avant le déblocage ; ensuite il est figé', () => {
    const p = due(percent('5.00'), null);
    expect(() => p.release()).toThrow(/montant de la commission est à fixer/);
    p.fixAmount('250 000,50');
    expect(p.amount).toBe('250000.50');
    expect(() => p.fixAmount('300000')).toThrow(/figé/);
  });

  it('refuse un montant nul, négatif ou mal écrit ; refuse hors des états « à verser » et « en attente »', () => {
    for (const bad of ['0', '-5', 'abc', '1.234', '']) expect(() => due(percent(), null).fixAmount(bad)).toThrow(DomainError);
    const p = due(percent(), null);
    p.cancel('Erreur');
    expect(() => p.fixAmount('1000')).toThrow(/annulée/);
  });
});

describe('CommissionPayout — déblocage et attente', () => {
  it('débloque depuis « à verser » ; le motif d’attente disparaît', () => {
    const p = due();
    p.hold('En attente du virement du client');
    expect(p).toMatchObject({ status: PayoutStatus.OnHold, holdReason: 'En attente du virement du client' });
    p.release();
    expect(p).toMatchObject({ status: PayoutStatus.Released, holdReason: null });
  });

  it('la mise en attente exige un motif (3 à 500 caractères) ; elle se répète avec un nouveau motif', () => {
    expect(() => due().hold(undefined)).toThrow(/motif/);
    expect(() => due().hold(' ab ')).toThrow(/motif/);
    expect(() => due().hold('x'.repeat(501))).toThrow(/500/);
    const p = due();
    p.hold('Premier motif');
    p.hold('Second motif');
    expect(p.holdReason).toBe('Second motif');
  });

  it('débloquer ou suspendre une commission déjà débloquée, versée ou annulée est refusé', () => {
    expect(() => released().release()).toThrow(/ne peut plus être débloquée/);
    expect(() => released().hold('Trop tard')).toThrow(/ne peut plus être mise en attente/);
  });
});

describe('CommissionPayout — versement', () => {
  it('se constate fonds débloqués, justificatif déposé, avec une date réelle non future', () => {
    const p = released();
    p.pay('2026-11-09', true, now);
    expect(p).toMatchObject({ status: PayoutStatus.Paid, paidOn: '2026-11-09' });
  });

  it('refuse sans fonds débloqués, sans justificatif, avec une date future ou invalide, ou deux fois', () => {
    expect(() => due().pay('2026-11-09', true, now)).toThrow(/fonds ne sont pas débloqués/);
    expect(() => released().pay('2026-11-09', false, now)).toThrow(/justificatif/);
    expect(() => released().pay('2026-11-11', true, now)).toThrow(/futur/);
    expect(() => released().pay('2026-02-31', true, now)).toThrow(/date valide/);
    expect(() => released().pay('', true, now)).toThrow(/date valide/);
    const p = released();
    p.pay('2026-11-10', true, now);
    expect(() => p.pay('2026-11-10', true, now)).toThrow(/déjà versée/);
  });
});

describe('CommissionPayout — annulation', () => {
  it('annule avec un motif depuis « à verser », « en attente » ou « débloquée » ; jamais après le versement', () => {
    for (const make of [() => due(), () => { const p = due(); p.hold('Attente'); return p; }, released]) {
      const p = make();
      p.cancel('Erreur de saisie');
      expect(p).toMatchObject({ status: PayoutStatus.Cancelled, cancelledReason: 'Erreur de saisie', holdReason: null });
    }
    const paid = released();
    paid.pay('2026-11-10', true, now);
    expect(() => paid.cancel('Trop tard')).toThrow(/versée/);
    const cancelled = due();
    cancelled.cancel('Une fois');
    expect(() => cancelled.cancel('Deux fois')).toThrow(/annulée/);
  });

  it('exige un motif', () => {
    expect(() => due().cancel(undefined)).toThrow(/motif/);
    expect(() => due().cancel('x'.repeat(501))).toThrow(/500/);
  });
});
