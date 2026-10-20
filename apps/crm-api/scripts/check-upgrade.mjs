// Vérifie qu'une migration préserve les données d'une base DÉJÀ remplie : applique les migrations jusqu'à
// la précédente, insère des lignes, applique la suivante, compare. Base jetable (voir test-db.mjs).
//   node scripts/check-upgrade.mjs <migration-précédente> <migration-à-tester>
import { randomBytes } from 'node:crypto';
import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [previous = '20261020000000_s1_company_audit', next = '20261021000000_s2_core_iam_docs_audit_partition'] = process.argv.slice(2);
const sql = (name) => readFileSync(join(root, 'prisma/migrations', name, 'migration.sql'), 'utf8');

const port = Number(process.env.TEST_DB_PORT ?? 54330);
const password = randomBytes(12).toString('hex');
const dataDir = join(tmpdir(), `investally-upgrade-check-${process.pid}`);
const server = new EmbeddedPostgres({
  databaseDir: dataDir, user: 'upgrade', password, port, persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'], postgresFlags: ['-c', 'timezone=Africa/Douala'],
  onLog: () => {}, onError: () => {},
});

let started = false;
try {
  await server.initialise();
  await server.start();
  started = true;
  await server.createDatabase('upgrade');
  const client = new pg.Client({ connectionString: `postgresql://upgrade:${password}@127.0.0.1:${port}/upgrade` });
  await client.connect();

  await client.query(sql(previous));
  const rows = 40;
  await client.query(
    `INSERT INTO audit.audit_logs (id, module, entity_type, entity_id, action, new_value, ip_address, device, created_at)
     SELECT gen_random_uuid(), 'm', 'T', 'e' || g, 'CREATE', jsonb_build_object('n', g), '10.0.0.1', 'dev',
            now() - (g || ' days')::interval
     FROM generate_series(1, ${rows}) g`,
  );
  await client.query(
    `INSERT INTO bd.companies (id, name, name_key, status, updated_at) VALUES (gen_random_uuid(), 'Avant', 'avant', 'TARGET', now())`,
  );
  const before = (await client.query('SELECT md5(string_agg(id::text || entity_id || new_value::text, \',\' ORDER BY id)) h, count(*)::int n FROM audit.audit_logs')).rows[0];

  await client.query(sql(next));

  const after = (await client.query('SELECT md5(string_agg(id::text || entity_id || new_value::text, \',\' ORDER BY id)) h, count(*)::int n FROM audit.audit_logs')).rows[0];
  const inDefault = (await client.query('SELECT count(*)::int n FROM audit.audit_logs_default')).rows[0].n;
  const companies = (await client.query('SELECT count(*)::int n FROM bd.companies')).rows[0].n;
  await client.end();

  const problems = [];
  if (before.n !== rows) problems.push(`préparation: ${before.n} lignes au lieu de ${rows}`);
  if (after.n !== before.n) problems.push(`lignes d'audit perdues ou dupliquées: ${before.n} -> ${after.n}`);
  if (after.h !== before.h) problems.push("contenu des lignes d'audit modifié");
  if (inDefault !== 0) problems.push(`${inDefault} lignes dans la partition de secours (anciennes dates hors plage)`);
  if (companies !== 1) problems.push(`entreprises: ${companies} au lieu de 1`);
  if (problems.length > 0) throw new Error(problems.join(' ; '));
  console.log(`✔ Mise à niveau ${previous} -> ${next} : ${after.n} lignes d'audit conservées à l'identique, ${inDefault} en partition de secours`);
} catch (error) {
  console.error(`✘ ${error.message}`);
  process.exitCode = 1;
} finally {
  if (started) await server.stop().catch(() => {});
  rmSync(dataDir, { recursive: true, force: true });
}
