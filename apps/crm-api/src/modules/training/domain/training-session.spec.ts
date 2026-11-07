import { DomainError } from '../../../shared-kernel';
import { RHYTHMS } from './rhythms';
import { endDateFor, isWorkingDay, overlaps, parseIsoDate } from './session-dates';
import { TrainingSession } from './training-session';

const NOW = new Date('2026-11-06T09:00:00.000Z'); // vendredi
const TODAY = '2026-11-06';
const DAY = RHYTHMS.find((r) => r.code === 'DAY')!;
const EVENING = RHYTHMS.find((r) => r.code === 'EVENING')!;

const plan = (over: Partial<Parameters<typeof TrainingSession.create>[0]> = {}) =>
  TrainingSession.create({
    id: 's1', trainingId: 't1', rhythm: 'DAY', startDate: '2026-11-16', roomId: 'r1', trainerId: 'f1', capacity: 13, today: TODAY, now: NOW, ...over,
  });

const expectError = (fn: () => unknown, code: string, message: RegExp) => {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe(code);
    expect((error as DomainError).message).toMatch(message);
    return;
  }
  throw new Error('une erreur de domaine était attendue');
};

describe('Dates de session', () => {
  it('lit une date du calendrier et refuse les autres', () => {
    expect(parseIsoDate('2026-11-16', 'La date')).toBe('2026-11-16');
    for (const bad of ['16/11/2026', '2026-13-01', '2026-02-30', '', undefined, 20261116]) {
      expectError(() => parseIsoDate(bad, 'La date'), 'VALIDATION', /date/);
    }
  });

  it('les jours de cours sont du lundi au vendredi', () => {
    expect([ '2026-11-16', '2026-11-20' ].every(isWorkingDay)).toBe(true);
    expect(isWorkingDay('2026-11-14')).toBe(false); // samedi
    expect(isWorkingDay('2026-11-15')).toBe(false); // dimanche
  });

  it('la fin suit le rythme : une semaine du lundi au vendredi, ou cinq jours de cours à partir du mercredi', () => {
    expect(endDateFor('2026-11-16', DAY)).toBe('2026-11-20');
    expect(endDateFor('2026-11-18', DAY)).toBe('2026-11-24'); // mercredi → mardi suivant (le week-end n'est pas compté)
    expect(endDateFor('2026-11-16', EVENING)).toBe('2026-11-27'); // deux semaines
  });

  it('deux périodes se recouvrent bornes incluses', () => {
    expect(overlaps('2026-11-16', '2026-11-20', '2026-11-20', '2026-11-24')).toBe(true);
    expect(overlaps('2026-11-16', '2026-11-20', '2026-11-21', '2026-11-24')).toBe(false);
    expect(overlaps('2026-11-16', '2026-11-20', '2026-11-09', '2026-11-13')).toBe(false);
  });
});

