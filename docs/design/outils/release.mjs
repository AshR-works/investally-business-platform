// Fige une version des livrables design : instantané des captures + fiche de version + index de comparaison.
//
//   node docs/design/outils/release.mjs --version 0.4.0 --status "En revue"
//   node docs/design/outils/release.mjs --version 0.2.0 --from 1687304 --status "Proposée (reconstituée)"
//
// --version  numéro sémantique (MAJEUR.MINEUR.CORRECTIF) : MAJEUR = rupture visuelle ou de navigation ;
//            MINEUR = nouveaux écrans ou composants ; CORRECTIF = retouches sans changement de sens.
// --from     (facultatif) commit Git d'où extraire les captures (reconstitution d'une version passée) ;
//            par défaut : le dossier screens/ actuel et le commit courant (HEAD).
// --status   Proposée | En revue | Validée | Figée   (le statut « Validée » exige l'accord de la direction produit).
//
// Ce script N'ÉTIQUETTE PAS Git : il affiche la commande à lancer une fois la version validée.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const designDir = resolve(here, '..');
const repo = resolve(designDir, '..', '..');
const releases = join(designDir, 'releases');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}
const version = arg('version');
const from = arg('from');
const status = arg('status', 'En revue');
if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) throw new Error('--version MAJEUR.MINEUR.CORRECTIF est obligatoire (ex. 0.4.0)');
if (!['Proposée', 'En revue', 'Validée', 'Figée'].some((s) => status.startsWith(s))) throw new Error('--status invalide');

const git = (...args) => execFileSync('git', args, { cwd: repo, maxBuffer: 256 * 1024 * 1024 });
const target = join(releases, `v${version}`, 'screens');
mkdirSync(target, { recursive: true });

const commit = git('rev-parse', from ?? 'HEAD').toString().trim();
const files = [];
if (from) {
  const listed = git('ls-tree', '-r', '--name-only', commit, 'docs/design/screens').toString().split('\n').filter((f) => f.endsWith('.png'));
  for (const path of listed) {
    const name = path.split('/').pop();
    const data = git('show', `${commit}:${path}`);
    writeFileSync(join(target, name), data);
    files.push(name);
  }
} else {
  const source = join(designDir, 'screens');
  for (const name of readdirSync(source).filter((f) => f.endsWith('.png'))) {
    cpSync(join(source, name), join(target, name));
    files.push(name);
  }
}
files.sort();
const hash = (name) => createHash('sha256').update(readFileSync(join(target, name))).digest('hex');
const date = new Date().toISOString().slice(0, 10);

const manifest = [
  `# Manifeste — design v${version}`,
  '',
  `| Champ | Valeur |`,
  `|---|---|`,
  `| Version | **${version}** |`,
  `| Statut | ${status} |`,
  `| Commit de référence | \`${commit.slice(0, 7)}\`${from ? ' (reconstituée après coup)' : ''} |`,
  `| Étiquette Git | \`design-v${version}\` ${existsSync(join(repo, '.git')) && git('tag', '-l', `design-v${version}`).toString().trim() ? '(posée)' : '(à poser à la validation)'} |`,
  `| Date de l'instantané | ${date} |`,
  `| Captures | ${files.length} |`,
  '',
  '| Capture | SHA-256 |',
  '|---|---|',
  ...files.map((f) => `| ${f} | \`${hash(f).slice(0, 16)}…\` |`),
  '',
].join('\n');
writeFileSync(join(releases, `v${version}`, 'MANIFEST.md'), manifest);

const notesPath = join(releases, `v${version}`, 'NOTES.md');
if (!existsSync(notesPath)) {
  writeFileSync(notesPath, `# Notes de version — design v${version}\n\n> À compléter : ce qui change, pourquoi (renvoyer aux exigences EXD et aux fiches de décision DDR), ce qui n'est pas vérifié.\n\nVoir aussi [CHANGELOG-DESIGN.md](../../CHANGELOG-DESIGN.md).\n`);
}

// index lu par compare.html
const index = readdirSync(releases, { withFileTypes: true })
  .filter((d) => d.isDirectory() && /^v\d+\.\d+\.\d+$/.test(d.name))
  .map((d) => ({ version: d.name.slice(1), screens: readdirSync(join(releases, d.name, 'screens')).filter((f) => f.endsWith('.png')).sort() }))
  .sort((a, b) => a.version.localeCompare(b.version, undefined, { numeric: true }));
writeFileSync(join(releases, 'index.json'), JSON.stringify(index, null, 2) + '\n');

console.log(`Version ${version} figée : ${files.length} captures, manifeste et index écrits dans ${releases}`);
console.log(`Après validation de la direction produit :\n  git tag -a design-v${version} ${commit.slice(0, 7)} -m "Design v${version}"`);
