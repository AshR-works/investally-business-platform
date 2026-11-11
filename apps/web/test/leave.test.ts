import { describe, expect, it } from 'vitest';
import {
  addDays, calendarRows, canCancelRequest, dayText, daysInMonth, daysText, EMPTY_LEAVE_FORM, EMPTY_TYPE_FORM, LEAVE_PAGES, LEAVE_STATUS, LEAVE_STATUS_FILTERS, leaveBody, markOn, monthBounds, monthName,
  parseDays, periodLabel, settingsForm, shiftMonth, typeForm, validateAdjustment, validateHoliday, validateLeaveForm, validateReason, validateSettings, validateTypeForm, weekdayName, weekdayOf,
  type CalendarEntry, type LeaveType,
} from '../lib/leave';
import { availableModules, MODULES } from '../lib/modules';
import type { Profile } from '../lib/types';

const rules = { today: '2026-11-11', allowHalfDays: true, canBackdate: false };
const form = (patch = {}) => ({ ...EMPTY_LEAVE_FORM('2026-12-21'), leaveTypeId: 't1', end: '2026-12-24', ...patch });

describe('dates et durées', () => {
  it('affichent les jours civils sans fuseau', () => {
    expect(dayText('2026-12-21')).toBe('21/12/2026');
    expect(dayText('2026-03-05')).toBe('05/03/2026'); // jour et mois toujours sur deux chiffres, dans l'ordre jour/mois/année
    expect(weekdayOf('2026-11-11')).toBe(3);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(monthBounds(2026, 2)).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  });
  it('disent la durée au singulier, au pluriel et à la demi-journée', () => {
    expect(daysText(1)).toBe('1 jour');
    expect(daysText(0.5)).toBe('0,5 jour');
    expect(daysText(2.5)).toBe('2,5 jours');
    expect(daysText(-1.5)).toBe('-1,5 jours');
  });
  it('disent la période et ses demi-journées en toutes lettres', () => {
    expect(periodLabel({ start: '2026-12-21', end: '2026-12-24', startHalf: false, endHalf: false })).toBe('du 21/12/2026 au 24/12/2026');
    expect(periodLabel({ start: '2026-12-21', end: '2026-12-24', startHalf: true, endHalf: true })).toBe('du 21/12/2026 (après-midi) au 24/12/2026 (matin)');
    expect(periodLabel({ start: '2026-12-21', end: '2026-12-21', startHalf: false, endHalf: true })).toBe('le 21/12/2026 (matin)');
    expect(periodLabel({ start: '2026-12-21', end: '2026-12-21', startHalf: false, endHalf: false })).toBe('le 21/12/2026');
  });
});

describe('calendrier d\'équipe', () => {
  const entry = (patch: Partial<CalendarEntry> = {}): CalendarEntry => ({ requestId: 'r', employeeId: 'e1', employeeName: 'Ada', department: 'Commercial', start: '2026-12-21', end: '2026-12-23', startHalf: false, endHalf: false, leaveTypeLabel: null, ...patch });
  it('marque la journée, la matinée du dernier jour et l\'après-midi du premier', () => {
    const e = entry({ startHalf: true, endHalf: true });
    expect(markOn(e, '2026-12-20')).toBeNull();
    expect(markOn(e, '2026-12-21')).toBe('afternoon');
    expect(markOn(e, '2026-12-22')).toBe('full');
    expect(markOn(e, '2026-12-23')).toBe('morning');
    expect(markOn(e, '2026-12-24')).toBeNull();
    expect(markOn(entry({ start: '2026-12-21', end: '2026-12-21', endHalf: true }), '2026-12-21')).toBe('morning');
  });
  it('regroupe une ligne par personne, triée par service puis par nom', () => {
    const rows = calendarRows([entry({ employeeId: 'b', employeeName: 'Zoé', department: 'Finance' }), entry({ employeeId: 'a', employeeName: 'Ada' }), entry({ employeeId: 'a', employeeName: 'Ada', start: '2026-12-28', end: '2026-12-29' })]);
    expect(rows.map((r) => r.employeeName)).toEqual(['Ada', 'Zoé']);
    expect(rows[0]!.entries).toHaveLength(2);
  });
});

