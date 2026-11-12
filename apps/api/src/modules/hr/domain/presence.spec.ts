import { PRESENCE_MODE_CODES } from '../presentation/dto/presence.dto';
import { HR_WINDOW, PRESENCE_MODES, PresenceDeclaration, SELF_WINDOW, assertDay, coversWholeDay, parseMode } from './presence';

const now = new Date('2026-11-10T09:00:00Z');
const uuid = '00000000-0000-4000-8000-000000000004';
const declare = (over: Partial<{ employeeId: string; day: string; mode: string }> = {}) =>
  PresenceDeclaration.declare({ id: 'p1', employeeId: uuid, day: '2026-11-10', mode: 'REMOTE', declaredByUserId: 'u1', now, ...over });

describe('PresenceDeclaration', () => {
  it('déclare un mode pour un jour : une valeur parmi trois, rien d’autre', () => {
    const p = declare();
    expect(p).toMatchObject({ id: 'p1', employeeId: uuid, day: '2026-11-10', mode: 'REMOTE', declaredByUserId: 'u1', version: 1, createdAt: now, updatedAt: now });
  });

  it('la liste des modes du domaine est celle de l’interface de programmation', () => {
    expect([...PRESENCE_MODES]).toEqual(PRESENCE_MODE_CODES);
  });

  it.each([['ON_SITE'], ['REMOTE'], ['TRAVEL']])('accepte le mode %s', (mode) => {
    expect(declare({ mode }).mode).toBe(mode);
  });

  it.each([[''], ['remote'], ['HOME'], ['LATE'], ['HEURES']])('refuse le mode « %s »', (mode) => {
    expect(() => parseMode(mode)).toThrow(/mode de présence/);
    expect(() => declare({ mode })).toThrow(/mode de présence/);
  });

  it('refuse un employé qui n’est pas un identifiant et un jour qui n’existe pas', () => {
    expect(() => declare({ employeeId: 'abc' })).toThrow(/identifiant valide/);
    expect(() => declare({ day: '2026-02-30' })).toThrow(/date valide/);
    expect(() => declare({ day: '10/11/2026' })).toThrow(/date valide/);
    expect(() => assertDay('2026-11-10')).not.toThrow();
  });

  it('change le mode et garde la trace de la dernière saisie', () => {
    const p = declare();
    const later = new Date('2026-11-10T15:00:00Z');
    p.change({ mode: 'TRAVEL', by: 'u-hr', now: later });
    expect(p).toMatchObject({ mode: 'TRAVEL', declaredByUserId: 'u-hr', updatedAt: later, createdAt: now });
    expect(() => p.change({ mode: 'X', by: 'u-hr', now: later })).toThrow(/mode de présence/);
    expect(p.mode).toBe('TRAVEL');
  });

  it('les fenêtres de saisie : courte pour l’employé, plus large pour la RH', () => {
    expect(SELF_WINDOW).toEqual({ past: 7, future: 30 });
    expect(HR_WINDOW).toEqual({ past: 90, future: 90 });
  });
});

describe('coversWholeDay : une absence interdit la déclaration seulement si elle couvre la journée entière', () => {
  const period = (over: Partial<{ start: string; end: string; startHalf: boolean; endHalf: boolean }> = {}) => ({ start: '2026-11-10', end: '2026-11-12', startHalf: false, endHalf: false, ...over });

  it('un jour du milieu est couvert, un jour hors période ne l’est pas', () => {
    expect(coversWholeDay(period(), '2026-11-11')).toBe(true);
    expect(coversWholeDay(period(), '2026-11-09')).toBe(false);
    expect(coversWholeDay(period(), '2026-11-13')).toBe(false);
  });

  it('les bornes sont couvertes en entier sauf demi-journée', () => {
    expect(coversWholeDay(period(), '2026-11-10')).toBe(true);
    expect(coversWholeDay(period(), '2026-11-12')).toBe(true);
    expect(coversWholeDay(period({ startHalf: true }), '2026-11-10')).toBe(false);
    expect(coversWholeDay(period({ endHalf: true }), '2026-11-12')).toBe(false);
    expect(coversWholeDay(period({ startHalf: true }), '2026-11-12')).toBe(true);
    expect(coversWholeDay(period({ endHalf: true }), '2026-11-10')).toBe(true);
  });

  it('une absence d’un seul jour : couverte en entier, ou non dès qu’une moitié manque', () => {
    expect(coversWholeDay(period({ end: '2026-11-10' }), '2026-11-10')).toBe(true);
    expect(coversWholeDay(period({ end: '2026-11-10', startHalf: true }), '2026-11-10')).toBe(false);
    expect(coversWholeDay(period({ end: '2026-11-10', endHalf: true }), '2026-11-10')).toBe(false);
  });
});
