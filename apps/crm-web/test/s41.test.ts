import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCompanyBody, EMPTY_COMPANY_FORM, type CompanyForm, validateCompanyFields, validateCompanyForm } from '../lib/facilitation';
import { COUNTRY_SUGGESTIONS } from '../lib/countries';

const root = join(__dirname, '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const form = (patch: Partial<CompanyForm> = {}): CompanyForm => ({ ...EMPTY_COMPANY_FORM, name: 'Acme', ...patch });
const css = read('app/globals.css');
const rule = (selector: string) => css.slice(css.indexOf(selector), css.indexOf('}', css.indexOf(selector)) + 1);

describe('retours de tests S4.0 — fenêtres : une croix en haut à droite, plus de bouton « Fermer » en bas', () => {
  const modal = read('components/modal.tsx');
  it('la fenêtre porte une croix nommée « Fermer la fenêtre », avec le pictogramme de croix, placée dans l\'en-tête', () => {
    expect(modal).toContain('className="dialog-close"');
    expect(modal).toContain('aria-label="Fermer la fenêtre"');
    expect(modal).toContain('<Icon name="close"');
    const closeAt = modal.indexOf('className="dialog-close"');
    expect(closeAt).toBeGreaterThan(modal.indexOf('<h2>'));
    expect(closeAt).toBeLessThan(modal.indexOf('{children}'));
  });
  it('la croix est à droite de l\'en-tête, et ne prend jamais le focus avant un champ', () => {
    expect(rule('.dialog-head {')).toMatch(/justify-content:\s*space-between/);
    expect(modal).toContain("input, select, textarea");
    expect(modal).toMatch(/button:not\(\.dialog-close\)/);
  });
  it('aucune fenêtre ne garde un bouton « Fermer » en bas', () => {
    for (const file of ['components/documents/documents-panel.tsx', 'app/(app)/admin/users/page.tsx', 'components/companies/company-dialog.tsx', 'components/step-up-dialog.tsx', 'components/confirm-dialog.tsx', 'app/(app)/account/sessions/page.tsx']) {
      expect(read(file), file).not.toMatch(/>\s*Fermer\s*<\/button>/);
    }
  });
  it('« Annuler » reste à côté de l\'action principale des formulaires (choix explicite, pas une simple fermeture)', () => {
    expect(read('components/companies/company-dialog.tsx')).toContain('>Annuler</button>');
  });
  it('largeur minimale : la fenêtre ne se tasse pas, et prend toute la largeur d\'un écran étroit', () => {
    expect(rule('.dialog { min-width')).toMatch(/min-width:\s*min\(26rem,\s*100%\)/);
    expect(rule('.dialog.wide { min-width')).toMatch(/min-width:\s*min\(46rem,\s*100%\)/);
  });
});

describe('retours de tests S4.0 — zones de commentaire à taille fixe', () => {
  it('aucune zone de texte n\'est redimensionnable à la main, et elle défile au-delà', () => {
    const textarea = rule('\ntextarea {');
    expect(textarea).toMatch(/resize:\s*none/);
    expect(textarea).toMatch(/overflow-y:\s*auto/);
  });
  it('les zones de texte reçoivent la même mise en forme que les champs (et le même anneau de focus)', () => {
    expect(css).toMatch(/input, select, textarea \{/);
    expect(css).toMatch(/textarea:focus-visible/);
  });
  it('le commentaire du facilitateur est borné à 2 000 caractères, avec compteur annoncé', () => {
    const dialog = read('components/companies/company-dialog.tsx');
    expect(dialog).toContain('maxLength={COMMENT_MAX}');
    expect(dialog).toContain('const COMMENT_MAX = 2000');
    expect(dialog).toContain('aria-describedby="company-facilitator-comment-count"');
  });
});

describe('retours de tests S4.0 — pays d\'affiliation', () => {
  it('le pays est envoyé s\'il est saisi, omis sinon, et sans espaces', () => {
    expect(buildCompanyBody(form({ country: '  Cameroun ' }))).toEqual({ name: 'Acme', country: 'Cameroun' });
    expect(buildCompanyBody(form({ country: '   ' }))).toEqual({ name: 'Acme' });
  });
  it('le pays est facultatif mais borné à 100 caractères comme côté serveur', () => {
    expect(validateCompanyFields(form({ country: 'x'.repeat(100) }))).toEqual({});
    expect(validateCompanyFields(form({ country: 'x'.repeat(101) })).country).toBeDefined();
  });
  it('des suggestions sont proposées sans doublon, la saisie libre reste possible', () => {
    expect(new Set(COUNTRY_SUGGESTIONS).size).toBe(COUNTRY_SUGGESTIONS.length);
    expect(COUNTRY_SUGGESTIONS).toEqual(expect.arrayContaining(['Cameroun', 'Gabon', 'Côte d’Ivoire']));
    expect(read('components/companies/company-dialog.tsx')).toContain('list="company-country-suggestions"');
  });
});

describe('retours de tests S4.0 — champs non conformes en surbrillance', () => {
  it('chaque règle désigne son champ ; le premier champ en erreur est le premier de la page', () => {
    const errors = validateCompanyFields(form({ name: '', email: 'x', phone: 'abc', facilitatorMode: 'new', facilitatorPhone: 'abc' }));
    expect(Object.keys(errors)).toEqual(['name', 'email', 'phone', 'facilitatorLastName', 'facilitatorFirstName', 'facilitatorPhone']);
  });
  it('la liste de messages garde exactement les mêmes contrôles que le contrôle champ par champ', () => {
    for (const f of [form(), form({ email: 'x' }), withBadCommission(), form({ name: '' })]) {
      expect(validateCompanyForm(f)).toEqual(Object.values(validateCompanyFields(f)));
    }
  });
  it('une fiche conforme ne met rien en évidence', () => {
    expect(validateCompanyFields(form({ country: 'Cameroun', email: 'a@b.cm', phone: '+237 222 33 44 55' }))).toEqual({});
  });
  it('le style de surbrillance : bordure, fond ET liseré (pas la couleur seule), sur champs, listes et zones de texte', () => {
    const invalid = rule("input[aria-invalid='true']");
    expect(css).toMatch(/textarea\[aria-invalid='true'\]/);
    expect(css).toMatch(/select\[aria-invalid='true'\]/);
    expect(invalid).toMatch(/border-color:\s*var\(--bad\)/);
    expect(invalid).toMatch(/background:\s*var\(--bad-bg\)/);
    expect(invalid).toMatch(/box-shadow/);
  });
  it('à l\'écran : état annoncé (aria-invalid), message relié (aria-describedby) et écrit sous le champ, avec pictogramme', () => {
    const dialog = read('components/companies/company-dialog.tsx');
    expect(dialog).toContain("'aria-invalid'");
    expect(dialog).toContain("'aria-describedby'");
    expect(dialog).toContain('className="field-error"');
    expect(dialog).toContain('<Icon name="alert"');
    expect(dialog).toContain('Corrigez les champs en surbrillance');
  });
  it('le premier champ en erreur reçoit le focus à l\'envoi', () => {
    expect(read('components/companies/company-dialog.tsx')).toMatch(/getElementById\(`company-\$\{first\}`\)\?\.focus\(\)/);
  });
  it('le composant de champ est défini hors du rendu : sinon les champs seraient recréés (focus perdu) à chaque frappe', () => {
    const dialog = read('components/companies/company-dialog.tsx');
    expect(dialog.indexOf('function Field(')).toBeLessThan(dialog.indexOf('export function CompanyDialog'));
    expect(dialog).not.toMatch(/const Field = /);
  });
  it('chaque champ en erreur possible a un identifiant correspondant à son libellé', () => {
    const dialog = read('components/companies/company-dialog.tsx');
    expect(dialog).toContain('htmlFor={`company-${name}`}');
    expect(dialog).toContain('id: `company-${key}`');
  });
});

function withBadCommission(): CompanyForm {
  return form({ facilitatorMode: 'new', facilitatorLastName: 'A', facilitatorFirstName: 'B', facilitatorPhone: '+237 600 00 00 01', commissionType: 'PERCENT', commissionValue: '150' });
}

describe('retours de tests S4.0 — une fenêtre qui contient un tableau est large (pas de défilement horizontal)', () => {
  it("la fenêtre des versions d'un document est large", () => {
    expect(read('components/documents/documents-panel.tsx')).toMatch(/<Modal title=\{`Versions de[^>]*size="wide"/);
  });
  it('toute fenêtre dont le contenu comporte un tableau est large', () => {
    for (const file of ['components/documents/documents-panel.tsx', 'app/(app)/admin/users/page.tsx', 'app/(app)/account/sessions/page.tsx', 'components/confirm-dialog.tsx']) {
      const source = read(file);
      // Chaque <Modal ...> ... </Modal> qui contient « <table » doit porter size="wide".
      for (const block of source.split('<Modal ').slice(1)) {
        const body = block.slice(0, block.indexOf('</Modal>'));
        if (body.includes('<table')) expect(block.slice(0, block.indexOf('>')), `${file} : ${body.slice(0, 40)}`).toContain('size="wide"');
      }
    }
  });
});