describe('demande d\'absence', () => {
  it('une demande complète est conforme', () => {
    expect(validateLeaveForm(form(), rules)).toEqual({});
  });
  it('exige un type, des dates réelles et une fin qui ne précède pas le début', () => {
    expect(validateLeaveForm(form({ leaveTypeId: '' }), rules).leaveTypeId).toBeDefined();
    expect(validateLeaveForm(form({ start: '' }), rules).start).toBeDefined();
    expect(validateLeaveForm(form({ start: '2026-02-30', end: '2026-12-24' }), rules).start).toBeDefined();
    expect(validateLeaveForm(form({ end: '2026-12-20' }), rules).end).toMatch(/précéder/);
  });
  it('le passé est réservé à la RH', () => {
    const past = form({ start: '2026-11-01', end: '2026-11-02' });
    expect(validateLeaveForm(past, rules).start).toMatch(/RH/);
    expect(validateLeaveForm(past, { ...rules, canBackdate: true })).toEqual({});
  });
  it('la demi-journée n\'existe que si la RH l\'autorise', () => {
    expect(validateLeaveForm(form({ startHalf: true }), { ...rules, allowHalfDays: false }).half).toBeDefined();
    expect(validateLeaveForm(form({ startHalf: true }), rules)).toEqual({});
  });
  it('le motif tient en 500 caractères', () => {
    expect(validateLeaveForm(form({ note: 'x'.repeat(501) }), rules).note).toBeDefined();
  });
  it('le corps envoyé omet l\'employé, les demi-journées fausses et le motif vide', () => {
    expect(leaveBody(form({ note: '  ' }))).toEqual({ leaveTypeId: 't1', start: '2026-12-21', end: '2026-12-24' });
    expect(leaveBody(form({ employeeId: 'e9', startHalf: true, note: ' Voyage ' }))).toEqual({ employeeId: 'e9', leaveTypeId: 't1', start: '2026-12-21', end: '2026-12-24', startHalf: true, note: 'Voyage' });
  });
  it('l\'annulation : en attente toujours, validée avant le début (la RH aussi en cours), refusée jamais', () => {
    expect(canCancelRequest({ status: 'PENDING', start: '2026-01-01' }, '2026-11-11', false)).toBe(true);
    expect(canCancelRequest({ status: 'APPROVED', start: '2026-12-01' }, '2026-11-11', false)).toBe(true);
    expect(canCancelRequest({ status: 'APPROVED', start: '2026-11-01' }, '2026-11-11', false)).toBe(false);
    expect(canCancelRequest({ status: 'APPROVED', start: '2026-11-01' }, '2026-11-11', true)).toBe(true);
    expect(canCancelRequest({ status: 'REJECTED', start: '2026-12-01' }, '2026-11-11', true)).toBe(false);
    expect(canCancelRequest({ status: 'CANCELLED', start: '2026-12-01' }, '2026-11-11', true)).toBe(false);
  });
  it('un refus exige un motif', () => {
    expect(validateReason('  ', true)).toMatch(/obligatoire/);
    expect(validateReason('', false)).toBeUndefined();
    expect(validateReason('x'.repeat(501), false)).toBeDefined();
  });
});

