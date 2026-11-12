import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PASSWORD_AUTO_HIDE_MS } from '../lib/password';
import { CODES_FILE_NAME, codesFileText } from '../lib/secret-codes';

const root = join(__dirname, '..');
const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === 'node_modules' || name === '.next') return [];
    return statSync(path).isDirectory() ? sourceFiles(path) : /\.(tsx|ts)$/.test(name) ? [path] : [];
  });
const read = (path: string) => readFileSync(path, 'utf8');

describe('fichier des codes de secours (UX-04)', () => {
  const codes = ['AAAAA-11111', 'BBBBB-22222', 'CCCCC-33333'];
  const text = codesFileText(codes, new Date('2026-10-22T10:00:00Z'));

  it('contient tous les codes, dans l\'ordre, une ligne chacun', () => {
    const lines = text.split('\n');
    const at = codes.map((c) => lines.indexOf(c));
    expect(at.every((i) => i > 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });
  it('ne contient aucune adresse e-mail ni donnée personnelle', () => {
    expect(text).not.toMatch(/@/);
    expect(CODES_FILE_NAME).toBe('investally-codes-de-secours.txt');
  });
  it('porte la date de génération et le rappel d\'usage unique', () => {
    expect(text).toContain('2026');
    expect(text).toContain('ne sert qu’une seule fois');
  });
  it('se termine par un retour à la ligne', () => {
    expect(text.endsWith('\n')).toBe(true);
  });
});

describe('uniformité du champ mot de passe (UX-01)', () => {
  it('AUCUN écran ne déclare de champ mot de passe en dehors du composant PasswordField', () => {
    const offenders = [...sourceFiles(join(root, 'app')), ...sourceFiles(join(root, 'components'))]
      .filter((file) => !file.endsWith('password-field.tsx'))
      .filter((file) => /type=["']password["']/.test(read(file)));
    expect(offenders).toEqual([]);
  });
  it('les quatre écrans concernés utilisent le composant', () => {
    for (const file of ['app/login/page.tsx', 'components/auth/new-password-fields.tsx', 'app/(app)/account/page.tsx']) {
      expect(read(join(root, file))).toContain('<PasswordField');
    }
  });
  it('le mot de passe affiché se remasque tout seul après 30 secondes', () => {
    expect(PASSWORD_AUTO_HIDE_MS).toBe(30_000);
  });
  it('le composant remasque à l\'envoi, à la perte de visibilité, et coupe la correction orthographique', () => {
    const source = read(join(root, 'components/auth/password-field.tsx'));
    expect(source).toContain("addEventListener('submit'");
    expect(source).toContain('visibilitychange');
    expect(source).toContain('spellCheck={false}');
    expect(source).toContain('aria-pressed');
  });
  it('l\'icône « œil » native d\'Edge est masquée (sinon deux icônes se superposent)', () => {
    expect(read(join(root, 'app/globals.css'))).toContain('::-ms-reveal');
  });
});

describe('confirmation de la régénération des codes (UX-03)', () => {
  const account = read(join(root, 'app/(app)/account/page.tsx'));
  it('le bouton n\'appelle plus la régénération directement : il ouvre une confirmation', () => {
    expect(account).toContain('onClick={() => setConfirming(true)}');
    expect(account).not.toMatch(/onClick=\{\(\) => void regenerate\(\)\}>Générer/);
  });
  it('la confirmation dit : invalidés, irréversible, affichage unique', () => {
    expect(account).toContain('invalidés immédiatement');
    expect(account).toContain('irréversible');
    expect(account).toContain('qu’une seule fois');
  });
  it('le focus initial est sur « Annuler » (premier bouton de la fenêtre)', () => {
    const dialog = read(join(root, 'components/confirm-dialog.tsx'));
    expect(dialog.indexOf('className="secondary"')).toBeGreaterThan(-1);
    expect(dialog.indexOf('className="secondary"')).toBeLessThan(dialog.indexOf('className="danger"'));
  });
});

describe('codes de secours à affichage unique (UX-04)', () => {
  const panel = read(join(root, 'components/auth/secret-codes-panel.tsx'));
  it('les codes ne sont jamais écrits dans le stockage du navigateur', () => {
    for (const file of ['components/auth/secret-codes-panel.tsx', 'app/(app)/account/page.tsx', 'app/mfa/page.tsx']) {
      expect(read(join(root, file))).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie/);
    }
  });
  it('quitter sans avoir conservé les codes est signalé (fermeture ET liens internes)', () => {
    expect(panel).toContain('beforeunload');
    expect(panel).toContain("addEventListener('click', onClick, true)");
  });
  it('offre la copie, le fichier texte et l\'impression PDF, partagés par l\'activation et Mon compte', () => {
    expect(panel).toContain('Copier');
    expect(panel).toContain('Télécharger (.txt)');
    expect(panel).toContain('enregistrer en PDF');
    expect(read(join(root, 'app/mfa/page.tsx'))).toContain('<SecretCodesPanel');
    expect(read(join(root, 'app/(app)/account/page.tsx'))).toContain('<SecretCodesPanel');
  });
  it('la feuille imprimée ne contient ni nom ni adresse e-mail', () => {
    const printed = panel.slice(panel.indexOf('codes-print'));
    expect(printed).not.toMatch(/profile|email|displayName|useAuth/);
  });
});
