// Manifeste de la BASE DE DONNÉES V1 (production) : la liste figée des migrations de la V1 (nom + somme de contrôle) et des données de référence attendues.
//
//   node scripts/db-docs/v1-manifest.mjs check                                    vérifie que les migrations de la V1 n'ont pas été modifiées (sans base)
//   DATABASE_URL=postgresql://… node scripts/db-docs/v1-manifest.mjs check        idem, et compare avec la base : migrations appliquées, données de référence
//   DATABASE_URL=postgresql://… node scripts/db-docs/v1-manifest.mjs check --fresh   idem, et exige qu'AUCUNE donnée métier ne soit présente (base neuve)
//   DATABASE_URL=postgresql://… node scripts/db-docs/v1-manifest.mjs write        (ré)écrit le manifeste depuis les migrations et une base V1 neuve (une seule fois, à la clôture de la V1)
//
// Lecture seule côté base (transaction en lecture seule). Sortie : code 0 si tout est conforme, 1 sinon. Le manifeste est docs/base-de-donnees/V1-MANIFESTE.json.
// Règle : une migration de la V1 ne se modifie JAMAIS ; les migrations suivantes s'ajoutent après (elles sont listées « après la V1 », sans erreur).
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const migrationsDir = join(root, 'apps/api/prisma/migrations');
const manifestPath = join(root, 'docs/base-de-donnees/V1-MANIFESTE.json');
const mode = process.argv[2];
const fresh = process.argv.includes('--fresh');
if (mode !== 'check' && mode !== 'write') {
  console.error('Usage : node scripts/db-docs/v1-manifest.mjs <check|write> [--fresh]   (DATABASE_URL pour comparer avec une base)');
  process.exit(2);
}

/** Tables dont le contenu est de la donnée de RÉFÉRENCE livrée avec la V1 (rôles, droits, types, modèles) : elles ne sont pas vides sur une base neuve. */
const REFERENCE_TABLES = [
  'iam.roles', 'iam.permissions', 'iam.role_permissions', 'hr.leave_types', 'hr.leave_settings', 'hr.contract_types', 'hr.journey_templates', 'hr.journey_template_tasks',
];

const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const migrationsOnDisk = () =>
  readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(migrationsDir, d.name, 'migration.sql')))
    .map((d) => ({ name: d.name, sha256: sha256(join(migrationsDir, d.name, 'migration.sql')) }))
    .sort((a, b) => a.name.localeCompare(b.name));

async function connect() {
  if (!process.env.DATABASE_URL) return null;
  const pg = createRequire(join(root, 'apps/api/package.json'))('pg');
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query('SET default_transaction_read_only = on');
  return client;
}

const problems = [];
const note = (line) => console.log(line);
const fail = (line) => {
  problems.push(line);
  console.log(`✘ ${line}`);
};

async function tablesOf(client) {
  const rows = await client.query(
    `SELECT n.nspname AS schema, c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind IN ('r', 'p') AND NOT c.relispartition AND n.nspname IN ('iam', 'bd', 'training', 'hr', 'docs', 'audit') ORDER BY 1, 2`,
  );
  return rows.rows.map((r) => `${r.schema}.${r.name}`);
}

