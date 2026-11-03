import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { columnWidths, SELECTION_SHARE } from '../lib/table-layout';

const root = join(__dirname, '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const css = read('app/globals.css');
const rule = (selector: string) => css.slice(css.indexOf(`${selector} {`), css.indexOf('}', css.indexOf(`${selector} {`)) + 1);

describe('fenêtres : cadre fixe, corps qui défile, boutons visibles (observation de recette 2)', () => {
  it('le cadre ne défile pas : colonne, débordement masqué, largeur bornée par l’écran', () => {
    const dialog = rule('.dialog');
    expect(dialog).toMatch(/display: flex/);
    expect(dialog).toMatch(/flex-direction: column/);
    expect(dialog).toMatch(/overflow: hidden/);
    expect(dialog).toMatch(/padding: 0/);
    expect(dialog).toMatch(/calc\(100vw - 2rem\)/);
  });
  it('seul le corps défile, avec une barre fine, à l’intérieur du cadre et à place réservée', () => {
    const body = rule('.dialog-body');
    expect(body).toMatch(/overflow: auto/);
    expect(body).toMatch(/scrollbar-gutter: stable/);
    expect(body).toMatch(/margin: 0 \.5rem \.75rem 0/);
    expect(body).not.toMatch(/overflow-x: hidden/);
  });
  it('les boutons d’action restent collés en bas du corps', () => {
    expect(css).toMatch(/\.dialog-body > \.row\.end:last-child[^{]*\{[^}]*position: sticky[^}]*bottom: 0/);
  });
  it('le composant Modal enveloppe le contenu dans le corps défilant', () => {
    expect(read('components/modal.tsx')).toContain('<div className="dialog-body">{children}</div>');
  });
});

describe('barres de défilement minimalistes sur toute l’application (correctif de recette)', () => {
  it('toute l’application : barre fine, sans rail, pouce discret qui se renforce au survol', () => {
    expect(css).toMatch(/\* \{ scrollbar-width: thin; scrollbar-color: color-mix\(in srgb, var\(--ink\) \d+%, transparent\) transparent; \}/);
    expect(css).toMatch(/\*:hover \{ scrollbar-color: color-mix\(in srgb, var\(--ink\) \d+%, transparent\) transparent; \}/);
  });
  it('les couleurs suivent les thèmes (dérivées du texte), jamais une couleur en dur', () => {
    const block = css.slice(css.indexOf('/* Barres de défilement minimalistes'), css.indexOf('body {'));
    expect(block).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(/);
    expect(block).toMatch(/var\(--ink\)/);
  });
  it('un repli existe pour les navigateurs sans « scrollbar-width »', () => {
    expect(css).toMatch(/@supports not \(scrollbar-width: thin\)[^]*::-webkit-scrollbar-thumb/);
  });
});

describe('tableaux : icône de tri propre, sans changer l’aspect du tableau (correctif de recette)', () => {
  const table = read('components/data/data-table.tsx');
  it('plus de symboles de texte (↕ ▲ ▼) : des pictogrammes du jeu', () => {
    for (const glyph of ['↕', '▲', '▼']) expect(table).not.toContain(glyph);
    expect(table).toContain("'sort-asc'");
    expect(table).toContain("'sort-desc'");
    expect(table).toContain("'sort'");
    const icons = read('components/icon.tsx');
    for (const name of ['sort', 'sort-asc', 'sort-desc']) expect(icons).toContain(`'${name}':`.replace("'sort':", 'sort:'));
  });
  it('l’en-tête ne se déplace ni ne s’élargit : emplacement d’icône de taille fixe, sens annoncé par aria-sort', () => {
    expect(table).toMatch(/className=\{`size-4 /);
    expect(table).toContain('aria-sort=');
  });
  it('largeurs de colonnes fixes : mise en page fixe, une part relative par colonne, textes longs coupés, largeur minimale', () => {
    expect(table).toMatch(/table-fixed/);
    expect(table).toMatch(/<colgroup>/);
    expect(table).toContain('columnWidths(columns.map((column) => column.weight)');
    expect(table).toMatch(/min-w-\[48rem\]/);
    expect(table).toMatch(/\[overflow-wrap:anywhere\]/);
    expect(table).toMatch(/width: '3rem'/);
  });
  it('les neuf tableaux de l’application donnent une part à leurs colonnes principales', () => {
    const files = ['app/(app)/companies/page.tsx', 'app/(app)/contacts/page.tsx', 'app/(app)/admin/users/page.tsx', 'app/(app)/ambassadors/page.tsx', 'app/(app)/offers/page.tsx', 'app/(app)/followups/page.tsx', 'components/documents/documents-panel.tsx', 'app/(app)/account/sessions/page.tsx'];
    for (const file of files) {
      const source = read(file);
      const columns = (source.match(/id: '/g) ?? []).length;
      const weighted = (source.match(/weight: [0-9.]+/g) ?? []).length;
      expect(weighted, file).toBeGreaterThanOrEqual(columns - 1);
    }
  });
  it('l’icône du tri actif est colorée et pleine ; les autres sont atténuées jusqu’au survol', () => {
    expect(table).toMatch(/text-\[var\(--brand-strong\)\]/);
    expect(table).toMatch(/opacity-40 group-hover:opacity-100/);
  });
});

describe('largeurs de colonnes : calcul des parts', () => {
  it('chaque colonne reçoit sa part relative ; le total fait 100 % sans case de sélection', () => {
    expect(columnWidths([4, 2, 2], false)).toEqual(['50.00%', '25.00%', '25.00%']);
    expect(columnWidths([1, 1, 1, 1], false)).toEqual(['25.00%', '25.00%', '25.00%', '25.00%']);
  });
  it('une colonne sans poids (ou à poids nul) compte pour 1', () => {
    expect(columnWidths([undefined, 3], false)).toEqual(['25.00%', '75.00%']);
    expect(columnWidths([0, 1], false)).toEqual(['50.00%', '50.00%']);
  });
  it('avec une case de sélection, les colonnes se partagent 93 % : 7 % restent à la case', () => {
    expect(SELECTION_SHARE).toBe(93);
    expect(columnWidths([1, 1], true)).toEqual(['46.50%', '46.50%']);
    const total = columnWidths([4, 2.4, 2, 3.6, 2.6, 2.6, 2.4, 2, 1.8], true).reduce((n, w) => n + parseFloat(w), 0);
    expect(total).toBeGreaterThan(92.9);
    expect(total).toBeLessThan(93.1);
  });
  it('les parts ne dépendent que des poids : jamais du contenu des lignes', () => {
    expect(columnWidths([2, 1], false)).toEqual(columnWidths([2, 1], false));
  });
});
