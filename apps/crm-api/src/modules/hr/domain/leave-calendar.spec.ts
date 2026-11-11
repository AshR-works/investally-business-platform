import {
  CalendarRules, MAX_LEAVE_SPAN_DAYS, annualEntitlement, assertPeriod, computeBalance, dayOrdinal, isIsoDate, isWorkingDay, isoOfOrdinal, leaveDays, monthsOfService, periodsOverlap, slotRange, weekdayOf,
} from './leave-calendar';

const rules = (holidays: string[] = [], countsSaturday = false): CalendarRules => ({ countsSaturday, holidays: new Set(holidays) });
const period = (start: string, end: string, startHalf = false, endHalf = false) => ({ start, end, startHalf, endHalf });
// Décembre 2026 : le 1er est un mardi ; lundi 7, 14, 21, 28 ; samedi 5, 12, 19, 26 ; dimanche 6, 13, 20, 27.

describe('dates', () => {
  it('reconnaît les dates réelles et refuse les autres', () => {
    for (const ok of ['2026-12-31', '2028-02-29', '2000-01-01']) expect(isIsoDate(ok)).toBe(true);
    for (const bad of ['2026-02-29', '2026-13-01', '2026-00-10', '2026-12-32', '2026-1-1', '26-12-01', '', 'demain', '2026-12-01T00:00']) expect(isIsoDate(bad)).toBe(false);
  });

  it('passe d’une date à son numéro de jour et inversement', () => {
    expect(dayOrdinal('1970-01-01')).toBe(0);
    expect(dayOrdinal('1970-01-02')).toBe(1);
    expect(dayOrdinal('2026-12-14') - dayOrdinal('2026-12-07')).toBe(7);
    expect(isoOfOrdinal(dayOrdinal('2026-12-14'))).toBe('2026-12-14');
    expect(isoOfOrdinal(dayOrdinal('2028-02-29') + 1)).toBe('2028-03-01');
  });

  it('donne le jour de la semaine (0 = dimanche)', () => {
    expect(weekdayOf('2026-12-14')).toBe(1);
    expect(weekdayOf('2026-12-19')).toBe(6);
    expect(weekdayOf('2026-12-20')).toBe(0);
  });
});

describe('jours ouvrés', () => {
  it('le dimanche ne compte jamais, le samedi seulement si la règle le dit', () => {
    expect(isWorkingDay('2026-12-14', rules())).toBe(true);
    expect(isWorkingDay('2026-12-19', rules())).toBe(false);
    expect(isWorkingDay('2026-12-19', rules([], true))).toBe(true);
    expect(isWorkingDay('2026-12-20', rules())).toBe(false);
    expect(isWorkingDay('2026-12-20', rules([], true))).toBe(false);
  });

  it('un jour férié ne compte pas', () => {
    expect(isWorkingDay('2026-12-25', rules())).toBe(true);
    expect(isWorkingDay('2026-12-25', rules(['2026-12-25']))).toBe(false);
  });
});

describe('forme d’une période', () => {
  it('refuse les dates irréelles, inversées, ou au-delà d’un an', () => {
    expect(() => assertPeriod(period('2026-02-30', '2026-03-02'))).toThrow(/début/);
    expect(() => assertPeriod(period('2026-03-02', '2026-13-02'))).toThrow(/fin/);
    expect(() => assertPeriod(period('2026-12-15', '2026-12-14'))).toThrow(/précéder/);
    expect(() => assertPeriod(period('2026-01-01', '2027-01-02'))).toThrow(new RegExp(String(MAX_LEAVE_SPAN_DAYS)));
    expect(() => assertPeriod(period('2026-01-01', '2026-12-31'))).not.toThrow();
  });

  it('une seule journée ne commence pas l’après-midi et ne s’arrête pas à midi à la fois', () => {
    expect(() => assertPeriod(period('2026-12-14', '2026-12-14', true, true))).toThrow(/matinée/);
    expect(() => assertPeriod(period('2026-12-14', '2026-12-14', true, false))).not.toThrow();
    expect(() => assertPeriod(period('2026-12-14', '2026-12-14', false, true))).not.toThrow();
    expect(() => assertPeriod(period('2026-12-14', '2026-12-15', true, true))).not.toThrow();
  });
});

