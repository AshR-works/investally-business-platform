// Exécute les vérifications d'intégrité de docs/base-de-donnees/verifications.sql (LECTURE SEULE) et dit, pour chacune, réussite ou nombre d'anomalies.
//
//   DATABASE_URL=postgresql://… node scripts/db-docs/run-verifications.mjs [--json]
//
// Code de sortie : 0 si toutes passent, 1 sinon. Chaque vérification tourne dans une transaction en lecture seule (aucune écriture possible).
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const pg = createRequire(join(root, 'apps/crm-api/package.json'))('pg');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL est obligatoire.');

const text = readFileSync(join(root, 'docs/base-de-donnees/verifications.sql'), 'utf8');
const checks = text.split(/^-- @check /m).slice(1).map((block) => {
  const [head, ...rest] = block.split('\n');
  const [name, ...label] = head.split(' : ');
  const sql = rest.filter((line) => !line.trim().startsWith('--')).join('\n').trim().replace(/;\s*$/, '');
  return { name: name.trim(), label: label.join(' : ').trim(), sql };
});
if (checks.length === 0) throw new Error('Aucune vérification trouvée dans verifications.sql');

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
await client.query('SET default_transaction_read_only = on');
const results = [];
for (const check of checks) {
  try {
    const { rows } = await client.query(check.sql);
    results.push({ ...check, anomalies: rows.length, sample: rows.slice(0, 3) });
  } catch (error) {
    results.push({ ...check, error: error.message, anomalies: -1, sample: [] });
  }
}
await client.end();

if (process.argv.includes('--json')) console.log(JSON.stringify(results.map(({ sql, ...r }) => r), null, 2));
else {
  for (const r of results) console.log(`${r.anomalies === 0 ? 'OK     ' : 'ÉCHEC  '} ${r.name} : ${r.label}${r.anomalies > 0 ? ` (${r.anomalies} anomalie${r.anomalies > 1 ? 's' : ''}) ${JSON.stringify(r.sample)}` : ''}${r.error ? ` — erreur : ${r.error}` : ''}`);
  const failed = results.filter((r) => r.anomalies !== 0).length;
  console.log(`\n${results.length - failed} / ${results.length} vérifications réussies`);
}
process.exit(results.some((r) => r.anomalies !== 0) ? 1 : 0);
