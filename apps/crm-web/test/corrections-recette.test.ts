import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { columnLayout, SELECTION_REM, tableWidthRem, WEIGHT_UNIT_REM } from '../lib/table-layout';

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
  it('largeurs de colonnes fixes : mise en page fixe, largeur minimale par nature de colonne, défilement plutôt qu’écrasement (lot A)', () => {
    expect(table).toMatch(/table-fixed/);
    expect(table).toMatch(/<colgroup>/);
    expect(table).toContain('columnLayout(columns)');
    expect(table).toContain('tableWidthRem(layout');
    expect(table).toMatch(/Math\.max\(48,/);
    expect(table).toMatch(/\[overflow-wrap:anywhere\]/);
    expect(table).toMatch(/whitespace-nowrap/);
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

describe('largeurs de colonnes : calcul des largeurs (lot A)', () => {
  const column = (header: string, weight?: number, extra: Record<string, unknown> = {}) => ({ header, weight, ...extra });

  it('une colonne de texte reçoit sa part de poids (3,5 rem par unité), au moins une unité', () => {
    expect(WEIGHT_UNIT_REM).toBe(3.5);
    expect(columnLayout([column('Entreprise', 4), column('Responsable', 2)]).map((c) => c.width)).toEqual(['14.00rem', '7.00rem']);
    expect(columnLayout([column('Objet'), column('Note', 0), column('Autre', undefined)]).map((c) => c.width)).toEqual(['3.50rem', '3.50rem', '3.50rem']);
  });

  it('une colonne de date, téléphone, montant, état ou référence garde sa largeur minimale quel que soit son poids', () => {
    const widths = (header: string, weight: number) => columnLayout([column(header, weight)])[0]!.width;
    expect(widths('Créée le', 1)).toBe('8.00rem');
    expect(widths('Téléphone', 1)).toBe('10.00rem');
    expect(widths('Valeur', 1)).toBe('11.00rem');
    expect(widths('Statut', 1)).toBe('11.50rem');
    expect(widths('Référence', 1)).toBe('10.00rem');
    expect(widths('Pays', 1)).toBe('9.00rem');
    expect(widths('Dernière connexion', 1)).toBe('11.50rem');
    // Un poids plus grand que le minimum l'emporte.
    expect(widths('Statut', 5)).toBe('17.50rem');
  });

  it('une colonne peut préciser sa largeur minimale et sa coupure', () => {
    expect(columnLayout([column('Entreprise', 1, { min: 12 })])[0]).toEqual({ width: '12.00rem', nowrap: false });
    expect(columnLayout([column('Créée le', 1, { nowrap: false })])[0]!.nowrap).toBe(false);
    expect(columnLayout([column('Entreprise', 1, { nowrap: true })])[0]!.nowrap).toBe(true);
  });

  it('les dates, numéros, montants, états et références ne se coupent jamais ; le texte, si', () => {
    const nowrap = (header: string) => columnLayout([column(header)])[0]!.nowrap;
    for (const header of ['Créée le', 'Déposée le', 'Téléphone', 'Téléphone professionnel', 'Valeur', 'Montant', 'État', 'Statut', 'Référence', 'Dernière connexion']) expect([header, nowrap(header)]).toEqual([header, true]);
    for (const header of ['Entreprise', 'E-mail', 'Secteur', 'Pays', 'Objet', 'Responsable', 'Actions', 'Dates']) expect([header, nowrap(header)]).toEqual([header, false]);
  });

  it('les largeurs ne dépendent que des colonnes, jamais des lignes', () => {
    expect(columnLayout([column('Statut', 2), column('Objet', 3)])).toEqual(columnLayout([column('Statut', 2), column('Objet', 3)]));
  });

  it('la largeur totale compte la case de sélection (3 rem) et sert de largeur minimale du tableau', () => {
    expect(SELECTION_REM).toBe(3);
    const layout = columnLayout([column('Entreprise', 4), column('Créée le', 1)]);
    expect(tableWidthRem(layout, false)).toBe(22);
    expect(tableWidthRem(layout, true)).toBe(25);
  });
});
