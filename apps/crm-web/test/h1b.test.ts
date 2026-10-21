import { describe, expect, it } from 'vitest';
import { pageRange } from '../components/data/pagination';
import { initialsOf } from '../components/data/entity-cell';
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
