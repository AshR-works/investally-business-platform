import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// Cohérence interface ↔ serveur : les domaines RÉELS de l'API sont interrogés sur les mêmes cas.
import { RHYTHMS } from '../../crm-api/src/modules/training/domain/rhythms';
import { endDateFor as serverEndDate, isWorkingDay as serverWorkingDay } from '../../crm-api/src/modules/training/domain/session-dates';
import { TrainingSession as ServerSession } from '../../crm-api/src/modules/training/domain/training-session';
import { availableModules } from '../lib/modules';
import {
  capacityText, dateText, EMPTY_PLAN_FORM, editBody, endDateFor, formFromSession, hasStarted, isIsoDate, isWorkingDay, periodText, planBody, type PlanForm, type Session,
  SESSION_STATUS, SESSION_STATUS_OPTIONS, sessionActions, todayIso, validateCancel, validateEdit, validatePlan, validatePostpone,
} from '../lib/sessions';
import type { Profile } from '../lib/types';

const TODAY = '2026-11-06'; // vendredi
const NOW = new Date('2026-11-06T09:00:00Z');
const valid = (errors: object) => Object.keys(errors).length === 0;
const serverAccepts = (build: () => unknown) => {
  try {
    build();
    return true;
  } catch {
    return false;
  }
};
const marches = { id: 'r1', name: 'Salle de marchés', kind: 'WORKSTATIONS' as const, usableSeats: 13 };
const cours = { id: 'r2', name: 'Salle de réunion', kind: 'CLASSROOM' as const, usableSeats: 16 };
const rooms = [marches, cours];
const ctx = (needsWorkstations: boolean | null = true) => ({ rooms, needsWorkstations, today: TODAY });
const form = (over: Partial<PlanForm> = {}): PlanForm => ({ trainingId: 't1', rhythm: 'DAY', startDate: '2026-11-16', roomId: 'r1', trainerId: 'f1', capacity: '13', ...over });

const session = (over: Partial<Session> = {}): Session => ({
  id: 's1', trainingId: 't1', trainingTitle: 'Certificat trading', programName: 'Marchés financiers', rhythm: { code: 'DAY', label: 'Cours du jour', weeks: 1, totalHours: 35 },
  startDate: '2026-11-16', endDate: '2026-11-20', roomId: 'r1', roomName: 'Salle de marchés', roomKind: 'WORKSTATIONS', roomUsableSeats: 13, trainerId: 'f1', trainerName: 'Ida Interne',
  capacity: 13, enrolled: 0, status: 'PLANNED', phase: 'UPCOMING', cancelReason: null, needsWorkstations: true, version: 1, createdAt: '2026-11-06T09:00:00.000Z', ...over,
});

describe('sessions : dates', () => {
  it('reconnaît une date du calendrier et les jours de cours', () => {
    expect(isIsoDate('2026-11-16')).toBe(true);
    for (const bad of ['', '16/11/2026', '2026-02-30', '2026-13-01']) expect(isIsoDate(bad)).toBe(false);
    expect(isWorkingDay('2026-11-16')).toBe(true);
    expect(isWorkingDay('2026-11-14')).toBe(false);
    expect(isWorkingDay('2026-11-15')).toBe(false);
  });

  it('calcule la fin comme le serveur : une semaine du lundi au vendredi, cinq jours de cours depuis le mercredi, deux semaines', () => {
    expect(endDateFor('2026-11-16', 1)).toBe('2026-11-20');
    expect(endDateFor('2026-11-18', 1)).toBe('2026-11-24');
    expect(endDateFor('2026-11-16', 2)).toBe('2026-11-27');
    for (const rhythm of RHYTHMS) {
      for (const start of ['2026-11-16', '2026-11-18', '2026-11-20', '2026-12-31']) {
        expect([rhythm.code, start, endDateFor(start, rhythm.weeks)]).toEqual([rhythm.code, start, serverEndDate(start, rhythm)]);
      }
    }
    for (const day of ['2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16']) expect(isWorkingDay(day)).toBe(serverWorkingDay(day));
  });

  it('affiche une date du serveur sans décalage de fuseau, et la période en une phrase', () => {
    expect(dateText('2026-11-16')).toMatch(/16 nov/);
    expect(dateText('pas une date')).toBe('pas une date');
    expect(periodText(session())).toMatch(/^du .*16 nov.* au .*20 nov/);
    expect(todayIso(new Date(2026, 10, 6, 23, 30))).toBe('2026-11-06');
  });
});