describe('paramétrage RH', () => {
  it('l\'ajustement : non nul, par demi-journée, 60 jours au plus, motif obligatoire', () => {
    expect(validateAdjustment({ days: '5', reason: 'Report 2025' })).toEqual({});
    expect(validateAdjustment({ days: '-1,5', reason: 'Correction' })).toEqual({});
    expect(validateAdjustment({ days: '', reason: 'x' }).days).toBeDefined();
    expect(validateAdjustment({ days: '0', reason: 'x' }).days).toBeDefined();
    expect(validateAdjustment({ days: 'abc', reason: 'x' }).days).toBeDefined();
    expect(validateAdjustment({ days: '61', reason: 'x' }).days).toBeDefined();
    expect(validateAdjustment({ days: '1,3', reason: 'x' }).days).toMatch(/demi-journée/);
    expect(validateAdjustment({ days: '1', reason: ' ' }).reason).toBeDefined();
  });
  it('les règles : de 0 à 5 jours par mois, deux décimales au plus', () => {
    const f = (accrualDaysPerMonth: string) => ({ accrualDaysPerMonth, countsSaturday: false, allowHalfDays: true, allowNegativeBalance: false });
    expect(validateSettings(f('1,5'))).toEqual({});
    expect(validateSettings(f('2.08'))).toEqual({});
    expect(validateSettings(f(''))).toHaveProperty('accrualDaysPerMonth');
    expect(validateSettings(f('6'))).toHaveProperty('accrualDaysPerMonth');
    expect(validateSettings(f('-1'))).toHaveProperty('accrualDaysPerMonth');
    expect(validateSettings(f('1,505'))).toHaveProperty('accrualDaysPerMonth');
  });
  it('un type : code fixé à la création (majuscules), libellé, plafond au demi-jour', () => {
    const base = { code: 'STUDY', label: 'Études', deductsBalance: false, requiresApproval: true, maxDays: '', sortOrder: '100' };
    expect(validateTypeForm(base, true)).toEqual({});
    expect(validateTypeForm({ ...base, code: 'étude' }, true).code).toBeDefined();
    expect(validateTypeForm({ ...base, code: '' }, false)).toEqual({});
    expect(validateTypeForm({ ...base, label: ' ' }, false).label).toBeDefined();
    expect(validateTypeForm({ ...base, maxDays: '2,5' }, false)).toEqual({});
    expect(validateTypeForm({ ...base, maxDays: '0,2' }, false).maxDays).toBeDefined();
    expect(validateTypeForm({ ...base, maxDays: '1,3' }, false).maxDays).toBeDefined();
    expect(validateTypeForm({ ...base, sortOrder: 'x' }, false).sortOrder).toBeDefined();
  });
  it('un jour férié : date réelle et libellé', () => {
    expect(validateHoliday('2026-12-25', 'Noël')).toEqual({});
    expect(validateHoliday('', 'Noël').day).toBeDefined();
    expect(validateHoliday('2026-13-01', 'Noël').day).toBeDefined();
    expect(validateHoliday('2026-12-25', ' ').label).toBeDefined();
  });
});