describe('Session de formation', () => {
  it('est planifiée avec sa date de fin déduite du rythme', () => {
    const s = plan();
    expect(s).toMatchObject({ status: 'PLANNED', startDate: '2026-11-16', endDate: '2026-11-20', rhythm: 'DAY', capacity: 13, version: 1, cancelReason: null });
  });

  it('refuse le rythme du soir tant qu\'il n\'est pas ouvert, et un rythme inconnu', () => {
    expectError(() => plan({ rhythm: 'EVENING' }), 'INVARIANT_VIOLATION', /pas encore ouvert/);
    expectError(() => plan({ rhythm: 'WEEKEND' }), 'VALIDATION', /rythme est inconnu/);
  });

  it('refuse une date dans le passé, un week-end, un format invalide', () => {
    expectError(() => plan({ startDate: '2026-11-05' }), 'VALIDATION', /passé/);
    expectError(() => plan({ startDate: '2026-11-14' }), 'VALIDATION', /jour de cours/);
    expectError(() => plan({ startDate: 'demain' }), 'VALIDATION', /AAAA-MM-JJ/);
  });

  it('accepte une date de début aujourd\'hui (un jour de cours)', () => {
    expect(plan({ startDate: TODAY }).startDate).toBe(TODAY);
  });

  it('refuse une capacité hors de 1 à 1000, ou non entière', () => {
    for (const capacity of [0, -1, 1001, 12.5, Number.NaN]) expectError(() => plan({ capacity }), 'VALIDATION', /capacité/);
  });

  it('s\'ouvre une seule fois, depuis « planifiée »', () => {
    const s = plan();
    s.open();
    expect(s.status).toBe('OPEN');
    expectError(() => s.open(), 'INVARIANT_VIOLATION', /déjà ouverte/);
  });

  it('se modifie (salle, formateur, capacité) tant qu\'elle n\'a pas commencé ; ensuite seule la capacité change', () => {
    const s = plan();
    s.update({ roomId: 'r2', trainerId: 'f2', capacity: 10 }, TODAY);
    expect(s).toMatchObject({ roomId: 'r2', trainerId: 'f2', capacity: 10 });
    expect(s.hasStarted('2026-11-15')).toBe(false);
    expect(s.hasStarted('2026-11-16')).toBe(true);
    expectError(() => s.update({ roomId: 'r1' }, '2026-11-17'), 'INVARIANT_VIOLATION', /a commencé/);
    expectError(() => s.update({ trainerId: 'f1' }, '2026-11-17'), 'INVARIANT_VIOLATION', /a commencé/);
    s.update({ capacity: 8 }, '2026-11-17');
    expect(s.capacity).toBe(8);
    expectError(() => s.update({ capacity: 0 }, TODAY), 'VALIDATION', /capacité/);
  });

  it('se reporte à une autre date de début avec un motif ; la fin suit ; avant le début seulement', () => {
    const s = plan();
    s.postpone('2026-11-23', '  Formateur indisponible  ', TODAY);
    expect(s).toMatchObject({ startDate: '2026-11-23', endDate: '2026-11-27', status: 'PLANNED' });
    expectError(() => s.postpone('2026-11-30', '', TODAY), 'VALIDATION', /motif/);
    expectError(() => s.postpone('2026-11-23', 'Encore', TODAY), 'VALIDATION', /identique/);
    expectError(() => s.postpone('2026-11-14', 'Samedi', TODAY), 'VALIDATION', /jour de cours/);
    expectError(() => s.postpone('2026-11-02', 'Passé', TODAY), 'VALIDATION', /passé/);
    expectError(() => s.postpone('2026-11-30', 'Trop tard', '2026-11-24'), 'INVARIANT_VIOLATION', /a commencé/);
  });

  it('une session ouverte se reporte et garde son état', () => {
    const s = plan();
    s.open();
    s.postpone('2026-11-23', 'Salle indisponible', TODAY);
    expect(s.status).toBe('OPEN');
  });

  it('s\'annule avec un motif, une seule fois, et ne se modifie plus ensuite', () => {
    const s = plan();
    expectError(() => s.cancel('   '), 'VALIDATION', /motif/);
    s.cancel('  Pas assez d\'inscrits ');
    expect(s).toMatchObject({ status: 'CANCELLED', cancelReason: 'Pas assez d\'inscrits' });
    expectError(() => s.cancel('Encore'), 'INVARIANT_VIOLATION', /déjà annulée/);
    expectError(() => s.update({ capacity: 5 }, TODAY), 'INVARIANT_VIOLATION', /annulée/);
    expectError(() => s.postpone('2026-11-30', 'Report', TODAY), 'INVARIANT_VIOLATION', /annulée/);
    expectError(() => s.open(), 'INVARIANT_VIOLATION', /planifiée/);
  });

  it('une session clôturée ne s\'annule ni ne se modifie', () => {
    const s = TrainingSession.rehydrate({
      id: 's9', trainingId: 't1', rhythm: 'DAY', startDate: '2026-10-05', endDate: '2026-10-09', roomId: 'r1', trainerId: 'f1', capacity: 10, status: 'CLOSED',
      cancelReason: null, createdAt: NOW, version: 3,
    });
    expectError(() => s.cancel('Trop tard'), 'INVARIANT_VIOLATION', /clôturée/);
    expectError(() => s.update({ capacity: 5 }, TODAY), 'INVARIANT_VIOLATION', /clôturée/);
  });
});
