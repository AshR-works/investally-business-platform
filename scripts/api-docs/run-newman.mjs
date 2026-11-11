// Lance la collection Postman en ligne de commande (Newman) contre une pile LOCALE ou JETABLE, sans les dossiers qui ferment la session ou enrôlent un compte.
//
//   npm install -g newman        (une fois)
//   node scripts/api-docs/run-newman.mjs --env mon-environnement.json [--only 00,01,90] [--report rapport.json]
//
// L'environnement est une copie de docs/api/postman/Investally-local.postman_environment.json dans laquelle vous renseignez email, password et mfaSecret
// (fichier à garder hors du dépôt). Les dossiers « 00b » (première connexion) et « 98 » (actions de session) ne tournent jamais ici : lancez-les à part.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : undefined; };
const env = arg('env');
if (!env) {
  console.error('Usage : node scripts/api-docs/run-newman.mjs --env <environnement.json> [--only 00,01,90] [--report <rapport.json>]');
  process.exit(2);
}
const only = (arg('only') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const collectionPath = join(root, 'docs/api/postman/Investally-API.postman_collection.json');
const collection = JSON.parse(readFileSync(collectionPath, 'utf8'));
const folders = collection.item.map((f) => f.name).filter((name) => !/^(00b|98)/.test(name) && (only.length === 0 || only.some((o) => name.startsWith(o))));
const quote = (s) => (process.platform === 'win32' ? `"${s}"` : s);
const args = ['run', quote(collectionPath), '-e', quote(resolve(env)), '--timeout-request', '30000', ...(arg('report') ? ['--reporters', 'cli,json', '--reporter-json-export', quote(resolve(arg('report')))] : []), ...folders.flatMap((name) => ['--folder', quote(name)])];
const result = spawnSync('newman', args, { stdio: 'inherit', shell: process.platform === 'win32' });
if (result.error) {
  console.error('Newman est introuvable : installez-le avec « npm install -g newman ».');
  process.exit(2);
}
process.exit(result.status ?? 1);
