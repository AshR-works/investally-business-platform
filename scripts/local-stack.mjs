// Pile LOCALE PERSISTANTE de l'application, sans Docker et sans Claude Code.
//
//   node scripts/local-stack.mjs            démarre base + API + interface (Ctrl+C pour tout arrêter)
//   node scripts/local-stack.mjs --demo     idem, et ajoute des entreprises fictives (idempotent)
//   node scripts/local-stack.mjs --rebuild  force la recompilation de l'API et de l'interface
//   node scripts/local-stack.mjs --dev      interface en mode développement (rechargement à chaud)
//   node scripts/local-stack.mjs reset      supprime base, documents et secrets locaux (après confirmation)
//
// Tout vit dans INVESTALLY_LOCAL_HOME (défaut : dossier voisin du dépôt, hors OneDrive) : base PostgreSQL,
// documents téléversés, secrets générés (droits restreints), journaux. Rien n'est écrit dans le dépôt.
// Ce script n'ouvre que 127.0.0.1. Il ne se connecte JAMAIS à une autre base que la sienne.
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes, generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, createWriteStream } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apiDir = join(repo, 'apps', 'crm-api');
const webDir = join(repo, 'apps', 'crm-web');
const home = resolve(process.env.INVESTALLY_LOCAL_HOME ?? join(repo, '..', 'investally-local'));
const PG_PORT = Number(process.env.LOCAL_DB_PORT ?? 54330);
const API_PORT = Number(process.env.LOCAL_API_PORT ?? 3001);
const WEB_PORT = Number(process.env.LOCAL_WEB_PORT ?? 3000);
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const adminEmail = args.find((a) => a.startsWith('--email='))?.slice(8) ?? 'admin@investally.test';

const say = (msg) => console.log(msg);
const fail = (msg) => {
  console.error(`\n✘ ${msg}`);
  process.exit(1);
};
const node = (cwd, script, scriptArgs, env = {}, label = script) => {
  const r = spawnSync(process.execPath, [script, ...scriptArgs], { cwd, stdio: 'inherit', env: { ...process.env, ...env } });
  if (r.status !== 0) fail(`${label} a échoué (code ${r.status})`);
};

// --- réinitialisation --------------------------------------------------------------------------------------------
if (args[0] === 'reset') {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`Supprimer définitivement ${home} (base, documents, secrets) ? Tapez OUI : `);
  rl.close();
  if (answer.trim() !== 'OUI') fail('Annulé.');
  rmSync(home, { recursive: true, force: true });
  say('✔ Environnement local supprimé.');
  process.exit(0);
}

// --- vérifications -----------------------------------------------------------------------------------------------
const major = Number(process.versions.node.split('.')[0]);
if (major !== 22) {
  say(`⚠ Node ${process.versions.node} détecté ; le projet vise Node 22 LTS (.nvmrc) et Prisma 7 ne supporte pas officiellement les autres versions.`);
  say('  Pour utiliser Node 22 sans toucher aux autres projets : fnm exec --using=22 node scripts/local-stack.mjs   (installation : docs/GUIDE-EXECUTION-LOCALE.md, « Node 22 »).');
}
if (!existsSync(join(repo, 'node_modules')) || !existsSync(join(apiDir, 'node_modules'))) fail('Dépendances absentes : lancez `pnpm install` à la racine du dépôt.');

mkdirSync(join(home, 'documents'), { recursive: true });
mkdirSync(join(home, 'logs'), { recursive: true });

// --- secrets locaux persistants (clés de jetons, chiffrement MFA, mot de passe de la base) ------------------------
const secretsFile = join(home, 'secrets.json');
if (!existsSync(secretsFile)) {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  writeFileSync(
    secretsFile,
    JSON.stringify({
      dbPassword: randomBytes(18).toString('hex'),
      jwtPrivate: privateKey.export({ type: 'pkcs8', format: 'pem' }).trim(),
      jwtPublic: publicKey.export({ type: 'spki', format: 'pem' }).trim(),
      mfaKey: randomBytes(32).toString('base64'),
    }),
    { mode: 0o600 },
  );
  say('✔ Secrets locaux générés (aucun secret de production).');
}
const secrets = JSON.parse(readFileSync(secretsFile, 'utf8'));
const dbUrl = `postgresql://investally_local:${secrets.dbPassword}@127.0.0.1:${PG_PORT}/investally_local`;