describe('sessions : planification', () => {
  it('accepte une saisie complète et conforme', () => {
    expect(valid(validatePlan(form(), ctx()))).toBe(true);
    expect(planBody(form({ startDate: ' 2026-11-16 ' }))).toEqual({ trainingId: 't1', rhythm: 'DAY', startDate: '2026-11-16', roomId: 'r1', trainerId: 'f1', capacity: 13 });
  });

  it('refuse les champs vides, une date passée ou de week-end, une capacité hors plage', () => {
    expect(Object.keys(validatePlan(EMPTY_PLAN_FORM(), ctx()))).toEqual(['trainingId', 'startDate', 'roomId', 'trainerId', 'capacity']);
    expect(validatePlan(form({ startDate: '2026-11-05' }), ctx()).startDate).toMatch(/passé/);
    expect(validatePlan(form({ startDate: '2026-11-14' }), ctx()).startDate).toMatch(/jour de cours/);
    expect(validatePlan(form({ startDate: '2026-02-30' }), ctx()).startDate).toMatch(/valide/);
    for (const capacity of ['0', '-3', '1001', '12.5', 'abc']) expect(validatePlan(form({ capacity }), ctx()).capacity).toMatch(/entier entre 1 et 1000/);
  });

  it('plafonne la capacité aux places utiles de la salle (13 et non 14) et exige une salle à postes pour un module pratique', () => {
    expect(validatePlan(form({ capacity: '14' }), ctx()).capacity).toMatch(/places utiles.*13/);
    expect(valid(validatePlan(form({ capacity: '13' }), ctx()))).toBe(true);
    expect(validatePlan(form({ roomId: 'r2', capacity: '10' }), ctx(true)).roomId).toMatch(/module pratique/);
    expect(valid(validatePlan(form({ roomId: 'r2', capacity: '16' }), ctx(false)))).toBe(true);
    expect(valid(validatePlan(form({ roomId: 'r2', capacity: '16' }), ctx(null)))).toBe(true); // inconnu : le serveur tranchera
  });

  it('suit le serveur sur les dates et la capacité (même verdict pour les mêmes cas)', () => {
    const cases = [
      { startDate: '2026-11-16', capacity: 13 }, { startDate: '2026-11-06', capacity: 13 }, { startDate: '2026-11-05', capacity: 13 }, { startDate: '2026-11-14', capacity: 13 },
      { startDate: '2026-02-30', capacity: 13 }, { startDate: '', capacity: 13 }, { startDate: '2026-11-16', capacity: 0 }, { startDate: '2026-11-16', capacity: 1001 }, { startDate: '2026-11-16', capacity: 12.5 },
    ];
    for (const c of cases) {
      const client = valid(validatePlan(form({ startDate: c.startDate, capacity: String(c.capacity), roomId: 'r1' }), { ...ctx(), rooms: [{ ...marches, usableSeats: 1000 }] }));
      const server = serverAccepts(() => ServerSession.create({ id: 's', trainingId: 't', rhythm: 'DAY', startDate: c.startDate, roomId: 'r', trainerId: 'f', capacity: c.capacity, today: TODAY, now: NOW }));
      expect([c, client]).toEqual([c, server]);
    }
  });
});

describe('sessions : modification, report, annulation', () => {
  it('ne transmet que les champs modifiés', () => {
    const s = session();
    expect(editBody(formFromSession(s), s)).toEqual({ version: 1 });
    expect(editBody({ roomId: 'r2', trainerId: 'f1', capacity: '10' }, s)).toEqual({ version: 1, roomId: 'r2', capacity: 10 });
  });

  it('applique à la modification les mêmes plafonds qu\'à la planification', () => {
    expect(valid(validateEdit({ roomId: 'r1', trainerId: 'f1', capacity: '13' }, rooms, true))).toBe(true);
    expect(validateEdit({ roomId: 'r1', trainerId: 'f1', capacity: '14' }, rooms, true).capacity).toMatch(/places utiles/);
    expect(validateEdit({ roomId: 'r2', trainerId: 'f1', capacity: '10' }, rooms, true).roomId).toMatch(/module pratique/);
    expect(validateEdit({ roomId: 'r1', trainerId: '', capacity: '' }, rooms, true)).toMatchObject({ trainerId: expect.any(String), capacity: expect.any(String) });
  });

  it('exige une nouvelle date de début valide et différente, et un motif', () => {
    const s = session();
    expect(valid(validatePostpone({ startDate: '2026-11-23', reason: 'Formateur indisponible' }, s, TODAY))).toBe(true);
    expect(validatePostpone({ startDate: '', reason: '' }, s, TODAY)).toMatchObject({ startDate: expect.any(String), reason: expect.stringMatching(/obligatoire/) });
    expect(validatePostpone({ startDate: '2026-11-16', reason: 'x' }, s, TODAY).startDate).toMatch(/identique/);
    expect(validatePostpone({ startDate: '2026-11-14', reason: 'x' }, s, TODAY).startDate).toMatch(/jour de cours/);
    expect(validatePostpone({ startDate: '2026-11-02', reason: 'x' }, s, TODAY).startDate).toMatch(/passé/);
    expect(validatePostpone({ startDate: '2026-11-23', reason: 'x'.repeat(501) }, s, TODAY).reason).toMatch(/500/);
  });

  it('exige un motif d\'annulation', () => {
    expect(validateCancel('   ')).toMatch(/obligatoire/);
    expect(validateCancel('x'.repeat(501))).toMatch(/500/);
    expect(validateCancel('Pas assez d\'inscrits')).toBeUndefined();
  });
});

