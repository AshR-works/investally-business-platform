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
import { spawn } from 'node:child_process';
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
  pending.set(id, (d) => (d.error ? reject(new Error(`${method}: ${d.error.message}`)) : resolveCall(d.result)));
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
  const snapshot = await js('document.body.innerText.replace(/\s+/g, " ").slice(0, 400)').catch(() => '');
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
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(SHOTS, `${name}.png`), Buffer.from(r.data, 'base64'));
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
  await setValue('[role=dialog] input', `Société Horizon ${Date.now() % 100000}`);
  await clickText('Enregistrer');
  await waitFor("!document.querySelector('[role=dialog]')", 'création terminée', 15000);
  await sleep(1200);
  await js("document.querySelectorAll('tbody input[type=checkbox]')[0].click(); document.querySelectorAll('tbody input[type=checkbox]')[2].click()");
  await sleep(400);
  await audit('Entreprises — deux lignes sélectionnées', 'barre de sélection annoncée, lignes teintées avec barre latérale');
  await shot('entreprises-selection');
  await js("document.querySelector('thead input[type=checkbox]').click()");
  await sleep(300);
  await js("[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Tout désélectionner').click()");
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
  await clickText('Fermer', dialog);
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
proc.kill();
process.exit(violations.length ? 1 : 0);