const appEnv = {
  DATABASE_URL: dbUrl,
  NODE_ENV: 'development',
  PORT: String(API_PORT),
  ALLOWED_ORIGINS: `http://127.0.0.1:${WEB_PORT},http://localhost:${WEB_PORT}`,
  APP_PUBLIC_URL: `http://127.0.0.1:${WEB_PORT}`,
  TRUST_PROXY: 'loopback',
  JWT_PRIVATE_KEY_PEM: secrets.jwtPrivate.replace(/\n/g, '\\n'),
  JWT_PUBLIC_KEY_PEM: secrets.jwtPublic.replace(/\n/g, '\\n'),
  MFA_ENCRYPTION_KEY: secrets.mfaKey,
  EMAIL_PROVIDER: 'log',
  EMAIL_LOG_CONTENT: 'true',
  DOCUMENTS_DIR: join(home, 'documents'),
  CRM_API_URL: `http://127.0.0.1:${API_PORT}`,
};

// --- compilation (seulement si nécessaire) -----------------------------------------------------------------------
const rebuild = flag('rebuild');
const tsc = join(apiDir, 'node_modules', 'typescript', 'bin', 'tsc');
const prismaCli = join(apiDir, 'node_modules', 'prisma', 'build', 'index.js');
const nextCli = join(webDir, 'node_modules', 'next', 'dist', 'bin', 'next');
if (rebuild || !existsSync(join(apiDir, 'dist', 'src', 'main.js'))) {
  say('\n▶ Compilation de l\'API');
  node(apiDir, prismaCli, ['generate'], appEnv, 'prisma generate');
  node(apiDir, tsc, ['-p', 'tsconfig.build.json'], appEnv, 'compilation API');
}
// L'adresse de l'API est figée dans l'interface à la compilation (réécriture /api/*) : on recompile si elle change.
const webStamp = join(home, 'web-build.json');
const builtFor = existsSync(webStamp) ? JSON.parse(readFileSync(webStamp, 'utf8')).apiUrl : null;
if (!flag('dev') && (rebuild || builtFor !== appEnv.CRM_API_URL || !existsSync(join(webDir, '.next', 'BUILD_ID')))) {
  say('\n▶ Compilation de l\'interface');
  // `next build` exige NODE_ENV=production (sinon le prérendu de /_global-error échoue).
  node(webDir, nextCli, ['build'], { ...appEnv, NODE_ENV: 'production' }, 'compilation interface');
  writeFileSync(webStamp, JSON.stringify({ apiUrl: appEnv.CRM_API_URL }));
}

// --- base PostgreSQL persistante ---------------------------------------------------------------------------------
const apiRequire = createRequire(join(apiDir, 'package.json'));
const EmbeddedPostgres = apiRequire('embedded-postgres').default ?? apiRequire('embedded-postgres');
const pg = apiRequire('pg');
const pgData = join(home, 'pgdata');
const server = new EmbeddedPostgres({
  databaseDir: pgData,
  user: 'investally_local',
  password: secrets.dbPassword,
  port: PG_PORT,
  persistent: true,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  onLog: () => {},
  onError: () => {},
});
const children = [];
let stopping = false;
async function stopAll() {
  if (stopping) return;
  stopping = true;
  say('\n▶ Arrêt…');
  for (const child of children) child.kill();
  await server.stop().catch(() => {});
  process.exit(0);
}
process.on('SIGINT', stopAll);
process.on('SIGTERM', stopAll);

say('\n▶ PostgreSQL local (persistant)');
if (!existsSync(join(pgData, 'PG_VERSION'))) await server.initialise();
await server.start();
const admin = new pg.Client({ connectionString: dbUrl.replace(/\/investally_local$/, '/postgres') });
await admin.connect();
const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = 'investally_local'");
if (exists.rowCount === 0) await admin.query('CREATE DATABASE investally_local');
await admin.end();

say('\n▶ Migrations et rôles');
node(apiDir, prismaCli, ['migrate', 'deploy'], appEnv, 'migrations');
node(apiDir, join('dist', 'src', 'cli', 'seed-core.js'), [], appEnv, 'seed des rôles');

// --- premier administrateur --------------------------------------------------------------------------------------
const db = new pg.Client({ connectionString: dbUrl });
await db.connect();
const users = await db.query('SELECT count(*)::int AS n FROM iam.users');
if (users.rows[0].n === 0) {
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? `${randomBytes(6).toString('hex')}-${randomBytes(6).toString('hex')}-${randomBytes(6).toString('hex')}`;
  node(apiDir, join('dist', 'src', 'cli', 'create-admin.js'), ['--email', adminEmail, '--name', 'Administrateur local'], { ...appEnv, BOOTSTRAP_ADMIN_PASSWORD: password }, 'création de l\'administrateur');
  say('\n┌───────────────────────────────────────────────────────────────────────────┐');
  say(`│ Compte administrateur créé (affiché UNE SEULE FOIS, notez-le) :`);
  say(`│   e-mail       : ${adminEmail}`);
  say(`│   mot de passe : ${password}`);
  say('│ À la première connexion : scannez le QR code avec une application TOTP.   │');
  say('└───────────────────────────────────────────────────────────────────────────┘');
}

