// Génère les captures du prototype (thème clair et thème sombre) dans docs/design/screens/.
//
//   node docs/design/outils/render-screens.mjs            # toutes les captures
//   node docs/design/outils/render-screens.mjs 06 02b     # seulement celles dont le nom commence par ces préfixes
//
// Utilise Microsoft Edge (ou Chrome) en mode sans fenêtre : aucune dépendance à installer.
// Variable d'environnement facultative : BROWSER_PATH (chemin du navigateur).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const designDir = resolve(here, '..');
const out = join(designDir, 'screens');
const page = pathToFileURL(join(designDir, 'prototype', 'index.html')).href;

const CANDIDATES = [
  process.env.BROWSER_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const browser = CANDIDATES.find((p) => existsSync(p));
if (!browser) throw new Error('Aucun navigateur trouvé : définissez BROWSER_PATH.');

/** [nom du fichier, paramètres d'URL, ancre, largeur, hauteur] */
const SCREENS = [
  ['01-connexion', '', '#login', 1520, 900],
  ['02-vue-densemble-hub', '', '#dashboard', 1520, 1500],
  ['02b-hub-recherche', 'q=kora', '#dashboard', 1520, 1100],
  ['03-agenda-semaine', '', '#agenda', 1520, 980],
  ['04-agenda-mois', '', '#agenda-mois', 1520, 920],
  ['05-entreprises', '', '#companies', 1520, 980],
  ['05b-entreprises-navigation-depliee', 'nav=full', '#companies', 1520, 980],
  ['06-opportunites', '', '#pipeline', 1520, 980],
  ['06b-opportunites-par-etape', '', '#opportunites-etapes', 1520, 860],
  ['06c-opportunites-filtre-etape', 'etape=Offre%20envoy%C3%A9e', '#pipeline', 1520, 760],
  ['07-formation', '', '#formation', 1520, 720],
  ['08-securite', '', '#security', 1520, 840],
  ['09-composants', '', '#components', 1520, 1650],
];

const filters = process.argv.slice(2);
mkdirSync(out, { recursive: true });
let count = 0;
for (const [name, query, hash, width, height] of SCREENS) {
  if (filters.length && !filters.some((prefix) => name.startsWith(prefix))) continue;
  for (const dark of [false, true]) {
    const params = [dark ? 'theme=dark' : '', query].filter(Boolean).join('&');
    const url = `${page}${params ? '?' + params : '?x=1'}${hash}`;
    const file = join(out, `${name}${dark ? '-sombre' : ''}.png`);
    execFileSync(browser, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--window-size=${width},${height}`, `--screenshot=${file}`, url], { stdio: 'ignore' });
    count += 1;
  }
}
console.log(`${count} captures écrites dans ${out}`);
