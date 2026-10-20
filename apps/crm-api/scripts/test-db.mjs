// Base PostgreSQL JETABLE pour les tests (aucun Docker, aucun identifiant à fournir).
//
//   node scripts/test-db.mjs            migre, jette des données génériques, lance les tests d'intégration, supprime tout
//   node scripts/test-db.mjs --keep     migre + données génériques, puis laisse la base ouverte (Ctrl+C pour arrêter)
//
// Les données vivent dans le dossier temporaire du système (hors OneDrive). Mot de passe aléatoire
// généré à chaque exécution. NE JAMAIS pointer ce script vers une vraie base.
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const keep = process.argv.includes('--keep');
const port = Number(process.env.TEST_DB_PORT ?? 54329);
const user = 'investally_test';
const password = randomBytes(12).toString('hex');
const database = 'investally_test';
const dataDir = join(tmpdir(), `investally-crm-test-pg-${process.pid}`);
const url = `postgresql://${user}:${password}@127.0.0.1:${port}/${database}`;

const server = new EmbeddedPostgres({
  databaseDir: dataDir,
  user,
  password,
  port,
  persistent: false,
  // UTF-8 explicite (le défaut Windows est WIN1252). Fuseau serveur VOLONTAIREMENT non UTC :
  // il garde actif le test de non-régression des horodatages (l'application force sa session en UTC).
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  postgresFlags: ['-c', 'timezone=Africa/Douala'],
  onLog: () => {},
  onError: (e) => console.error('[postgres]', String(e).trim()),
});

function run(label, args) {
  console.log(`\n▶ ${label}`);
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url, RUN_DB_TESTS: '1' },
  });
  if (result.status !== 0) throw new Error(`${label} a échoué (code ${result.status})`);
}

async function seedGenericData() {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const sectors = ['Banque', 'Assurance', 'Industrie', 'Distribution', 'Énergie'];
    for (let i = 1; i <= 25; i++) {
      const name = `Entreprise Test ${String(i).padStart(2, '0')}`;
      await client.query(
        `INSERT INTO bd.companies (id, name, name_key, status, sector, country, updated_at)
         VALUES (gen_random_uuid(), $1, $2, 'TARGET', $3, 'Cameroun', now())`,
        [name, name.toLowerCase(), sectors[i % sectors.length]],
      );
    }
    console.log('✔ 25 entreprises génériques insérées');
  } finally {
    await client.end();
  }
}

let started = false;
async function stop() {
  if (started) {
    started = false;
    await server.stop().catch(() => {});
  }
  rmSync(dataDir, { recursive: true, force: true });
}

try {
  console.log(`▶ Démarrage de PostgreSQL embarqué sur 127.0.0.1:${port}`);
  await server.initialise();
  await server.start();
  started = true;
  await server.createDatabase(database);

  const prisma = join(root, 'node_modules/prisma/build/index.js');
  run('prisma migrate deploy', [prisma, 'migrate', 'deploy']);
  run('prisma migrate status', [prisma, 'migrate', 'status']);
  await seedGenericData();

  if (keep) {
    console.log(`\n✔ Base prête. DATABASE_URL=${url}\n  (Ctrl+C pour arrêter et tout supprimer)`);
    process.on('SIGINT', async () => {
      await stop();
      process.exit(0);
    });
    await new Promise(() => {});
  } else {
    run('tests d\'intégration', [
      join(root, 'node_modules/jest/bin/jest.js'),
      '--runInBand',
      '--testPathPatterns',
      // Cibler un fichier : `node scripts/test-db.mjs --tests=rbac-http` (par défaut, toute la suite d'intégration).
      process.argv.find((a) => a.startsWith('--tests='))?.slice('--tests='.length) ?? 'integration',
    ]);
    console.log('\n✔ Tests d\'intégration terminés');
  }
} catch (error) {
  console.error(`\n✘ ${error.message}`);
  process.exitCode = 1;
} finally {
  if (!keep) await stop();
}
