import { describe, expect, it } from 'vitest';
import { pageRange } from '../components/data/pagination';
import { initialsOf } from '../components/data/entity-cell';
import { extensionOf, formatBytes, formatDate, precheckFile } from '../lib/format';
import { allSelected, setMany, someSelected, toggleId } from '../lib/selection';
import { COMPANY_STATUS, USER_STATUS, statusStyle } from '../lib/status';

describe('sélection persistante (EXD-02)', () => {
  it('bascule un identifiant sans modifier l\'ensemble d\'origine', () => {
    const base = new Set(['a']);
    const added = toggleId(base, 'b');
    expect([...added].sort()).toEqual(['a', 'b']);
    expect([...base]).toEqual(['a']);
    expect([...toggleId(added, 'a')]).toEqual(['b']);
  });
  it('la case d\'en-tête : tout, rien ou partiel', () => {
    const ids = ['a', 'b', 'c'];
    expect(allSelected(new Set(), ids)).toBe(false);
    expect(allSelected(new Set(ids), ids)).toBe(true);
    expect(allSelected(new Set(['a', 'b']), ids)).toBe(false);
    expect(someSelected(new Set(['a']), ids)).toBe(true);
    expect(someSelected(new Set(ids), ids)).toBe(false);
    expect(someSelected(new Set(), ids)).toBe(false);
    expect(allSelected(new Set(['a']), [])).toBe(false);
  });
  it('tout sélectionner sur une page ne touche pas à la sélection des autres pages', () => {
    const otherPage = new Set(['x', 'y']);
    const next = setMany(otherPage, ['a', 'b'], true);
    expect([...next].sort()).toEqual(['a', 'b', 'x', 'y']);
    expect([...setMany(next, ['a', 'b'], false)].sort()).toEqual(['x', 'y']);
  });
});

describe('pagination', () => {
  it('bornes « de – à sur total »', () => {
    expect(pageRange(1, 20, 48)).toEqual({ from: 1, to: 20 });
    expect(pageRange(3, 20, 48)).toEqual({ from: 41, to: 48 });
    expect(pageRange(1, 20, 0)).toEqual({ from: 0, to: 0 });
  });
});

describe('affichage des entités et des statuts', () => {
  it('initiales : deux lettres au plus, jamais vides', () => {
    expect(initialsOf('Société Horizon SA')).toBe('SH');
    expect(initialsOf('  marie   claire  dupont ')).toBe('MC');
    expect(initialsOf('')).toBe('?');
  });
  it('chaque statut connu a un libellé français ; un statut inconnu garde son code', () => {
    for (const code of ['TARGET', 'CONTACTED', 'QUALIFIED', 'CLIENT', 'ARCHIVED']) expect(COMPANY_STATUS[code].label).not.toBe(code);
    for (const code of ['ACTIVE', 'PENDING', 'LOCKED', 'DISABLED']) expect(USER_STATUS[code].label).not.toBe(code);
    expect(statusStyle(COMPANY_STATUS, 'NOUVEAU')).toEqual({ label: 'NOUVEAU', tone: 'neutral' });
  });
  it('un compte verrouillé est signalé en danger, un compte actif en succès', () => {
    expect(USER_STATUS.LOCKED.tone).toBe('bad');
    expect(USER_STATUS.ACTIVE.tone).toBe('ok');
  });
});

describe('dates', () => {
  it('format français, tolérant aux valeurs absentes ou illisibles', () => {
    expect(formatDate('2026-10-21T08:30:00.000Z')).toBe('21/10/2026');
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
    expect(formatDate('pas une date')).toBe('—');
  });
});

describe('envoi de documents : tailles et contrôle de confort', () => {
  it('tailles lisibles en français', () => {
    expect(formatBytes(0)).toBe('0 o');
    expect(formatBytes(850)).toBe('850 o');
    expect(formatBytes(1536)).toBe('1,5 Ko');
    expect(formatBytes(10 * 1024 * 1024)).toBe('10 Mo');
    expect(formatBytes(-1)).toBe('—');
    expect(formatBytes(Number.NaN)).toBe('—');
  });
  it('extension en minuscules, sans le point', () => {
    expect(extensionOf('Rapport.PDF')).toBe('pdf');
    expect(extensionOf('LISEZMOI')).toBe('');
    expect(extensionOf('.pdf')).toBe('');
  });
  const rules = { maxBytes: 10 * 1024 * 1024, formats: ['pdf', 'jpg', 'png'] };
  it('refuse avant envoi un fichier vide, trop gros ou à extension non acceptée ; accepte le reste', () => {
    expect(precheckFile({ name: 'a.pdf', size: 0 }, rules)).toMatch(/vide/);
    expect(precheckFile({ name: 'a.pdf', size: rules.maxBytes + 1 }, rules)).toMatch(/taille maximale/);
    expect(precheckFile({ name: 'a.exe', size: 10 }, rules)).toMatch(/Formats acceptés : PDF, JPG, PNG/);
    expect(precheckFile({ name: 'SANS-EXTENSION', size: 10 }, rules)).toMatch(/Formats acceptés/);
    expect(precheckFile({ name: 'A.PDF', size: rules.maxBytes }, rules)).toBeNull();
  });
});

