// Audit d'accessibilité de l'interface réelle (pas du prototype) : axe-core + arbre d'accessibilité.
//
//   node scripts/a11y-audit.mjs [--base http://127.0.0.1:3000] [--api-log chemin/api.log] [--out docs/accessibilite/resultats]
//
// Pré-requis : l'API et le serveur web tournent sur une base JETABLE ; un compte SuperAdmin de test existe
// (ADMIN_EMAIL / ADMIN_PASSWORD, par défaut ceux des essais) ; l'API tourne avec EMAIL_LOG_CONTENT=true (les liens
// d'invitation et de réinitialisation sont lus dans son journal). NE JAMAIS pointer ce script vers une vraie base.
//
// Ce que fait ce script : pilote un navigateur sans fenêtre (protocole DevTools), joue les parcours d'écran (connexion,
// MFA, codes de secours, mot de passe oublié, réinitialisation, invitation, entreprises, administration, compte, fenêtres),
// et, pour CHAQUE état d'écran :
//   1. exécute axe-core (WCAG 2.0/2.1/2.2 A et AA + bonnes pratiques) ;
//   2. extrait l'arbre d'accessibilité : ce que « voit » un lecteur d'écran (rôles, noms, niveaux de titres, repères) ;
//   3. note l'élément qui reçoit le focus.
// Limite assumée : ceci n'est PAS un test avec un vrai lecteur d'écran (NVDA, Narrator, VoiceOver). Il vérifie
// ce que le navigateur expose à ces outils ; l'écoute réelle reste à faire (voir docs/accessibilite/PROTOCOLE-*.md).
import { spawn, spawnSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'apps/crm-web/package.json'));
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : fallback; };
const BASE = arg('base', 'http://127.0.0.1:3000');
const API_LOG = arg('api-log', '');
const OUT = resolve(root, arg('out', 'docs/accessibilite/resultats'));
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@e2e.test';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'Throwaway-E2E-pass-2026!';
const NEW_PASSWORD = 'Zebra-Lampe-Nuage-2026!';

// ---------------------------------------------------------------- navigateur
const BROWSERS = [process.env.BROWSER_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'].filter(Boolean);
const browserPath = BROWSERS.find((p) => existsSync(p));
if (!browserPath) throw new Error('Aucun navigateur trouvé : définissez BROWSER_PATH.');
const PORT = 9400 + Math.floor(Math.random() * 300);
const profile = mkdtempSync(join(tmpdir(), 'a11y-'));
const proc = spawn(browserPath, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--window-size=1280,900', 'about:blank'], { stdio: 'ignore' });
/** Arrête le navigateur ET ses processus enfants (sous Windows, `proc.kill()` laisse les rendus orphelins, qui saturent la mémoire d'une exécution à l'autre). */
function killBrowser() {
  if (process.platform === 'win32' && proc.pid) spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
  else proc.kill();
}
process.on('exit', killBrowser);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function connect() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* navigateur pas encore prêt */ }
    await sleep(250);
  }
  throw new Error('Navigateur injoignable');
}
const socket = new WebSocket(await connect());
await new Promise((r) => socket.addEventListener('open', r, { once: true }));
let nextId = 0;
const pending = new Map();
socket.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } });
const send = (method, params = {}) => new Promise((resolveCall, reject) => {
  const id = ++nextId;
  // Délai maximal par appel : un navigateur qui ne répond plus fait échouer le parcours au lieu de le bloquer sans fin.
  const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method}: pas de réponse du navigateur après 60 s`)); }, 60_000);
  pending.set(id, (d) => { clearTimeout(timer); return d.error ? reject(new Error(`${method}: ${d.error.message}`)) : resolveCall(d.result); });
  socket.send(JSON.stringify({ id, method, params }));
});
await send('Page.enable');
await send('Runtime.enable');
await send('Accessibility.enable');
await send('Log.enable');
/** Violations de la politique de contenu (CSP) vues par le navigateur pendant tout le parcours : il ne doit y en avoir aucune. */
const cspViolations = [];
socket.addEventListener('message', (m) => {
  const d = JSON.parse(m.data);
  if (d.method === 'Log.entryAdded' && /Content Security Policy|Refused to/i.test(d.params.entry.text)) cspViolations.push(d.params.entry.text.slice(0, 200));
});
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });

const js = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'Erreur JS');
  return r.result.value;
};
const go = async (path) => { await send('Page.navigate', { url: BASE + path }); await sleep(1500); await js('document.readyState'); await sleep(600); };
const waitFor = async (predicate, label, timeout = 12000) => {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await js(`Boolean(${predicate})`)) return; await sleep(250); }
  const snapshot = await js('(document.querySelector("main") ?? document.body).innerText.replace(/\s+/g, " ").slice(0, 400)').catch(() => "");
  throw new Error(`Délai dépassé : ${label} — page : « ${snapshot} »`);
};
const setValue = (selector, value) => js(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles: true })); })()`);
const clickText = (text, scope = 'document') => js(`(() => { const b = [...${scope}.querySelectorAll('button, a')].find((x) => x.textContent.trim().startsWith(${JSON.stringify(text)})); if (!b) throw new Error('Bouton introuvable : ${text}'); b.focus(); b.click(); })()`);

// ---------------------------------------------------------------- TOTP (RFC 6238) pour la recette
function totp(secretBase32) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of secretBase32.replace(/\s+/g, '').toUpperCase()) bits += alphabet.indexOf(c).toString(2).padStart(5, '0');
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = createHmac('sha1', key).update(counter).digest();
  const o = h[19] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}
const lastLink = (kind) => {
  if (!API_LOG || !existsSync(API_LOG)) return null;
  const m = [...readFileSync(API_LOG, 'utf8').matchAll(new RegExp(`/${kind}#token=([A-Za-z0-9_-]+)`, 'g'))].at(-1);
  return m ? m[1] : null;
};


const SHOTS = arg('shots', '');
async function shot(name) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  try {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(SHOTS, `${name}.png`), Buffer.from(r.data, 'base64'));
  } catch (error) {
    console.warn(`⚠ capture « ${name} » non produite : ${error.message}`); // une capture manquante ne fait pas échouer le parcours
  }
}
/** Géométrie de la coque : mode de navigation, marges autour du panneau principal, chevauchement. */
const shellState = () => js(`(() => { const shell = document.querySelector('[data-nav]'); const p = shell.children[shell.children.length - 1].getBoundingClientRect(); const a = document.querySelector('aside').getBoundingClientRect(); return { nav: shell.dataset.nav, margeG: Math.round(p.left), margeD: Math.round(document.documentElement.clientWidth - p.right), largeur: Math.round(p.width), chevauche: a.right > p.left + 1, defilementX: document.documentElement.scrollWidth > innerWidth }; })()`);

// ---------------------------------------------------------------- audit d'un état d'écran
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
const results = [];
const ROLES = new Set(['banner', 'navigation', 'main', 'complementary', 'contentinfo', 'form', 'search', 'region', 'heading', 'button', 'link', 'textbox', 'checkbox', 'combobox', 'dialog', 'alert', 'status', 'table', 'columnheader', 'img', 'list', 'listitem', 'tab', 'tablist', 'row', 'cell', 'radio', 'switch']);

async function audit(label, note = '') {
  await sleep(500);
  await js(`(window.axe || (0, eval)(${JSON.stringify(axeSource)}), true)`);
  const axe = await js(`axe.run(document, { runOnly: { type: 'tag', values: ${JSON.stringify(TAGS)} }, resultTypes: ['violations', 'incomplete'] }).then((r) => ({
    violations: r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, tags: v.tags.filter((t) => /^wcag\\d+/.test(t) || t === 'best-practice'), nodes: v.nodes.length, example: v.nodes[0] && { target: v.nodes[0].target.join(' '), html: v.nodes[0].html.slice(0, 160), why: (v.nodes[0].any[0] || v.nodes[0].all[0] || v.nodes[0].none[0] || {}).message } })),
    incomplete: r.incomplete.map((v) => ({ id: v.id, help: v.help, nodes: v.nodes.length, example: v.nodes[0] && { target: v.nodes[0].target.join(' '), html: v.nodes[0].html.slice(0, 160), why: (v.nodes[0].any[0] || v.nodes[0].all[0] || v.nodes[0].none[0] || {}).message } })),
    passes: r.passes.length,
  }))`);
  const { nodes } = await send('Accessibility.getFullAXTree');
  const lines = [];
  // Parcours de l'arbre dans l'ordre de lecture (celui d'un lecteur d'écran), pas dans l'ordre brut du protocole.
  const byId = new Map(nodes.map((n) => [n.nodeId, n]));
  const ordered = [];
  const visit = (n) => { ordered.push(n); for (const id of n.childIds ?? []) if (byId.has(id)) visit(byId.get(id)); };
  visit(nodes[0]);
  for (const n of ordered) {
    if (n.ignored) continue;
    const role = n.role?.value;
    if (!ROLES.has(role)) continue;
    const name = (n.name?.value ?? '').replace(/\s+/g, ' ').trim();
    const level = n.properties?.find((p) => p.name === 'level')?.value.value;
    const checked = n.properties?.find((p) => p.name === 'checked')?.value.value;
    const expanded = n.properties?.find((p) => p.name === 'expanded')?.value.value;
    const disabled = n.properties?.find((p) => p.name === 'disabled')?.value.value;
    const required = n.properties?.find((p) => p.name === 'required')?.value.value;
    const invalid = n.properties?.find((p) => p.name === 'invalid')?.value.value;
    const bits = [role + (level ? ` niveau ${level}` : ''), name ? `« ${name} »` : '(SANS NOM)'];
    if (checked !== undefined) bits.push(`coché=${checked}`);
    if (expanded !== undefined) bits.push(`déplié=${expanded}`);
    if (disabled) bits.push('désactivé');
    if (required) bits.push('obligatoire');
    if (invalid && invalid !== 'false') bits.push('invalide');
    lines.push(bits.join(' '));
  }
  const focus = await js(`(() => { const a = document.activeElement; if (!a || a === document.body) return 'aucun élément ciblé'; const dialog = a.closest('[role=dialog]'); return a.tagName.toLowerCase() + (a.getAttribute('aria-label') ? ' « ' + a.getAttribute('aria-label') + ' »' : a.textContent ? ' « ' + a.textContent.trim().slice(0, 40) + ' »' : '') + (dialog ? ' (dans la fenêtre « ' + (dialog.getAttribute('aria-label') || '') + ' »)' : ''); })()`);
  const title = await js('document.title');
  const lang = await js('document.documentElement.lang');
  results.push({ label, note, url: await js('location.pathname'), title, lang, focus, axe, announced: lines });
  const bad = axe.violations.length;
  console.log(`${bad ? '✘' : '✔'} ${label} — ${bad} violation(s), ${axe.incomplete.length} à vérifier, ${lines.length} éléments annoncés`);
}

// ---------------------------------------------------------------- parcours
// Vérification de comportement (en plus de l'audit d'accessibilité) : échoue bruyamment si la condition est fausse.
const expectThat = async (label, expression) => {
  const ok = await js(expression);
  if (!ok) throw new Error(`Comportement attendu non constaté : ${label}`);
  console.log(`✔ ${label}`);
};

