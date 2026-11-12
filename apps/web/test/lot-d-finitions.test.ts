import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const css = read('app/globals.css');
const rule = (selector: string) => css.slice(css.indexOf(selector), css.indexOf('}', css.indexOf(selector)) + 1);

describe('lot D — finitions d’interface : fenêtre de confirmation du code (step-up)', () => {
  const stepUp = read('components/step-up-dialog.tsx');
  it('reprend la fenêtre commune (en-tête, croix, marges) au lieu d’une fenêtre nue', () => {
    expect(stepUp).toContain("import { Modal } from './modal'");
    expect(stepUp).toContain('<Modal title="Confirmez votre identité"');
    expect(stepUp).not.toContain('className="dialog"');
  });
  it('saisit le code comme à la connexion : six cases, ou un code de secours', () => {
    expect(stepUp).toContain("import { OtpInput } from './auth/otp-input'");
    expect(stepUp).toContain('<OtpInput');
    expect(stepUp).toContain('placeholder="XXXXX-XXXXX"');
    expect(stepUp).toMatch(/code\.length === OTP_LENGTH/);
  });
  it('« Annuler » reste (choix explicite) ; aucun bouton « Fermer » en bas', () => {
    expect(stepUp).toContain('>Annuler</button>');
    expect(stepUp).not.toMatch(/>\s*Fermer\s*<\/button>/);
  });
  it('un échec vide le code et affiche l’erreur sans fermer la fenêtre', () => {
    expect(stepUp).toMatch(/setError\(e instanceof ApiError/);
    expect(stepUp).toMatch(/setCode\(''\);\s*setBusy\(false\)/);
  });
});

describe('lot D — formulaire du catalogue : le libellé est au-dessus du champ', () => {
  const catalogue = read('components/training/catalogue-dialogs.tsx');
  it('« Ajouter un module » n’est plus en ligne avec une liste de largeur automatique', () => {
    expect(catalogue).toContain('<label className="field-stack">');
    const at = catalogue.indexOf('Ajouter un module');
    expect(catalogue.slice(at, at + 200)).not.toContain("width: 'auto'");
  });
  it('le champ prend toute la largeur, sans débordement', () => {
    expect(rule('.field-stack > select')).toMatch(/width:\s*100%/);
  });
});

describe('lot D — téléchargement des documents : un pictogramme nommé, jamais un texte qui se replie', () => {
  const docs = read('components/documents/documents-panel.tsx');
  it('aucun bouton « Télécharger » en texte dans la table des documents', () => {
    expect(docs).not.toMatch(/>Télécharger<\/button>/);
    expect((docs.match(/<IconButton icon="download"/g) ?? []).length).toBe(2);
  });
  it('le pictogramme porte un nom accessible qui cite le fichier, et une info-bulle', () => {
    expect(docs).toContain('label={`Télécharger ${d.current.fileName}`}');
    const button = read('components/icon-button.tsx');
    expect(button).toContain('aria-label={label}');
    expect(button).toContain('title={label}');
  });
  it('le bouton ne replie jamais son contenu', () => {
    expect(rule('\n.icon-button {')).toMatch(/white-space:\s*nowrap/);
  });
});

describe('lot D — fenêtres de consultation : pas de « Fermer », « Modifier » en pictogramme avant la croix', () => {
  const modal = read('components/modal.tsx');
  it('la fenêtre accepte des pictogrammes d’action placés avant la croix', () => {
    expect(modal).toContain('actions?: ReactNode');
    expect(modal.indexOf('{actions}')).toBeGreaterThan(-1);
    expect(modal.indexOf('{actions}')).toBeLessThan(modal.indexOf('className="dialog-close"'));
  });
  it('aucune fenêtre du projet ne garde un bouton « Fermer » en bas', () => {
    for (const file of [
      'components/opportunities/opportunity-dialogs.tsx', 'components/appointments/appointment-dialogs.tsx', 'components/offers/offer-dialogs.tsx',
      'components/offers/receipt-dialog.tsx', 'components/training/session-dialogs.tsx', 'components/documents/documents-panel.tsx', 'components/step-up-dialog.tsx',
    ]) {
      expect(read(file), file).not.toMatch(/>\s*Fermer\s*<\/button>/);
    }
  });
  it('opportunité et rendez-vous : « Modifier » est un pictogramme nommé, les autres actions tiennent sur une seule ligne', () => {
    for (const [file, label] of [['components/opportunities/opportunity-dialogs.tsx', 'Modifier l’opportunité'], ['components/appointments/appointment-dialogs.tsx', 'Modifier le rendez-vous']]) {
      const source = read(file);
      expect(source, file).toContain(`<IconButton icon="edit" label="${label}"`);
      expect(source, file).toContain('className="actions-line"');
      expect(source, file).toContain('size="medium"');
    }
    expect(rule('.actions-line {')).toMatch(/flex-wrap:\s*nowrap/);
    expect(rule('.actions-line {')).toMatch(/justify-content:\s*flex-end/);
  });
  it('« Modifier » n’apparaît plus parmi les boutons du bas', () => {
    expect(read('components/opportunities/opportunity-dialogs.tsx')).toContain("allActions.filter((a) => a !== 'edit')");
    expect(read('components/appointments/appointment-dialogs.tsx')).toContain("allActions.filter((x) => x !== 'edit')");
  });
});

describe('lot D — fiche entreprise : les changements de statut sont alignés à droite de la carte', () => {
  const page = read('app/(app)/companies/[id]/page.tsx');
  it('les boutons ne sont plus dans la cellule du statut mais dans une rangée alignée à droite, sur la marge de la carte', () => {
    const cell = page.slice(page.indexOf('>Statut</dt>'), page.indexOf('>Responsable</dt>'));
    expect(cell).not.toContain('statusActions(');
    expect(page).toContain('className="flex flex-wrap justify-end gap-2 px-5 pb-5"');
  });
  it('l’en-tête de la fiche garde le bloc titre et description pleine largeur, boutons dessous', () => {
    expect(page).toMatch(/<PageHeader\s+stacked/);
    expect(read('components/data/page-header.tsx')).toContain("stacked ? 'flex-col'");
  });
});
