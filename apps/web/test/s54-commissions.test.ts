import { describe, expect, it } from 'vitest';
// Cohérence interface ↔ serveur : le domaine RÉEL du versement valide les mêmes saisies.
import { CommissionPayout } from '../../api/src/modules/business-development/domain/commission-payout';
import {
  PAYOUT_ACTION_LABEL, PAYOUT_STATUS, PAYOUT_STATUS_OPTIONS, payoutActions, payoutAmountText, payoutDefinitionText, validatePaidOn, validatePayoutAmount,
  type PayoutRights,
} from '../lib/commissions';
import { MODULES } from '../lib/modules';

const finance: PayoutRights = { release: true, pay: false, manage: false };
const accountManager: PayoutRights = { release: false, pay: true, manage: false };
const headOfSales: PayoutRights = { release: false, pay: true, manage: true };
const direction: PayoutRights = { release: false, pay: false, manage: false };
const payout = (status: string, amount: string | null = '150000.00') => ({ status, amount });

describe('commission : lecture', () => {
  it('libellés d’état : cinq états, filtre complet', () => {
    expect(Object.keys(PAYOUT_STATUS)).toEqual(['DUE', 'ON_HOLD', 'RELEASED', 'PAID', 'CANCELLED']);
    expect(PAYOUT_STATUS.RELEASED!.label).toBe('Fonds débloqués');
    expect(PAYOUT_STATUS_OPTIONS.map((o) => o.value)).toEqual(Object.keys(PAYOUT_STATUS));
  });

  it('montant : formaté dans sa devise, ou « À fixer » tant qu’il manque', () => {
    expect(payoutAmountText({ amount: '150000.00', currency: 'XAF' }).replace(/[  ]/g, ' ')).toMatch(/^150 000/);
    expect(payoutAmountText({ amount: null, currency: 'XAF' })).toBe('À fixer');
  });

  it('définition figée : pourcentage ou montant fixe', () => {
    expect(payoutDefinitionText({ commissionType: 'PERCENT', commissionValue: '5.00', commissionCurrency: null })).toBe('5 %');
    expect(payoutDefinitionText({ commissionType: 'PERCENT', commissionValue: '2.50', commissionCurrency: null })).toBe('2,5 %');
    expect(payoutDefinitionText({ commissionType: 'FIXED', commissionValue: '150000.00', commissionCurrency: 'XAF' }).replace(/[  ]/g, ' ')).toMatch(/^150 000/);
  });

  it('le module « Commissions » est au hub, sous le droit de lecture', () => {
    const module = MODULES.find((m) => m.id === 'commissions');
    expect(module).toMatchObject({ href: '/commissions', permission: 'bd.commission.read' });
  });
});

describe('commission : actions selon l’état et les droits', () => {
  it('la Finance débloque ou suspend une commission à verser ou en attente, seulement si le montant existe pour débloquer', () => {
    expect(payoutActions(payout('DUE'), finance)).toEqual(['release', 'hold']);
    expect(payoutActions(payout('ON_HOLD'), finance)).toEqual(['release', 'hold']);
    expect(payoutActions(payout('DUE', null), finance)).toEqual(['hold']);
    for (const status of ['RELEASED', 'PAID', 'CANCELLED']) expect(payoutActions(payout(status), finance)).toEqual([]);
  });

  it('le chargé de compte ne verse que des fonds débloqués', () => {
    expect(payoutActions(payout('RELEASED'), accountManager)).toEqual(['pay']);
    for (const status of ['DUE', 'ON_HOLD', 'PAID', 'CANCELLED']) expect(payoutActions(payout(status), accountManager)).toEqual([]);
  });

  it('le Responsable commercial verse, annule avant le versement, et fixe un montant manquant', () => {
    expect(payoutActions(payout('DUE'), headOfSales)).toEqual(['cancel']);
    expect(payoutActions(payout('DUE', null), headOfSales)).toEqual(['amount', 'cancel']);
    expect(payoutActions(payout('RELEASED'), headOfSales)).toEqual(['pay', 'cancel']);
    expect(payoutActions(payout('PAID'), headOfSales)).toEqual([]);
    expect(payoutActions(payout('CANCELLED'), headOfSales)).toEqual([]);
  });

  it('la Direction (lecture seule) n’a aucune action ; chaque action a son libellé', () => {
    for (const status of Object.keys(PAYOUT_STATUS)) expect(payoutActions(payout(status), direction)).toEqual([]);
    expect(Object.keys(PAYOUT_ACTION_LABEL).sort()).toEqual(['amount', 'cancel', 'hold', 'pay', 'release']);
  });
});

describe('commission : saisie', () => {
  it('date de versement : obligatoire, réelle, pas dans le futur', () => {
    const today = '2026-11-10';
    expect(validatePaidOn('', today)).toMatch(/obligatoire/);
    expect(validatePaidOn('2026-02-31', today)).toMatch(/pas valide/);
    expect(validatePaidOn('2026-11-11', today)).toMatch(/futur/);
    expect(validatePaidOn('2026-11-10', today)).toBeNull();
    expect(validatePaidOn('2026-11-01', today)).toBeNull();
  });

  it('montant à fixer : positif, deux décimales au plus ; même décision que le domaine réel du serveur', () => {
    const cases = ['', '0', '-5', 'abc', '1.234', '250000', '250 000,50', '99999999999.99', '1000000000000'];
    for (const text of cases) {
      const ui = validatePayoutAmount(text) === null;
      let server = true;
      try {
        CommissionPayout.due({ id: 'p', companyId: 'c', facilitatorId: 'f', approvalId: 'a', commission: { type: 'PERCENT' as never, value: '5.00', currency: null }, approvalAmount: null, approvalCurrency: 'XAF', now: new Date() }).fixAmount(text);
      } catch {
        server = false;
      }
      expect([text, ui]).toEqual([text, server]);
    }
  });
});
