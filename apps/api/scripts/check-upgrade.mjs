// Vérifie qu'une migration préserve les données d'une base DÉJÀ remplie : applique TOUTES les migrations jusqu'à la
// précédente, insère des lignes, applique la suivante, compare. Base jetable (voir test-db.mjs).
//   node scripts/check-upgrade.mjs [<migration-précédente> <migration-à-tester>]
// Sans argument : la dernière migration est testée contre l'état précédent.
import { randomBytes } from 'node:crypto';
import { readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = join(root, 'prisma/migrations');
const all = readdirSync(migrationsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
const [previous = all[all.length - 2], next = all[all.length - 1]] = process.argv.slice(2);
const sql = (name) => readFileSync(join(migrationsDir, name, 'migration.sql'), 'utf8');
const upToPrevious = all.filter((name) => name <= previous);

const port = Number(process.env.TEST_DB_PORT ?? 54330);
const password = randomBytes(12).toString('hex');
const dataDir = join(tmpdir(), `investally-upgrade-check-${process.pid}`);
const server = new EmbeddedPostgres({
  databaseDir: dataDir, user: 'upgrade', password, port, persistent: false,
  initdbFlags: ['--encoding=UTF8', '--locale=C'], postgresFlags: ['-c', 'timezone=Africa/Douala'],
  onLog: () => {}, onError: () => {},
});

const fingerprint = async (client, query) => (await client.query(query)).rows[0];
const exists = async (client, table) => (await client.query('SELECT to_regclass($1) AS t', [table])).rows[0].t !== null;

let started = false;
try {
  await server.initialise();
  await server.start();
  started = true;
  await server.createDatabase('upgrade');
  const client = new pg.Client({ connectionString: `postgresql://upgrade:${password}@127.0.0.1:${port}/upgrade` });
  await client.connect();

  for (const name of upToPrevious) await client.query(sql(name));

  // Données de référence présentes dans TOUTES les versions
  const auditRows = 40;
  await client.query(
    `INSERT INTO audit.audit_logs (id, module, entity_type, entity_id, action, new_value, ip_address, device, created_at)
     SELECT gen_random_uuid(), 'm', 'T', 'e' || g, 'CREATE', jsonb_build_object('n', g), '10.0.0.1', 'dev', now() - (g || ' days')::interval
     FROM generate_series(1, ${auditRows}) g`,
  );
  await client.query(`INSERT INTO bd.companies (id, name, name_key, status, updated_at) VALUES (gen_random_uuid(), 'Avant', 'avant', 'TARGET', now())`);

  // Données IAM si le schéma existe déjà (S2 et suivants) : un utilisateur et sa session
  const hasIam = await exists(client, 'iam.users');
  if (hasIam) {
    await client.query(
      `INSERT INTO iam.users (id, email, email_key, display_name, status, password_hash, updated_at)
       VALUES ('00000000-0000-7000-8000-000000000001', 'Avant@Test.fr', 'avant@test.fr', 'Avant', 'ACTIVE', '$argon2id$exemple', now())`,
    );
    await client.query(
      `INSERT INTO iam.user_sessions (id, user_id, ip_address, device, expires_at, absolute_expires_at)
       VALUES ('00000000-0000-7000-8000-000000000002', '00000000-0000-7000-8000-000000000001', '10.0.0.1', 'dev', now() + interval '1 hour', now() + interval '2 hours')`,
    );
  }

  const auditQuery = `SELECT md5(string_agg(id::text || entity_id || new_value::text, ',' ORDER BY id)) h, count(*)::int n FROM audit.audit_logs`;
  const userQuery = `SELECT md5(string_agg(id::text || email_key || coalesce(password_hash,''), ',' ORDER BY id)) h, count(*)::int n FROM iam.users`;
  const before = { audit: await fingerprint(client, auditQuery), users: hasIam ? await fingerprint(client, userQuery) : null };

  await client.query(sql(next));

  const after = { audit: await fingerprint(client, auditQuery), users: hasIam ? await fingerprint(client, userQuery) : null };
  const companies = (await client.query('SELECT count(*)::int n FROM bd.companies')).rows[0].n;
  const sessions = hasIam ? (await client.query('SELECT count(*)::int n FROM iam.user_sessions')).rows[0].n : null;
  const inDefault = (await client.query('SELECT count(*)::int n FROM audit.audit_logs_default').catch(() => ({ rows: [{ n: 0 }] }))).rows[0].n;
  await client.end();

  const problems = [];
  if (before.audit.n !== auditRows) problems.push(`préparation : ${before.audit.n} lignes d'audit au lieu de ${auditRows}`);
  if (after.audit.n !== before.audit.n) problems.push(`lignes d'audit perdues ou dupliquées : ${before.audit.n} -> ${after.audit.n}`);
  if (after.audit.h !== before.audit.h) problems.push("contenu des lignes d'audit modifié");
  if (hasIam && (after.users.n !== before.users.n || after.users.h !== before.users.h)) problems.push('utilisateurs modifiés ou perdus');
  if (hasIam && sessions !== 1) problems.push(`sessions : ${sessions} au lieu de 1`);
  if (inDefault !== 0) problems.push(`${inDefault} lignes dans la partition de secours`);
  if (companies !== 1) problems.push(`entreprises : ${companies} au lieu de 1`);
  if (problems.length > 0) throw new Error(problems.join(' ; '));
  console.log(`✔ Mise à niveau ${previous} -> ${next} : ${after.audit.n} lignes d'audit${hasIam ? `, ${after.users.n} utilisateur(s), ${sessions} session(s)` : ''} conservés à l'identique`);
} catch (error) {
  console.error(`✘ ${error.message}`);
  process.exitCode = 1;
} finally {
  if (started) await server.stop().catch(() => {});
  rmSync(dataDir, { recursive: true, force: true });
}