describe('jours décomptés', () => {
  it('une semaine du lundi au vendredi compte 5 jours', () => {
    expect(leaveDays(period('2026-12-14', '2026-12-18'), rules())).toBe(5);
  });

  it('un week-end ne compte pas ; une période à cheval le saute', () => {
    expect(leaveDays(period('2026-12-19', '2026-12-20'), rules())).toBe(0);
    expect(leaveDays(period('2026-12-17', '2026-12-22'), rules())).toBe(4); // jeu, ven, lun, mar
    expect(leaveDays(period('2026-12-17', '2026-12-22'), rules([], true))).toBe(5); // + samedi
  });

  it('un jour férié dans la période ne compte pas', () => {
    expect(leaveDays(period('2026-12-24', '2026-12-28'), rules(['2026-12-25']))).toBe(2); // jeu et lun
    expect(leaveDays(period('2026-12-25', '2026-12-25'), rules(['2026-12-25']))).toBe(0);
  });

  it('une journée seule : entière, matinée ou après-midi', () => {
    expect(leaveDays(period('2026-12-14', '2026-12-14'), rules())).toBe(1);
    expect(leaveDays(period('2026-12-14', '2026-12-14', false, true), rules())).toBe(0.5);
    expect(leaveDays(period('2026-12-14', '2026-12-14', true, false), rules())).toBe(0.5);
  });

  it('commencer l’après-midi et finir à midi retire une demi-journée à chaque bout', () => {
    expect(leaveDays(period('2026-12-14', '2026-12-15', true, false), rules())).toBe(1.5);
    expect(leaveDays(period('2026-12-14', '2026-12-15', false, true), rules())).toBe(1.5);
    expect(leaveDays(period('2026-12-14', '2026-12-15', true, true), rules())).toBe(1);
    expect(leaveDays(period('2026-12-14', '2026-12-18', true, true), rules())).toBe(4);
  });

  it('une demi-journée posée sur un jour non ouvré ne retire rien', () => {
    // Vendredi 25 férié : la période finit à midi ce jour-là, il n'y avait rien à décompter.
    expect(leaveDays(period('2026-12-24', '2026-12-25', false, true), rules(['2026-12-25']))).toBe(1);
    // Début un samedi après-midi : le samedi n'est pas ouvré, la demi-journée ne retire rien.
    expect(leaveDays(period('2026-12-19', '2026-12-21', true, false), rules())).toBe(1);
  });

  it('refuse une période mal formée', () => {
    expect(() => leaveDays(period('2026-12-15', '2026-12-14'), rules())).toThrow();
  });
});

describe('chevauchement à la demi-journée', () => {
  it('numérote les demi-journées : matin pair, après-midi impair', () => {
    const day = dayOrdinal('2026-12-14');
    expect(slotRange(period('2026-12-14', '2026-12-14'))).toEqual({ first: day * 2, last: day * 2 + 1 });
    expect(slotRange(period('2026-12-14', '2026-12-14', false, true))).toEqual({ first: day * 2, last: day * 2 });
    expect(slotRange(period('2026-12-14', '2026-12-14', true, false))).toEqual({ first: day * 2 + 1, last: day * 2 + 1 });
    expect(slotRange(period('2026-12-14', '2026-12-15', true, true))).toEqual({ first: day * 2 + 1, last: (day + 1) * 2 });
  });

  it('la matinée et l’après-midi du même jour ne se chevauchent pas', () => {
    expect(periodsOverlap(period('2026-12-14', '2026-12-14', false, true), period('2026-12-14', '2026-12-14', true, false))).toBe(false);
    expect(periodsOverlap(period('2026-12-14', '2026-12-14', false, true), period('2026-12-14', '2026-12-14'))).toBe(true);
  });

  it('une période qui finit à midi n’empêche pas une autre de commencer l’après-midi', () => {
    expect(periodsOverlap(period('2026-12-14', '2026-12-16', false, true), period('2026-12-16', '2026-12-18', true, false))).toBe(false);
    expect(periodsOverlap(period('2026-12-14', '2026-12-16'), period('2026-12-16', '2026-12-18', true, false))).toBe(true);
  });

  it('détecte les périodes disjointes, incluses, croisées et jointives', () => {
    expect(periodsOverlap(period('2026-12-14', '2026-12-15'), period('2026-12-16', '2026-12-17'))).toBe(false);
    expect(periodsOverlap(period('2026-12-14', '2026-12-18'), period('2026-12-15', '2026-12-16'))).toBe(true);
    expect(periodsOverlap(period('2026-12-15', '2026-12-16'), period('2026-12-14', '2026-12-18'))).toBe(true);
    expect(periodsOverlap(period('2026-12-14', '2026-12-16'), period('2026-12-16', '2026-12-18'))).toBe(true);
    expect(periodsOverlap(period('2026-12-14', '2026-12-15'), period('2026-12-14', '2026-12-15'))).toBe(true);
  });
});