describe('sessions : actions selon l\'état, les dates et les droits', () => {
  const full = { update: true, cancel: true };
  it('une session planifiée avant son début : tout est possible', () => {
    expect(sessionActions(session(), full, TODAY)).toEqual({ edit: true, open: true, postpone: true, cancel: true });
  });
  it('une session ouverte ne s\'ouvre plus mais se modifie, se reporte, s\'annule', () => {
    expect(sessionActions(session({ status: 'OPEN' }), full, TODAY)).toEqual({ edit: true, open: false, postpone: true, cancel: true });
  });
  it('une session commencée ne se reporte plus', () => {
    expect(hasStarted(session({ startDate: '2026-11-06' }), TODAY)).toBe(true);
    expect(sessionActions(session({ status: 'OPEN', startDate: '2026-11-03' }), full, TODAY)).toEqual({ edit: true, open: false, postpone: false, cancel: true });
  });
  it('une session annulée ou clôturée n\'offre plus aucune action', () => {
    for (const status of ['CANCELLED', 'CLOSED'] as const) expect(sessionActions(session({ status }), full, TODAY)).toEqual({ edit: false, open: false, postpone: false, cancel: false });
  });
  it('sans droit d\'écriture, aucune action ; annuler dépend de son propre droit', () => {
    expect(sessionActions(session(), { update: false, cancel: false }, TODAY)).toEqual({ edit: false, open: false, postpone: false, cancel: false });
    expect(sessionActions(session(), { update: false, cancel: true }, TODAY)).toEqual({ edit: false, open: false, postpone: false, cancel: true });
  });
});

describe('sessions : libellés et module du hub', () => {
  it('chaque état a un libellé, et les filtres couvrent toutes, planifiées, ouvertes, annulées', () => {
    expect(Object.values(SESSION_STATUS).map((s) => s.label)).toEqual(['Planifiée', 'Ouverte aux inscriptions', 'Clôturée', 'Annulée']);
    expect(SESSION_STATUS_OPTIONS.map((o) => o.label)).toEqual(['Toutes', 'Planifiées', 'Ouvertes', 'Annulées']);
    expect(capacityText({ capacity: 13, roomUsableSeats: 13 })).toBe('13 places sur 13 utiles');
    expect(capacityText({ capacity: 1, roomUsableSeats: 13 })).toBe('1 place sur 13 utiles');
  });

  it('le module « Sessions de formation » n\'apparaît que pour qui peut lire les sessions', () => {
    const profile = (...permissions: string[]) => ({ permissions: permissions.map((code) => ({ code, scope: 'ALL' })) }) as unknown as Profile;
    expect(availableModules(profile('training.session.read')).some((m) => m.id === 'sessions')).toBe(true);
    expect(availableModules(profile('training.program.read')).some((m) => m.id === 'sessions')).toBe(false);
  });

  it('la page lit ses droits et ne propose « Nouvelle session » qu\'avec le droit de créer', () => {
    const source = readFileSync(join(__dirname, '../app/(app)/training/sessions/page.tsx'), 'utf8');
    expect(source).toContain("can(profile, SESSION_PERMISSIONS.create)");
    expect(source).toContain('canCreate ?');
    expect(source).toContain('sessionActions(s, rights, today)');
  });
});
