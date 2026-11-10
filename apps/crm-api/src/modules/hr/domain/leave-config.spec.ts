import { DEFAULT_LEAVE_SETTINGS, LeaveType, validateAdjustment, validateHoliday, validateLeaveSettings } from './leave-config';

const now = new Date('2026-11-10T09:00:00Z');
const settings = { accrualDaysPerMonth: 1.5, countsSaturday: false, allowHalfDays: true, allowNegativeBalance: false };

describe('règles de congés', () => {
  it('les valeurs de départ sont celles du cadrage (« à confirmer »)', () => {
    expect(DEFAULT_LEAVE_SETTINGS).toEqual({ accrualDaysPerMonth: 1.5, countsSaturday: false, allowHalfDays: true, allowNegativeBalance: false, version: 1 });
  });

  it('accepte un nombre de jours par mois entre 0 et 5, au centième', () => {
    for (const ok of [0, 1.5, 2.5, 5, 1.25, 0.01]) expect(() => validateLeaveSettings({ ...settings, accrualDaysPerMonth: ok })).not.toThrow();
  });

  it('refuse un nombre hors bornes, au-delà du centième, ou qui n’en est pas un', () => {
    for (const bad of [-0.01, 5.01, 6, 1.234, Number.NaN, Number.POSITIVE_INFINITY, '1.5' as unknown as number, null as unknown as number]) {
      expect(() => validateLeaveSettings({ ...settings, accrualDaysPerMonth: bad })).toThrow(/jours acquis/);
    }
  });
});

describe('type d’absence', () => {
  const make = (extra: Record<string, unknown> = {}) => LeaveType.create({ id: 't1', code: 'study', label: '  Congé   formation ', now, ...extra } as Parameters<typeof LeaveType.create>[0]);

  it('crée un type actif, code en majuscules, libellé nettoyé, valeurs de départ prudentes', () => {
    expect(make()).toMatchObject({ code: 'STUDY', label: 'Congé formation', deductsBalance: false, requiresApproval: true, maxDaysPerRequest: null, active: true, sortOrder: 100, version: 1, createdAt: now });
  });

  it('lit les options données', () => {
    expect(make({ deductsBalance: true, requiresApproval: false, maxDaysPerRequest: 3, sortOrder: 5 })).toMatchObject({ deductsBalance: true, requiresApproval: false, maxDaysPerRequest: 3, sortOrder: 5 });
  });

  it('refuse un code mal formé', () => {
    for (const bad of ['', 'a', '1ABC', 'A B', 'A-B', 'é', 'A'.repeat(31), '_AB']) expect(() => make({ code: bad })).toThrow(/code/);
    expect(make({ code: 'AB' }).code).toBe('AB');
    expect(make({ code: 'A'.repeat(30) }).code).toHaveLength(30);
  });

  it('refuse un libellé vide ou trop long', () => {
    expect(() => make({ label: '   ' })).toThrow(/libellé/);
    expect(() => make({ label: 'x'.repeat(101) })).toThrow(/100/);
    expect(make({ label: 'x'.repeat(100) }).label).toHaveLength(100);
  });

  it('refuse une durée maximale qui n’est pas un nombre positif par demi-journée de 365 au plus', () => {
    for (const bad of [0, -1, 0.3, 366, Number.NaN]) expect(() => make({ maxDaysPerRequest: bad })).toThrow(/durée maximale/);
    expect(make({ maxDaysPerRequest: 0.5 }).maxDaysPerRequest).toBe(0.5);
    expect(make({ maxDaysPerRequest: 365 }).maxDaysPerRequest).toBe(365);
    expect(make({ maxDaysPerRequest: null }).maxDaysPerRequest).toBeNull();
  });

  it('se modifie champ par champ, le code ne change jamais, `null` retire le plafond', () => {
    const t = make({ maxDaysPerRequest: 3 });
    t.update({ label: 'Formation', deductsBalance: true, requiresApproval: false, active: false, sortOrder: 7 });
    expect(t).toMatchObject({ code: 'STUDY', label: 'Formation', deductsBalance: true, requiresApproval: false, active: false, sortOrder: 7, maxDaysPerRequest: 3 });
    t.update({ maxDaysPerRequest: null });
    expect(t.maxDaysPerRequest).toBeNull();
    t.update({});
    expect(t.label).toBe('Formation');
  });

  it('une modification refusée ne laisse rien derrière elle', () => {
    const t = make();
    expect(() => t.update({ label: 'Nouveau', sortOrder: -1 })).toThrow(/ordre/);
    expect(t.label).toBe('Congé formation');
    for (const bad of [-1, 10_001, 1.5]) expect(() => t.update({ sortOrder: bad })).toThrow(/ordre/);
    expect(() => t.update({ label: '' })).toThrow(/libellé/);
    expect(() => t.update({ maxDaysPerRequest: 0 })).toThrow(/durée maximale/);
  });

  it('se reconstitue depuis la persistance', () => {
    const t = LeaveType.rehydrate({ id: 'x', code: 'ANNUAL', label: 'Congé annuel', deductsBalance: true, requiresApproval: true, maxDaysPerRequest: null, active: true, sortOrder: 10, version: 4, createdAt: now });
    expect(t).toMatchObject({ code: 'ANNUAL', version: 4, deductsBalance: true });
  });
});