describe('mois de service et droits annuels', () => {
  it('toute l’année : 12 mois ; entré le 1er janvier aussi', () => {
    expect(monthsOfService('2020-05-10', null, 2026)).toBe(12);
    expect(monthsOfService('2026-01-01', null, 2026)).toBe(12);
  });

  it('le mois d’entrée entamé ne compte qu’une fois complet', () => {
    expect(monthsOfService('2026-01-15', null, 2026)).toBe(11);
    expect(monthsOfService('2026-03-02', null, 2026)).toBe(9);
    expect(monthsOfService('2026-12-01', null, 2026)).toBe(1);
    expect(monthsOfService('2026-12-02', null, 2026)).toBe(0);
    expect(monthsOfService('2026-12-31', null, 2026)).toBe(0);
  });

  it('un 31 se prolonge en fin de mois plus court', () => {
    expect(monthsOfService('2026-01-31', null, 2026)).toBe(11);
    expect(monthsOfService('2026-01-31', '2026-03-01', 2026)).toBe(1); // 31 janvier → 28 février (1 mois), mars ne finit pas
    expect(monthsOfService('2028-01-31', '2028-03-01', 2028)).toBe(1); // bissextile : 29 février
  });

  it('un 31 qui sort avant la fin du mois court : le mois se complète le dernier jour du mois suivant', () => {
    // Entré le 31 janvier, sorti le 27 février : le « mois » du 31 janvier au 28 février est complet (28 février exclu = 27 inclus).
    expect(monthsOfService('2026-01-31', '2026-02-27', 2026)).toBe(1);
    expect(monthsOfService('2026-01-31', '2026-02-26', 2026)).toBe(0);
    // Année bissextile : le mois se complète le 29 février.
    expect(monthsOfService('2028-01-31', '2028-02-28', 2028)).toBe(1);
    expect(monthsOfService('2028-01-31', '2028-02-27', 2028)).toBe(0);
    // Un 30 en mois de 30 jours ne bouge pas.
    expect(monthsOfService('2026-03-30', '2026-04-29', 2026)).toBe(1);
  });

  it('la sortie arrête l’acquisition (dernier jour inclus)', () => {
    expect(monthsOfService('2020-01-01', '2026-06-30', 2026)).toBe(6);
    expect(monthsOfService('2020-01-01', '2026-06-29', 2026)).toBe(5);
    expect(monthsOfService('2020-01-01', '2026-01-31', 2026)).toBe(1);
  });

  it('avant l’entrée ou après la sortie : zéro', () => {
    expect(monthsOfService('2027-03-01', null, 2026)).toBe(0);
    expect(monthsOfService('2020-01-01', '2025-12-31', 2026)).toBe(0);
    expect(monthsOfService('2020-01-01', '2026-01-01', 2026)).toBe(0);
  });

  it('une sortie après l’année n’ajoute rien', () => {
    expect(monthsOfService('2020-01-01', '2027-06-30', 2026)).toBe(12);
  });

  it('les droits sont les mois de service fois le taux, au centième', () => {
    expect(annualEntitlement('2020-01-01', null, 2026, 1.5)).toBe(18);
    expect(annualEntitlement('2026-03-02', null, 2026, 1.5)).toBe(13.5);
    expect(annualEntitlement('2026-03-02', null, 2026, 2.5)).toBe(22.5);
    expect(annualEntitlement('2026-03-02', null, 2026, 0)).toBe(0);
    expect(annualEntitlement('2020-01-01', null, 2026, 1.25)).toBe(15);
    expect(annualEntitlement('2026-03-02', null, 2026, 1.33)).toBe(11.97);
    // 11 × 1,1 vaut 12,100000000000001 en virgule flottante : le droit est arrondi au centième.
    expect(annualEntitlement('2026-01-15', null, 2026, 1.1)).toBe(12.1);
  });
});

describe('solde', () => {
  it('acquis + ajustements − pris − en attente', () => {
    expect(computeBalance({ year: 2026, entitlement: 18, adjustments: 2, taken: 5, pending: 1.5 })).toEqual({ year: 2026, entitlement: 18, adjustments: 2, taken: 5, pending: 1.5, available: 13.5 });
  });

  it('peut être négatif (ajustement ou règle changée) sans erreur d’arrondi', () => {
    expect(computeBalance({ year: 2026, entitlement: 1.5, adjustments: 0, taken: 0.1, pending: 2 }).available).toBe(-0.6);
    expect(computeBalance({ year: 2026, entitlement: 0.3, adjustments: 0, taken: 0.1, pending: 0.1 }).available).toBe(0.1);
  });
});
