// Génère docs/livrables/03-INDEX-DES-FONCTIONS.md à partir des commentaires JSDoc du code.
//
//   node scripts/gen-function-index.mjs
//
// Pour chaque fichier source (API et interface web, hors tests), liste les déclarations (classes, fonctions, méthodes,
// interfaces) précédées d'un commentaire `/** ... */`, avec leur signature et la première phrase du commentaire.
// Le document est GÉNÉRÉ : on corrige le commentaire dans le code, puis on relance ce script.
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCES = [
  { dir: 'apps/crm-api/src', title: 'API (NestJS)' },
  { dir: 'apps/crm-web/app', title: 'Interface web — pages (Next.js)' },
  { dir: 'apps/crm-web/components', title: 'Interface web — composants' },
  { dir: 'apps/crm-web/lib', title: 'Interface web — bibliothèque' },
];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else if (/\.(ts|tsx)$/.test(name) && !/\.(spec|test|d)\.ts$/.test(name)) out.push(path);
  }
  return out.sort();
}

const DECLARATION = /^\s*(export\s+)?(default\s+)?(abstract\s+)?(async\s+)?(function\*?\s+\w+|class\s+\w+|interface\s+\w+|type\s+\w+|const\s+\w+\s*=|(?:public\s+|private\s+|protected\s+|static\s+)*(?:async\s+)?(?:get\s+|set\s+)?\w+\s*(?:<[^>]*>)?\s*\()/;

/** Première phrase d'un bloc JSDoc, sur une ligne. */
function summary(block) {
  const text = block
    .map((line) => line.replace(/^\s*\/\*\*\s?/, '').replace(/\s*\*\/\s*$/, '').replace(/^\s*\*\s?/, ''))
    .filter((line) => line.trim() && !line.trim().startsWith('@'))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  const end = text.search(/[.!?](\s|$)/);
  return end > 0 ? text.slice(0, end + 1) : text;
}

function signature(line) {
  return line
    .trim()
    .replace(/\s*\{\s*$/, '')
    .replace(/\s*=>\s*\{?$/, '')
    .replace(/\s*=\s*\(?$/, '')
    .replace(/\|/g, '\\|')
    .slice(0, 150);
}

let total = 0;
const parts = [
  '# Index des fonctions et composants (généré)\n',
  `> Document **généré** par \`node scripts/gen-function-index.mjs\` à partir des commentaires du code. Ne pas le modifier à la main : corriger le commentaire dans le fichier source, puis relancer le script.\n`,
];

for (const source of SOURCES) {
  const files = walk(join(root, source.dir));
  const section = [];
  let count = 0;
  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');
    const rows = [];
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].trim().endsWith('*/') || !lines[i].trim().startsWith('/**') && !lines[i].trim().startsWith('*')) continue;
      // début du bloc
      let start = i;
      while (start > 0 && !lines[start].trim().startsWith('/**')) start--;
      if (!lines[start].trim().startsWith('/**')) continue;
      // première ligne de code suivante (hors décorateurs)
      let j = i + 1;
      while (j < lines.length && lines[j].trim().startsWith('@')) j++;
      if (j >= lines.length || !DECLARATION.test(lines[j])) continue;
      const indent = lines[j].length - lines[j].trimStart().length;
      if (indent > 2) continue; // seulement le niveau module et classe
      rows.push({ sig: signature(lines[j]), text: summary(lines.slice(start, i + 1)) });
    }
    if (rows.length === 0) continue;
    count += rows.length;
    section.push(`\n### \`${relative(join(root, source.dir), file).replace(/\\/g, '/')}\`\n`);
    section.push('| Déclaration | Rôle |\n|---|---|');
    for (const row of rows) section.push(`| \`${row.sig}\` | ${row.text.replace(/\|/g, '\\|')} |`);
  }
  total += count;
  parts.push(`\n## ${source.title} — ${count} déclarations commentées`);
  parts.push(...section);
}

parts.splice(2, 0, `**${total} déclarations commentées au total.**\n`);
mkdirSync(join(root, 'docs/livrables'), { recursive: true });
writeFileSync(join(root, 'docs/livrables/03-INDEX-DES-FONCTIONS.md'), parts.join('\n') + '\n', 'utf8');
console.log(`Index généré : ${total} déclarations`);