// --- données de démonstration (facultatif) -----------------------------------------------------------------------
if (flag('demo')) {
  const sectors = ['Banque', 'Assurance', 'Industrie', 'Distribution', 'Énergie', 'Télécoms', 'Santé'];
  const countries = ['Cameroun', 'Côte d\'Ivoire', 'Sénégal', 'Gabon', 'RDC'];
  const statuses = ['TARGET', 'TARGET', 'TARGET'];
  let added = 0;
  for (let i = 1; i <= 40; i++) {
    const name = `Démo Entreprise ${String(i).padStart(2, '0')}`;
    const r = await db.query(
      `INSERT INTO bd.companies (id, name, name_key, status, sector, country, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, now()) ON CONFLICT DO NOTHING`,
      [name, name.toLowerCase(), statuses[i % statuses.length], sectors[i % sectors.length], countries[i % countries.length]],
    );
    added += r.rowCount;
  }
  say(`✔ Données de démonstration : ${added} entreprise(s) ajoutée(s)`);

  // Un compte par rôle (mots de passe aléatoires, conservés dans demo-accounts.json, droits restreints).
  const accountsFile = join(home, 'demo-accounts.json');
  const before = existsSync(accountsFile) ? JSON.parse(readFileSync(accountsFile, 'utf8')).length : 0;
  node(apiDir, join('dist', 'src', 'cli', 'create-demo-users.js'), [], { ...appEnv, DEMO_ACCOUNTS_FILE: accountsFile }, 'comptes de démonstration');
  const accounts = JSON.parse(readFileSync(accountsFile, 'utf8'));
  // Répartit les entreprises sans propriétaire entre les deux chargés de compte (tests de portée « propres objets »).
  const owners = await db.query("SELECT id, email_key FROM iam.users WHERE email_key IN ('compte1@demo.investally.test', 'compte2@demo.investally.test') ORDER BY email_key");
  if (owners.rowCount === 2) {
    await db.query(
      `UPDATE bd.companies SET owner_user_id = CASE WHEN (row_number % 2) = 1 THEN $1::uuid ELSE $2::uuid END
       FROM (SELECT id AS cid, row_number() OVER (ORDER BY name) AS row_number FROM bd.companies WHERE owner_user_id IS NULL AND name LIKE 'Démo Entreprise%') t
       WHERE bd.companies.id = t.cid`,
      [owners.rows[0].id, owners.rows[1].id],
    );
  }
  if (accounts.length > before) {
    say('\n┌ Comptes de démonstration (un par rôle ; MFA à enrôler à la première connexion)');
    for (const a of accounts) say(`│ ${a.role.padEnd(16)} ${a.email.padEnd(36)} ${a.password}`);
    say(`└ Conservés dans ${accountsFile} (local, droits restreints).`);
  } else {
    say(`✔ Comptes de démonstration déjà présents (mots de passe : ${accountsFile})`);
  }
}
await db.end();

// --- API + interface ---------------------------------------------------------------------------------------------
function start(label, cwd, script, scriptArgs) {
  const log = createWriteStream(join(home, 'logs', `${label}.log`), { flags: 'a' });
  const child = spawn(process.execPath, [script, ...scriptArgs], { cwd, env: { ...process.env, ...appEnv }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  child.on('exit', (code) => {
    if (!stopping) {
      console.error(`\n✘ ${label} s'est arrêté (code ${code}). Voir ${join(home, 'logs', `${label}.log`)}`);
      stopAll();
    }
  });
  children.push(child);
}
async function waitFor(url, label) {
  for (let i = 0; i < 60; i++) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  fail(`${label} ne répond pas. Voir ${join(home, 'logs')}`);
}

start('api', apiDir, join('dist', 'src', 'main.js'), []);
await waitFor(`http://127.0.0.1:${API_PORT}/api/v1/auth/me`, 'API');
start('web', webDir, nextCli, flag('dev') ? ['dev', '-H', '127.0.0.1', '-p', String(WEB_PORT)] : ['start', '-H', '127.0.0.1', '-p', String(WEB_PORT)]);
await waitFor(`http://127.0.0.1:${WEB_PORT}/login`, 'Interface');

say(`\n✔ Prêt.
   Interface      http://127.0.0.1:${WEB_PORT}
   API (Swagger)  http://127.0.0.1:${API_PORT}/api/docs
   Journaux       ${join(home, 'logs')}
   E-mails        (invitations, réinitialisations) : liens écrits dans ${join(home, 'logs', 'api.log')}
   Ctrl+C pour tout arrêter ; les données sont conservées.`);
await new Promise(() => {});