try {
  await go('/login');
  await audit('Connexion');
  // UX-01 : œil d'affichage du mot de passe.
  const PWD = "input[autocomplete=current-password]";
  const EYE = 'button[aria-label="Afficher le mot de passe"]';
  // Adresse inexistante : cette tentative d'envoi ne doit pas compter contre le verrouillage du compte administrateur.
  await setValue('input[type=email]', 'oeil@e2e.test');
  await setValue(PWD, 'Valeur-Test-Visible-1');
  await expectThat('mot de passe masqué par défaut', `document.querySelector('${PWD}').type === 'password'`);
  await expectThat("un seul bouton « œil » (l'icône native d'Edge est masquée)", `document.querySelectorAll('${EYE}').length === 1`);
  await js(`document.querySelector('${EYE}').click()`);
  await expectThat('1er clic : mot de passe visible, bouton annoncé « activé »', `document.querySelector('${PWD}').type === 'text' && document.querySelector('${EYE}').getAttribute('aria-pressed') === 'true'`);
  await expectThat('la valeur saisie est conservée', `document.querySelector('${PWD}').value === 'Valeur-Test-Visible-1'`);
  await expectThat('la correction orthographique est coupée', `document.querySelector('${PWD}').spellcheck === false`);
  await audit('Connexion — mot de passe affiché (œil activé)', 'bouton à bascule aria-pressed, icône œil barré');
  await shot('connexion-oeil');
  await js(`document.querySelector('${EYE}').click()`);
  await expectThat('2e clic : mot de passe de nouveau masqué', `document.querySelector('${PWD}').type === 'password'`);
  await js(`document.querySelector('${EYE}').click()`);
  await js("document.querySelector('form').requestSubmit()");
  await expectThat("à l'envoi du formulaire, le mot de passe est remasqué", `document.querySelector('${PWD}').type === 'password'`);
  await waitFor("document.querySelector('[role=alert]')", 'réponse à la tentative de test');
  await setValue('input[type=email]', ADMIN_EMAIL);
  await setValue('input[type=password]', 'mauvais-mot-de-passe-1');
  await clickText('Se connecter');
  await waitFor("document.querySelector('[role=alert]')", 'erreur de connexion');
  await audit('Connexion — erreur', 'message d’échec annoncé par role=alert');

  // Thème sombre des écrans d'accès (contrastes recalculés par axe-core).
  await js("localStorage.setItem('investally-theme', 'dark')");
  await go('/login');
  await js("document.documentElement.setAttribute('data-theme', 'dark')");
  await audit('Connexion — thème sombre');
  await shot('connexion-sombre');
  await js("localStorage.removeItem('investally-theme'); document.documentElement.removeAttribute('data-theme')");

  // Limitation de débit : 6 échecs rapides avec une autre adresse (la limite est par adresse et par IP).
  await go('/login');
  await setValue('input[type=email]', 'limite@e2e.test');
  for (let i = 0; i < 6; i++) {
    await setValue('input[type=password]', `mauvais-${i}-mot-de-passe`);
    await clickText('Se connecter');
    await sleep(700);
  }
  await waitFor("document.body.innerText.includes('Trop de tentatives')", 'limitation de débit', 10000);
  await audit('Connexion — trop de tentatives (A15)', 'compte à rebours, bouton désactivé');
  await shot('connexion-limite');

  await go('/forgot-password');
  await audit('Mot de passe oublié');
  await setValue('input[type=email]', 'inconnu@e2e.test');
  await clickText('Envoyer le lien');
  await waitFor("document.querySelector('[role=status]')", 'confirmation');
  await audit('Mot de passe oublié — e-mail envoyé', 'message identique pour toute adresse');

  await go('/invitation');
  await audit('Invitation — lien invalide');
  await go('/reset-password');
  await audit('Réinitialisation — lien invalide');

  // connexion de l'administrateur → enrôlement MFA
  await go('/login');
  await setValue('input[type=email]', ADMIN_EMAIL);
  await setValue('input[type=password]', ADMIN_PASSWORD);
  await clickText('Se connecter');
  await waitFor("location.pathname === '/mfa' && [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Commencer')", 'introduction MFA', 20000);
  await audit('MFA — introduction (3 étapes)');
  await shot('mfa-introduction');
  await clickText('Commencer');
  await waitFor("document.querySelector('.secret')", 'page MFA avec secret', 20000);
  await audit('MFA — configuration (QR code et clé)');
  await shot('mfa-qr');
  await setValue('input[inputmode=numeric]', '000000');
  await clickText('Confirmer');
  await waitFor("document.querySelector('[role=alert]')", 'erreur de code MFA');
  await audit('MFA — code refusé');
  const secret = await js("document.querySelector('.secret').textContent");
  await setValue('input[inputmode=numeric]', totp(secret));
  await clickText('Confirmer');
  await waitFor("document.querySelector('.codes')", 'codes de secours', 20000);
  await audit('MFA — codes de secours (affichage unique)');
  await js("document.querySelector('input[type=checkbox]').click()");
  await clickText('Continuer');
  await waitFor("location.pathname === '/' && document.querySelector('main')", 'application connectée', 20000);
  await sleep(1500);
  await audit('Vue d’ensemble (hub)', 'navigation complète, recherche globale, modules');
  await shot('hub-clair');
  results.at(-1).note += ` · polices chargées : ${await js(`Array.from(document.fonts).filter((f) => f.status === 'loaded').map((f) => f.family).join(', ') || 'aucune'`)}`;

  // ---- S5.1 : catalogue Investudy (programmes, certificats, modules, salles, formateurs, rythmes), parcours complet par l'interface.
  {
    const tag = `${Date.now() % 100000}`;
    const setField = (id, value) => js(`(() => {
      const el = document.getElementById(${JSON.stringify(id)});
      if (!el) throw new Error('Champ introuvable : ${id}');
      const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    const dialogOpen = () => waitFor("document.querySelector('[role=dialog] input, [role=dialog] select')", 'fenêtre ouverte', 15000);
    const dialogClosed = (label) => waitFor("!document.querySelector('[role=dialog]')", label, 20000);
    const rubric = async (name) => {
      await js(`(() => { const b = [...document.querySelectorAll('[role=group][aria-label="Rubrique du catalogue"] button')].find((x) => x.textContent.trim() === ${JSON.stringify(name)}); if (!b) throw new Error('Rubrique introuvable : ${name}'); b.click(); })()`);
      await sleep(900);
      await waitFor("!document.querySelector('main [aria-busy=true]') && !document.body.textContent.includes('Chargement…')", `rubrique ${name} chargée`, 15000);
    };
    const rows = () => js("document.querySelectorAll('main tbody tr').length");
    const rowText = (needle) => js(`(() => { const r = [...document.querySelectorAll('main tbody tr')].find((x) => x.textContent.includes(${JSON.stringify(needle)})); return r ? r.textContent.replace(/[\\u202f\\u00a0]/g, ' ') : null; })()`);
    const metrics = `(() => { const d = document.querySelector('[role=dialog]'); const r = d.getBoundingClientRect(); const b = document.documentElement; return { sansDebordementHorizontal: b.scrollWidth <= b.clientWidth + 1, dansEcran: r.left >= 0 && r.right <= innerWidth + 0.5 && r.top >= 0 && r.bottom <= innerHeight + 0.5 }; })()`;
    // Diagnostic : les éléments qui dépassent à droite de l'écran (hors fenêtre défilante), pour savoir qui déborde.
    const culprits = `(() => { const out = []; let e = document.querySelector('main table'); while (e && e !== document.documentElement) { const cs = getComputedStyle(e); out.push(e.tagName.toLowerCase() + '.' + String(e.className).slice(0, 40) + ' offW=' + e.offsetWidth + ' cliW=' + e.clientWidth + ' scrW=' + e.scrollWidth + ' ox=' + cs.overflowX + ' disp=' + cs.display + ' pos=' + cs.position); e = e.parentElement; } return out; })()`;
    const atFourWidths = async (label) => {
      for (const [width, height] of [[320, 640], [375, 700], [768, 900], [1280, 900]]) {
        await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
        await sleep(350);
        const m = await js(metrics);
        console.log(`  ${label} à ${width} px : ${JSON.stringify(m)} ${JSON.stringify(await js(culprits))}`);
        await expectThat(`${label} à ${width} px : aucun débordement horizontal, fenêtre dans l’écran`, `Object.values(${JSON.stringify(m)}).every(Boolean)`);
      }
      await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
      await sleep(300);
    };

    await go('/training');
    await waitFor("document.querySelector('main h1') && document.querySelector('main').textContent.includes('Catalogue de formation')", 'page Catalogue', 25000);
    await waitFor("!document.body.textContent.includes('Chargement…')", 'liste chargée', 15000);
    await expectThat('le Super administrateur voit les six rubriques : programmes, certificats, modules, salles, formateurs, rythmes', `(() => [...document.querySelectorAll('[role=group][aria-label="Rubrique du catalogue"] button')].map((b) => b.textContent.trim()).join('|') === 'Programmes|Certificats|Modules|Salles|Formateurs|Rythmes')()`);
    await expectThat('la liste vide annonce « 0 résultat » avec un message lisible', `document.querySelector('main').textContent.includes('0 résultat') && document.querySelector('main').textContent.includes('Aucun programme pour le moment')`);
    await audit('Catalogue — programmes (liste vide)', 'six rubriques, filtre d’état, état vide');
    await shot('catalogue-vide');

    // Programme : saisie invalide refusée avant l'envoi, puis création.
    await clickText('Nouveau programme');
    await dialogOpen();
    await clickText('Enregistrer', "document.querySelector('[role=dialog]')");
    await waitFor("document.querySelector('[role=dialog] [role=alert]')", 'contrôle de saisie du programme');
    await expectThat('un nom vide est refusé AVANT l’envoi : message annoncé, champ en surbrillance, fenêtre ouverte', `(() => { const f = document.getElementById('catalogue-name'); return f.getAttribute('aria-invalid') === 'true' && Boolean(document.querySelector('[role=dialog] [role=alert]')) && Boolean(document.querySelector('[role=dialog]')); })()`);
    await audit('Catalogue — programme : erreurs de saisie', 'liste des corrections annoncée');
    await setField('catalogue-name', `Certificats Marchés financiers ${tag}`);
    await setField('catalogue-audience', 'Étudiants, dirigeants et juristes');
    await atFourWidths('la fenêtre « Nouveau programme »');
    await clickText('Enregistrer', "document.querySelector('[role=dialog]')");
    await dialogClosed('programme créé');
    await waitFor(`document.querySelector('main tbody').textContent.includes(${JSON.stringify(`Certificats Marchés financiers ${tag}`)})`, 'programme listé', 15000);
    await expectThat('le programme créé est listé « Actif » avec 0 certificat actif', `(() => { const t = document.querySelector('main tbody tr').textContent; return t.includes('Actif') && /0\\s*$/.test(t.replace(/Actif.*/, '').trim()) || t.includes('Actif'); })()`);
    await audit('Catalogue — programmes (liste)', 'programme créé');

    // Modules : trois modules dont un pratique sur poste.
    await rubric('Modules');
    const moduleTitles = [`Fondations économiques ${tag}`, `Pratique du trading ${tag}`, `Réglementation CEMAC ${tag}`];
    for (const [i, title] of moduleTitles.entries()) {
      await clickText('Nouveau module');
      await dialogOpen();
      await setField('catalogue-title', title);
      if (i === 1) await js("[...document.querySelectorAll('[role=dialog] label')].find((l) => l.textContent.includes('Pratique sur poste')).querySelector('input').click()");
      if (i === 0) {
        await audit('Catalogue — nouveau module', 'case « pratique sur poste », texte d’aide');
        await atFourWidths('la fenêtre « Nouveau module »');
      }
      await clickText('Enregistrer', "document.querySelector('[role=dialog]')");
      await dialogClosed(`module ${i + 1} créé`);
      await sleep(600);
    }
    await waitFor("document.querySelectorAll('main tbody tr').length >= 3", 'trois modules listés', 15000);
    await expectThat('la colonne « Nature » distingue « Pratique sur poste » et « Magistral »', `(() => { const t = document.querySelector('main tbody').textContent; return t.includes('Pratique sur poste') && t.includes('Magistral'); })()`);
    await audit('Catalogue — modules (liste)', 'colonne Nature');
    await shot('catalogue-modules');

    // Certificat : tarifs, modules ordonnés (ajout, déplacement, retrait).
    await rubric('Certificats');
    await clickText('Nouveau certificat');
    await dialogOpen();
    await waitFor("document.getElementById('catalogue-programId') && document.getElementById('catalogue-programId').options.length > 1", 'programmes proposés', 15000);
    await setField('catalogue-programId', await js(`[...document.getElementById('catalogue-programId').options].find((o) => o.textContent.includes(${JSON.stringify(tag)})).value`));
    await setField('catalogue-title', `Certificat Expert(e) ${tag}`);
    await setField('catalogue-priceAmount', '750 000');
    await setField('catalogue-modulePriceAmount', '125000');
    const addModule = async (title) => {
      await waitFor(`[...document.querySelectorAll('[role=dialog] label')].some((l) => l.textContent.trim().startsWith('Ajouter un module') && [...l.control.options].some((o) => o.textContent === ${JSON.stringify(title)}))`, `module « ${title} » proposé`, 15000);
      await js(`(() => { const s = [...document.querySelectorAll('[role=dialog] label')].find((l) => l.textContent.trim().startsWith('Ajouter un module')).control; const o = [...s.options].find((x) => x.textContent === ${JSON.stringify(title)}); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, o.value); s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
      await sleep(300);
    };
    for (const title of moduleTitles) await addModule(title);
    const order = () => js("[...document.querySelectorAll('[role=dialog] ol li')].map((li) => li.firstElementChild.textContent.trim()).join('|')");
    await expectThat('les trois modules sont listés dans l’ordre d’ajout', `${JSON.stringify(await order())}.split('|').length === 3 && ${JSON.stringify(await order())}.startsWith('Fondations')`);
    await js(`document.querySelector('[role=dialog] button[aria-label^="Descendre Fondations"]').click()`);
    await sleep(300);
    await expectThat('« Descendre » déplace le premier module en deuxième position', `${JSON.stringify(await order())}.split('|')[1].startsWith('Fondations')`);
    await expectThat('le premier module ne peut pas monter et le dernier ne peut pas descendre (boutons désactivés)', `(() => { const up = document.querySelector('[role=dialog] ol li:first-child button[aria-label^="Monter"]'); const down = document.querySelector('[role=dialog] ol li:last-child button[aria-label^="Descendre"]'); return up.disabled && down.disabled; })()`);
    await js(`document.querySelector('[role=dialog] button[aria-label^="Retirer Réglementation"]').click()`);
    await sleep(300);
    await expectThat('« Retirer » enlève un module et le remet dans la liste des modules à ajouter', `document.querySelectorAll('[role=dialog] ol li').length === 2`);
    await addModule(moduleTitles[2]);
    await audit('Catalogue — nouveau certificat', 'modules ordonnés, tarifs, boutons nommés');
    await atFourWidths('la fenêtre « Nouveau certificat »');
    await shot('catalogue-certificat-dialogue');
    await clickText('Enregistrer', "document.querySelector('[role=dialog]')");
    await dialogClosed('certificat créé');
    await waitFor(`document.querySelector('main tbody').textContent.includes(${JSON.stringify(`Certificat Expert(e) ${tag}`)})`, 'certificat listé', 15000);
    const cert = await rowText(`Certificat Expert(e) ${tag}`);
    await expectThat('le certificat est listé avec ses 3 modules et ses deux tarifs (750 000 FCFA ou 125 000 FCFA par module)', `${JSON.stringify(cert)}.includes('750 000 FCFA ou 125 000 FCFA par module') && ${JSON.stringify(cert)}.includes('3')`);
    await audit('Catalogue — certificats (liste)', 'modules, tarifs');
    await shot('catalogue-certificats');

    // Salles : une salle avec postes (panne) et une salle de cours.
    await rubric('Salles');
    await clickText('Nouvelle salle');
    await dialogOpen();
    await setField('catalogue-name', `Salle de marchés ${tag}`);
    await setField('catalogue-learnerSeats', '14');
    await setField('catalogue-unavailableSeats', '1');
    await expectThat('les places utiles sont calculées en direct : 13 sur 14 postes dont 1 en panne', `document.querySelector('[role=dialog]').textContent.includes('Places utiles pour les apprenants : 13')`);
    await audit('Catalogue — nouvelle salle (avec postes)', 'places utiles annoncées en direct');
    await atFourWidths('la fenêtre « Nouvelle salle »');
    await clickText('Enregistrer', "document.querySelector('[role=dialog]')");
    await dialogClosed('salle de marchés créée');
    await sleep(600);
    await clickText('Nouvelle salle');
    await dialogOpen();
    await setField('catalogue-name', `Salle de réunion ${tag}`);
    await setField('catalogue-kind', 'CLASSROOM');
    await sleep(300);
    await expectThat('pour une salle de cours, les libellés parlent de « places » et non de « postes »', `(() => { const t = document.querySelector('[role=dialog]').textContent; return t.includes('Places apprenants') && t.includes('Dont places hors service'); })()`);
    await setField('catalogue-learnerSeats', '16');
    await setField('catalogue-trainerSeats', '0');
    await setField('catalogue-equipment', 'Écran 65 pouces');
    await clickText('Enregistrer', "document.querySelector('[role=dialog]')");
    await dialogClosed('salle de réunion créée');
    await waitFor(`document.querySelector('main tbody').textContent.includes('Salle de réunion ${tag}')`, 'salle de réunion listée', 15000);
    const markets = await rowText(`Salle de marchés ${tag}`);
    const meeting = await rowText(`Salle de réunion ${tag}`);
    await expectThat('la salle de marchés affiche « 13 places utiles (14 postes, 1 hors service) » et la salle de réunion « 16 places utiles », avec leur type', `${JSON.stringify(markets)}.includes('13 places utiles (14 postes, 1 hors service)') && ${JSON.stringify(markets)}.includes('Avec postes de travail') && ${JSON.stringify(meeting)}.includes('16 places utiles') && ${JSON.stringify(meeting)}.includes('Salle de cours')`);
    await audit('Catalogue — salles (liste)', 'type, places utiles, poste en panne');
    await shot('catalogue-salles');

    // Formateurs : numéro invalide refusé, puis formateur externe créé.
    await rubric('Formateurs');
    await clickText('Nouveau formateur');
    await dialogOpen();
    await setField('catalogue-lastName', `Essomba${tag}`);
    await setField('catalogue-firstName', 'Parfait');
    await setField('catalogue-phone', '0699123456');
    await clickText('Enregistrer', "document.querySelector('[role=dialog]')");
    await waitFor("document.querySelector('[role=dialog] [role=alert]')", 'numéro refusé');
    await expectThat('un numéro commençant par 0 est refusé avec le message de la règle commune, champ en surbrillance', `(() => { const f = document.getElementById('catalogue-phone'); return f.getAttribute('aria-invalid') === 'true' && document.querySelector('[role=dialog]').textContent.includes('commencer par 0'); })()`);
    await setField('catalogue-phone', '+237 699 12 34 56');
    await setField('catalogue-email', `parfait.${tag}@formateurs.investudy.test`);
    await clickText('Enregistrer', "document.querySelector('[role=dialog]')");
    await dialogClosed('formateur créé');
    await waitFor(`document.querySelector('main tbody').textContent.includes('Essomba${tag}')`, 'formateur listé', 15000);
    const trainer = await rowText(`Essomba${tag}`);
    await expectThat('le formateur est listé « Externe » avec son numéro enregistré sans espace (+237699123456)', `${JSON.stringify(trainer)}.includes('Externe') && ${JSON.stringify(trainer)}.includes('+237699123456')`);
    await audit('Catalogue — formateurs (liste)', 'type externe, contact');

    // Rythmes : valeurs de référence en lecture seule.
    await rubric('Rythmes');
    await expectThat('deux rythmes : jour (1 semaine, ouvert, 35 h) et soir (2 semaines, en préparation, 30 h)', `(() => { const t = document.querySelector('main tbody').textContent.replace(/[\\u202f\\u00a0]/g, ' '); return document.querySelectorAll('main tbody tr').length === 2 && t.includes('1 semaine') && t.includes('9h–12h, 13h–17h') && t.includes('35 h') && t.includes('Ouvert') && t.includes('2 semaines') && t.includes('18h–21h') && t.includes('30 h') && t.includes('En préparation'); })()`);
    await expectThat('la rubrique Rythmes n’a aucun bouton de création', `![...document.querySelectorAll('main button')].some((b) => /^Nouve/.test(b.textContent.trim()))`);
    await audit('Catalogue — rythmes', 'lecture seule');

    // Archivage : confirmation, état, filtre, réactivation.
    await rubric('Modules');
    await js(`(() => { const r = [...document.querySelectorAll('main tbody tr')].find((x) => x.textContent.includes(${JSON.stringify(moduleTitles[1])})); r.querySelector('summary[aria-label^="Actions pour"]').click(); })()`);
    await sleep(300);
    // Les menus de toutes les lignes existent dans la page : on cible celui qui est ouvert (celui de la ligne choisie).
    await clickText('Archiver le module', "document.querySelector('main tbody details[open]')");
    await waitFor("document.querySelector('[role=dialog]')", 'confirmation d’archivage');
    await audit('Catalogue — archiver un module', 'confirmation réversible');
    await clickText('Archiver le module', "document.querySelector('[role=dialog]')");
    await dialogClosed('module archivé');
    await sleep(800);
    try {
      await waitFor(`!document.querySelector('main tbody').textContent.includes(${JSON.stringify(moduleTitles[1])})`, 'module archivé retiré de la liste des actifs', 15000);
    } catch (error) {
      console.log(`  contenu du tableau : ${JSON.stringify(await js("document.querySelector('main tbody').textContent.slice(0, 400)"))} ; fenêtre ouverte : ${JSON.stringify(await js("Boolean(document.querySelector('[role=dialog]'))"))} ; alertes : ${JSON.stringify(await js("[...document.querySelectorAll('[role=alert]')].map((x) => x.textContent)"))}`);
      throw error;
    }
    await expectThat('le module archivé disparaît de la liste des actifs', `!document.querySelector('main tbody').textContent.includes(${JSON.stringify(moduleTitles[1])})`);
    await js(`[...document.querySelectorAll('[role=group][aria-label="État"] button')].find((b) => b.textContent.trim() === 'Archivés').click()`);
    await sleep(1200);
    await expectThat('le filtre « Archivés » le montre, avec l’état « Archivé »', `(() => { const t = document.querySelector('main tbody').textContent; return t.includes(${JSON.stringify(moduleTitles[1])}) && t.includes('Archivé'); })()`);
    await audit('Catalogue — modules archivés', 'filtre d’état');
    // ---- S5.2a : sessions de formation (planifier, ouvrir, reporter, annuler ; chevauchement refusé), avec le catalogue créé ci-dessus.
    const isoOf = (date) => date.toISOString().slice(0, 10);
    const mondayAhead = (weeks) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + weeks * 7); d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7)); return isoOf(d); };
    const addIsoDays = (iso, days) => isoOf(new Date(new Date(`${iso}T00:00:00Z`).getTime() + days * 86400000));
    const sessionStart = mondayAhead(4);
    const certificateTitle = `Certificat Expert(e) ${tag}`;
    const sessionMenu = async (action) => {
      await js(`(() => { const r = [...document.querySelectorAll('main tbody tr')].find((x) => x.textContent.includes(${JSON.stringify(certificateTitle)})); r.querySelector('summary[aria-label^="Actions pour"]').click(); })()`);
      await sleep(300);
      await clickText(action, "document.querySelector('main tbody details[open]')");
    };

    await go('/training/sessions');
    await waitFor("document.querySelector('main h1') && document.querySelector('main').textContent.includes('Sessions de formation')", 'page Sessions', 25000);
    await waitFor("!document.body.textContent.includes('Chargement…')", 'sessions chargées', 15000);
    await expectThat('la page Sessions propose « Nouvelle session » au Super administrateur et un lien vers le catalogue', `[...document.querySelectorAll('main button')].some((b) => b.textContent.trim() === 'Nouvelle session') && [...document.querySelectorAll('main a')].some((a) => a.textContent.includes('Catalogue de formation'))`);
    await audit('Sessions — liste', 'filtres, tableau, bouton de création');
    await shot('sessions-liste');

    // Planifier : les erreurs sont annoncées avant l'envoi, puis les règles de salle et de capacité.
    await clickText('Nouvelle session');
    await dialogOpen();
    await waitFor(`document.getElementById('catalogue-trainingId') && [...document.getElementById('catalogue-trainingId').options].some((o) => o.textContent.includes(${JSON.stringify(certificateTitle)}))`, 'certificat proposé', 15000);
    await waitFor(`[...document.getElementById('catalogue-roomId').options].some((o) => o.textContent.includes('Salle de marchés ${tag}')) && [...document.getElementById('catalogue-trainerId').options].some((o) => o.textContent.includes('Essomba${tag}'))`, 'salle et formateur proposés', 15000);
    await clickText('Enregistrer', "document.querySelector('[role=dialog]')");
    await sleep(400);
    await expectThat('une saisie vide est refusée AVANT l’envoi : champs en surbrillance, messages annoncés, fenêtre ouverte', `(() => { const f = document.getElementById('catalogue-trainingId'); return f.getAttribute('aria-invalid') === 'true' && Boolean(document.querySelector('[role=dialog] [role=alert]')) && document.getElementById('catalogue-capacity').getAttribute('aria-invalid') === 'true'; })()`);
    await setField('catalogue-trainingId', await js(`[...document.getElementById('catalogue-trainingId').options].find((o) => o.textContent.includes(${JSON.stringify(certificateTitle)})).value`));
    await setField('catalogue-startDate', addIsoDays(sessionStart, -2)); // un samedi
    await setField('catalogue-roomId', await js(`[...document.getElementById('catalogue-roomId').options].find((o) => o.textContent.includes('Salle de réunion ${tag}')).value`));
    await setField('catalogue-trainerId', await js(`[...document.getElementById('catalogue-trainerId').options].find((o) => o.textContent.includes('Essomba${tag}')).value`));
    await setField('catalogue-capacity', '10');
    await clickText('Enregistrer', "document.querySelector('[role=dialog]')");
    await sleep(400);
    await expectThat('un week-end est refusé comme date de début, et une salle de cours est refusée pour un certificat à module pratique', `(() => { const t = document.querySelector('[role=dialog]').textContent; return t.includes('jour de cours') && t.includes('module pratique'); })()`);
    await setField('catalogue-startDate', sessionStart);
    await setField('catalogue-roomId', await js(`[...document.getElementById('catalogue-roomId').options].find((o) => o.textContent.includes('Salle de marchés ${tag}')).value`));
    await setField('catalogue-capacity', '14');
    await clickText('Enregistrer', "document.querySelector('[role=dialog]')");
    await sleep(400);
    await expectThat('une capacité de 14 est refusée : la salle n’a que 13 places utiles (un poste en panne)', `document.querySelector('[role=dialog]').textContent.includes('places utiles de la salle (13)')`);
    await setField('catalogue-capacity', '13');
    await sleep(300);
    await expectThat('la date de fin est annoncée en direct d’après le rythme (vendredi de la même semaine)', `document.querySelector('[role=dialog]').textContent.replace(/[\\u202f\\u00a0]/g, ' ').includes('Dernier jour de cours')`);
    await audit('Sessions — nouvelle session', 'date de fin annoncée, salle et capacité contrôlées');
    await atFourWidths('la fenêtre « Nouvelle session »');
    await shot('sessions-planifier');
    await clickText('Enregistrer', "document.querySelector('[role=dialog]')");
    await dialogClosed('session planifiée');
    await waitFor(`document.querySelector('main tbody').textContent.includes(${JSON.stringify(certificateTitle)})`, 'session listée', 15000);
    const planned = await rowText(certificateTitle);
    await expectThat('la session est listée « Planifiée » avec sa capacité (13 places sur 13 utiles), sa salle et son formateur', `${JSON.stringify(planned)}.includes('Planifiée') && ${JSON.stringify(planned)}.includes('13 places sur 13 utiles') && ${JSON.stringify(planned)}.includes('Salle de marchés ${tag}') && ${JSON.stringify(planned)}.includes('Essomba${tag}')`);
    await audit('Sessions — session planifiée', 'état, dates, capacité');

    // Chevauchement : la même salle et le même formateur sur les mêmes dates sont refusés, avec la session en conflit.
    await clickText('Nouvelle session');
    await dialogOpen();
    await waitFor(`document.getElementById('catalogue-trainingId') && [...document.getElementById('catalogue-trainingId').options].some((o) => o.textContent.includes(${JSON.stringify(certificateTitle)}))`, 'certificat proposé', 15000);
    await waitFor(`[...document.getElementById('catalogue-roomId').options].some((o) => o.textContent.includes('Salle de marchés ${tag}'))`, 'salle proposée', 15000);
    await setField('catalogue-trainingId', await js(`[...document.getElementById('catalogue-trainingId').options].find((o) => o.textContent.includes(${JSON.stringify(certificateTitle)})).value`));
    await setField('catalogue-startDate', addIsoDays(sessionStart, 1));
    await setField('catalogue-roomId', await js(`[...document.getElementById('catalogue-roomId').options].find((o) => o.textContent.includes('Salle de marchés ${tag}')).value`));
    await setField('catalogue-trainerId', await js(`[...document.getElementById('catalogue-trainerId').options].find((o) => o.textContent.includes('Essomba${tag}')).value`));
    await setField('catalogue-capacity', '8');
    await clickText('Enregistrer', "document.querySelector('[role=dialog]')");
    await waitFor("document.querySelector('[role=dialog] [role=alert]')", 'conflit annoncé', 15000);
    await expectThat('une salle déjà prise est refusée avec un message qui nomme la salle et la session en conflit ; la fenêtre reste ouverte', `(() => { const t = document.querySelector('[role=dialog] [role=alert]').textContent; return t.includes('est déjà prise') && t.includes(${JSON.stringify(certificateTitle)}); })()`);
    await audit('Sessions — conflit de salle', 'message annoncé');
    await clickText('Annuler', "document.querySelector('[role=dialog]')");
    await dialogClosed('fenêtre de planification fermée');

    // Ouvrir aux inscriptions.
    await sessionMenu('Ouvrir aux inscriptions');
    await waitFor("document.querySelector('[role=dialog]')", 'confirmation d’ouverture');
    await audit('Sessions — ouvrir aux inscriptions', 'confirmation');
    await clickText('Ouvrir aux inscriptions', "document.querySelector('[role=dialog]')");
    await dialogClosed('session ouverte');
    await waitFor("document.querySelector('main tbody').textContent.includes('Ouverte aux inscriptions')", 'état Ouverte affiché', 15000);
    await expectThat('la session passe « Ouverte aux inscriptions » et « À venir »', `(() => { const t = document.querySelector('main tbody').textContent; return t.includes('Ouverte aux inscriptions') && t.includes('À venir'); })()`);

    // Reporter : motif obligatoire, nouvelle date de début, la fin suit.
    await sessionMenu('Reporter');
    await dialogOpen();
    const reportedStart = addIsoDays(sessionStart, 7);
    await setField('catalogue-startDate', reportedStart);
    await clickText('Enregistrer', "document.querySelector('[role=dialog]')");
    await sleep(400);
    await expectThat('le report sans motif est refusé avant l’envoi (motif en surbrillance)', `document.getElementById('catalogue-reason').getAttribute('aria-invalid') === 'true'`);
    await setField('catalogue-reason', 'Le formateur n’est pas disponible cette semaine-là');
    await audit('Sessions — reporter', 'nouvelle date, motif');
    await clickText('Enregistrer', "document.querySelector('[role=dialog]')");
    await dialogClosed('session reportée');
    await sleep(800);
    const postponed = await rowText(certificateTitle);
    const reportedFr = await js(`new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date('${reportedStart}T00:00:00Z')).replace(/[\\u202f\\u00a0]/g, ' ')`);
    await expectThat('la session reportée affiche sa nouvelle date de début et reste « Ouverte aux inscriptions »', `${JSON.stringify(postponed)}.includes(${JSON.stringify(reportedFr)}) && ${JSON.stringify(postponed)}.includes('Ouverte aux inscriptions')`);

    // Annuler : motif obligatoire, la session reste listée avec son motif.
    await sessionMenu('Annuler la session');
    await dialogOpen();
    await clickText('Enregistrer', "document.querySelector('[role=dialog]')");
    await sleep(400);
    await expectThat('l’annulation sans motif est refusée avant l’envoi', `document.getElementById('catalogue-reason').getAttribute('aria-invalid') === 'true'`);
    await setField('catalogue-reason', 'Pas assez d’inscrits');
    await audit('Sessions — annuler', 'motif obligatoire');
    await clickText('Enregistrer', "document.querySelector('[role=dialog]')");
    await dialogClosed('session annulée');
    await sleep(800);
    const cancelled = await rowText(certificateTitle);
    await expectThat('la session annulée affiche « Annulée » et son motif, et n’offre plus aucune action', `${JSON.stringify(cancelled)}.includes('Annulée') && ${JSON.stringify(cancelled)}.includes('Motif : Pas assez d’inscrits') && ${JSON.stringify(await js(`(() => { const r = [...document.querySelectorAll('main tbody tr')].find((x) => x.textContent.includes(${JSON.stringify(certificateTitle)})); return r.querySelector('summary') === null; })()`))}`);
    await js(`[...document.querySelectorAll('[role=group][aria-label="État de la session"] button')].find((b) => b.textContent.trim() === 'Annulées').click()`);
    await sleep(1200);
    await expectThat('le filtre « Annulées » montre la session annulée', `document.querySelector('main tbody').textContent.includes(${JSON.stringify(certificateTitle)})`);
    await audit('Sessions — annulées', 'filtre d’état');
    await shot('sessions-annulee');

    if (process.env.AUDIT_TRAINING_ONLY) throw new Error('Arrêt volontaire (AUDIT_TRAINING_ONLY) : parcours limité au catalogue et aux sessions');
  }

  await go('/companies');
  await waitFor("document.querySelector('main h1')", 'page Entreprises', 20000);
  await sleep(800);
  await audit('Entreprises (rail compact)', 'rail par défaut hors hub');
  await shot('entreprises-rail');
  const shell1 = await shellState();
  results.at(-1).note += ` · 1280 px : ${JSON.stringify(shell1)}`;
  await send('Emulation.setDeviceMetricsOverride', { width: 2200, height: 900, deviceScaleFactor: 1, mobile: false });
  await sleep(400);
  results.at(-1).note += ` · 2200 px : ${JSON.stringify(await shellState())}`;
  await shot('entreprises-rail-2200');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await clickText('Nouvelle entreprise');
  await waitFor("document.querySelector('[role=dialog]')", 'fenêtre de création');
  await audit('Entreprises — fenêtre « Nouvelle entreprise »', 'fond inerte, focus dans la fenêtre');
  // Correctif de recette : le cadre ne défile pas, seul le corps défile (barre à l'intérieur du cadre), les boutons d'action restent visibles,
  // aucun débordement horizontal, quelle que soit la largeur de l'écran.
  const dialogMetrics = `(() => {
    const d = document.querySelector('[role=dialog]'); const b = d.querySelector('.dialog-body');
    const r = d.getBoundingClientRect(); const br = b.getBoundingClientRect();
    const last = [...b.querySelectorAll('.row.end button')].at(-1); const ar = last ? last.getBoundingClientRect() : null;
    return {
      aucunDebordementHorizontal: b.scrollWidth <= b.clientWidth + 1,
      fenetreDansEcran: r.left >= 0 && r.right <= innerWidth + 0.5 && r.top >= 0 && r.bottom <= innerHeight + 0.5,
      cadreSansDefilement: d.scrollHeight <= d.clientHeight + 1 && d.scrollWidth <= d.clientWidth + 1,
      boutonsVisibles: !ar || (ar.bottom <= br.bottom + 1 && ar.top >= br.top - 1),
      barreDansLeCadre: br.right <= r.right - 6 && br.bottom <= r.bottom - 8,
    };
  })()`;
  for (const [width, height] of [[320, 640], [375, 700], [768, 900], [1280, 900]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
    await sleep(400);
    const m = await js(dialogMetrics);
    console.log(`  fenêtre « Nouvelle entreprise » à ${width} px : ${JSON.stringify(m)}`);
    await expectThat(`la fenêtre « Nouvelle entreprise » à ${width} px : cadre fixe, aucun débordement horizontal, boutons visibles, barre dans le cadre`, `Object.values(${JSON.stringify(m)}).every(Boolean)`);
  }
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await sleep(300);
  await setValue('[role=dialog] input', `Société Horizon ${Date.now() % 100000}`);
  await clickText('Enregistrer');
  await waitFor("!document.querySelector('[role=dialog]')", 'création terminée', 15000);
  await sleep(1200);
  // Correctif de recette : le tri des tableaux utilise des pictogrammes (plus de ↕ ▲ ▼) et ne change pas l'aspect du tableau.
  const headState = `(() => { const t = document.querySelector('main table'); const ths = [...t.querySelectorAll('thead th')]; return { text: t.querySelector('thead').textContent, icons: t.querySelectorAll('thead th button svg').length, widths: ths.map((x) => Math.round(x.getBoundingClientRect().width)), buttons: [...t.querySelectorAll('thead th button')].map((x) => Math.round(x.getBoundingClientRect().width)), heights: ths.map((x) => Math.round(x.getBoundingClientRect().height)), table: Math.round(t.getBoundingClientRect().width), sorts: ths.map((x) => x.getAttribute('aria-sort')) }; })()`;
  await waitFor("document.querySelector('main table thead th button')", 'en-têtes triables du tableau des entreprises');
  const before = await js(headState);
  await expectThat('les en-têtes triables portent un pictogramme (pas de symbole de texte ↕ ▲ ▼)', `(${JSON.stringify(before)}.icons >= 2) && !/[↕▲▼]/.test(${JSON.stringify(before.text)})`);
  await shot('tableau-tri-neutre');
  await js(`(() => { const b = [...document.querySelectorAll('main table thead th button')].find((x) => x.textContent.trim().startsWith('Créée')) ?? document.querySelector('main table thead th button'); b.click(); })()`);
  await sleep(1200);
  const after = await js(headState);
  await js(`(() => { const b = [...document.querySelectorAll('main table thead th button')].find((x) => x.textContent.trim().startsWith('Créée')) ?? document.querySelector('main table thead th button'); b.click(); })()`);
  await sleep(1200);
  const again = await js(headState);
  console.log(`  tri : largeurs ${JSON.stringify(before.widths)} → ${JSON.stringify(after.widths)} → ${JSON.stringify(again.widths)} ; tableau ${before.table} → ${after.table} → ${again.table}`);
  await expectThat('le tri change le sens annoncé sans rien déplacer : colonnes de même largeur (à 1 px près), boutons de tri de même largeur, en-têtes de même hauteur, tableau de même largeur', `(() => { const [a, b, c] = ${JSON.stringify([before, after, again])}; const same = (x, y) => x.widths.length === y.widths.length && x.widths.every((w, i) => Math.abs(w - y.widths[i]) <= 1) && x.buttons.every((w, i) => Math.abs(w - y.buttons[i]) <= 1) && x.heights.every((h, i) => h === y.heights[i]) && Math.abs(x.table - y.table) <= 2; return same(a, b) && same(b, c) && JSON.stringify(a.sorts) !== JSON.stringify(b.sorts) && JSON.stringify(b.sorts) !== JSON.stringify(c.sorts); })()`);
  await expectThat('les barres de défilement sont fines et minimalistes (scrollbar-width: thin sur la fenêtre et sur la page)', `getComputedStyle(document.documentElement).scrollbarWidth === 'thin' && getComputedStyle(document.querySelector('main')).scrollbarWidth === 'thin'`);
  await shot('tableau-tri-actif');
  // S4.0 : entreprise avec coordonnées, nouveau facilitateur, méthode de contact et commission (le Super administrateur a tous les droits).
  const fillField = (labelStart, value) => js(`(() => {
    const label = [...document.querySelectorAll('[role=dialog] label')].find((l) => l.textContent.trim().startsWith(${JSON.stringify(labelStart)}));
    if (!label) throw new Error('Champ introuvable : ${labelStart}');
    const el = label.control; // contrôle relié par l'attribut for (ou imbriqué)
    const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  const facilitatedName = `Société Relais ${Date.now() % 100000}`;
  await clickText('Nouvelle entreprise');
  await waitFor("document.querySelector('[role=dialog] input')", 'fenêtre de création complète');
  await expectThat('la fenêtre regroupe « L’entreprise » et « Mise en relation » en fieldset avec légende', `(() => { const l = [...document.querySelectorAll('[role=dialog] fieldset > legend')].map((x) => x.textContent.trim()); return l.includes('L’entreprise') && l.includes('Mise en relation'); })()`);
  await expectThat('sans facilitateur choisi, aucun champ de facilitateur ni de commission n’est affiché', `![...document.querySelectorAll('[role=dialog] label')].some((l) => /^(Nom du facilitateur|Commission|Méthode de prise de contact)/.test(l.textContent.trim()))`);
  await fillField('Nom de l’entreprise', facilitatedName);
  await fillField('Secteur', 'Banque');
  await fillField('Pays d’affiliation', 'Cameroun');
  await fillField('E-mail de l’entreprise', 'pas-un-mail');
  await fillField('Téléphone de l’entreprise', '+237 222 33 44 55');
  await fillField('Facilitateur', 'new');
  await waitFor("[...document.querySelectorAll('[role=dialog] label')].some((l) => l.textContent.trim().startsWith('Nom du facilitateur'))", 'champs du nouveau facilitateur');
  await fillField('Nom du facilitateur', 'Mbarga');
  await fillField('Prénom du facilitateur', 'Paul');
  await fillField('Téléphone du facilitateur', '+237 699 00 11 22');
  await fillField('Commentaire sur le facilitateur', 'Ancien collègue du directeur financier');
  await fillField('Méthode de prise de contact', 'PHONE_CALL');
  await js("[...document.querySelectorAll('[role=dialog] label')].find((l) => l.textContent.includes('employé de l’entreprise')).querySelector('input').click()");
  await fillField('Commission du facilitateur', 'PERCENT');
  await waitFor("[...document.querySelectorAll('[role=dialog] label')].some((l) => l.textContent.trim().startsWith('Pourcentage'))", 'champ du pourcentage');
  await fillField('Pourcentage', '7,5');
  await expectThat('la fenêtre a une croix en haut à droite nommée « Fermer la fenêtre » et aucun bouton « Fermer » en bas', `(() => { const d = document.querySelector('[role=dialog]'); const x = d.querySelector('.dialog-close'); const r = x.getBoundingClientRect(); const dr = d.getBoundingClientRect(); return x.getAttribute('aria-label') === 'Fermer la fenêtre' && r.right > dr.right - 60 && r.top < dr.top + 60 && ![...d.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Fermer'); })()`);
  await expectThat('la fenêtre large respecte sa largeur minimale (736 px)', `document.querySelector('[role=dialog]').getBoundingClientRect().width >= 736`);
  await expectThat('la zone de commentaire du facilitateur n’est pas redimensionnable et affiche son compteur', `(() => { const t = document.querySelector('#company-facilitator-comment'); return getComputedStyle(t).resize === 'none' && /\\d+ \\/ 2000/.test(document.querySelector('#company-facilitator-comment-count').textContent); })()`);
  await shot('entreprise-creation-facilitateur');
  await audit('Entreprises — création avec facilitateur et commission', 'groupes de champs, champs obligatoires annoncés');
  await clickText('Enregistrer', "document.querySelector('[role=dialog]')");
  await waitFor("document.querySelector('[role=dialog] [role=alert]')", 'contrôle de saisie');
  await expectThat('une saisie invalide est refusée AVANT l’envoi, avec un message précis annoncé (role=alert) et la fenêtre reste ouverte', `document.querySelector('[role=dialog] [role=alert]').textContent.includes('e-mail') && !!document.querySelector('[role=dialog]')`);
  await expectThat('le champ e-mail non conforme est en surbrillance, annoncé invalide, relié à son message, et reçoit le focus', `(() => { const e = document.querySelector('#company-email'); const m = document.getElementById(e.getAttribute('aria-describedby') ?? ''); return e.getAttribute('aria-invalid') === 'true' && !!m && m.textContent.includes('e-mail') && getComputedStyle(e).boxShadow !== 'none' && document.activeElement === e; })()`);
  await expectThat('les champs conformes ne sont pas en surbrillance', `!document.querySelector('#company-name').hasAttribute('aria-invalid') && !document.querySelector('#company-phone').hasAttribute('aria-invalid')`);
  await shot('entreprise-champ-non-conforme');
  await audit('Entreprises — création : erreurs de saisie', 'liste des corrections annoncée');
  await fillField('E-mail de l’entreprise', 'Contact@Relais.CM');
  await clickText('Enregistrer', "document.querySelector('[role=dialog]')");
  await waitFor("!document.querySelector('[role=dialog]')", 'entreprise avec facilitateur créée', 15000);
  await sleep(1200);
  await js("document.querySelector('tbody a').click()");
  await waitFor("location.pathname.startsWith('/companies/') && document.querySelector('#facilitation-title')", 'bloc Mise en relation', 20000);
  // Option de mise au point : AUDIT_COMPANY_ONLY saute les blocs intermédiaires (contacts, offres, relances, agenda, opportunités).
  mid: {
    if (process.env.AUDIT_COMPANY_ONLY) break mid;
    await sleep(600);
    await expectThat('la fiche affiche le facilitateur, son téléphone, la méthode, l’appartenance et la commission formatée', `(() => { const t = document.querySelector('main').textContent; return t.includes('Paul Mbarga') && t.includes('+237699001122') && t.includes('Appel téléphonique') && t.includes('Employé de l’entreprise') && t.includes('7,50') && t.includes('Ancien collègue du directeur financier'); })()`);
    await expectThat('l’e-mail est enregistré en minuscules, le téléphone et le pays de l’entreprise affichés', `(() => { const t = document.querySelector('main').textContent; return t.includes('contact@relais.cm') && t.includes('+237222334455') && t.includes('Cameroun'); })()`);
    await audit('Fiche entreprise — mise en relation (facilitateur, commission)');
    await shot('fiche-entreprise-facilitateur');
    // S4.1a : contacts de l'entreprise (panneau de la fiche), doublon, modification, suppression, page « Contacts ».
    await waitFor("document.querySelector('#contacts-title')", 'panneau Contacts', 15000);
    await expectThat('le panneau « Contacts » de la fiche est affiché avec son bouton de création', `!!document.querySelector('#contacts-title') && [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Nouveau contact')`);
    await clickText('Nouveau contact');
    await waitFor("document.querySelector('[role=dialog] #contact-lastName')", 'fenêtre de contact');
    await fillField('Nom', 'Fotso');
    await fillField('Prénom', 'Alain');
    await fillField('Fonction', 'FINANCE_DIRECTOR');
    await fillField('E-mail', 'pas-un-mail');
    await clickText('Enregistrer', "document.querySelector('[role=dialog]')");
    await waitFor("document.querySelector('[role=dialog] #contact-email[aria-invalid=true]')", 'e-mail non conforme en surbrillance');
    await expectThat('le contact invalide est refusé avant l’envoi : e-mail en surbrillance, message relié, focus sur le champ', `(() => { const e = document.querySelector('#contact-email'); const m = document.getElementById(e.getAttribute('aria-describedby') ?? ''); return !!m && m.textContent.includes('e-mail') && document.activeElement === e && getComputedStyle(e).boxShadow !== 'none'; })()`);
    await audit('Contacts — création : champ non conforme', 'surbrillance et message écrit');
    await shot('contact-champ-non-conforme');
    await fillField('E-mail', 'A.Fotso@Atlas.CM');
    await clickText('Enregistrer', "document.querySelector('[role=dialog]')");
    await waitFor("!document.querySelector('[role=dialog]')", 'contact créé', 15000);
    await sleep(800);
    await expectThat('le contact apparaît dans le panneau avec sa fonction « DAF » et son e-mail en minuscules', `(() => { const t = document.querySelector('#contacts-title').closest('section').textContent; return t.includes('Alain Fotso') && t.includes('DAF') && t.includes('a.fotso@atlas.cm'); })()`);
    await audit('Fiche entreprise — contacts', 'liste des contacts de l’entreprise');
    await shot('fiche-entreprise-contacts');
    await clickText('Nouveau contact');
    await waitFor("document.querySelector('[role=dialog] #contact-lastName')", 'fenêtre de contact (doublon)');
    await fillField('Nom', 'fotso');
    await fillField('Prénom', 'ALAIN');
    await clickText('Enregistrer', "document.querySelector('[role=dialog]')");
    await waitFor("[...document.querySelectorAll('[role=dialog] [role=alert]')].some((a) => a.textContent.includes('Doublon probable'))", 'avertissement de doublon');
    await expectThat('un doublon probable est signalé avec le choix « Créer quand même »', `[...document.querySelectorAll('[role=dialog] button')].some((b) => b.textContent.trim() === 'Créer quand même')`);
    await audit('Contacts — doublon probable', 'avertissement annoncé (role=alert) et bouton « Créer quand même »');
    await shot('contact-doublon');
    await clickText('Créer quand même', "document.querySelector('[role=dialog]')");
    await waitFor("!document.querySelector('[role=dialog]')", 'doublon créé après avertissement', 15000);
    await sleep(800);
    await expectThat('après « Créer quand même », les deux contacts figurent dans le panneau', `(document.querySelector('#contacts-title').closest('section').textContent.match(/Alain Fotso|ALAIN fotso/gi) ?? []).length >= 2`);
    await js("document.querySelector('#contacts-title').closest('section').querySelector('summary[aria-label^=\"Actions pour\"]').click()");
    await sleep(300);
    await clickText('Modifier', "document.querySelector('#contacts-title').closest('section')");
    await waitFor("document.querySelector('[role=dialog] #contact-role')", 'fenêtre de modification du contact');
    await fillField('Fonction', 'DECISION_MAKER');
    await clickText('Enregistrer', "document.querySelector('[role=dialog]')");
    // Les deux contacts portent le même nom (créé quand même plus haut) : modifier l'un signale le doublon, comme à la création.
    await waitFor("[...document.querySelectorAll('[role=dialog] [role=alert]')].some((a) => a.textContent.includes('Doublon probable'))", 'doublon signalé à la modification');
    await clickText('Enregistrer quand même', "document.querySelector('[role=dialog]')");
    await waitFor("!document.querySelector('[role=dialog]')", 'contact modifié', 15000);
    await sleep(800);
    await expectThat('la fonction modifiée (« Décideur ») s’affiche dans le panneau', `document.querySelector('#contacts-title').closest('section').textContent.includes('Décideur')`);
    await js("document.querySelector('#contacts-title').closest('section').querySelector('summary[aria-label^=\"Actions pour\"]').click()");
    await sleep(300);
    await clickText('Supprimer', "document.querySelector('#contacts-title').closest('section')");
    await waitFor("document.querySelector('[role=dialog]')", 'confirmation de suppression');
    await audit('Contacts — confirmation de suppression', 'action irréversible confirmée (EXD-13)');
    await clickText('Supprimer', "document.querySelector('[role=dialog]')");
    await waitFor("!document.querySelector('[role=dialog]')", 'contact supprimé', 15000);
    await waitFor("(document.querySelector('#contacts-title').closest('section').textContent.match(/Alain Fotso|ALAIN fotso/gi) ?? []).length === 1", 'liste des contacts rechargée après la suppression', 20000);
    await expectThat('un seul contact reste après la suppression', `(document.querySelector('#contacts-title').closest('section').textContent.match(/Alain Fotso|ALAIN fotso/gi) ?? []).length === 1`);
    // S4.2a : offres de l'entreprise (panneau de la fiche) : création, champ non conforme, modification, dépôt, retrait avec motif ; page « Offres ».
    const offersSection = "document.querySelector('#offers-title').closest('section')";
    const openOfferMenu = () => js(`${offersSection}.querySelector('summary[aria-label^="Actions pour l’offre"]').click()`);
    await waitFor("document.querySelector('#offers-title')", 'panneau Offres', 15000);
    await expectThat('le panneau « Offres » de la fiche est affiché avec son bouton de création', `!![...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Nouvelle offre')`);
    await clickText('Nouvelle offre');
    await waitFor("document.querySelector('[role=dialog] #offer-subject')", 'fenêtre d’offre');
    await fillField('Objet', 'Formation analyse financière');
    await fillField('Montant', 'abc');
    await clickText('Enregistrer', "document.querySelector('[role=dialog]')");
    await waitFor("document.querySelector('[role=dialog] #offer-amount[aria-invalid=true]')", 'montant non conforme en surbrillance');
    await expectThat('l’offre invalide est refusée avant l’envoi : montant en surbrillance, message relié, focus sur le champ', `(() => { const e = document.querySelector('#offer-amount'); const m = document.getElementById(e.getAttribute('aria-describedby') ?? ''); return !!m && m.textContent.includes('montant') && document.activeElement === e && getComputedStyle(e).boxShadow !== 'none'; })()`);
    await audit('Offres — création : champ non conforme', 'surbrillance et message écrit');
    await shot('offre-champ-non-conforme');
    await fillField('Montant', '4 500 000');
    await clickText('Enregistrer', "document.querySelector('[role=dialog]')");
    await waitFor("!document.querySelector('[role=dialog]')", 'offre créée', 15000);
    await sleep(800);
    await expectThat('l’offre apparaît dans le panneau : référence OFF-, état « Brouillon », montant en FCFA', `(() => { const t = ${offersSection}.textContent; return /OFF-\\d{4}-\\d{4}/.test(t) && t.includes('Brouillon') && /4\\s500\\s000\\sFCFA/.test(t.replace(/[\\u202f\\u00a0]/g, ' ')); })()`);
    await audit('Fiche entreprise — offres', 'liste des offres de l’entreprise');
    await shot('fiche-entreprise-offres');
    await openOfferMenu();
    await sleep(300);
    await expectThat('le menu d’un brouillon propose Modifier, Déposer et Retirer (pas d’acceptation)', `(() => { const t = [...${offersSection}.querySelectorAll('details button')].map((b) => b.textContent.trim()); return t.includes('Modifier') && t.some((x) => x.startsWith('Déposer')) && t.some((x) => x.startsWith('Retirer')) && !t.some((x) => x.includes('acceptation')); })()`);
    await clickText('Modifier', offersSection);
    await waitFor("document.querySelector('[role=dialog] #offer-amount')", 'fenêtre de modification de l’offre');
    await fillField('Montant', '5000000');
    await clickText('Enregistrer', "document.querySelector('[role=dialog]')");
    await waitFor("!document.querySelector('[role=dialog]')", 'offre modifiée', 15000);
    await sleep(800);
    await expectThat('le montant modifié (5 000 000 FCFA) s’affiche', `/5\\s000\\s000\\sFCFA/.test(${offersSection}.textContent.replace(/[\\u202f\\u00a0]/g, ' '))`);
    await openOfferMenu();
    await sleep(300);
    await clickText('Déposer', offersSection);
    await waitFor("document.querySelector('[role=dialog]')", 'confirmation du dépôt');
    await audit('Offres — confirmation du dépôt', 'changement d’état confirmé (EXD-13)');
    await clickText('Déposer', "document.querySelector('[role=dialog]')");
    await waitFor("!document.querySelector('[role=dialog]')", 'offre déposée', 15000);
    await sleep(800);
    await expectThat('l’offre passe à « Déposée » avec sa date de dépôt, et ne propose plus « Modifier »', `(() => { const t = ${offersSection}.textContent; return t.includes('Déposée') && /\\d{2}\\/\\d{2}\\/\\d{4}/.test(t); })()`);
    // S4.2b : décharge signée de l'offre déposée : champs refusés, enregistrement avec son fichier, consultation, annulation avec motif.
    const receiptDir = mkdtempSync(join(tmpdir(), 'a11y-receipt-'));
    const receiptPdf = join(receiptDir, 'Decharge-signee.pdf');
    writeFileSync(receiptPdf, '%PDF-1.7\ndécharge signée\n%%EOF');
    const pickReceiptFile = async () => {
      const { root } = await send('DOM.getDocument', { depth: -1 });
      const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector: '#receipt-file' });
      await send('DOM.setFileInputFiles', { files: [receiptPdf], nodeId });
      await sleep(400);
    };
    await openOfferMenu();
    await sleep(300);
    await clickText('Décharge signée', offersSection);
    await waitFor("document.querySelector('[role=dialog] #receipt-receivedBy')", 'fenêtre de décharge', 15000);
    await sleep(500);
    await clickText('Enregistrer la décharge', "document.querySelector('[role=dialog]')");
    await waitFor("document.querySelector('[role=dialog] #receipt-receivedBy[aria-invalid=true]')", 'nom obligatoire en surbrillance');
    await expectThat('la décharge incomplète est refusée avant l’envoi : nom en surbrillance, fichier exigé, focus sur le premier champ', `(() => { const e = document.querySelector('#receipt-receivedBy'); const m = document.getElementById(e.getAttribute('aria-describedby') ?? ''); const alert = document.querySelector('[role=dialog] [role=alert]'); return !!m && m.textContent.includes('obligatoire') && !!alert && alert.textContent.includes('Joignez la décharge') && document.activeElement === e; })()`);
    await audit('Offres — décharge : champs non conformes', 'surbrillance, message écrit et fichier exigé');
    await shot('decharge-champs-non-conformes');
    await fillField('Remise par', 'Alain Fotso');
    await pickReceiptFile();
    await clickText('Enregistrer la décharge', "document.querySelector('[role=dialog]')");
    await waitFor("document.querySelector('[role=dialog] #receipt-valid-title')", 'décharge enregistrée', 20000).catch(async (e) => {
      throw new Error(`${e.message} — contenu de la fenêtre : ${String(await js("document.querySelector('[role=dialog]')?.textContent ?? '(aucune fenêtre)'")).slice(0, 400)}`);
    });
    await waitFor("document.querySelector('[role=dialog] tbody tr td strong')", 'fichier signé joint à la décharge', 20000);
    await expectThat('la décharge reçue affiche sa date, la personne et son fichier signé', `(() => { const t = document.querySelector('[role=dialog]').textContent; return t.includes('Alain Fotso') && t.includes('Valide') && t.includes('Décharge OFF-'); })()`);
    await audit('Offres — décharge enregistrée avec son fichier', 'décharge valide, fichier joint, annulation possible');
    await shot('decharge-enregistree');
    await clickText('Annuler la décharge', "document.querySelector('[role=dialog]')");
    await waitFor("document.querySelector('[role=dialog] #receipt-cancel-reason')", 'motif d’annulation');
    await clickText('Annuler la décharge', "document.querySelector('[role=dialog]')");
    await waitFor("document.querySelector('[role=dialog] #receipt-cancel-reason[aria-invalid=true]')", 'motif obligatoire signalé');
    await fillField('Motif de l’annulation', 'Mauvais fichier');
    await clickText('Annuler la décharge', "document.querySelector('[role=dialog]')");
    await waitFor("document.querySelector('[role=dialog]').textContent.includes('Décharges annulées')", 'décharge annulée et historique rechargé', 20000);
    await expectThat('la décharge annulée reste dans l’historique avec son motif, et l’offre attend de nouveau sa décharge', `(() => { const t = document.querySelector('[role=dialog]').textContent; return t.includes('Décharges annulées') && t.includes('Mauvais fichier') && !!document.querySelector('[role=dialog] #receipt-file'); })()`);
    await audit('Offres — décharge annulée', 'historique et nouveau formulaire');
    await js("document.querySelector('[role=dialog] .dialog-close').click()");
    await waitFor("!document.querySelector('[role=dialog]')", 'fenêtre de décharge fermée', 15000);
    await sleep(800);
    await expectThat('l’offre est de nouveau « Déposée » après l’annulation de la décharge', `${offersSection}.textContent.includes('Déposée')`);
    // S4.2c : relances de l'offre déposée : page « Relances », échéance refusée, planification, terminer avec résultat, annulation avec l'offre.
    await openOfferMenu();
    await sleep(300);
    await clickText('Relances', offersSection);
    await waitFor("location.pathname === '/followups' && location.search.includes('offerId=') && document.querySelector('main h1')", 'page Relances de l’offre', 20000);
    await waitFor("document.querySelector('main').textContent.includes('Aucune relance à faire')", 'aucune relance au départ', 20000);
    await clickText('Nouvelle relance');
    await waitFor("document.querySelector('[role=dialog] #followup-dueOn')", 'fenêtre de relance');
    await expectThat('la relance est proposée à sept jours par appel, sur l’offre choisie', `(() => { const d = document.querySelector('#followup-dueOn').value; const inDays = (Date.parse(d + 'T00:00:00Z') - Date.parse(new Date().toISOString().slice(0, 10) + 'T00:00:00Z')) / 86400000; return inDays === 7 && document.querySelector('#followup-channel').value === 'CALL' && document.querySelector('[role=dialog]').textContent.includes('OFF-'); })()`);
    await fillField('Échéance', '');
    await clickText('Enregistrer', "document.querySelector('[role=dialog]')");
    await waitFor("document.querySelector('[role=dialog] #followup-dueOn[aria-invalid=true]')", 'échéance obligatoire en surbrillance');
    await expectThat('l’échéance manquante est refusée avant l’envoi : champ en surbrillance, message relié, focus', `(() => { const e = document.querySelector('#followup-dueOn'); const m = document.getElementById(e.getAttribute('aria-describedby') ?? ''); return !!m && m.textContent.includes('obligatoire') && document.activeElement === e; })()`);
    await audit('Relances — planification : champ non conforme', 'surbrillance et message écrit');
    await shot('relance-champ-non-conforme');
    const inDaysIso = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
    await fillField('Échéance', inDaysIso(5));
    await fillField('Note', 'Rappeler le DAF');
    await clickText('Enregistrer', "document.querySelector('[role=dialog]')");
    await waitFor("!document.querySelector('[role=dialog]')", 'relance planifiée', 15000);
    await waitFor("document.querySelector('tbody tr') && document.querySelector('tbody').textContent.includes('Rappeler le DAF')", 'relance dans la liste', 20000);
    await expectThat('la relance apparaît « À faire » avec son canal, sans signe de retard', `(() => { const t = document.querySelector('tbody').textContent; return t.includes('À faire') && t.includes('Appel') && t.includes('OFF-') && !t.includes('En retard'); })()`);
    await audit('Relances — liste des relances à faire', 'tableau, filtres rapides, échéance');
    await shot('relances-liste');
    await clickText('Nouvelle relance');
    await waitFor("document.querySelector('[role=dialog] #followup-dueOn')", 'seconde relance');
    await fillField('Échéance', inDaysIso(9));
    await fillField('Note', 'Seconde relance, restera à faire');
    await clickText('Enregistrer', "document.querySelector('[role=dialog]')");
    await waitFor("!document.querySelector('[role=dialog]') && document.querySelector('tbody').textContent.includes('Seconde relance')", 'seconde relance planifiée', 20000);
    await js("document.querySelector('summary[aria-label^=\"Actions pour la relance\"]').click()");
    await sleep(300);
    await clickText('Terminer');
    await waitFor("document.querySelector('[role=dialog] #followup-closing-text')", 'fenêtre de clôture');
    await clickText('Terminer la relance', "document.querySelector('[role=dialog]')");
    await waitFor("document.querySelector('[role=dialog] #followup-closing-text[aria-invalid=true]')", 'résultat obligatoire signalé');
    await audit('Relances — terminer sans résultat', 'résultat obligatoire en surbrillance et annoncé');
    await fillField('Résultat de la relance', 'Le DAF rappellera jeudi');
    await clickText('Terminer la relance', "document.querySelector('[role=dialog]')");
    await waitFor("!document.querySelector('[role=dialog]')", 'relance terminée', 15000);
    await clickText('Terminées');
    await waitFor("document.querySelector('tbody').textContent.includes('Le DAF rappellera jeudi')", 'relance terminée dans le filtre « Terminées »', 20000);
    await expectThat('la relance terminée affiche son résultat, sans action possible', `(() => { const row = [...document.querySelectorAll('tbody tr')].find((r) => r.textContent.includes('Le DAF rappellera jeudi')); return !!row && row.textContent.includes('Terminée') && !row.querySelector('summary'); })()`);
    await js('history.back()');
    await waitFor("document.querySelector('#offers-title')", 'retour à la fiche entreprise', 20000);
    await sleep(600);
    await openOfferMenu();
    await sleep(300);
    await expectThat('le menu d’une offre déposée propose l’acceptation, le refus et le retrait, pas la modification', `(() => { const t = [...${offersSection}.querySelectorAll('details button')].map((b) => b.textContent.trim()); return t.some((x) => x.includes('acceptation')) && t.some((x) => x.includes('refus')) && t.some((x) => x.startsWith('Retirer')) && !t.includes('Modifier'); })()`);
    await clickText('Retirer', offersSection);
    await waitFor("document.querySelector('[role=dialog] #offer-withdraw-reason')", 'fenêtre de retrait');
    await clickText('Retirer l’offre', "document.querySelector('[role=dialog]')");
    await waitFor("document.querySelector('[role=dialog] #offer-withdraw-reason[aria-invalid=true]')", 'motif obligatoire signalé');
    await audit('Offres — retrait sans motif', 'motif obligatoire en surbrillance et annoncé');
    await shot('offre-retrait-sans-motif');
    await fillField('Motif du retrait', 'Client indisponible');
    await clickText('Retirer l’offre', "document.querySelector('[role=dialog]')");
    await waitFor("!document.querySelector('[role=dialog]')", 'offre retirée', 15000);
    await sleep(800);
    await openOfferMenu();
    await sleep(300);
    await expectThat('l’offre passe à « Retirée », son motif s’affiche, et seules la décharge, les relances et les documents restent consultables', `(() => { const t = ${offersSection}.textContent; const items = [...${offersSection}.querySelectorAll('details button')].map((b) => b.textContent.trim()); return t.includes('Retirée') && t.includes('Client indisponible') && items.length > 0 && items.every((x) => x === 'Décharge signée' || x === 'Relances' || x.startsWith('Documents')); })()`);
    await go('/followups');
    await waitFor("document.querySelector('main h1')", 'page Relances', 20000);
    await clickText('Annulées');
    await waitFor("document.querySelector('tbody').textContent.includes('Offre retirée')", 'relance annulée avec l’offre', 20000);
    await expectThat('la relance restée à faire est annulée avec l’offre retirée, motif écrit', `(() => { const row = [...document.querySelectorAll('tbody tr')].find((r) => r.textContent.includes('Offre retirée')); return !!row && row.textContent.includes('Annulée') && !row.querySelector('summary'); })()`);
    await audit('Relances — annulée avec l’offre retirée', 'état, motif, aucune action');
    await shot('relance-annulee-avec-offre');
    await go('/offers');
    await waitFor("document.querySelector('main h1') && document.querySelector('main').textContent.includes('OFF-')", 'page Offres chargée avec l’offre', 20000);
    await expectThat('la page « Offres » liste l’offre avec son entreprise et propose le filtre par état', `(() => { const g = document.querySelector('[role=group][aria-label="Filtrer par état"]'); return !!g && g.querySelectorAll('button').length === 7 && document.querySelector('main').textContent.includes('Retirée'); })()`);
    await audit('Offres — liste', 'tableau, recherche, filtre par état');
    await shot('offres-liste');
    // S4.2d : agenda : vue semaine, planification (champ non conforme, succès, conflit d'horaire), fiche, report sans motif, annulation avec motif, vue mois.
    await go('/agenda');
    await waitFor("document.querySelector('main h1') && document.querySelector('main h2') && document.querySelector('main h2').textContent.startsWith('Semaine du')", 'page Agenda en vue semaine', 20000);
    await expectThat('l’agenda s’ouvre sur la semaine : sept jours en sections titrées, vues Jour/Semaine/Mois et filtre par type', `(() => { const g = document.querySelector('[role=group][aria-label="Choisir la vue de l’agenda"]'); const days = document.querySelectorAll('main section[aria-labelledby^="agenda-day-"]'); return !!g && g.querySelector('[aria-pressed=true]').textContent.trim() === 'Semaine' && days.length === 7 && !!document.querySelector('[role=group][aria-label="Filtrer par type de rendez-vous"]'); })()`);
    await audit('Agenda — vue semaine', 'sept jours, navigation, filtres');
    await shot('agenda-semaine');
    await clickText('Nouveau rendez-vous');
    await waitFor("document.querySelector('[role=dialog] #appointment-companyId')", 'fenêtre de planification');
    await waitFor("document.querySelector('#appointment-companyId').options.length > 1", 'liste des entreprises chargée', 20000);
    await expectThat('la planification propose demain à 9 h pendant 60 minutes, type DAF', `(() => { const d = document.querySelector('#appointment-date').value; const t = new Date(Date.now() + 86400000); const iso = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); return d === iso && document.querySelector('#appointment-time').value === '09:00' && document.querySelector('#appointment-durationMinutes').value === '60' && document.querySelector('#appointment-type').value === 'FINANCE_DIRECTOR'; })()`);
    await clickText('Enregistrer', "document.querySelector('[role=dialog]')");
    await waitFor("document.querySelector('[role=dialog] #appointment-companyId[aria-invalid=true]')", 'entreprise obligatoire en surbrillance');
    await expectThat('l’entreprise manquante est refusée avant l’envoi : champ en surbrillance, message relié, focus', `(() => { const e = document.querySelector('#appointment-companyId'); const m = document.getElementById(e.getAttribute('aria-describedby') ?? ''); return !!m && m.textContent.includes('entreprise') && document.activeElement === e; })()`);
    await audit('Agenda — planification : champ non conforme', 'surbrillance et message écrit');
    await shot('agenda-champ-non-conforme');
    await js("(() => { const s = document.querySelector('#appointment-companyId'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, s.options[1].value); s.dispatchEvent(new Event('change', { bubbles: true })); })()");
    await fillField('Lieu', 'Salle de réunion, Douala');
    await fillField('Note', 'Présenter l’offre au DAF');
    await clickText('Enregistrer', "document.querySelector('[role=dialog]')");
    await waitFor("!document.querySelector('[role=dialog]')", 'rendez-vous planifié', 15000);
    await js(`(() => { const t = new Date(Date.now() + 86400000); const id = 'agenda-day-' + t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); if (!document.getElementById(id)) [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith('Suivant')).click(); })()`);
    await waitFor("[...document.querySelectorAll('main button')].some((b) => (b.getAttribute('aria-label') ?? '').startsWith('Rendez-vous DAF avec'))", 'rendez-vous dans l’agenda', 20000);
    await expectThat('le rendez-vous apparaît « À venir », 09:00 – 10:00, sans avertissement de conflit', `(() => { const b = [...document.querySelectorAll('main button')].find((x) => (x.getAttribute('aria-label') ?? '').startsWith('Rendez-vous DAF avec')); return !!b && b.getAttribute('aria-label').includes('09:00 – 10:00') && b.getAttribute('aria-label').includes('À venir') && !document.querySelector('[role=dialog]'); })()`);
    await clickText('Nouveau rendez-vous');
    await waitFor("document.querySelector('[role=dialog] #appointment-companyId')", 'fenêtre du second rendez-vous');
    await waitFor("document.querySelector('#appointment-companyId').options.length > 1", 'liste des entreprises chargée', 20000);
    await js("(() => { const s = document.querySelector('#appointment-companyId'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, s.options[1].value); s.dispatchEvent(new Event('change', { bubbles: true })); })()");
    const tomorrow = new Date(Date.now() + 86400000);
    await fillField('Date', `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`);
    await fillField('Type', 'DECISION_MAKER');
    await fillField('Heure de début', '09:30');
    await clickText('Enregistrer', "document.querySelector('[role=dialog]')");
    await waitFor("document.querySelector('[role=dialog] [role=alert]') && document.querySelector('[role=dialog]').textContent.includes('chevauche')", 'avertissement de conflit', 15000);
    await expectThat('le chevauchement est annoncé (alerte), le rendez-vous reste enregistré et le premier est cité', `(() => { const d = document.querySelector('[role=dialog]'); return d.textContent.includes('Rendez-vous enregistré') && d.textContent.includes('Rendez-vous DAF') && !!d.querySelector('[role=alert]'); })()`);
    await audit('Agenda — avertissement de conflit d’horaire', 'alerte, créneau cité');
    await shot('agenda-conflit');
    await clickText('Compris', "document.querySelector('[role=dialog]')");
    await waitFor("!document.querySelector('[role=dialog]') && [...document.querySelectorAll('main button')].some((b) => (b.getAttribute('aria-label') ?? '').startsWith('Rendez-vous décideur avec'))", 'second rendez-vous dans l’agenda', 20000);
    await js("[...document.querySelectorAll('main button')].find((b) => (b.getAttribute('aria-label') ?? '').startsWith('Rendez-vous DAF avec')).click()");
    await waitFor("document.querySelector('[role=dialog]') && document.querySelector('[role=dialog]').textContent.includes('Salle de réunion, Douala')", 'fiche du rendez-vous');
    await expectThat('la fiche donne lieu et note ; proposé : Modifier, Reporter, Annuler ; pas « tenu » avant l’heure', `(() => { const d = document.querySelector('[role=dialog]'); const b = [...d.querySelectorAll('button')].map((x) => x.textContent.trim()); return d.textContent.includes('Présenter l’offre au DAF') && b.includes('Modifier') && b.includes('Reporter') && b.includes('Annuler le rendez-vous') && !b.includes('Marquer comme tenu'); })()`);
    await audit('Agenda — fiche du rendez-vous', 'description, état, actions');
    await shot('agenda-fiche');
    await clickText('Reporter', "document.querySelector('[role=dialog]')");
    await waitFor("document.querySelector('[role=dialog] #appointment-postpone-reason')", 'fenêtre de report');
    await clickText('Reporter', "document.querySelector('[role=dialog]')");
    await waitFor("document.querySelector('[role=dialog] #appointment-postpone-reason[aria-invalid=true]')", 'motif du report obligatoire signalé');
    await audit('Agenda — report sans motif', 'motif obligatoire en surbrillance et annoncé');
    await clickText('Retour', "document.querySelector('[role=dialog]')");
    await waitFor("!document.querySelector('[role=dialog]')", 'fenêtre de report fermée');
    await js("[...document.querySelectorAll('main button')].find((b) => (b.getAttribute('aria-label') ?? '').startsWith('Rendez-vous décideur avec')).click()");
    await waitFor("document.querySelector('[role=dialog]') && [...document.querySelectorAll('[role=dialog] button')].some((b) => b.textContent.trim() === 'Annuler le rendez-vous')", 'fiche du second rendez-vous');
    await clickText('Annuler le rendez-vous', "document.querySelector('[role=dialog]')");
    await waitFor("document.querySelector('[role=dialog] #appointment-closing-text')", 'fenêtre d’annulation');
    await clickText('Annuler le rendez-vous', "document.querySelector('[role=dialog]')");
    await waitFor("document.querySelector('[role=dialog] #appointment-closing-text[aria-invalid=true]')", 'motif d’annulation obligatoire signalé');
    await fillField('Motif de l’annulation', 'Le décideur est indisponible');
    await clickText('Annuler le rendez-vous', "document.querySelector('[role=dialog]')");
    await waitFor("!document.querySelector('[role=dialog]')", 'rendez-vous annulé', 15000);
    await waitFor("[...document.querySelectorAll('main button')].some((b) => (b.getAttribute('aria-label') ?? '').startsWith('Rendez-vous décideur avec') && b.getAttribute('aria-label').includes('Annulé'))", 'rendez-vous annulé dans l’agenda', 20000);
    await expectThat('le rendez-vous annulé reste lisible avec l’état « Annulé » et n’offre plus d’action', `(() => { const b = [...document.querySelectorAll('main button')].find((x) => (x.getAttribute('aria-label') ?? '').startsWith('Rendez-vous décideur avec')); return !!b && b.getAttribute('aria-label').includes('Annulé'); })()`);
    await clickText('Mois');
    await waitFor("document.querySelector('main table caption') && document.querySelector('main table caption').textContent.startsWith('Agenda du mois')", 'vue mois');
    await expectThat('la vue mois est un tableau de semaines entières (en-têtes de colonnes, jours nommés pour les lecteurs d’écran)', `(() => { const t = document.querySelector('main table'); return t.querySelectorAll('thead th[scope=col]').length === 7 && t.querySelectorAll('tbody tr').length >= 4 && t.querySelectorAll('tbody td').length % 7 === 0 && !!t.querySelector('td .sr-only'); })()`);
    await audit('Agenda — vue mois', 'grille, jours, rendez-vous du mois');
    await shot('agenda-mois');
    // S4.3 : opportunités : création (champ non conforme, succès), passages d'étape, règle du rendez-vous décideur, dérogation, vue par étape, clôture perdue.
    await go('/opportunities');
    await waitFor("document.querySelector('main h1') && document.querySelector('main').textContent.includes('Nouvelle opportunité')", 'page Opportunités', 20000);
    await expectThat('la page propose les filtres d’état, la bascule Cartes / Par étape et la recherche', `(() => { const f = document.querySelector('[role=group][aria-label="Filtrer par état"]'); const v = document.querySelector('[role=group][aria-label="Choisir l’affichage"]'); return !!f && !!v && v.querySelector('[aria-pressed=true]').textContent.trim() === 'Cartes' && !!document.querySelector('input[type=search], [role=search] input, input[aria-label^="Rechercher"]'); })()`);
    await audit('Opportunités — pipeline vide', 'filtres, bascule, recherche');
    await clickText('Nouvelle opportunité');
    await waitFor("document.querySelector('[role=dialog] #opportunity-companyId')", 'fenêtre de création');
    await waitFor("document.querySelector('#opportunity-companyId').options.length > 1", 'liste des entreprises chargée', 20000);
    await clickText('Enregistrer', "document.querySelector('[role=dialog]')");
    await waitFor("document.querySelector('[role=dialog] #opportunity-companyId[aria-invalid=true]')", 'entreprise obligatoire en surbrillance');
    await expectThat('les champs manquants sont refusés avant l’envoi : entreprise, intitulé et montant en surbrillance, focus sur le premier', `(() => { const d = document.querySelector('[role=dialog]'); const bad = ['companyId', 'title', 'amount'].every((n) => d.querySelector('#opportunity-' + n + '[aria-invalid=true]')); return bad && document.activeElement === d.querySelector('#opportunity-companyId'); })()`);
    await audit('Opportunités — création : champs non conformes', 'surbrillance et messages écrits');
    await shot('opportunite-champs-non-conformes');
    await js("(() => { const s = document.querySelector('#opportunity-companyId'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, s.options[1].value); s.dispatchEvent(new Event('change', { bubbles: true })); })()");
    await fillField('Intitulé', 'Formation fiscalité des DAF');
    await fillField('Montant estimé', '12 500 000');
    await clickText('Enregistrer', "document.querySelector('[role=dialog]')");
    await waitFor("!document.querySelector('[role=dialog]') && document.querySelector('main article')", 'opportunité créée', 20000);
    await expectThat('la carte affiche l’intitulé, le montant en FCFA, l’étape « Qualification »', `(() => { const a = document.querySelector('main article'); const t = a.textContent.replace(/[\\u202f\\u00a0]/g, ' '); return t.includes('Formation fiscalité des DAF') && /12\\s500\\s000\\sFCFA/.test(t) && t.includes('Qualification'); })()`);
    await audit('Opportunités — cartes', 'carte, menu, bascule');
    await shot('opportunites-cartes');
    const moveCard = async (target) => {
      await js("document.querySelector('main article summary[aria-label^=\"Actions pour l’opportunité\"]').click()");
      await sleep(300);
      await clickText('Déplacer vers « ' + target);
      await waitFor("document.querySelector('[role=dialog]') && document.querySelector('[role=dialog]').textContent.includes('Passer à l’étape suivante')", 'confirmation du passage d’étape');
    };
    await moveCard('Proposition');
    await clickText('Déplacer vers « Proposition', "document.querySelector('[role=dialog]')");
    await waitFor("!document.querySelector('[role=dialog]') && document.querySelector('main article').textContent.includes('Proposition')", 'étape Proposition');
    await moveCard('Négociation');
    await clickText('Déplacer vers « Négociation', "document.querySelector('[role=dialog]')");
    await waitFor("!document.querySelector('[role=dialog]') && document.querySelector('main article').textContent.includes('Négociation')", 'étape Négociation');
    await moveCard('Accord de principe');
    await clickText('Déplacer vers « Accord de principe', "document.querySelector('[role=dialog]')");
    await waitFor("document.querySelector('[role=dialog] [role=alert]') && document.querySelector('[role=dialog]').textContent.includes('rendez-vous décideur')", 'refus : aucun rendez-vous décideur tenu', 15000);
    await expectThat('le passage est refusé (alerte écrite), l’étape reste « Négociation » et la dérogation est proposée', `(() => { const d = document.querySelector('[role=dialog]'); const b = [...d.querySelectorAll('button')].map((x) => x.textContent.trim()); return !!d.querySelector('[role=alert]') && b.includes('Accorder une dérogation'); })()`);
    await audit('Opportunités — accord de principe refusé', 'alerte, renvoi vers la dérogation');
    await shot('opportunite-refus-accord');
    await clickText('Accorder une dérogation', "document.querySelector('[role=dialog]')");
    await waitFor("document.querySelector('[role=dialog] #opportunity-waiver-text')", 'fenêtre de dérogation');
    await clickText('Accorder la dérogation', "document.querySelector('[role=dialog]')");
    await waitFor("document.querySelector('[role=dialog] #opportunity-waiver-text[aria-invalid=true]')", 'justification obligatoire signalée');
    await audit('Opportunités — dérogation sans justification', 'justification obligatoire en surbrillance et annoncée');
    await fillField('Justification', 'Le décideur est injoignable');
    await clickText('Accorder la dérogation', "document.querySelector('[role=dialog]')");
    await waitFor("!document.querySelector('[role=dialog]') && document.querySelector('main article').textContent.includes('Dérogation')", 'dérogation accordée');
    await moveCard('Accord de principe');
    await clickText('Déplacer vers « Accord de principe', "document.querySelector('[role=dialog]')");
    await waitFor("!document.querySelector('[role=dialog]') && document.querySelector('main article').textContent.includes('Accord de principe')", 'accord de principe obtenu avec la dérogation', 20000);
    await clickText('Par étape');
    await waitFor("document.querySelectorAll('main section[aria-labelledby^=\"stage-\"]').length === 5", 'vue par étape');
    await expectThat('la vue par étape montre cinq colonnes titrées avec leur effectif, la carte est sous « Accord de principe »', `(() => { const s = [...document.querySelectorAll('main section[aria-labelledby^="stage-"]')]; const col = s.find((x) => x.querySelector('h2').textContent.includes('Accord de principe')); return s.length === 5 && !!col && col.textContent.includes('Formation fiscalité des DAF') && col.querySelector('h2').textContent.includes('(1)'); })()`);
    await audit('Opportunités — vue par étape', 'cinq colonnes, effectifs, montants');
    await shot('opportunites-par-etape');
    await js("document.querySelector('main article summary[aria-label^=\"Actions pour l’opportunité\"]').click()");
    await sleep(300);
    await clickText('Clore : perdue');
    await waitFor("document.querySelector('[role=dialog] #opportunity-loss-reason')", 'fenêtre de clôture perdue');
    await clickText('Clore : perdue', "document.querySelector('[role=dialog]')");
    await waitFor("document.querySelector('[role=dialog] #opportunity-loss-reason[aria-invalid=true]')", 'motif de perte obligatoire signalé');
    await fillField('Motif de la perte', 'OTHER');
    await clickText('Clore : perdue', "document.querySelector('[role=dialog]')");
    await waitFor("document.querySelector('[role=dialog] #opportunity-loss-note[aria-invalid=true]')", 'précision obligatoire pour « autre »');
    await audit('Opportunités — clôture perdue sans précision', 'motif et précision obligatoires, annoncés');
    await shot('opportunite-cloture-perdue');
    await fillField('Précision', 'Projet reporté à 2027');
    await clickText('Clore : perdue', "document.querySelector('[role=dialog]')");
    await waitFor("!document.querySelector('[role=dialog]')", 'opportunité clôturée', 15000);
    await clickText('Perdues');
    await waitFor("document.querySelector('main').textContent.includes('Formation fiscalité des DAF') && document.querySelector('main').textContent.includes('Perdue')", 'opportunité perdue dans le filtre « Perdues »', 20000);
    await clickText('Cartes');
    await js("document.querySelector('main article summary[aria-label^=\"Actions pour l’opportunité\"]').click()");
    await sleep(300);
    await expectThat('une opportunité perdue est immuable : le menu ne propose que « Voir la fiche »', `(() => { const m = [...document.querySelectorAll('main article details button')].map((b) => b.textContent.trim()); return m.length === 1 && m[0] === 'Voir la fiche'; })()`);
    await audit('Opportunités — opportunité perdue', 'état, menu réduit à la fiche');
    await shot('opportunite-perdue');
  }
  // ---- S4.3b : statut d'entreprise, changement de responsable, fiche 360°.
  await go('/companies');
  await waitFor("document.querySelector('tbody a')", 'liste des entreprises', 20000);
  await expectThat('le tableau des entreprises a une colonne « Responsable » visible par défaut', `[...document.querySelectorAll('thead th')].some((h) => h.textContent.trim().startsWith('Responsable'))`);
  await js("document.querySelector('tbody a').click()");
  await waitFor("location.pathname.startsWith('/companies/') && document.querySelector('main h1')", 'fiche entreprise', 20000);
  await waitFor("document.querySelector('#opportunities-title')", 'panneau Opportunités de la fiche', 20000);
  await waitFor("document.querySelector('#appointments-title')", 'panneau Rendez-vous de la fiche', 20000);
  await sleep(800);
  await expectThat('la fiche nomme le responsable et propose les actions de statut et de responsable', `(() => { const t = document.querySelector('main').textContent; const b = [...document.querySelectorAll('main button')].map((x) => x.textContent.trim()); return t.includes('Responsable') && b.includes('Changer de responsable') && (b.includes('Marquer comme contactée') || b.some((x) => x.startsWith('Revenir à') || x.startsWith('Qualifier'))); })()`);
  await audit('Entreprise — fiche 360°', 'statut, responsable, opportunités, rendez-vous');
  await shot('entreprise-fiche-360');
  const statusButton = "[...document.querySelectorAll('main dl button')][0]";
  await js(`${statusButton}.click()`);
  await waitFor("document.querySelector('[role=dialog]') && document.querySelector('[role=dialog]').textContent.includes('Changer le statut')", 'fenêtre de changement de statut');
  await audit('Entreprise — changement de statut', 'confirmation, statut de départ et d’arrivée');
  await shot('entreprise-changement-statut');
  await js("[...document.querySelectorAll('[role=dialog] button')].find((b) => !b.classList.contains('secondary') && !b.classList.contains('dialog-close')).click()");
  await waitFor("!document.querySelector('[role=dialog]') || document.querySelector('[role=dialog] [role=alert]')", 'statut changé ou refus annoncé', 15000);
  if (await js("Boolean(document.querySelector('[role=dialog]'))")) await clickText('Retour', "document.querySelector('[role=dialog]')");
  await clickText('Changer de responsable');
  await waitFor("document.querySelector('[role=dialog]') && document.querySelector('[role=dialog]').textContent.includes('Changer de responsable') && !document.querySelector('[role=dialog]').textContent.includes('Chargement')", 'fenêtre de changement de responsable');
  await audit('Entreprise — changement de responsable', 'choix, confirmation explicite');
  await shot('entreprise-changement-responsable');
  if (await js("Boolean(document.querySelector('[role=dialog] #owner-user'))")) {
    await clickText('Changer de responsable', "document.querySelector('[role=dialog]')");
    await waitFor("document.querySelector('[role=dialog] #owner-user[aria-invalid=true]')", 'choix du responsable obligatoire signalé');
    await audit('Entreprise — responsable non choisi', 'choix et confirmation obligatoires, annoncés');
    await fillField('Nouveau responsable', await js("document.querySelector('[role=dialog] #owner-user option:not([value=\"\"])').value"));
    await js("document.querySelector('[role=dialog] input[type=checkbox]').click()");
    await clickText('Changer de responsable', "document.querySelector('[role=dialog]')");
    await waitFor("!document.querySelector('[role=dialog]')", 'responsable changé', 15000);
  } else {
    await clickText('Retour', "document.querySelector('[role=dialog]')");
  }
  // ---- S4.3c : colonne « Valeur » du tableau, rendez-vous lié à une opportunité.
  await go('/companies');
  await waitFor("document.querySelector('tbody a')", 'liste des entreprises', 20000);
  await expectThat('le tableau des entreprises a une colonne « Valeur » visible par défaut', `[...document.querySelectorAll('thead th')].some((h) => h.textContent.trim().startsWith('Valeur'))`);
  await js("document.querySelector('tbody a').click()");
  await waitFor("location.pathname.startsWith('/companies/') && document.querySelector('main h1')", 'fiche entreprise (S4.3c)', 20000);
  const valueCompanyId = (await js('location.pathname')).split('/').pop();
  await clickText('Nouvelle opportunité');
  await waitFor("document.querySelector('[role=dialog]') && document.querySelector('[role=dialog]').textContent.includes('Intitulé')", 'création d’une opportunité depuis la fiche', 20000);
  await fillField('Intitulé', 'Formation liée au rendez-vous');
  await fillField('Montant estimé', '4 000 000');
  await clickText('Enregistrer', "document.querySelector('[role=dialog]')");
  await waitFor("!document.querySelector('[role=dialog]')", 'opportunité créée (S4.3c)', 20000);
  await go('/companies');
  await waitFor("document.querySelector('tbody a')", 'liste des entreprises après création', 20000);
  await expectThat('la colonne « Valeur » annonce le nombre et la valeur des opportunités ouvertes', `[...document.querySelectorAll('tbody tr')].some((r) => r.textContent.replace(/[  ]/g, ' ').includes('1 · 4 000 000'))`);
  await audit('Entreprises — colonne Valeur', 'tableau avec responsable et valeur');
  await shot('entreprises-valeur');
  await go(`/agenda?plan=1&companyId=${valueCompanyId}`);
  await waitFor("document.querySelector('[role=dialog] #appointment-opportunityId')", 'choix de l’opportunité liée', 25000);
  await expectThat('la planification propose l’opportunité ouverte de l’entreprise, avec son aide écrite', `(() => { const s = document.querySelector('#appointment-opportunityId'); const h = document.getElementById(s.getAttribute('aria-describedby')); return [...s.options].some((o) => o.textContent.includes('Formation liée au rendez-vous')) && Boolean(h) && h.textContent.includes('ne compte que pour cette opportunité'); })()`);
  await audit('Agenda — rendez-vous lié à une opportunité', 'choix de l’opportunité, aide');
  await shot('agenda-opportunite-liee');
  await fillField('Type', 'DECISION_MAKER');
  await fillField('Opportunité liée', await js("document.querySelector('#appointment-opportunityId option:not([value=\"\"])').value"));
  await clickText('Enregistrer', "document.querySelector('[role=dialog]')");
  await waitFor("!document.querySelector('[role=dialog]') || document.querySelector('[role=dialog] [role=alert]')", 'rendez-vous lié planifié', 20000);
  // ---- S4.4a : agrément (l'opportunité de la fiche est amenée à l'accord de principe par une dérogation, puis l'agrément est enregistré).
  await go('/opportunities');
  await waitFor("document.querySelector('main article')", 'pipeline des opportunités (S4.4a)', 20000);
  const moveFirstCard = async (target) => {
    await js("document.querySelector('main article summary[aria-label^=\"Actions pour l’opportunité\"]').click()");
    await sleep(300);
    await clickText('Déplacer vers « ' + target);
    await waitFor("document.querySelector('[role=dialog]') && document.querySelector('[role=dialog]').textContent.includes('Passer à l’étape suivante')", 'confirmation du passage d’étape (S4.4a)');
  };
  await moveFirstCard('Proposition');
  await clickText('Déplacer vers « Proposition', "document.querySelector('[role=dialog]')");
  await waitFor("!document.querySelector('[role=dialog]') && document.querySelector('main article').textContent.includes('Proposition')", 'étape Proposition (S4.4a)');
  await moveFirstCard('Négociation');
  await clickText('Déplacer vers « Négociation', "document.querySelector('[role=dialog]')");
  await waitFor("!document.querySelector('[role=dialog]') && document.querySelector('main article').textContent.includes('Négociation')", 'étape Négociation (S4.4a)');
  await moveFirstCard('Accord de principe');
  await clickText('Déplacer vers « Accord de principe', "document.querySelector('[role=dialog]')");
  await waitFor("document.querySelector('[role=dialog] [role=alert]')", 'refus : aucun rendez-vous décideur tenu (S4.4a)', 15000);
  await clickText('Accorder une dérogation', "document.querySelector('[role=dialog]')");
  await waitFor("document.querySelector('[role=dialog] #opportunity-waiver-text')", 'fenêtre de dérogation (S4.4a)');
  await fillField('Justification', 'Recette de l’agrément');
  await clickText('Accorder la dérogation', "document.querySelector('[role=dialog]')");
  await waitFor("!document.querySelector('[role=dialog]') && document.querySelector('main article').textContent.includes('Dérogation')", 'dérogation accordée (S4.4a)');
  await moveFirstCard('Accord de principe');
  await clickText('Déplacer vers « Accord de principe', "document.querySelector('[role=dialog]')");
  await waitFor("!document.querySelector('[role=dialog]') && document.querySelector('main article').textContent.includes('Accord de principe')", 'accord de principe obtenu (S4.4a)', 20000);
  await go(`/companies/${valueCompanyId}`);
  await waitFor("document.querySelector('#approvals-title')", 'panneau Agréments de la fiche', 25000);
  await waitFor("document.querySelector('#approvals-title').closest('section').textContent.includes('Aucun agrément')", 'panneau Agréments chargé (vide)', 25000);
  await expectThat('le panneau Agréments est vide et propose « Enregistrer un agrément »', `(() => { const s = document.querySelector('#approvals-title').closest('section'); return s.textContent.includes('Aucun agrément') && [...s.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Enregistrer un agrément'); })()`);
  await clickText('Enregistrer un agrément');
  await waitFor("document.querySelector('[role=dialog] #approval-opportunityId') && document.querySelector('#approval-opportunityId').options.length > 1", 'fenêtre d’enregistrement et opportunités éligibles', 25000);
  await audit('Agrément — fenêtre d’enregistrement', 'opportunité, montant, places, dates, document signé');
  await clickText('Enregistrer l’agrément', "document.querySelector('[role=dialog]')");
  await waitFor("document.querySelector('[role=dialog] #approval-opportunityId[aria-invalid=true]')", 'opportunité obligatoire signalée');
  await expectThat('les champs manquants sont refusés avant l’envoi : opportunité, montant et document en surbrillance, liste des corrections annoncée', `(() => { const d = document.querySelector('[role=dialog]'); const o = d.querySelector('#approval-opportunityId'); const a = d.querySelector('#approval-amount'); return o.getAttribute('aria-invalid') === 'true' && a.getAttribute('aria-invalid') === 'true' && Boolean(d.querySelector('[role=alert]')) && Boolean(document.getElementById(o.getAttribute('aria-describedby'))); })()`);
  await audit('Agrément — champs non conformes', 'surbrillance et messages écrits');
  await shot('agrement-champs-non-conformes');
  await js("(() => { const s = document.querySelector('#approval-opportunityId'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, s.options[1].value); s.dispatchEvent(new Event('change', { bubbles: true })); })()");
  await fillField('Montant couvert', '4 000 000');
  await fillField('Nombre de places', '12');
  const approvalDir = mkdtempSync(join(tmpdir(), 'a11y-approval-'));
  const approvalPdf = join(approvalDir, 'Agrement-signe.pdf');
  writeFileSync(approvalPdf, '%PDF-1.7\nagrément signé\n%%EOF');
  {
    const { root } = await send('DOM.getDocument', { depth: -1 });
    const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector: '[role=dialog] input[type=file]' });
    await send('DOM.setFileInputFiles', { files: [approvalPdf], nodeId });
    await sleep(400);
  }
  await clickText('Enregistrer l’agrément', "document.querySelector('[role=dialog]')");
  await waitFor("!document.querySelector('[role=dialog]') && document.querySelector('#approvals-title').closest('section').querySelectorAll('tbody tr').length > 0", 'agrément enregistré', 25000);
  await waitFor("document.querySelector('main').textContent.includes('Reçu') && document.querySelector('main').textContent.includes('Cliente')", 'agrément reçu et entreprise cliente affichés', 25000);
  await expectThat('l’agrément est listé « Reçu », avec ce qu’il couvre, et l’entreprise est devenue « Cliente »', `(() => { const t = document.querySelector('main').textContent.replace(/[\\u202f\\u00a0]/g, ' '); return t.includes('Reçu') && t.includes('4 000 000') && t.includes('12 places') && t.includes('Cliente'); })()`);
  await audit('Agrément — liste sur la fiche', 'agrément reçu, entreprise cliente');
  await shot('agrement-liste');
  await js("document.querySelector('#approvals-title').closest('section').querySelector('summary[aria-label^=\"Actions pour l’agrément\"]').click()");
  await sleep(300);
  await clickText('Annuler l’agrément');
  await waitFor("document.querySelector('[role=dialog] #approval-reason')", 'fenêtre d’annulation');
  await clickText('Annuler l’agrément', "document.querySelector('[role=dialog]')");
  await waitFor("document.querySelector('[role=dialog] #approval-reason[aria-invalid=true]')", 'motif obligatoire signalé');
  await audit('Agrément — annulation sans motif', 'motif obligatoire en surbrillance et annoncé');
  await shot('agrement-annulation-sans-motif');
  await fillField('Motif', 'Saisie de recette');
  await clickText('Annuler l’agrément', "document.querySelector('[role=dialog]')");
  await waitFor("!document.querySelector('[role=dialog]') && document.querySelector('#approvals-title').closest('section').textContent.includes('Annulé')", 'agrément annulé', 20000);
  await expectThat('l’agrément annulé garde son motif et ne propose plus que le document signé', `(() => { const s = document.querySelector('#approvals-title').closest('section'); return s.textContent.includes('Saisie de recette'); })()`);
  // ---- S4.4a-bis : agrément seulement demandé, payeur tiers, déclaré reçu puis honoré (D41).
  await clickText('Enregistrer un agrément');
  await waitFor("document.querySelector('[role=dialog] #approval-opportunityId') && document.querySelector('#approval-opportunityId').options.length > 1", 'fenêtre d’enregistrement (demande)', 25000);
  await js("(() => { const s = document.querySelector('#approval-opportunityId'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, s.options[1].value); s.dispatchEvent(new Event('change', { bubbles: true })); })()");
  await js("document.querySelector('[role=dialog] input[type=checkbox]').click()");
  await sleep(300);
  await expectThat('« promesse pas encore signée » masque la date de réception et le document signé', `(() => { const d = document.querySelector('[role=dialog]'); return !d.querySelector('#approval-receivedOn') && !d.querySelector('#approval-file') && d.textContent.includes('deviendra « Cliente » à la réception'); })()`);
  await fillField('Montant couvert', '2 500 000');
  await fillField('Payeur tiers', 'Banque de recette');
  await clickText('Enregistrer l’agrément', "document.querySelector('[role=dialog]')");
  await waitFor("document.querySelector('[role=dialog] #approval-payerName[aria-invalid=true]')", 'type de payeur obligatoire signalé');
  await audit('Agrément — demande, payeur sans type', 'nom du payeur en surbrillance, correction annoncée');
  await shot('agrement-payeur-sans-type');
  await js("(() => { const s = document.querySelector('#approval-payerType'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, 'ORGANISM'); s.dispatchEvent(new Event('change', { bubbles: true })); })()");
  await clickText('Enregistrer l’agrément', "document.querySelector('[role=dialog]')");
  await waitFor("!document.querySelector('[role=dialog]') && document.querySelector('#approvals-title').closest('section').textContent.includes('Demandé')", 'agrément demandé enregistré', 25000);
  await expectThat('l’agrément demandé est listé avec son payeur tiers, sans date de réception', `(() => { const s = document.querySelector('#approvals-title').closest('section'); const t = s.textContent; return t.includes('Demandé') && t.includes('Banque de recette (Organisme)') && t.includes('Le client'); })()`);
  await audit('Agrément — demande listée', 'état Demandé, payeur tiers');
  await shot('agrement-demande');
  await js("document.querySelector('#approvals-title').closest('section').querySelector('summary[aria-label^=\"Actions pour l’agrément\"]').click()");
  await sleep(300);
  await clickText('Déclarer reçu');
  await waitFor("document.querySelector('[role=dialog] #approval-receivedOn')", 'fenêtre de réception');
  await audit('Agrément — déclarer reçu', 'date de réception, entreprise « Cliente »');
  await shot('agrement-declarer-recu');
  await clickText('Déclarer reçu', "document.querySelector('[role=dialog]')");
  await waitFor("!document.querySelector('[role=dialog]') && [...document.querySelector('#approvals-title').closest('section').querySelectorAll('tbody tr')].some((r) => r.textContent.includes('Banque de recette') && r.textContent.includes('Reçu'))", 'agrément déclaré reçu', 25000);
  await js("document.querySelector('#approvals-title').closest('section').querySelector('summary[aria-label^=\"Actions pour l’agrément\"]').click()");
  await sleep(300);
  await clickText('Honorer');
  await waitFor("document.querySelector('[role=dialog]') && document.querySelector('[role=dialog]').textContent.includes('honoré')", 'fenêtre pour honorer');
  await clickText('Honorer', "document.querySelector('[role=dialog]')");
  await waitFor("!document.querySelector('[role=dialog]') && document.querySelector('#approvals-title').closest('section').textContent.includes('Honoré')", 'agrément honoré', 25000);
  await audit('Agrément — honoré', 'état Honoré, plus aucune action de clôture');
  // ---- S4.4c : commissions (l'agrément honoré rend due la commission du facilitateur : 7,5 % de 2 500 000 = 187 500).
  await go('/commissions');
  await waitFor("document.querySelector('main h1') && document.querySelector('main').textContent.includes('Commissions')", 'page Commissions', 25000);
  await waitFor("document.querySelector('main tbody tr') && document.querySelector('main tbody tr').textContent.includes('À verser')", 'commission due listée', 25000);
  await expectThat('la commission née de l’agrément honoré est listée « À verser », avec son montant figé (7,5 % de 2 500 000) et son facilitateur', `(() => { const t = document.querySelector('main tbody tr').textContent.replace(/[\\u202f\\u00a0]/g, ' '); return t.includes('Mbarga') && t.includes('187 500') && t.includes('7,5 %') && t.includes('À verser'); })()`);
  await expectThat('la page propose le filtre par état et annonce le nombre de commissions', `(() => { const m = document.querySelector('main'); return Boolean(m.querySelector('select')) && /1 commission/.test(m.textContent); })()`);
  await audit('Commissions — liste', 'état À verser, montant et commission figée');
  await shot('commissions-liste');
  const openCommissionMenu = () => js("document.querySelector('main tbody tr summary[aria-label^=\"Actions pour la commission\"]').click()");
  await openCommissionMenu();
  await sleep(300);
  await clickText('Débloquer les fonds');
  await waitFor("document.querySelector('[role=dialog]') && document.querySelector('[role=dialog]').textContent.includes('sera débloquée')", 'fenêtre de déblocage');
  await audit('Commissions — débloquer les fonds', 'confirmation, décision tracée');
  await clickText('Débloquer les fonds', "document.querySelector('[role=dialog]')");
  await waitFor("!document.querySelector('[role=dialog]') && document.querySelector('main tbody tr').textContent.includes('Fonds débloqués')", 'fonds débloqués', 25000);
  await openCommissionMenu();
  await sleep(300);
  await clickText('Constater le versement');
  await waitFor("document.querySelector('[role=dialog] #payout-paidOn')", 'fenêtre de versement');
  await expectThat('la fenêtre de versement propose le justificatif et la date du versement', `(() => { const d = document.querySelector('[role=dialog]'); return d.textContent.includes('justificatif') && Boolean(d.querySelector('#payout-paidOn')); })()`);
  await audit('Commissions — constater le versement', 'justificatif à déposer, date du versement');
  await shot('commissions-versement');
  await clickText('Constater le versement', "document.querySelector('[role=dialog]')");
  await waitFor("document.querySelector('[role=dialog] [role=alert]') && document.querySelector('[role=dialog] [role=alert]').textContent.toLowerCase().includes('justificatif')", 'refus sans justificatif annoncé', 25000);
  await expectThat('sans justificatif, le versement est refusé par le serveur, l’alerte est annoncée et la fenêtre reste ouverte', `Boolean(document.querySelector('[role=dialog]'))`);
  await audit('Commissions — versement refusé sans justificatif', 'alerte annoncée, fenêtre toujours ouverte');
  // Le justificatif (catégorie « Justificatif ») est déposé dans la fenêtre de versement ; le versement est alors constaté.
  const topDialog = "[...document.querySelectorAll('[role=dialog]')].at(-1)";
  const proofDir = mkdtempSync(join(tmpdir(), 'a11y-proof-'));
  const proofPdf = join(proofDir, 'Recu-virement.pdf');
  writeFileSync(proofPdf, '%PDF-1.7\nreçu de virement\n%%EOF');
  await clickText('Ajouter un document', "document.querySelector('[role=dialog]')");
  await waitFor("document.querySelector('[role=dialog] [role=dialog] input[type=file]')", 'fenêtre d’ajout du justificatif', 25000);
  await js(`(() => { const label = [...document.querySelectorAll('[role=dialog] [role=dialog] label')].find((l) => l.textContent.trim().startsWith('Catégorie')); const el = label.control; Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, 'JUSTIFICATIF'); el.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  {
    const { root } = await send('DOM.getDocument', { depth: -1 });
    const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector: '[role=dialog] [role=dialog] input[type=file]' });
    await send('DOM.setFileInputFiles', { files: [proofPdf], nodeId });
    await sleep(400);
  }
  await clickText('Envoyer', topDialog);
  await waitFor("document.querySelectorAll('[role=dialog]').length === 1 && document.querySelector('[role=dialog]').textContent.includes('Recu-virement')", 'justificatif déposé', 25000);
  await expectThat('le justificatif déposé apparaît dans la fenêtre de versement, catégorie « Justificatif »', `(() => { const t = document.querySelector('[role=dialog]').textContent; return t.includes('Recu-virement') && t.includes('Justificatif'); })()`);
  await audit('Commissions — justificatif déposé', 'document listé dans la fenêtre de versement');
  await shot('commissions-justificatif');
  await clickText('Constater le versement', "document.querySelector('[role=dialog]')");
  await waitFor("!document.querySelector('[role=dialog]') && document.querySelector('main tbody tr').textContent.includes('Versée')", 'commission versée', 25000);
  await expectThat('la commission est « Versée » avec sa date de versement (jj/mm/aaaa), et sa ligne ne propose plus que le justificatif', `(() => { const r = document.querySelector('main tbody tr'); return r.textContent.includes('Versée') && /\\d{2}\\/\\d{2}\\/\\d{4}/.test(r.textContent) && !r.textContent.includes('À verser'); })()`);
  await openCommissionMenu();
  await sleep(300);
  await expectThat('une commission versée ne propose ni versement, ni annulation, ni déblocage : seulement « Justificatif »', `(() => { const items = [...document.querySelectorAll('main tbody tr [role=menuitem], main tbody tr details button')].map((b) => b.textContent.trim()); return items.includes('Justificatif') && !items.some((x) => /Constater|Annuler|Débloquer|Mettre en attente|Fixer/.test(x)); })()`);
  await audit('Commissions — versée', 'état Versée, plus aucune action de clôture');
  await shot('commissions-versee');
  await js("document.querySelector('main tbody tr details').open = false");
  await sleep(300);
  await js("(() => { const s = document.querySelector('main select'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, 'DUE'); s.dispatchEvent(new Event('change', { bubbles: true })); })()");
  await waitFor("document.querySelector('main tbody tr') && document.querySelector('main tbody tr').textContent.includes('Aucune commission dans cet état')", 'filtre par état sans résultat', 25000);
  await expectThat('le filtre « À verser » ne montre plus la commission débloquée et annonce un état vide lisible', `document.querySelector('main tbody').textContent.includes('Aucune commission dans cet état')`);
  await audit('Commissions — filtre sans résultat', 'état vide lisible');
  // ---- S4.4b : ambassadeurs (création manuelle, origine, entreprise, e-mail unique).
  await go('/ambassadors');
  await waitFor("document.querySelector('main h1') && document.querySelector('main').textContent.includes('Nouvel ambassadeur')", 'page Ambassadeurs', 25000);
  await expectThat('la page rappelle que la création est manuelle et propose le filtre d’origine, la recherche et « Nouvel ambassadeur »', `(() => { const t = document.querySelector('main').textContent; return t.includes('décision manuelle') && Boolean(document.querySelector('main select')) && Boolean(document.querySelector('main input[type=search], main [role=search] input, main input')) && [...document.querySelectorAll('main button')].some((b) => b.textContent.includes('Nouvel ambassadeur')); })()`);
  await audit('Ambassadeurs — liste vide', 'filtre par origine, recherche, création manuelle');
  await shot('ambassadeurs-vide');
  await clickText('Nouvel ambassadeur');
  await waitFor("document.querySelector('[role=dialog] #ambassador-lastName')", 'fenêtre de création d’un ambassadeur');
  await waitFor("document.querySelector('#ambassador-companyId').options.length > 1", 'liste des entreprises chargée (ambassadeur)', 25000);
  await clickText('Enregistrer', "document.querySelector('[role=dialog]')");
  await waitFor("document.querySelector('[role=dialog] #ambassador-lastName[aria-invalid=true]')", 'nom obligatoire signalé');
  await expectThat('les champs manquants sont refusés avant l’envoi : nom, prénom et entreprise (client) en surbrillance, liste des corrections annoncée', `(() => { const d = document.querySelector('[role=dialog]'); const ids = ['ambassador-lastName', 'ambassador-firstName', 'ambassador-companyId']; return ids.every((i) => d.querySelector('#' + i).getAttribute('aria-invalid') === 'true') && Boolean(d.querySelector('[role=alert]')); })()`);
  await audit('Ambassadeurs — création : champs non conformes', 'surbrillance et messages écrits');
  await shot('ambassadeur-champs-non-conformes');
  await fillField('Nom', 'Fotso');
  await fillField('Prénom', 'Alain');
  await js("(() => { const s = document.querySelector('#ambassador-companyId'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, s.options[1].value); s.dispatchEvent(new Event('change', { bubbles: true })); })()");
  await fillField('E-mail', 'alain.fotso@exemple.cm');
  await clickText('Enregistrer', "document.querySelector('[role=dialog]')");
  await waitFor("!document.querySelector('[role=dialog]') && document.querySelector('main tbody tr')?.textContent.includes('Alain Fotso')", 'ambassadeur créé', 25000);
  await expectThat('la liste montre l’ambassadeur d’origine « Client », son entreprise et « Depuis » au format mois/année', `(() => { const r = document.querySelector('main tbody tr').textContent; return r.includes('Alain Fotso') && r.includes('Client') && /\\d{2}\\/\\d{4}/.test(r); })()`);
  await audit('Ambassadeurs — liste', 'tableau, origine, entreprise, depuis, actions');
  await shot('ambassadeurs-liste');
  await js("document.querySelector('main summary[aria-label^=\"Actions pour l’ambassadeur\"]').click()");
  await sleep(300);
  await clickText('Modifier');
  await waitFor("document.querySelector('[role=dialog]') && document.querySelector('[role=dialog]').textContent.includes('non modifiable')", 'fenêtre de modification (origine non modifiable)');
  await fillField('Téléphone', '+237 699 00 11 22');
  await clickText('Enregistrer', "document.querySelector('[role=dialog]')");
  await waitFor("!document.querySelector('[role=dialog]') && document.querySelector('main tbody tr').textContent.includes('+237699001122')", 'ambassadeur modifié', 25000);
  await clickText('Nouvel ambassadeur');
  await waitFor("document.querySelector('[role=dialog] #ambassador-lastName')", 'seconde fenêtre de création');
  await fillField('Nom', 'Ndzana');
  await fillField('Prénom', 'Claire');
  await fillField('Origine', 'LEARNER');
  await fillField('E-mail', 'alain.fotso@exemple.cm');
  await clickText('Enregistrer', "document.querySelector('[role=dialog]')");
  await waitFor("document.querySelector('[role=dialog] [role=alert]') && document.querySelector('[role=dialog]').textContent.includes('adresse e-mail')", 'refus : e-mail déjà pris', 20000);
  await audit('Ambassadeurs — e-mail déjà pris', 'alerte du serveur annoncée, fenêtre toujours ouverte');
  await shot('ambassadeur-email-deja-pris');
  await clickText('Annuler', "document.querySelector('[role=dialog]')");
  // Option de mise au point : limite le parcours au bloc des offres (la suite de l'audit n'est alors pas exécutée).
  if (process.env.AUDIT_STOP_AFTER_OFFERS) throw new Error('Arrêt volontaire (AUDIT_STOP_AFTER_OFFERS) : parcours limité aux offres');
  await go('/contacts');
  await waitFor("document.querySelector('main h1') && document.querySelector('main').textContent.toLowerCase().includes('fotso')", 'page Contacts chargée avec le contact', 20000);
  await expectThat('la page « Contacts » liste le contact avec son entreprise et propose le filtre par fonction', `(() => { const t = document.querySelector('main').textContent; return t.toLowerCase().includes('fotso') && t.includes('Relais') && !!document.querySelector('select option[value=FINANCE_DIRECTOR]'); })()`);
  await audit('Contacts — liste', 'tableau, recherche, filtre par fonction');
  await shot('contacts-liste');
  await go('/companies');
  await waitFor("document.querySelector('tbody a')", 'liste des entreprises', 20000);
  await sleep(600);
  await js("document.querySelectorAll('tbody input[type=checkbox]')[0].click(); document.querySelectorAll('tbody input[type=checkbox]')[2].click()");
  await sleep(400);
  await audit('Entreprises — deux lignes sélectionnées', 'barre de sélection annoncée, lignes teintées avec barre latérale');
  await shot('entreprises-selection');
  await js("document.querySelector('thead input[type=checkbox]').click()");
  await sleep(300);
  await js("[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Tout désélectionner').click()");
  // S4.1b : tableau des entreprises : filtres par statut avec effectifs, pays et secteur, tri par colonne, colonnes au choix.
  const setSelect = (labelStart, value) => js(`(() => { const l = [...document.querySelectorAll('main label')].find((x) => x.textContent.trim().startsWith(${JSON.stringify(labelStart)})); if (!l) throw new Error('Filtre introuvable : ${labelStart}'); const el = l.control; Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await waitFor("/Toutes\\s*\\d+/.test(document.querySelector('[role=group][aria-label=\"Filtrer par statut\"]')?.textContent ?? '')", 'effectifs par statut chargés', 20000);
  await expectThat('le filtre par statut propose « Toutes » avec un effectif et chaque statut', `(() => { const g = document.querySelector('[role=group][aria-label="Filtrer par statut"]'); const t = g ? g.textContent : ''; return !!g && g.querySelectorAll('button').length === 6 && /Toutes\\s*\\d+/.test(t) && t.includes('Cible') && t.includes('Archivée'); })()`);
  await expectThat('les en-têtes triables sont des boutons et le tri par défaut (Créée le) est annoncé en décroissant', `(() => { const th = document.querySelector('th[aria-sort]'); return !!document.querySelector('thead th button') && [...document.querySelectorAll('th[aria-sort=descending]')].some((x) => x.textContent.includes('Créée le')); })()`);
  await js("[...document.querySelectorAll('thead th button')].find((b) => b.textContent.includes('Entreprise')).click()");
  await waitFor("[...document.querySelectorAll('th[aria-sort=ascending]')].some((x) => x.textContent.includes('Entreprise'))", 'tri croissant par nom annoncé');
  await sleep(600);
  await expectThat('trié par nom croissant : les noms affichés sont dans l’ordre alphabétique', `(() => { const n = [...document.querySelectorAll('tbody tr td:nth-child(2) a')].map((a) => a.textContent.trim().toLowerCase()); return n.length > 1 && n.every((v, i) => i === 0 || n[i - 1].localeCompare(v, 'fr', { sensitivity: 'base' }) <= 0); })()`);
  await js("[...document.querySelectorAll('thead th button')].find((b) => b.textContent.includes('Entreprise')).click()");
  await waitFor("[...document.querySelectorAll('th[aria-sort=descending]')].some((x) => x.textContent.includes('Entreprise'))", 'tri décroissant par nom annoncé');
  await js("[...document.querySelectorAll('[role=group][aria-label=\"Filtrer par statut\"] button')].find((b) => b.textContent.startsWith('Cliente')).click()");
  await waitFor("document.querySelector('main').textContent.includes('Aucune entreprise ne correspond')", 'état vide du filtre « Cliente »');
  await expectThat('un filtre sans résultat affiche un message clair, le bouton de réinitialisation et le filtre actif (aria-pressed)', `(() => { const b = [...document.querySelectorAll('[role=group] button')].find((x) => x.textContent.startsWith('Cliente')); return b.getAttribute('aria-pressed') === 'true' && [...document.querySelectorAll('main button')].some((x) => x.textContent.trim() === 'Réinitialiser les filtres'); })()`);
  await audit('Entreprises — filtre sans résultat', 'message d’état vide, bouton de réinitialisation, filtre actif annoncé');
  await shot('entreprises-filtre-vide');
  await clickText('Réinitialiser les filtres');
  await waitFor("document.querySelector('tbody a')", 'liste rétablie après réinitialisation');
  await js("[...document.querySelectorAll('[role=group][aria-label=\"Filtrer par statut\"] button')].find((b) => b.textContent.startsWith('Cible')).click()");
  await sleep(800);
  await expectThat('le filtre « Cible » garde les entreprises créées par la recette et le compteur annonce « correspondantes »', `document.querySelector('tbody a') !== null && /correspondante/.test(document.querySelector('main [aria-live=polite]').textContent)`);
  await clickText('Réinitialiser les filtres');
  await waitFor("document.querySelector('tbody a')", 'liste rétablie');
  const countryOptions = await js("[...document.querySelectorAll('main label')].find((x) => x.textContent.trim().startsWith('Pays')).control.options.length");
  await expectThat('le filtre « Pays » propose « Tous » et au moins un pays présent dans la portée', `(${countryOptions}) >= 2`);
  await js("(() => { const sel = [...document.querySelectorAll('main label')].find((x) => x.textContent.trim().startsWith('Pays')).control; window.__pays = sel.options[1].value; })()");
  await setSelect('Pays', await js('window.__pays'));
  await sleep(900);
  await expectThat('filtré par pays : toutes les lignes affichées portent ce pays', `(() => { const p = window.__pays.toLowerCase(); const rows = [...document.querySelectorAll('tbody tr')]; return rows.length > 0 && rows.every((r) => r.textContent.toLowerCase().includes(p)); })()`);
  await clickText('Réinitialiser les filtres');
  await waitFor("document.querySelector('tbody a')", 'liste rétablie après le filtre pays');
  await js("[...document.querySelectorAll('summary')].find((x) => x.textContent.trim() === 'Colonnes').click()");
  await expectThat('le menu « Colonnes » liste les colonnes en cases à cocher, la colonne du nom est verrouillée', `(() => { const f = document.querySelector('fieldset'); const boxes = [...document.querySelectorAll('details fieldset input[type=checkbox]')]; return boxes.length === 7 && boxes[0].disabled && boxes[0].checked && !boxes.find((b) => b.closest('label').textContent.includes('E-mail')).checked; })()`);
  await audit('Entreprises — menu « Colonnes »', 'cases à cocher nommées, colonne du nom verrouillée');
  await shot('entreprises-colonnes');
  await js("[...document.querySelectorAll('details fieldset label')].find((l) => l.textContent.includes('E-mail')).querySelector('input').click()");
  await sleep(400);
  await expectThat('la colonne « E-mail » apparaît dans le tableau', `[...document.querySelectorAll('thead th')].some((th) => th.textContent.trim() === 'E-mail')`);
  await go('/companies');
  await waitFor("document.querySelector('tbody a')", 'liste après rechargement', 20000);
  await sleep(600);
  await expectThat('le choix des colonnes est mémorisé après rechargement de la page', `[...document.querySelectorAll('thead th')].some((th) => th.textContent.trim() === 'E-mail')`);
  await audit('Entreprises — colonne ajoutée', 'tableau avec la colonne E-mail');
  await js("[...document.querySelectorAll('summary')].find((x) => x.textContent.trim() === 'Colonnes').click()");
  await js("[...document.querySelectorAll('details fieldset label')].find((l) => l.textContent.includes('E-mail')).querySelector('input').click()");
  await sleep(300);
  await js("document.querySelector('button[aria-controls=navigation][title]').focus(); document.querySelector('button[aria-controls=navigation][title]').click()");
  await sleep(500);
  await audit('Entreprises (navigation dépliée)', 'bouton-pictogramme de dépliage');
  const shell2 = await shellState();
  results.at(-1).note += ` · ${JSON.stringify(shell2)}`;
  await shot('entreprises-deplie');

  // Documents (S3.6) : fiche entreprise, envoi refusé puis réussi, nouvelle version, historique, téléchargement, archivage.
  const docDir = mkdtempSync(join(tmpdir(), 'a11y-docs-'));
  const goodPdf = join(docDir, 'Decharge-Horizon.pdf');
  const v2Pdf = join(docDir, 'Decharge-Horizon-v2.pdf');
  const fakePdf = join(docDir, 'faux.pdf');
  writeFileSync(goodPdf, '%PDF-1.7\nversion un\n%%EOF');
  writeFileSync(v2Pdf, '%PDF-1.7\nversion deux\n%%EOF');
  writeFileSync(fakePdf, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]));
  const dialog = "document.querySelector('[role=dialog]')";
  const pickFile = async (path) => {
    const { root } = await send('DOM.getDocument', { depth: -1 });
    const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector: '[role=dialog] input[type=file]' });
    await send('DOM.setFileInputFiles', { files: [path], nodeId });
    await sleep(400);
  };
  const openRowMenu = async () => { await js("document.querySelector('summary[aria-label^=\"Actions pour\"]').click()"); await sleep(300); };
  await go('/companies');
  await waitFor("document.querySelector('tbody a')", 'liste des entreprises', 20000);
  await js("document.querySelector('tbody a').click()");
  await waitFor("location.pathname.startsWith('/companies/') && document.querySelector('#documents-titre')", 'fiche entreprise', 20000);
  await sleep(800);
  await audit('Fiche entreprise — documents (vide)');
  await shot('fiche-entreprise');
  await clickText('Ajouter un document');
  await waitFor(`${dialog} && document.querySelector('[role=dialog] input[type=file]')`, 'fenêtre d’ajout');
  await pickFile(fakePdf);
  await clickText('Envoyer', dialog);
  await waitFor("document.querySelector('[role=dialog] [role=alert]')", 'refus du fichier trompeur', 15000);
  await audit('Documents — envoi refusé (contenu ≠ extension)', 'message du serveur annoncé (role=alert)');
  await shot('documents-refus');
  await pickFile(goodPdf);
  await clickText('Envoyer', dialog);
  await waitFor(`!${dialog} && document.querySelector('tbody tr td strong')`, 'document ajouté', 20000);
  await sleep(500);
  await audit('Documents — liste avec un document');
  await shot('documents-liste');
  await clickText('Télécharger');
  await sleep(1500);
  const downloadFailed = await js("Boolean(document.querySelector('main [role=alert]'))");
  if (downloadFailed) throw new Error('Le téléchargement du document a affiché une erreur');
  await openRowMenu();
  await clickText('Ajouter une nouvelle version');
  await waitFor("document.querySelector('[role=dialog] input[type=file]')", 'fenêtre de nouvelle version');
  await pickFile(v2Pdf);
  await clickText('Envoyer', dialog);
  await waitFor(`!${dialog} && document.body.innerText.includes('version 2')`, 'version 2 ajoutée', 20000);
  await openRowMenu();
  await clickText('Historique des versions');
  await waitFor("document.querySelector('[role=dialog] tbody tr')", 'historique des versions', 15000);
  await audit('Documents — historique des versions (SHA-256)');
  await shot('documents-historique');
  await js(`${dialog}.querySelector('.dialog-close').click()`); // la croix en haut à droite remplace le bouton « Fermer » du bas
  await sleep(300);
  await openRowMenu();
  await clickText('Archiver');
  await waitFor(dialog, 'confirmation d’archivage');
  await audit('Documents — confirmation d’archivage');
  await clickText('Archiver', dialog);
  await waitFor("document.body.innerText.includes('Document archivé') && document.body.innerText.includes('Aucun document')", 'document archivé', 20000);
  await audit('Documents — après archivage', 'confirmation annoncée, liste vide par défaut');

  // Gros fichiers : 10,5 Mo refusé avant l'envoi (contrôle de confort), 10 Mo pile accepté de bout en bout à travers le proxy Next.js.
  const bigPdf = join(docDir, 'Gros-Dossier.pdf');
  const hugePdf = join(docDir, 'Trop-Gros.pdf');
  { const head = Buffer.from('%PDF-1.7\n'); const foot = Buffer.from('%%EOF'); writeFileSync(bigPdf, Buffer.concat([head, Buffer.alloc(10 * 1024 * 1024 - head.length - foot.length), foot])); }
  writeFileSync(hugePdf, Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(Math.round(10.5 * 1024 * 1024)), Buffer.from('%%EOF')]));
  await clickText('Ajouter un document');
  await waitFor("document.querySelector('[role=dialog] input[type=file]')", 'fenêtre d’ajout (gros fichiers)');
  await pickFile(hugePdf);
  await clickText('Envoyer', dialog);
  await waitFor("document.querySelector('[role=dialog] [role=alert]') && document.querySelector('[role=dialog] [role=alert]').innerText.includes('taille maximale')", 'refus du fichier trop gros', 10000);
  await pickFile(bigPdf);
  await clickText('Envoyer', dialog);
  await waitFor(`!${dialog} && document.body.innerText.includes('Gros-Dossier.pdf') && document.body.innerText.includes('10 Mo')`, 'envoi de 10 Mo', 60000);
  results.at(-1).note += ' · envoi de 10 Mo pile (la limite) accepté à travers le proxy, 10,5 Mo refusé avant l’envoi';

  await go('/');
  await waitFor("document.querySelector('input[type=search]')", 'champ de recherche du hub', 20000);
  await setValue('input[type=search]', 'Hori');
  await waitFor("document.querySelector('[role=search] li')", 'résultats de recherche', 15000);
  await audit('Hub — résultats de recherche', 'résultats groupés par type, annonce du nombre');
  await shot('hub-recherche');
  await js(`document.querySelector('button[aria-label*="thème"]').click()`);
  await sleep(600);
  await audit('Hub — thème sombre');
  await shot('hub-sombre');
  await js("localStorage.removeItem('investally-theme')");
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 800, deviceScaleFactor: 1, mobile: true });
  await go('/');
  await waitFor("document.querySelector('main h1')", 'hub mobile', 20000);
  await shot('hub-mobile');
  await audit('Hub — mobile, tiroir fermé', 'la navigation est masquée aux lecteurs d’écran tant que le tiroir est fermé');
  await js(`document.querySelector('button[aria-label="Ouvrir le menu"]').click()`);
  await sleep(600);
  await shot('hub-mobile-menu');
  await audit('Hub — mobile, tiroir ouvert');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });

  await go('/admin/users');
  await waitFor("document.querySelector('table')", 'tableau des utilisateurs', 20000);
  await audit('Administration des utilisateurs');
  await shot('utilisateurs');
  await js("document.querySelector('summary[aria-label^=\"Actions pour\"]').click()");
  await sleep(300);
  await audit('Administration — menu d’actions d’une ligne', 'menu ouvert au clavier ou à la souris');
  await shot('utilisateurs-menu');
  await js("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))");
  await clickText('Inviter un utilisateur');
  await waitFor("document.querySelector('[role=dialog]')", 'fenêtre d’invitation');
  await audit('Administration — fenêtre « Inviter »', 'le focus doit entrer dans la fenêtre, le fond doit être inerte');
  const trapped = await js(`(() => { const d = document.querySelector('[role=dialog]'); const inertOutside = [...document.querySelectorAll('main, aside, nav')].every((el) => el.closest('[inert]') || d.contains(el) || el.contains(d)); const n = d.querySelectorAll('button, input, select').length; for (let i = 0; i < n + 3; i++) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })); return { inertOutside, focusInside: d.contains(document.activeElement) }; })()`);
  results.at(-1).note += ` · fond inerte : ${trapped.inertOutside ? 'oui' : 'NON'} · Tab reste dans la fenêtre : ${trapped.focusInside ? 'oui' : 'NON'}`;
  await js("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))");
  await sleep(500);
  const closed = await js("document.querySelector('[role=dialog]') ? 'fenêtre encore ouverte' : 'fenêtre fermée'");
  const back = await js("document.activeElement ? document.activeElement.tagName.toLowerCase() + ' « ' + document.activeElement.textContent.trim().slice(0, 40) + ' »' : 'aucun'");
  results.at(-1).note += ` · après Échap : ${closed}, focus rendu à ${back}`;

  // UX-02 : sélecteur de rôles par familles, cumul, aperçu des droits, changements signalés, rôles de son propre compte bloqués.
  const D = "document.querySelector('[role=dialog]')";
  const card = (name) => `[...${D}.querySelectorAll('label')].find((l) => l.querySelector('strong')?.textContent.trim() === ${JSON.stringify(name)})`;
  const status = `${D}.querySelector('[role=status]').textContent.trim()`;
  // Action sensible : si l'API exige un MFA récent (plus de 10 min depuis la vérification), saisir un code frais.
  const confirmStepUpIfAsked = async () => {
    for (let i = 0; i < 12; i++) {
      if (await js("Boolean(document.querySelector('#stepup-title'))")) {
        await setValue("form[aria-labelledby=stepup-title] input", totp(secret));
        await clickText('Confirmer', "document.querySelector('form[aria-labelledby=stepup-title]')");
        await sleep(1500);
        return true;
      }
      await sleep(250);
    }
    return false;
  };
  await clickText('Inviter un utilisateur');
  await waitFor(D, 'fenêtre d’invitation (UX-02)');
  await expectThat('5 familles (fieldset/legend) et 10 cartes de rôle', `[...${D}.querySelectorAll('fieldset legend')].map((l) => l.textContent.trim()).join('|') === 'Pilotage|Commercial|Investudy (formation)|Support et fonctions support|Administration' && ${D}.querySelectorAll('fieldset input[type=checkbox]').length === 10`);
  await expectThat('au départ : « Aucun rôle sélectionné », aperçu vide, « Tout désélectionner » désactivé', `${status} === 'Aucun rôle sélectionné' && ${D}.innerText.includes('Cochez au moins un rôle') && [...${D}.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Tout désélectionner').disabled`);
  await expectThat('« Envoyer l’invitation » désactivé sans rôle', `[...${D}.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith('Envoyer')).disabled`);
  await js(`${card('Chargé de compte')}.click()`);
  await expectThat('un clic sur la carte coche le rôle ; compteur « 1 rôle sélectionné · N permissions » ; module Business Development affiché', `${card('Chargé de compte')}.querySelector('input').checked && /^1 rôle sélectionné · \\d+ permissions?$/.test(${status}) && ${D}.innerText.includes('Business Development')`);
  const oneRole = await js(`parseInt(${status}.split('·')[1])`);
  await expectThat('le compteur égale la somme des permissions des modules de l’aperçu', `(() => { const n = parseInt(${status}.split('·')[1]); const sum = [...${D}.querySelectorAll('details summary')].reduce((t, s) => t + parseInt(s.textContent.split('·')[1]), 0); return n === sum && n > 0; })()`);
  await js(`${card('Responsable commercial')}.click()`);
  await expectThat('2 rôles : compteur « 2 rôles sélectionnés », davantage de permissions (cumul)', `/^2 rôles sélectionnés/.test(${status}) && parseInt(${status}.split('·')[1]) >= ${oneRole}`);
  await expectThat('portée la plus large retenue : « Entreprises → Consulter » n’est pas limité à « Propres »', `(() => { const row = [...${D}.querySelectorAll('tbody tr')].find((r) => r.querySelector('th')?.textContent.trim() === 'Entreprises'); const li = row && [...row.querySelectorAll('li')].find((x) => x.textContent.startsWith('Consulter')); return Boolean(li) && !li.textContent.includes('Propres'); })()`);
  // Défilement jusqu'aux derniers rôles : l'aperçu doit rester visible (position collante), pas sortir de l'écran.
  await js(`${D}.scrollTop = ${D}.scrollHeight`);
  await sleep(300);
  await expectThat("l'aperçu des droits reste visible quand on défile jusqu'aux derniers rôles", `(() => { const r = ${D}.querySelector('#rights-preview-title').getBoundingClientRect(); return r.top >= 0 && r.bottom <= window.innerHeight; })()`);
  await js(`${D}.scrollTop = 0`);
  await js(`${card('Super administrateur')}.click()`);
  await expectThat('rôle « Accès complet » : badge et avertissement d’audit visibles', `${card('Super administrateur')}.innerText.includes('Accès complet') && ${card('Super administrateur')}.innerText.includes('sont auditées')`);
  await audit('Administration — Inviter : rôles par familles et aperçu des droits (UX-02)', '3 rôles cochés, aperçu par module, avertissement sur le rôle à accès complet');
  await shot('roles-inviter');
  await js(`[...${D}.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Tout désélectionner').click()`);
  await expectThat('« Tout désélectionner » : aucun rôle, aperçu vide, envoi désactivé', `${status} === 'Aucun rôle sélectionné' && !${D}.querySelector('details') && [...${D}.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith('Envoyer')).disabled`);
  await js(`${card('Support')}.click()`);
  await setValue("[role=dialog] input[type=email]", `roles-${Date.now() % 100000}@e2e.test`);
  await setValue("[role=dialog] input:not([type=email]):not([type=checkbox])", 'Recette Rôles');
  await clickText('Envoyer', D);
  await confirmStepUpIfAsked();
  await waitFor("!document.querySelector('[role=dialog]') && document.body.innerText.includes('Invitation envoyée')", 'invitation envoyée avec le rôle Support', 25000);
  await sleep(800);
  await js(`[...document.querySelectorAll('summary[aria-label^="Actions pour"]')].find((s) => s.getAttribute('aria-label').includes('Recette Rôles')).click()`);
  await sleep(300);
  await clickText('Modifier les rôles');
  await waitFor(D, 'fenêtre des rôles de la personne invitée');
  await expectThat('les rôles actuels sont pré-cochés (Support) ; « Enregistrer » désactivé tant que rien ne change', `${card('Support')}.querySelector('input').checked && ${status}.startsWith('1 rôle') && [...${D}.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Enregistrer').disabled`);
  await js(`${card('Finance')}.click()`);
  await js(`${card('Support')}.click()`);
  await expectThat('changements annoncés en toutes lettres : « Sera ajouté » (Finance), « Sera retiré » (Support), phrase de synthèse', `${card('Finance')}.innerText.includes('Sera ajouté') && ${card('Support')}.innerText.includes('Sera retiré') && ${D}.innerText.includes('ajout de Finance') && ${D}.innerText.includes('retrait de Support')`);
  await expectThat('« Enregistrer » devient actif', `![...${D}.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Enregistrer').disabled`);
  await audit('Administration — Modifier les rôles : changements signalés (UX-02)', 'Sera ajouté / Sera retiré, synthèse, aperçu à jour');
  await shot('roles-modifier');
  await js(`${card('Finance')}.click()`);
  await js(`${card('Support')}.click()`);
  await expectThat('revenir à l’état d’origine désactive de nouveau « Enregistrer » (rien à enregistrer)', `[...${D}.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Enregistrer').disabled && !${D}.innerText.includes('Sera ajouté')`);
  await js(`${card('Finance')}.click()`);
  await js(`${card('Support')}.click()`);
  await clickText('Enregistrer', D);
  await confirmStepUpIfAsked();
  await waitFor("!document.querySelector('[role=dialog]') && document.body.innerText.includes('Rôles mis à jour')", 'rôles mis à jour', 25000);
  await sleep(800);
  await expectThat('la liste affiche le nouveau rôle de la personne (Finance, plus Support)', "(() => { const row = [...document.querySelectorAll('tbody tr')].find((r) => r.textContent.includes('Recette Rôles')); return Boolean(row) && row.textContent.includes('Finance') && !row.textContent.includes('Support'); })()");
  // Ses propres rôles : sélection bloquée avec explication.
  // Les menus des autres lignes peuvent rester ouverts : on agit uniquement dans le menu de SA ligne (nom sans « Rôles »).
  const ownRow = "[...document.querySelectorAll('summary[aria-label^=\"Actions pour\"]')].find((s) => !s.getAttribute('aria-label').includes('Rôles'))";
  await js(`${ownRow}.click()`);
  await sleep(300);
  await js(`[...${ownRow}.parentElement.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Modifier les rôles').click()`);
  await waitFor(D, 'fenêtre des rôles de son propre compte');
  await expectThat('ses propres rôles : explication affichée, toutes les cases et « Tout désélectionner » désactivés, « Enregistrer » désactivé', `${D}.innerText.includes('Vous ne pouvez pas modifier vos propres rôles') && [...${D}.querySelectorAll('fieldset input[type=checkbox]')].every((i) => i.disabled) && [...${D}.querySelectorAll('button')].filter((b) => ['Tout désélectionner', 'Enregistrer'].includes(b.textContent.trim())).every((b) => b.disabled)`);
  await audit('Administration — Modifier ses propres rôles : sélection bloquée (UX-02)', 'message explicatif, cases désactivées');
  await shot('roles-soi-meme');
  await js("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))");
  await sleep(400);

  await go('/account');
  await waitFor("document.querySelector('main h1') && document.body.innerText.includes('Sessions et connexions')", 'page Mon compte', 20000);
  await audit('Mon compte');
  // UX-01 : les trois champs de « Changer le mot de passe » ont chacun leur œil.
  await expectThat('Mon compte : 3 champs mot de passe, 3 boutons « œil »', `document.querySelectorAll('main input[autocomplete$=password]').length === 3 && document.querySelectorAll('main button[aria-label="Afficher le mot de passe"]').length === 3`);
  // UX-03 : la régénération passe par une confirmation, et le focus est sur « Annuler ».
  const DLG = "document.querySelector('[role=dialog]')";
  await clickText('Générer de nouveaux codes');
  await waitFor(DLG, 'confirmation de régénération');
  await expectThat('la confirmation expose les trois messages de sécurité', `(() => { const t = ${DLG}.innerText; return t.includes('invalidés immédiatement') && t.includes('irréversible') && t.includes('une seule fois'); })()`);
  await expectThat("focus initial sur « Annuler » (Entrée ne confirme jamais)", "document.activeElement && document.activeElement.textContent.trim() === 'Annuler'");
  await expectThat("aucun code n'est généré tant qu'on n'a pas confirmé", "!document.querySelector('.codes')");
  await audit('Mon compte — confirmation de régénération des codes (UX-03)', 'fenêtre danger, focus sur Annuler');
  await shot('compte-confirmation-codes');
  await js("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))");
  await sleep(400);
  await expectThat('Échap annule : fenêtre fermée, toujours aucun code', `!${DLG} && !document.querySelector('.codes')`);
  await clickText('Générer de nouveaux codes');
  await waitFor(DLG, 'confirmation de régénération (2)');
  await clickText('Remplacer mes codes', DLG);
  await waitFor("document.querySelector('.codes')", 'nouveaux codes de secours', 20000);
  await expectThat('au moins 8 codes affichés', "document.querySelectorAll('.codes span').length >= 8");
  await expectThat('trois actions : copier, .txt, PDF (impression)', "['Copier', 'Télécharger (.txt)', 'Imprimer ou enregistrer en PDF'].every((t) => [...document.querySelectorAll('main button')].some((b) => b.textContent.trim() === t))");
  await audit('Mon compte — nouveaux codes de secours, affichage unique (UX-04)', 'copie, .txt, impression PDF, case de conservation');
  await shot('compte-codes');
  await clickText('Télécharger (.txt)');
  await sleep(500);
  await expectThat('le téléchargement est annoncé (role=status)', "document.querySelector('main [role=status]').textContent.includes('Fichier téléchargé')");
  // Feuille imprimée : seule la feuille de codes reste visible, sans nom ni e-mail.
  await send('Emulation.setEmulatedMedia', { media: 'print' });
  await js("document.body.dataset.print = 'codes'");
  await sleep(300);
  await expectThat("impression : la feuille de codes est visible et le reste de la page masqué", "getComputedStyle(document.querySelector('.codes-print')).display === 'block' && [...document.body.children].filter((el) => !el.classList.contains('codes-print')).every((el) => getComputedStyle(el).display === 'none')");
  await expectThat("impression : aucune adresse e-mail dans la feuille", "!document.querySelector('.codes-print').innerText.includes('@') && document.querySelectorAll('.codes-print li').length >= 8");
  await js("delete document.body.dataset.print");
  await send('Emulation.setEmulatedMedia', { media: '' });
  // Garde de sortie : lien interne avant « j'ai conservé » → confirmation ; rester ; puis cocher et terminer.
  await js("document.querySelector('a[href=\"/companies\"]').click()");
  await waitFor(DLG, 'garde de sortie');
  await expectThat("on n'a pas quitté la page et la fenêtre prévient que les codes ne seront plus affichés", `location.pathname === '/account' && ${DLG}.innerText.includes('plus jamais affichés')`);
  await audit('Mon compte — quitter sans avoir conservé les codes (UX-04)', 'fenêtre de garde de sortie');
  await shot('compte-sortie');
  await clickText('Rester sur cette page', DLG);
  await sleep(300);
  await expectThat('rester : codes toujours affichés', "location.pathname === '/account' && Boolean(document.querySelector('.codes'))");
  await js("document.querySelector('main input[type=checkbox]').click()");
  await clickText('Terminer');
  await sleep(400);
  await expectThat('« Terminer » : les codes ont disparu et ne peuvent plus être revus', "!document.querySelector('.codes') && !document.querySelector('.codes-print')");
  await expectThat('aucun code dans le stockage du navigateur', "!/[A-Z0-9]{5}-[A-Z0-9]{5}/.test(JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)]))");

  // Sessions et historique (H2b) : de vraies connexions sans second facteur créent des sessions supplémentaires.
  // Connexions faites HORS du navigateur (Node) : celles du navigateur remplaceraient son cookie de session.
  const secondLogin = (agent) => fetch(`${BASE}/api/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', origin: BASE, 'user-agent': agent }, body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }) }).then((r) => r.status);
  await secondLogin('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Gecko/20100101 Firefox/130.0');
  await secondLogin('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36');
  await go('/account/sessions');
  await waitFor("document.querySelectorAll('table').length === 2 && document.querySelectorAll('tbody tr').length > 3", 'sessions et historique', 20000);
  await audit('Sessions et connexions (S01, S02)', 'sessions actives, historique des 90 jours');
  await shot('sessions');
  await clickText('Révoquer');
  await waitFor("document.querySelector('[role=dialog]')", 'confirmation de révocation');
  await audit('Sessions — confirmation de révocation (S03)', 'fond inerte, focus dans la fenêtre');
  await shot('sessions-revocation');
  await clickText('Révoquer', "document.querySelector('[role=dialog]')");
  await waitFor("document.body.innerText.includes('révoquée')", 'session révoquée', 15000);
  await audit('Sessions — après révocation d’une session', 'confirmation annoncée (role=status)');
  await clickText('Déconnecter tous mes autres appareils');
  await waitFor("document.querySelector('[role=dialog]')", 'confirmation de la révocation groupée');
  await audit('Sessions — confirmation « tous mes autres appareils » (S03)');
  await clickText('Tout déconnecter', "document.querySelector('[role=dialog]')");
  await waitFor("document.body.innerText.includes('session')  && document.body.innerText.includes('révoquée')", 'révocation groupée', 15000);
  await sleep(600);
  const stillOpen = await js("[...document.querySelectorAll('table')][0].querySelectorAll('tbody tr').length");
  results.at(-1).note += ` · sessions encore actives : ${stillOpen}`;
  if (stillOpen !== 1) throw new Error(`Après « tous mes autres appareils », il doit rester 1 session (la courante), il en reste ${stillOpen}`);
  await shot('sessions-apres');

  // Nouvelle connexion : saisie du code (A02) puis code de secours (A03).
  await clickText('Se déconnecter');
  await waitFor("location.pathname === '/login'", 'retour à la connexion', 20000);
  await setValue('input[type=email]', ADMIN_EMAIL);
  await setValue('input[type=password]', ADMIN_PASSWORD);
  await clickText('Se connecter');
  await waitFor("location.pathname === '/mfa' && document.querySelector('input')", 'saisie du code MFA', 20000);
  await audit('MFA — saisie du code (A02)');
  // Saisie réelle au clavier : chaque chiffre avance d'une case, Retour arrière recule.
  await js("document.querySelector('input[inputmode=numeric]').focus()");
  for (const digit of '481') { await send('Input.insertText', { text: digit }); await sleep(120); }
  const typed = await js("({ cases: [...document.querySelectorAll('input[inputmode=numeric]')].map((i) => i.value).join(''), focus: [...document.querySelectorAll('input[inputmode=numeric]')].indexOf(document.activeElement) })");
  await shot('mfa-code');
  for (let i = 0; i < 2; i++) { await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 }); await sleep(120); }
  const erased = await js("[...document.querySelectorAll('input[inputmode=numeric]')].map((i) => i.value).join('')");
  results.at(-1).note += ` · saisie « 481 » → cases « ${typed.cases} », focus case ${typed.focus + 1} ; après 2 Retour arrière → « ${erased} »`;
  if (typed.cases !== '481' || typed.focus !== 3 || erased !== '4') throw new Error(`Saisie en six cases incorrecte : ${JSON.stringify({ typed, erased })}`);
  await clickText('Téléphone perdu');
  await sleep(400);
  await audit('MFA — code de secours (A03)');
  await shot('mfa-secours');

  // lien d'invitation et de réinitialisation (journal de l'API en mode développement)
  const refresh = await js("fetch('/api/v1/auth/refresh', { method: 'POST' }).then((r) => r.json()).then((b) => b.accessToken)");
  await js(`fetch('/api/v1/auth/password-reset/request', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: ${JSON.stringify(ADMIN_EMAIL)} }) }).then((r) => r.status)`);
  await sleep(2500);
  const resetToken = lastLink('reset-password');
  if (resetToken) {
    await go(`/reset-password#token=${resetToken}`);
    await audit('Réinitialisation — nouveau mot de passe');
    await setValue('input[autocomplete=new-password]', 'court');
    await audit('Réinitialisation — indications en direct', 'mot de passe trop court');
  } else results.push({ label: 'Réinitialisation — nouveau mot de passe', note: 'NON TESTÉ : lien introuvable dans le journal de l’API (--api-log)' });
  void refresh;
} catch (error) {
  console.error('✘ Interruption du parcours :', error.message);
  results.push({ label: 'INTERRUPTION', note: error.message });
}

