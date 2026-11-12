import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { availableModules, MODULES } from '../lib/modules';
import {
  addDays, canEditCell, cellOf, dayTotals, HR_WINDOW, inWindow, isWeekend, MODE_OPTIONS, modeLabel, modeSymbol, type PresenceBoard, type PresenceRow, SELF_WINDOW, shiftWeek,
  weekDays, weekdayName, weekStart,
} from '../lib/presences';
import type { Profile } from '../lib/types';

const root = join(__dirname, '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const row = (patch: Partial<PresenceRow> = {}): PresenceRow => ({ employeeId: 'e1', employeeName: 'Sam Test', department: 'Support', entries: [], leaveDays: [], ...patch });
const board = (patch: Partial<Pick<PresenceBoard, 'viewerEmployeeId' | 'canDeclareForAll'>> = {}) => ({ viewerEmployeeId: 'e1', canDeclareForAll: false, ...patch });
// 2026-11-10 est un mardi.
const TODAY = '2026-11-10';

describe('RH-4b — semaine', () => {
  it('le lundi de la semaine, quel que soit le jour', () => {
    for (const day of ['2026-11-09', '2026-11-10', '2026-11-13', '2026-11-15']) expect(weekStart(day)).toBe('2026-11-09');
    expect(weekStart('2026-11-16')).toBe('2026-11-16');
    expect(weekStart('2026-01-01')).toBe('2025-12-29');
  });

  it('sept jours du lundi au dimanche, et le passage d’un mois ou d’une année', () => {
    expect(weekDays('2026-11-09')).toEqual(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']);
    expect(weekDays('2026-12-28')[6]).toBe('2027-01-03');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('une semaine plus tôt ou plus tard', () => {
    expect(shiftWeek('2026-11-09', 1)).toBe('2026-11-16');
    expect(shiftWeek('2026-11-09', -1)).toBe('2026-11-02');
  });

  it('week-end et nom du jour', () => {
    expect(isWeekend('2026-11-14')).toBe(true);
    expect(isWeekend('2026-11-15')).toBe(true);
    expect(isWeekend('2026-11-13')).toBe(false);
    expect(weekdayName('2026-11-09')).toBe('lundi');
    expect(weekdayName('2026-11-15')).toBe('dimanche');
  });
});

describe('RH-4b — modes : trois possibilités, un texte et un symbole distincts', () => {
  it('sur site, télétravail, déplacement', () => {
    expect(MODE_OPTIONS.map((m) => m.code)).toEqual(['ON_SITE', 'REMOTE', 'TRAVEL']);
    expect(MODE_OPTIONS.map((m) => m.label)).toEqual(['Sur site', 'Télétravail', 'Déplacement']);
    expect(new Set(MODE_OPTIONS.map((m) => m.symbol)).size).toBe(3);
    expect(modeLabel('REMOTE')).toBe('Télétravail');
    expect(modeSymbol('TRAVEL')).toBe('→');
    expect(modeLabel('AUTRE')).toBe('AUTRE');
  });

  it('les codes sont ceux du serveur', () => {
    const server = readFileSync(join(root, '..', 'api/src/modules/hr/domain/presence.ts'), 'utf8');
    for (const { code } of MODE_OPTIONS) expect(server).toContain(`'${code}'`);
  });
});

describe('RH-4b — fenêtres de saisie (celles du serveur)', () => {
  it('valeurs de départ : 7 et 30 jours pour soi, 90 et 90 pour la RH', () => {
    expect(SELF_WINDOW).toEqual({ past: 7, future: 30 });
    expect(HR_WINDOW).toEqual({ past: 90, future: 90 });
    const server = readFileSync(join(root, '..', 'api/src/modules/hr/domain/presence.ts'), 'utf8');
    expect(server).toContain('SELF_WINDOW = { past: 7, future: 30 }');
    expect(server).toContain('HR_WINDOW = { past: 90, future: 90 }');
  });

  it('bornes comprises pour soi', () => {
    expect(inWindow('2026-11-03', TODAY, false)).toBe(true);
    expect(inWindow('2026-11-02', TODAY, false)).toBe(false);
    expect(inWindow('2026-12-10', TODAY, false)).toBe(true);
    expect(inWindow('2026-12-11', TODAY, false)).toBe(false);
  });

  it('bornes comprises pour la RH', () => {
    expect(inWindow('2026-08-12', TODAY, true)).toBe(true);
    expect(inWindow('2026-08-11', TODAY, true)).toBe(false);
    expect(inWindow('2027-02-08', TODAY, true)).toBe(true);
    expect(inWindow('2027-02-09', TODAY, true)).toBe(false);
  });
});

describe('RH-4b — qui peut saisir quelle case', () => {
  it('chacun saisit sa propre ligne, dans la fenêtre', () => {
    expect(canEditCell(board(), row(), TODAY, TODAY)).toBe(true);
    expect(canEditCell(board(), row(), '2026-11-02', TODAY)).toBe(false);
    expect(canEditCell(board(), row(), '2026-12-11', TODAY)).toBe(false);
  });

  it('pas la ligne d’un autre sans le droit de déclarer pour tous', () => {
    expect(canEditCell(board(), row({ employeeId: 'e2' }), TODAY, TODAY)).toBe(false);
    expect(canEditCell(board({ viewerEmployeeId: null }), row(), TODAY, TODAY)).toBe(false);
  });

  it('la RH saisit n’importe quelle ligne, avec sa fenêtre plus large', () => {
    const hr = board({ viewerEmployeeId: 'e9', canDeclareForAll: true });
    expect(canEditCell(hr, row(), TODAY, TODAY)).toBe(true);
    expect(canEditCell(hr, row(), '2026-09-01', TODAY)).toBe(true);
    expect(canEditCell(hr, row(), '2026-08-01', TODAY)).toBe(false);
  });

  it('jamais sur un jour d’absence validée', () => {
    expect(canEditCell(board(), row({ leaveDays: [TODAY] }), TODAY, TODAY)).toBe(false);
    expect(canEditCell(board({ canDeclareForAll: true }), row({ leaveDays: [TODAY] }), TODAY, TODAY)).toBe(false);
    expect(canEditCell(board(), row({ leaveDays: ['2026-11-11'] }), TODAY, TODAY)).toBe(true);
  });
});

describe('RH-4b — contenu d’une case et totaux du jour', () => {
  it('absence validée avant tout, sinon le mode déclaré, sinon rien', () => {
    expect(cellOf(row({ leaveDays: [TODAY], entries: [{ day: TODAY, mode: 'REMOTE' }] }), TODAY)).toEqual({ kind: 'leave' });
    expect(cellOf(row({ entries: [{ day: TODAY, mode: 'REMOTE' }] }), TODAY)).toEqual({ kind: 'mode', mode: 'REMOTE' });
    expect(cellOf(row({ entries: [{ day: '2026-11-11', mode: 'REMOTE' }] }), TODAY)).toEqual({ kind: 'none' });
  });

  it('un week-end au milieu d’une absence n’est pas un jour d’absence : la case reste neutre et n’est pas comptée', () => {
    const away = row({ leaveDays: ['2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16'] });
    expect(cellOf(away, '2026-11-13')).toEqual({ kind: 'leave' });
    expect(cellOf(away, '2026-11-14')).toEqual({ kind: 'none' });
    expect(cellOf(away, '2026-11-15')).toEqual({ kind: 'none' });
    expect(cellOf(away, '2026-11-16')).toEqual({ kind: 'leave' });
    expect(dayTotals([away], '2026-11-14').LEAVE).toBe(0);
    expect(dayTotals([away], '2026-11-13').LEAVE).toBe(1);
  });

  it('compte chaque mode et les absents', () => {
    const rows = [
      row({ employeeId: 'a', entries: [{ day: TODAY, mode: 'ON_SITE' }] }), row({ employeeId: 'b', entries: [{ day: TODAY, mode: 'ON_SITE' }] }),
      row({ employeeId: 'c', entries: [{ day: TODAY, mode: 'REMOTE' }] }), row({ employeeId: 'd', entries: [{ day: TODAY, mode: 'TRAVEL' }] }),
      row({ employeeId: 'e', leaveDays: [TODAY] }), row({ employeeId: 'f' }),
    ];
    expect(dayTotals(rows, TODAY)).toEqual({ ON_SITE: 2, REMOTE: 1, TRAVEL: 1, LEAVE: 1 });
    expect(dayTotals([], TODAY)).toEqual({ ON_SITE: 0, REMOTE: 0, TRAVEL: 0, LEAVE: 0 });
  });
});

describe('RH-4b — menu', () => {
  const profile = (grants: Record<string, 'OWN' | 'TEAM' | 'ALL'>): Profile => ({
    userId: 'u', email: 'u@x', displayName: 'U', roles: [], permissions: Object.entries(grants).map(([code, scope]) => ({ code, scope })), mfaEnrolled: true,
  });

  it('un écran « Présences » dans le domaine « Ressources humaines », avec son droit de lecture', () => {
    expect(MODULES.find((m) => m.id === 'presences')).toMatchObject({ group: 'Ressources humaines', href: '/hr/presences', permission: 'hr.presence.read', label: 'Présences' });
  });

  it('proposé à qui lit les présences, pas aux autres', () => {
    const has = (p: Profile) => availableModules(p).some((m) => m.id === 'presences');
    expect(has(profile({ 'hr.presence.read': 'OWN' }))).toBe(true);
    expect(has(profile({ 'hr.presence.read': 'ALL' }))).toBe(true);
    expect(has(profile({ 'hr.presence.declare': 'OWN' }))).toBe(false);
    expect(has(profile({}))).toBe(false);
  });
});

describe('RH-4b — écrans : déclaratifs, sans heure ni lieu ni texte libre', () => {
  const files = ['app/(app)/hr/presences/page.tsx', 'components/hr/presence-dialog.tsx', 'lib/presences.ts'];
  it('aucune heure, aucun lieu, aucun pointage dans les écrans', () => {
    for (const file of files) expect(read(file), file).not.toMatch(/checkIn|checkOut|clock-?in|badge|geoloc|latitude|longitude|type="time"|type="datetime/i);
  });
  it('aucune zone de texte libre', () => {
    for (const file of files) expect(read(file), file).not.toContain('<textarea');
  });
  it('aucun bouton « Fermer » en bas de la fenêtre', () => {
    expect(read('components/hr/presence-dialog.tsx')).not.toMatch(/>\s*Fermer\s*<\/button>/);
  });
  it('le mode est dit par un texte et un symbole, jamais le symbole seul', () => {
    const page = read('app/(app)/hr/presences/page.tsx');
    expect(page).toContain('className="sr-only">{modeLabel(cell.mode)}');
    expect(page).toContain('absent (absence validée)');
    expect(page).toContain('non déclaré');
  });
  it('la fenêtre parle de « vous » seulement pour soi-même ; la RH qui saisit pour un autre voit son nom', () => {
    const dialog = read('components/hr/presence-dialog.tsx');
    expect(dialog).toContain("self ? 'Où travaillez-vous ce jour-là ?' : `Où travaille ${employeeName} ce jour-là ?`");
    expect(read('app/(app)/hr/presences/page.tsx')).toContain('self={editing.row.employeeId === board?.viewerEmployeeId}');
  });
  it('la fenêtre se lit comme un groupe nommé de trois choix, et l’erreur est reliée au groupe', () => {
    const dialog = read('components/hr/presence-dialog.tsx');
    expect(dialog).toContain('<legend');
    expect(dialog).toContain("aria-describedby={missing ? 'presence-error' : undefined}");
    expect(dialog).toContain('<p id="presence-error" role="alert" className="error">');
    expect(dialog).toContain('type="radio"');
  });
  it('l’écran lit avec hr.presence.read ; la saisie passe toujours par le serveur, qui reste juge', () => {
    const page = read('app/(app)/hr/presences/page.tsx');
    expect(page).toContain("can(profile, 'hr.presence.read')");
    expect(page).toContain("canAll(profile, 'hr.presence.read')");
    expect(read('components/hr/presence-dialog.tsx')).toContain("`/hr/presences/${day}?employeeId=${employeeId}`");
  });
  it('un compte sans fiche employé est invité à demander à la RH de la relier', () => {
    expect(read('app/(app)/hr/presences/page.tsx')).toContain('Demandez à la RH de la relier');
  });
});
