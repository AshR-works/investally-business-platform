// Base PostgreSQL JETABLE pour les tests (aucun Docker, aucun identifiant à fournir).
//
//   node scripts/test-db.mjs            migre, jette des données génériques, lance les tests d'intégration, supprime tout
//   node scripts/test-db.mjs --keep     migre + données génériques, puis laisse la base ouverte (Ctrl+C pour arrêter)
//
// Les données vivent dans le dossier temporaire du système (hors OneDrive). Mot de passe aléatoire
// généré à chaque exécution. NE JAMAIS pointer ce script vers une vraie base.
import { spawn } from 'node:child_process';
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
const dataDir = join(tmpdir(), `investally-crm-test-pg-${process.pid}-${randomBytes(4).toString("hex")}`);
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
  // Base JETABLE : on renonce aux garanties de durabilité (fsync, écritures synchrones) qui ralentissent fortement chaque écriture sous Windows ; rien n'y survit de toute façon (D149).
  postgresFlags: ['-c', 'timezone=Africa/Douala', '-c', 'fsync=off', '-c', 'synchronous_commit=off', '-c', 'full_page_writes=off', '-c', 'max_connections=500'],
  onLog: () => {},
  onError: (e) => console.error('[postgres]', String(e).trim()),
});

// Exécution ASYNCHRONE (jamais spawnSync) : PostgreSQL embarqué écrit son journal dans des tubes que seul ce processus lit. Un processus bloqué en attente
// d'un enfant ne les vide plus : une fois le tube plein, PostgreSQL se fige à la prochaine erreur journalisée (une règle de la base qui refuse une
// écriture) et la passe complète s'arrête, sans verrou ni attente visible. C'était la cause de l'instabilité locale (D149).
function run(label, args) {
  console.log(`
▶ ${label}`);
  // Délai maximal par étape (TEST_DB_TIMEOUT_MIN, 45 min par défaut) : un processus qui ne rend jamais la main est tué au lieu de tourner des heures (D164).
  const timeoutMs = Number(process.env.TEST_DB_TIMEOUT_MIN ?? 45) * 60_000;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: root, stdio: 'inherit', env: { ...process.env, DATABASE_URL: url, RUN_DB_TESTS: '1' } });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      if (timedOut) reject(new Error(`${label} interrompu : délai de ${timeoutMs / 60_000} min dépassé (processus bloqué ?)`));
      else if (code !== 0) reject(new Error(`${label} a échoué (code ${code})`));
      else resolve();
    });
  });
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
let diag = null;
async function stop() {
  diag?.kill();
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
  await run('prisma migrate deploy', [prisma, 'migrate', 'deploy']);
  await run('prisma migrate status', [prisma, 'migrate', 'status']);
  await seedGenericData();
  // Diagnostic facultatif (TEST_DB_DIAG=1) : un processus à part décrit toutes les 45 s les connexions actives (D149).
  if (process.env.TEST_DB_DIAG === '1') diag = spawn(process.execPath, [join(root, 'scripts/pg-diag.mjs')], { cwd: root, stdio: 'inherit', env: { ...process.env, DATABASE_URL: url } });

  if (keep) {
    console.log(`\n✔ Base prête. DATABASE_URL=${url}\n  (Ctrl+C pour arrêter et tout supprimer)`);
    process.on('SIGINT', async () => {
      await stop();
      process.exit(0);
    });
    await new Promise(() => {});
  } else {
    await run('tests d\'intégration', [
      join(root, 'node_modules/jest/bin/jest.js'),
      '--runInBand',
      // Les tests rendent la main, mais une connexion à la base laissée ouverte par une suite empêche Jest de quitter (la tâche tournait 22 h) : on le force à la fin (D164).
      '--forceExit',
      // Ordre stable : les suites qui sèment beaucoup de données passent en dernier (D163).
      '--testSequencer=./test/support/sequencer.js',
      // Délai commun de 60 s par test et par crochet : en passe complète sur une machine chargée, le délai par défaut (5 s) fait échouer des suites au hasard (D149). Un délai propre à un test reste prioritaire.
      '--testTimeout=60000',
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
// Le arrêt de PostgreSQL embarqué peut réinitialiser le code de sortie : on le rétablit explicitement (un test rouge ne doit jamais sortir en 0).
if (!keep) process.exit(process.exitCode ?? 0);