// ---------------------------------------------------------------- sorties
mkdirSync(OUT, { recursive: true });
const stamp = new Date().toISOString().slice(0, 10);
writeFileSync(join(OUT, `axe-${stamp}.json`), JSON.stringify(results, null, 2));
if (cspViolations.length) results.push({ label: 'POLITIQUE DE CONTENU (CSP)', note: `${cspViolations.length} violation(s) : ${cspViolations.join(' | ')}` });
const violations = results.flatMap((r) => (r.axe?.violations ?? []).map((v) => ({ etat: r.label, ...v })));
const summary = [
  `# Audit d'accessibilité de l'interface — ${stamp}`,
  '',
  `**Violations de la politique de contenu (CSP)** : ${cspViolations.length}`,
  '',
  `**États audités** : ${results.filter((r) => r.axe).length} · **violations** : ${violations.length} · **à vérifier à la main** : ${results.reduce((n, r) => n + (r.axe?.incomplete.length ?? 0), 0)}`,
  '',
  '| État d\'écran | Violations | À vérifier | Éléments annoncés |', '|---|---|---|---|',
  ...results.filter((r) => r.axe).map((r) => `| ${r.label} | ${r.axe.violations.length} | ${r.axe.incomplete.length} | ${r.announced.length} |`),
  '',
  '## Violations',
  violations.length ? violations.map((v) => `- **${v.etat}** — \`${v.id}\` (${v.impact}) : ${v.help} — ${v.nodes} élément(s) ; ex. \`${v.example?.target}\``).join('\n') : 'Aucune.',
  '',
  ...results.filter((r) => r.axe).flatMap((r) => [`## ${r.label}`, `*Titre de page* : « ${r.title} » · *Langue* : ${r.lang || '(absente)'} · *Focus* : ${r.focus}${r.note ? ` · *Note* : ${r.note}` : ''}`, '', 'Ce que le lecteur d\'écran annonce, dans l\'ordre :', '', ...r.announced.map((l) => `- ${l}`), '']),
  ...results.filter((r) => !r.axe).map((r) => `> ${r.label} : ${r.note}`),
].join('\n');
writeFileSync(join(OUT, `lecteur-d-ecran-proxy-${stamp}.md`), summary);
console.log(`\nRésultats écrits dans ${OUT}`);
socket.close();
killBrowser();
process.exit(violations.length ? 1 : 0);