describe('jour férié', () => {
  it('valide une date réelle et un libellé nettoyé', () => {
    expect(validateHoliday({ day: ' 2026-12-25 ', label: '  Noël ' })).toEqual({ day: '2026-12-25', label: 'Noël' });
  });

  it('refuse une date irréelle, un libellé vide ou trop long', () => {
    expect(() => validateHoliday({ day: '2026-02-30', label: 'X' })).toThrow(/date/);
    expect(() => validateHoliday({ day: '', label: 'X' })).toThrow(/date/);
    expect(() => validateHoliday({ day: '2026-12-25', label: '  ' })).toThrow(/libellé/);
    expect(() => validateHoliday({ day: '2026-12-25', label: 'x'.repeat(101) })).toThrow(/100/);
    expect(validateHoliday({ day: '2026-12-25', label: 'x'.repeat(100) }).label).toHaveLength(100);
  });
});

describe('ajustement de solde', () => {
  it('accepte un report ou une correction avec motif', () => {
    expect(validateAdjustment({ year: 2027, days: 5, reason: '  Report 2026 ' })).toEqual({ year: 2027, days: 5, reason: 'Report 2026' });
    expect(validateAdjustment({ year: 2026, days: -2.5, reason: 'Correction' }).days).toBe(-2.5);
    expect(validateAdjustment({ year: 2000, days: 60, reason: 'x' }).year).toBe(2000);
    expect(validateAdjustment({ year: 2100, days: -60, reason: 'x' }).year).toBe(2100);
  });

  it('refuse une année hors de 2000 à 2100', () => {
    for (const year of [1999, 2101, 2026.5, Number.NaN]) expect(() => validateAdjustment({ year, days: 1, reason: 'x' })).toThrow(/année/);
  });

  it('refuse zéro, plus de 60 jours, ou pas par demi-journée', () => {
    for (const days of [0, 60.5, -60.5, 61, 0.3, 1.25, Number.NaN, Number.POSITIVE_INFINITY]) expect(() => validateAdjustment({ year: 2026, days, reason: 'x' })).toThrow(/jours/);
  });

  it('exige un motif de 500 caractères au plus', () => {
    expect(() => validateAdjustment({ year: 2026, days: 1, reason: '   ' })).toThrow(/motif/);
    expect(() => validateAdjustment({ year: 2026, days: 1, reason: 'x'.repeat(501) })).toThrow(/500/);
    expect(validateAdjustment({ year: 2026, days: 1, reason: 'x'.repeat(500) }).reason).toHaveLength(500);
  });
});