describe('entrées de menu des congés', () => {
  const profile = (grants: [string, string][]): Profile => ({ permissions: grants.map(([code, scope]) => ({ code, scope })) } as unknown as Profile);
  const ids = (p: Profile) => availableModules(p).filter((m) => m.id.startsWith('leave')).map((m) => m.id);
  it('un employé ordinaire voit ses absences, la validation et le calendrier, jamais les soldes ni les paramètres', () => {
    expect(ids(profile([['hr.leave.read', 'OWN'], ['hr.leave.create', 'OWN'], ['hr.leave.approve', 'OWN']]))).toEqual(['leave', 'leave-approvals', 'leave-calendar']);
  });
  it('la RH voit les cinq écrans', () => {
    expect(ids(profile([['hr.leave.read', 'ALL'], ['hr.leave.create', 'ALL'], ['hr.leave.approve', 'ALL'], ['hr.leave.manage', 'ALL']]))).toEqual(['leave', 'leave-approvals', 'leave-calendar', 'leave-balances', 'leave-settings']);
  });
  it('chaque entrée a un chemin propre et distinct', () => {
    const hrefs = MODULES.filter((m) => m.href).map((m) => m.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

// ───────────────────────────── Fautes plausibles détectées par les mutants de RH-2c ─────────────────────────────

describe('noms, mois et périodes', () => {
  it('nomment le jour et le mois', () => {
    expect(weekdayName('2026-11-11')).toBe('mercredi');
    expect(weekdayName('2026-11-15')).toBe('dimanche');
    expect(weekdayName('2026-11-14')).toBe('samedi');
    expect(monthName(1)).toBe('janvier');
    expect(monthName(12)).toBe('décembre');
    expect(monthName(13)).toBe('');
    expect(monthBounds(2026, 3)).toEqual({ from: '2026-03-01', to: '2026-03-31' });
    expect(monthBounds(2026, 11)).toEqual({ from: '2026-11-01', to: '2026-11-30' });
  });
  it('disent l\u2019après-midi seul d\u2019un jour unique', () => {
    expect(periodLabel({ start: '2026-12-21', end: '2026-12-21', startHalf: true, endHalf: false })).toBe('le 21/12/2026 (après-midi)');
  });
});

describe('calendrier : marques et tri', () => {
  const entry = (patch: Partial<CalendarEntry> = {}): CalendarEntry => ({ requestId: 'r', employeeId: 'e1', employeeName: 'Ada', department: 'Commercial', start: '2026-12-21', end: '2026-12-21', startHalf: false, endHalf: false, leaveTypeLabel: null, ...patch });
  it('un jour seul : après-midi, matin ou journée', () => {
    expect(markOn(entry({ startHalf: true }), '2026-12-21')).toBe('afternoon');
    expect(markOn(entry({ endHalf: true }), '2026-12-21')).toBe('morning');
    expect(markOn(entry(), '2026-12-21')).toBe('full');
    expect(markOn(entry(), '2026-12-22')).toBeNull();
    expect(markOn(entry(), '2026-12-20')).toBeNull();
  });
  it('les lignes sont triées par service, puis par nom (pas par ordre d\u2019arrivée)', () => {
    const rows = calendarRows([
      entry({ employeeId: '1', employeeName: 'Zoé', department: 'Commercial' }),
      entry({ employeeId: '2', employeeName: 'Ada', department: 'Finance' }),
      entry({ employeeId: '3', employeeName: 'Abel', department: 'Commercial' }),
      entry({ employeeId: '4', employeeName: 'Éva', department: 'Commercial' }),
    ]);
    expect(rows.map((r) => r.employeeName)).toEqual(['Abel', 'Éva', 'Zoé', 'Ada']);
  });
  it('une personne absente deux fois n\u2019a qu\u2019une ligne', () => {
    expect(calendarRows([entry(), entry({ start: '2026-12-28', end: '2026-12-28' })])).toHaveLength(1);
  });
});

describe('demande : limites et messages exacts', () => {
  const rules = { today: '2026-11-11', allowHalfDays: true, canBackdate: false };
  const ok = (patch = {}) => ({ ...EMPTY_LEAVE_FORM('2026-12-21'), leaveTypeId: 't1', end: '2026-12-24', ...patch });
  it('les dates sont exigées, réelles, et le jour même est permis', () => {
    expect(validateLeaveForm(ok({ start: '' }), rules).start).toBe('La date de début est obligatoire.');
    expect(validateLeaveForm(ok({ end: '' }), rules).end).toBe('La date de fin est obligatoire.');
    expect(validateLeaveForm(ok({ start: '2027-02-30', end: '2027-03-01' }), rules).start).toMatch(/pas valide/);
    expect(validateLeaveForm(ok({ end: '2027-02-30' }), rules).end).toMatch(/pas valide/);
    expect(validateLeaveForm(ok({ start: '2026-11-11', end: '2026-11-11' }), rules)).toEqual({});
    expect(validateLeaveForm(ok({ start: '2026-12-21', end: '2026-12-21' }), rules)).toEqual({});
    expect(validateLeaveForm(ok({ start: '2026-11-10', end: '2026-11-11' }), rules).start).toMatch(/passé/);
  });
  it('la demi-journée de fin est refusée quand elles sont interdites', () => {
    expect(validateLeaveForm(ok({ endHalf: true }), { ...rules, allowHalfDays: false }).half).toBeDefined();
  });
  it('le motif de 500 caractères passe, celui de 501 non', () => {
    expect(validateLeaveForm(ok({ note: 'x'.repeat(500) }), rules)).toEqual({});
    expect(validateLeaveForm(ok({ note: 'x'.repeat(501) }), rules).note).toBeDefined();
  });
  it('les demi-journées sont envoyées, début comme fin', () => {
    expect(leaveBody(ok({ endHalf: true }))).toMatchObject({ endHalf: true });
    expect(leaveBody(ok({ endHalf: true }))).not.toHaveProperty('startHalf');
    expect(leaveBody(ok({ startHalf: true }))).toMatchObject({ startHalf: true });
  });
  it('l\u2019absence qui commence aujourd\u2019hui ne s\u2019annule plus par l\u2019employé', () => {
    expect(canCancelRequest({ status: 'APPROVED', start: '2026-11-11' }, '2026-11-11', false)).toBe(false);
    expect(canCancelRequest({ status: 'APPROVED', start: '2026-11-12' }, '2026-11-11', false)).toBe(true);
  });
  it('le motif de 500 caractères passe, celui de 501 non', () => {
    expect(validateReason('x'.repeat(500), false)).toBeUndefined();
    expect(validateReason('x'.repeat(501), false)).toBeDefined();
  });
});

describe('ajustement : messages et bornes', () => {
  it('chaque refus dit pourquoi', () => {
    expect(validateAdjustment({ days: '', reason: 'x' }).days).toBe('Indiquez le nombre de jours.');
    expect(validateAdjustment({ days: 'abc', reason: 'x' }).days).toBe('Indiquez un nombre de jours différent de zéro.');
    expect(validateAdjustment({ days: '0', reason: 'x' }).days).toBe('Indiquez un nombre de jours différent de zéro.');
  });
  it('60 jours en plus ou en moins passent, 61 non, dans les deux sens', () => {
    expect(validateAdjustment({ days: '60', reason: 'x' })).toEqual({});
    expect(validateAdjustment({ days: '-60', reason: 'x' })).toEqual({});
    expect(validateAdjustment({ days: '-61', reason: 'x' }).days).toMatch(/60 jours/);
    expect(validateAdjustment({ days: '61', reason: 'x' }).days).toMatch(/60 jours/);
  });
  it('le motif de 500 caractères passe, celui de 501 non', () => {
    expect(validateAdjustment({ days: '1', reason: 'x'.repeat(500) })).toEqual({});
    expect(validateAdjustment({ days: '1', reason: 'x'.repeat(501) }).reason).toBeDefined();
  });
  it('la virgule française est comprise', () => {
    expect(parseDays('1,5')).toBe(1.5);
    expect(parseDays(' -2,5 ')).toBe(-2.5);
  });
});

describe('règles : affichage et bornes', () => {
  const f = (accrualDaysPerMonth: string) => ({ accrualDaysPerMonth, countsSaturday: false, allowHalfDays: true, allowNegativeBalance: false });
  it('le taux se montre avec une virgule', () => {
    expect(settingsForm({ accrualDaysPerMonth: 1.5, countsSaturday: true, allowHalfDays: false, allowNegativeBalance: true, version: 1 })).toEqual({ accrualDaysPerMonth: '1,5', countsSaturday: true, allowHalfDays: false, allowNegativeBalance: true });
  });
  it('un taux non numérique est refusé, 5 et 0 passent', () => {
    expect(validateSettings(f('abc')).accrualDaysPerMonth).toBe('Indiquez un nombre de jours par mois.');
    expect(validateSettings(f('5'))).toEqual({});
    expect(validateSettings(f('0'))).toEqual({});
  });
});

describe('types : codes, plafonds, ordre', () => {
  const base = { code: 'STUDY', label: 'Études', deductsBalance: false, requiresApproval: true, maxDays: '', sortOrder: '100' };
  it('le code est exigé, en majuscules, de 30 caractères au plus', () => {
    expect(validateTypeForm({ ...base, code: '' }, true).code).toBe('Le code est obligatoire.');
    expect(validateTypeForm({ ...base, code: 'study' }, true).code).toBeDefined();
    expect(validateTypeForm({ ...base, code: 'A'.repeat(30) }, true)).toEqual({});
    expect(validateTypeForm({ ...base, code: 'A'.repeat(31) }, true).code).toBeDefined();
  });
  it('le libellé de 100 caractères passe, celui de 101 non', () => {
    expect(validateTypeForm({ ...base, label: 'x'.repeat(100) }, false)).toEqual({});
    expect(validateTypeForm({ ...base, label: 'x'.repeat(101) }, false).label).toBeDefined();
  });
  it('le plafond : de 0,5 à 365 compris, sinon refusé', () => {
    for (const bad of ['abc', '0', '400', '365,5']) expect(validateTypeForm({ ...base, maxDays: bad }, false).maxDays, bad).toBeDefined();
    for (const good of ['0,5', '365', '1']) expect(validateTypeForm({ ...base, maxDays: good }, false), good).toEqual({});
  });
  it('l\u2019ordre : un entier de 0 à 10 000 compris', () => {
    expect(validateTypeForm({ ...base, sortOrder: '-1' }, false).sortOrder).toBeDefined();
    expect(validateTypeForm({ ...base, sortOrder: '10001' }, false).sortOrder).toBeDefined();
    expect(validateTypeForm({ ...base, sortOrder: '0' }, false)).toEqual({});
    expect(validateTypeForm({ ...base, sortOrder: '10000' }, false)).toEqual({});
  });
  it('la modification reprend le plafond, avec une virgule', () => {
    const t = (maxDaysPerRequest: number | null): LeaveType => ({ id: 'i', code: 'STUDY', label: 'Études', deductsBalance: false, requiresApproval: true, maxDaysPerRequest, active: true, sortOrder: 5, version: 1 });
    expect(typeForm(t(2.5)).maxDays).toBe('2,5');
    expect(typeForm(t(3)).maxDays).toBe('3');
    expect(typeForm(t(null)).maxDays).toBe('');
    expect(typeForm(t(null)).sortOrder).toBe('5');
  });
  it('un nouveau type demande une validation par défaut', () => {
    expect(EMPTY_TYPE_FORM.requiresApproval).toBe(true);
    expect(EMPTY_TYPE_FORM.deductsBalance).toBe(false);
  });
});

describe('jours fériés : messages et bornes', () => {
  it('la date est exigée, le libellé de 100 caractères passe, celui de 101 non', () => {
    expect(validateHoliday('', 'Noël').day).toBe('La date est obligatoire.');
    expect(validateHoliday('2026-12-25', 'x'.repeat(100))).toEqual({});
    expect(validateHoliday('2026-12-25', 'x'.repeat(101)).label).toBeDefined();
  });
});

describe('états, filtres et onglets', () => {
  it('chaque état a son libellé et sa teinte', () => {
    expect(LEAVE_STATUS.PENDING).toEqual({ label: 'En attente', tone: 'warn' });
    expect(LEAVE_STATUS.APPROVED).toEqual({ label: 'Validée', tone: 'ok' });
    expect(LEAVE_STATUS.REJECTED).toEqual({ label: 'Refusée', tone: 'bad' });
    expect(LEAVE_STATUS.CANCELLED).toEqual({ label: 'Annulée', tone: 'neutral' });
  });
  it('chaque filtre envoie le bon état ; « Toutes » n\u2019en envoie aucun', () => {
    expect(LEAVE_STATUS_FILTERS.map((x) => [x.value, x.label])).toEqual([['', 'Toutes'], ['PENDING', 'En attente'], ['APPROVED', 'Validées'], ['REJECTED', 'Refusées'], ['CANCELLED', 'Annulées']]);
  });
  it('les onglets et le menu disent la même chose : même chemin, même droit, même portée', () => {
    expect(LEAVE_PAGES).toHaveLength(5);
    for (const page of LEAVE_PAGES) {
      const module = MODULES.find((m) => m.href === page.href);
      expect(module, page.href).toBeDefined();
      expect(module!.permission, page.href).toBe(page.permission);
      expect(Boolean(module!.allScope), page.href).toBe(page.allScope);
    }
    expect(LEAVE_PAGES.filter((p) => p.allScope).map((p) => p.id)).toEqual(['balances', 'settings']);
    expect(LEAVE_PAGES.find((p) => p.id === 'approvals')!.permission).toBe('hr.leave.approve');
  });
  it('quelqu\u2019un qui gère en portée Propre seulement ne voit ni les soldes ni les paramètres', () => {
    const profile = { permissions: [{ code: 'hr.leave.read', scope: 'OWN' }, { code: 'hr.leave.manage', scope: 'OWN' }] } as unknown as Profile;
    expect(availableModules(profile).filter((m) => m.id.startsWith('leave')).map((m) => m.id)).toEqual(['leave', 'leave-calendar']);
  });
});
