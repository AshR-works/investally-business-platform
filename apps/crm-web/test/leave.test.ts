import { describe, expect, it } from 'vitest';
import {
  addDays, calendarRows, canCancelRequest, dayText, daysInMonth, daysText, EMPTY_LEAVE_FORM, leaveBody, markOn, monthBounds, periodLabel, shiftMonth, validateAdjustment,
  validateHoliday, validateLeaveForm, validateReason, validateSettings, validateTypeForm, weekdayOf, type CalendarEntry,
} from '../lib/leave';
import { availableModules, MODULES } from '../lib/modules';
import type { Profile } from '../lib/types';

const rules = { today: '2026-11-11', allowHalfDays: true, canBackdate: false };
const form = (patch = {}) => ({ ...EMPTY_LEAVE_FORM('2026-12-21'), leaveTypeId: 't1', end: '2026-12-24', ...patch });

describe('dates et durées', () => {
  it('affichent les jours civils sans fuseau', () => {
    expect(dayText('2026-12-21')).toBe('21/12/2026');
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