async function countOf(client, table) {
  return (await client.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n;
}

if (mode === 'write') {
  const client = await connect();
  if (!client) {
    console.error('DATABASE_URL est obligatoire pour écrire le manifeste (une base V1 NEUVE : migrations et rôles seulement).');
    process.exit(2);
  }
  const tables = await tablesOf(client);
  const reference = {};
  for (const table of REFERENCE_TABLES) {
    if (!tables.includes(table)) throw new Error(`Table de référence absente : ${table}`);
    reference[table] = await countOf(client, table);
  }
  const others = [];
  for (const table of tables.filter((t) => !REFERENCE_TABLES.includes(t))) if ((await countOf(client, table)) > 0) others.push(table);
  if (others.length > 0) throw new Error(`La base n'est pas neuve : des données métier existent (${others.join(', ')}).`);
  const applied = (await client.query('SELECT migration_name AS name, checksum FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name')).rows;
  const disk = migrationsOnDisk();
  if (applied.length !== disk.length || applied.some((a, i) => a.name !== disk[i].name)) throw new Error('Les migrations appliquées ne sont pas celles du dossier : migrez la base avant d\'écrire le manifeste.');
  // La somme de contrôle de Prisma est celle du fichier : si elle diffère de la nôtre, on le dit au lieu de se tromper en silence.
  const mismatch = applied.filter((a, i) => a.checksum !== disk[i].sha256).map((a) => a.name);
  if (mismatch.length > 0) throw new Error(`La somme de contrôle de Prisma diffère de celle du fichier pour : ${mismatch.join(', ')}`);
  await client.end();
  const manifest = {
    version: 'V1',
    description: 'Base de données de production V1 : migrations figées (jamais modifiées) et données de référence d\'une base neuve (aucun compte, aucune donnée métier).',
    migrations: disk,
    referenceData: reference,
    tablesCount: tables.length,
  };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  note(`✔ Manifeste écrit : ${disk.length} migrations, ${tables.length} tables, ${REFERENCE_TABLES.length} tables de référence (${manifestPath}).`);
  process.exit(0);
}

// --- check ---------------------------------------------------------------------------------------------------------------------------------------------
if (!existsSync(manifestPath)) {
  console.error(`Manifeste absent : ${manifestPath}`);
  process.exit(2);
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const disk = migrationsOnDisk();
const diskByName = new Map(disk.map((m) => [m.name, m.sha256]));

note(`▶ Migrations de la V1 dans le dépôt (${manifest.migrations.length})`);
for (const m of manifest.migrations) {
  if (!diskByName.has(m.name)) fail(`migration de la V1 supprimée ou renommée : ${m.name}`);
  else if (diskByName.get(m.name) !== m.sha256) fail(`migration de la V1 MODIFIÉE (interdit) : ${m.name}`);
}
const afterV1 = disk.filter((m) => !manifest.migrations.some((v1) => v1.name === m.name));
const beforeV1 = afterV1.filter((m) => m.name < manifest.migrations[manifest.migrations.length - 1].name);
for (const m of beforeV1) fail(`migration insérée AVANT la fin de la V1 (interdit) : ${m.name}`);
if (problems.length === 0) note('✔ Les migrations de la V1 sont intactes.');
if (afterV1.length > 0) note(`ℹ Migrations après la V1 (${afterV1.length}) : ${afterV1.map((m) => m.name).join(', ')}`);

const client = await connect();
if (client) {
  note('\n▶ Base de données');
  const applied = (await client.query('SELECT migration_name AS name, checksum, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY migration_name')).rows;
  const done = applied.filter((a) => a.finished_at && !a.rolled_back_at);
  const unfinished = applied.filter((a) => !a.finished_at || a.rolled_back_at);
  for (const a of unfinished) fail(`migration non terminée ou annulée dans la base : ${a.name}`);
  for (const m of manifest.migrations) {
    const a = done.find((x) => x.name === m.name);
    if (!a) fail(`migration de la V1 absente de la base : ${m.name}`);
    else if (a.checksum !== m.sha256) fail(`somme de contrôle différente dans la base (migration modifiée après application ?) : ${m.name}`);
  }
  const extra = done.filter((a) => !diskByName.has(a.name));
  for (const a of extra) fail(`migration appliquée dans la base mais absente du dépôt : ${a.name}`);
  const later = done.filter((a) => diskByName.has(a.name) && !manifest.migrations.some((m) => m.name === a.name));
  if (later.length > 0) note(`ℹ Migrations appliquées après la V1 : ${later.map((a) => a.name).join(', ')}`);
  if (problems.length === 0) note(`✔ Les ${manifest.migrations.length} migrations de la V1 sont appliquées, avec les mêmes sommes de contrôle.`);

  const tables = await tablesOf(client);
  if (tables.length < manifest.tablesCount) fail(`tables manquantes : ${tables.length} au lieu de ${manifest.tablesCount} au moins`);
  for (const [table, expected] of Object.entries(manifest.referenceData)) {
    if (!tables.includes(table)) {
      fail(`table de référence absente : ${table}`);
      continue;
    }
    const n = await countOf(client, table);
    // « Au moins » : les rôles et les droits sont chargés par le code (seed-core) et peuvent croître après la V1 ; ils ne doivent jamais manquer.
    if (n < expected) fail(`données de référence : ${table} contient ${n} ligne(s), au moins ${expected} attendue(s)`);
  }
  if (fresh) {
    const busy = [];
    for (const table of tables.filter((t) => !(t in manifest.referenceData))) if ((await countOf(client, table)) > 0) busy.push(table);
    if (busy.length > 0) fail(`base non neuve : des données existent dans ${busy.join(', ')}`);
    else note('✔ Aucune donnée métier : base neuve.');
  }
  if (problems.length === 0) note('✔ Données de référence conformes.');
  await client.end();
}

console.log(problems.length === 0 ? '\nCONFORME à la V1.' : `\nNON CONFORME : ${problems.length} problème(s).`);
process.exit(problems.length === 0 ? 0 : 1);
