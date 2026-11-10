// Crée deploy/.env : les réglages de production, avec des secrets ALÉATOIRES générés ici (mot de passe de la base, clé de chiffrement du second facteur,
// paire de clés de signature des jetons). Le fichier est écrit avec des droits restreints et n'est jamais versionné (.gitignore).
//
//   node gen-env.mjs --domain app.exemple.cm --acme-email admin@exemple.cm [--sender no-reply@exemple.cm] [--force]
//
// Aucun secret n'est affiché. Si le fichier existe déjà, rien n'est écrit sans --force (écraser les clés déconnecterait tout le monde et
// rendrait illisibles les secrets du second facteur déjà enregistrés).
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const value = (name) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? undefined : args[index + 1];
};
const flag = (name) => args.includes(`--${name}`);
const fail = (message) => {
  console.error(`✘ ${message}`);
  process.exit(1);
};

const domain = value('domain');
const acmeEmail = value('acme-email');
const sender = value('sender') ?? '';
const target = value('out') ?? join(dirname(fileURLToPath(import.meta.url)), '.env');

if (!domain || !/^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(domain)) fail('--domain est obligatoire : un nom de domaine (par exemple app.exemple.cm), sans https:// ni chemin');
if (!acmeEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(acmeEmail)) fail('--acme-email est obligatoire : l’adresse qui reçoit les avis de renouvellement du certificat');
if (sender && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sender)) fail('--sender doit être une adresse e-mail');
if (existsSync(target) && !flag('force')) fail(`${target} existe déjà : rien n’est écrit (ajoutez --force pour l’écraser, ce qui change toutes les clés)`);

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const oneLine = (pem) => pem.trim().replace(/\n/g, '\\n');

const lines = [
  '# Réglages de production — généré par gen-env.mjs. NE JAMAIS VERSIONNER, NE JAMAIS ENVOYER PAR E-MAIL. Sauvegarder dans un coffre.',
  `APP_DOMAIN=${domain.toLowerCase()}`,
  `ACME_EMAIL=${acmeEmail}`,
  'POSTGRES_USER=investally',
  `POSTGRES_PASSWORD=${randomBytes(24).toString('hex')}`,
  'POSTGRES_DB=investally',
  `MFA_ENCRYPTION_KEY=${randomBytes(32).toString('base64')}`,
  `JWT_PRIVATE_KEY_PEM="${oneLine(privateKey.export({ type: 'pkcs8', format: 'pem' }))}"`,
  `JWT_PUBLIC_KEY_PEM="${oneLine(publicKey.export({ type: 'spki', format: 'pem' }))}"`,
  '',
  '# Domaines publiés par le serveur : V1 = identité et accès (iam) et ressources humaines (hr). Le reste répond « introuvable » et est masqué. « all » publie tout.',
  'RELEASED_DOMAINS=iam,hr',
  '',
  '# Envoi des e-mails : relais SMTP de Google Workspace autorisé par l’adresse IP du serveur (aucun mot de passe).',
  'EMAIL_PROVIDER=google-relay',
  `EMAIL_SENDER=${sender}`,
  'SMTP_HOST=smtp-relay.gmail.com',
  'SMTP_PORT=587',
  '',
];
writeFileSync(target, lines.join('\n'), { mode: 0o600 });
console.log(`✔ ${target} créé (droits restreints). Domaine : ${domain.toLowerCase()}.`);
if (!sender) console.log('! EMAIL_SENDER est vide : renseignez l’adresse d’expédition avant de démarrer (elle doit exister dans Google Workspace).');
console.log('! Sauvegardez ce fichier dans un coffre : sans lui, les secrets du second facteur déjà enregistrés deviennent illisibles.');
