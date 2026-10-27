#!/usr/bin/env node
// Rapports journaliers du développement : génération, rendu HTML/PDF, changelog, tableaux de bord.
//
//   node scripts/daily-report.mjs help
//
// Principes (détail dans docs/daily-reports/README.md) :
//   * la SOURCE de vérité est l'historique Git + le fichier Markdown du jour ;
//   * le Markdown contient des blocs AUTOMATIQUES (<!-- auto:nom --> régénérés depuis Git) et des blocs MANUELS
//     (<!-- manual:nom --> écrits par l'auteur, jamais écrasés) ;
//   * le HTML et le PDF sont des produits dérivés du Markdown ;
//   * aucun secret, aucune adresse e-mail : les noms seulement (le dépôt est public).
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const REPORTS = join(ROOT, 'docs', 'daily-reports');
export const TZ = 'Africa/Douala';
export const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
export const PLACEHOLDER = '_À compléter._';
export const DRAFT_MARK = '_Brouillon automatique, à relire et compléter._';

// ------------------------------------------------------------------------------------------------ dates
/** Date locale (fuseau du projet) d'un instant ISO, au format AAAA-MM-JJ. */
export function localDate(iso) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}
export function localTime(iso) {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
}
export const today = () => localDate(new Date().toISOString());
export function weekday(date) {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', weekday: 'long' }).format(new Date(`${date}T12:00:00Z`));
}
export function monthFolder(date) {
  const m = Number(date.slice(5, 7));
  return `${String(m).padStart(2, '0')}-${MONTHS[m - 1]}`;
}
/** Chemins des trois formats d'un rapport : AAAA/MM-Mois/AAAA-MM-JJ.{md,html,pdf}. */
export function reportPaths(date, base = REPORTS) {
  const dir = join(base, date.slice(0, 4), monthFolder(date));
  return { dir, md: join(dir, `${date}.md`), html: join(dir, `${date}.html`), pdf: join(dir, `${date}.pdf`) };
}
/** Semaine ISO 8601 : « AAAA-Www » (le jeudi décide de l'année). */
export function isoWeek(date) {
  const d = new Date(`${date}T12:00:00Z`);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const week = Math.ceil(((d - new Date(Date.UTC(year, 0, 1))) / 86400000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}
export function weekRange(week) {
  const [y, w] = week.split('-W').map(Number);
  const jan4 = new Date(Date.UTC(y, 0, 4, 12));
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() || 7) - 1) + (w - 1) * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const f = (x) => x.toISOString().slice(0, 10);
  return { from: f(monday), to: f(sunday) };
}

// ------------------------------------------------------------------------------------------------ Git
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] });
const gitTry = (...args) => { try { return git(...args).trim(); } catch { return ''; } };

export function normalizeRef(ref) {
  return (ref ?? '').replace(/^refs\/heads\//, '').replace(/^refs\/remotes\/origin\//, '').replace(/^refs\/tags\/.*/, '').trim();
}
export function parseLog(raw) {
  return raw.split('\x1e').filter((r) => r.trim()).map((r) => {
    const [hash, short, date, author, subject, body, parents, source] = r.split('\x1f');
    return {
      hash: hash.trim(), short: short.trim(), date: date.trim(), day: localDate(date.trim()), time: localTime(date.trim()),
      author: author.trim(), subject: subject.trim(), body: (body ?? '').trim(),
      parents: parents && parents.trim() ? parents.trim().split(' ') : [], source: normalizeRef(source),
    };
  });
}
/** Nom de branche d'après la sortie de `git name-rev` (« sprint/s3-6~3^2 » → « sprint/s3-6 »). */
export function branchFromNameRev(name) {
  const n = (name ?? '').trim().replace(/^(heads|remotes\/origin)\//, '').replace(/[~^].*$/, '');
  return !n || n === 'undefined' ? '' : n;
}
/**
 * Tous les commits (toutes les branches locales et distantes). La branche d'un commit est la plus proche branche
 * `sprint/*`, `design/*` ou `main` qui le descend (`git name-rev`) ; une fusion appartient toujours à `main`.
 */
export function loadCommits() {
  const raw = git('log', '--all', '--date-order', '--format=%x1e%H%x1f%h%x1f%aI%x1f%an%x1f%s%x1f%b%x1f%P%x1f');
  const commits = parseLog(raw);
  const refs = ['--refs=refs/heads/sprint/*', '--refs=refs/heads/design/*', '--refs=refs/heads/main'];
  for (let i = 0; i < commits.length; i += 150) {
    const chunk = commits.slice(i, i + 150);
    const names = gitTry('name-rev', '--name-only', ...refs, ...chunk.map((c) => c.hash)).split('\n');
    chunk.forEach((c, k) => { c.source = isMerge(c) ? 'main' : branchFromNameRev(names[k]); });
  }
  return commits;
}
export const isMerge = (c) => c.parents.length > 1;
/** Co-auteurs déclarés dans le message (jamais l'adresse e-mail). */
export function coAuthors(body) {
  return [...body.matchAll(/^Co-Authored-By:\s*([^<\n]+)/gim)].map((m) => m[1].trim());
}
/** Description lisible d'un commit : le corps sans les lignes de signature. */
export function describeCommit(body) {
  return body.split('\n').filter((l) => !/^(Co-Authored-By|🤖|Generated with)/i.test(l.trim())).join(' ').replace(/\s+/g, ' ').trim();
}
export function parseNameStatus(raw) {
  return raw.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const [status, ...rest] = l.split('\t');
    return { status: status[0], path: rest.join('\t') };
  });
}
function commitFiles(c) {
  if (isMerge(c)) return [];
  const flag = c.parents.length === 0 ? ['--root'] : [];
  return parseNameStatus(git('diff-tree', '--no-commit-id', '--name-status', '-r', '--no-renames', ...flag, c.hash));
}
function commitNumstat(c) {
  if (isMerge(c)) return { add: 0, del: 0 };
  const flag = c.parents.length === 0 ? ['--root'] : [];
  let add = 0, del = 0;
  for (const line of git('diff-tree', '--no-commit-id', '--numstat', '-r', '--no-renames', ...flag, c.hash).split('\n')) {
    const [a, d] = line.split('\t');
    if (/^\d+$/.test(a)) add += Number(a);
    if (/^\d+$/.test(d)) del += Number(d);
  }
  return { add, del };
}
export function loadTags() {
  const raw = gitTry('for-each-ref', '--sort=creatordate', '--format=%(refname:short)%09%(creatordate:iso-strict)%09%(*objectname)%09%(objectname)%09%(contents:subject)', 'refs/tags');
  return raw.split('\n').filter(Boolean).map((l) => {
    const [name, date, peeled, obj, subject] = l.split('\t');
    const commit = peeled || obj;
    return { name, day: localDate(date), commit, subject: subject || gitTry('log', '-1', '--format=%s', commit) };
  });
}

// ------------------------------------------------------------------------------------------------ classification
/** Libellé de session d'après le nom de branche : sprint/s3-6-documents → S3.6 ; sprint/h2a-… → H2a. */
export function sprintLabel(branch) {
  const name = branch.replace(/^(sprint|design)\//, '');
  const special = { 'a11y-1': 'A11Y-1' };
  for (const [prefix, label] of Object.entries(special)) if (name.startsWith(prefix)) return label;
  const m = name.match(/^([a-z])(\d+)([a-z]?)(?:-(\d+))?(?:-|$)/);
  if (m) return `${m[1].toUpperCase()}${m[2]}${m[3]}${m[4] ? `.${m[4]}` : ''}`;
  return name;
}
const SECURITY_RE = /s[ée]curit|security|idor|\bmfa\b|\bcsp\b|xss|csrf|authentif|vuln|secret|r[ée]vocation|verrou|mot de passe|second facteur|\brbac\b/i;
const FIX_RE = /^(fix|correctif|hotfix)\b|\bcorrect(if|ion)\b|\bcorrig/i;
/** Catégories d'un commit selon son message et ses fichiers. */
export function classify(commit, files) {
  const tags = new Set();
  const paths = files.map((f) => f.path);
  if (paths.some((p) => p.startsWith('apps/crm-api/'))) tags.add('backend');
  if (paths.some((p) => p.startsWith('apps/crm-web/'))) tags.add('frontend');
  if (paths.some((p) => /^apps\/crm-web\/(components|app)\//.test(p) || /^docs\/design\//.test(p) || /UX/.test(p))) tags.add('ux');
  // D'après le message seulement : un commit qui touche le module d'identité sans parler de sécurité n'est pas une évolution de sécurité.
  if (SECURITY_RE.test(commit.subject)) tags.add('securite');
  if (FIX_RE.test(commit.subject)) tags.add('correctif');
  if (isMerge(commit)) tags.add('fusion');
  return tags;
}
/** Catégorie de changelog : Sécurité > Corrections > Ajouts > Modifications. */
export function changelogCategory(commit, files) {
  if (isMerge(commit)) return null;
  const tags = classify(commit, files);
  if (tags.has('securite') && !/^docs\b/i.test(commit.subject)) return 'Sécurité';
  if (tags.has('correctif')) return 'Corrections';
  if (/^(feat|ajout|nouveau|nouvelle|création|s\d|h\d|a11y)/i.test(commit.subject) || files.some((f) => f.status === 'A' && /^apps\//.test(f.path))) return 'Ajouts';
  return 'Modifications';
}
export function isNoise(path, paths = new Set()) {
  if (/^docs\/.*\.html$/.test(path) && !path.startsWith('docs/design/prototype/') && paths.has(path.replace(/\.html$/, '.md'))) return 'pages HTML générées';
  if (/^docs\/daily-reports\/.*\.(html|pdf)$/.test(path)) return 'rapports HTML/PDF générés';
  if (/\.(png|jpg)$/.test(path) && /(captures|screens|releases)\//.test(path)) return 'captures';
  return null;
}
/** Statut net d'un fichier sur la journée : créé puis supprimé = ignoré ; ajouté = A ; supprimé = D ; sinon M. */
export function netStatuses(sequences) {
  const out = new Map();
  for (const [path, seq] of sequences) {
    const first = seq[0], last = seq[seq.length - 1];
    if (first === 'A' && last === 'D') continue;
    out.set(path, last === 'D' ? 'D' : first === 'A' ? 'A' : 'M');
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ Markdown : blocs et en-tête
export function getBlock(md, kind, name) {
  const m = md.match(new RegExp(`<!-- ${kind}:${name} -->\\n([\\s\\S]*?)\\n?<!-- /${kind}:${name} -->`));
  return m ? m[1] : null;
}
export function setBlock(md, kind, name, content) {
  const re = new RegExp(`(<!-- ${kind}:${name} -->\\n)[\\s\\S]*?(\\n?<!-- /${kind}:${name} -->)`);
  return md.replace(re, (_, a, b) => `${a}${content.trim()}${b.startsWith('\n') ? b : `\n${b}`}`);
}
export function parseFrontMatter(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---\n?/);
  const data = {};
  if (m) for (const line of m[1].split('\n')) { const i = line.indexOf(':'); if (i > 0) data[line.slice(0, i).trim()] = line.slice(i + 1).trim(); }
  return { data, body: m ? md.slice(m[0].length) : md };
}
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const code = (s) => `\`${String(s).replace(/`/g, "'")}\``;

// ------------------------------------------------------------------------------------------------ Markdown → HTML
function inline(text) {
  let t = esc(text);
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])/g, '<em>$1</em>');
  t = t.replace(/(?<![\w])_(?!\s)(.+?)(?<!\s)_(?![\w])/g, '<em>$1</em>');
  t = t.replace(/~~(.+?)~~/g, '<del>$1</del>');
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => (/^(https?:|\.{0,2}\/|#|[\w.-]+\.(md|html|pdf))/i.test(href) && !/^javascript:/i.test(href) ? `<a href="${href.replace(/\.md$/, '.html')}">${label}</a>` : label));
  return t;
}
export const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/** Convertisseur Markdown (sous-ensemble : titres, listes à 2 niveaux, tableaux, code, citations). Tout le texte est échappé. */
export function markdownToHtml(md) {
  const lines = md.replace(/<!--[\s\S]*?-->/g, '').split('\n');
  const out = [], headings = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('```')) {
      const buf = [];
      for (i++; i < lines.length && !lines[i].startsWith('```'); i++) buf.push(esc(lines[i]));
      out.push(`<pre><code>${buf.join('\n')}</code></pre>`); i++; continue;
    }
    const h = line.match(/^(#{1,4}) (.+)$/);
    if (h) {
      const level = h[1].length, id = slug(h[2]);
      headings.push({ level, text: h[2], id });
      out.push(`<h${level} id="${id}">${inline(h[2])}</h${level}>`); i++; continue;
    }
    if (/^---+$/.test(line.trim())) { out.push('<hr>'); i++; continue; }
    if (line.startsWith('|') && i + 1 < lines.length && /^\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const split = (l) => l.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
      const head = split(line); i += 2; const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) { rows.push(split(lines[i])); i++; }
      out.push(`<div class="table-wrap"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    if (line.startsWith('>')) {
      const q = []; while (i < lines.length && lines[i].startsWith('>')) { q.push(lines[i].replace(/^>\s?/, '')); i++; }
      out.push(`<blockquote><p>${inline(q.join(' '))}</p></blockquote>`); continue;
    }
    if (/^\s*([-*]|\d+\.) /.test(line)) {
      const ordered = /^\s*\d+\. /.test(line), items = [];
      while (i < lines.length && /^\s*([-*]|\d+\.) /.test(lines[i])) {
        const m = lines[i].match(/^(\s*)([-*]|\d+\.) (.*)$/);
        const text = m[3].replace(/^\[ \] /, '☐ ').replace(/^\[[xX]\] /, '☑ ');
        if (m[1].length >= 2 && items.length) items[items.length - 1].sub.push(text); else items.push({ text, sub: [] });
        i++;
      }
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}>${items.map((it) => `<li>${inline(it.text)}${it.sub.length ? `<ul>${it.sub.map((s) => `<li>${inline(s)}</li>`).join('')}</ul>` : ''}</li>`).join('')}</${tag}>`);
      continue;
    }
    if (!line.trim()) { i++; continue; }
    const para = [line]; i++;
    while (i < lines.length && lines[i].trim() && !/^(#{1,4} |\||>|```|---+$|\s*([-*]|\d+\.) )/.test(lines[i])) { para.push(lines[i]); i++; }
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }
  return { html: out.join('\n'), headings };
}

const CSS = `
:root{--bg:#fff;--text:#1b2430;--muted:#5b6675;--border:#d5dae1;--accent:#6b4e3d;--code:#f3f5f8;--quote:#f6f1ec}
@media (prefers-color-scheme:dark){:root{--bg:#12161c;--text:#e8ecf1;--muted:#9aa5b4;--border:#364050;--accent:#d9b99b;--code:#1b212a;--quote:#241f1b}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.55 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}
main{max-width:1000px;margin:0 auto;padding:2rem 1.25rem 4rem}
header.cover{border-bottom:3px solid var(--accent);padding-bottom:1rem;margin-bottom:1.2rem}
header.cover .kicker{color:var(--muted);font-size:.85rem;text-transform:uppercase;letter-spacing:.08em}
h1{font-size:1.8rem;margin:.2em 0 .3em;line-height:1.25}
h2{font-size:1.3rem;margin:2em 0 .5em;padding-bottom:.2em;border-bottom:2px solid var(--border)}
h3{font-size:1.05rem;margin:1.4em 0 .3em}
a{color:var(--accent)}
code{background:var(--code);padding:.1em .35em;border-radius:4px;font:.88em ui-monospace,Consolas,monospace;overflow-wrap:anywhere}
pre{background:var(--code);padding:1rem;border-radius:8px;overflow-x:auto}pre code{background:none;padding:0}
blockquote{margin:1rem 0;padding:.5rem 1rem;background:var(--quote);border-left:4px solid var(--accent);border-radius:0 8px 8px 0}
.table-wrap{overflow-x:auto;margin:.8rem 0}
table{border-collapse:collapse;width:100%;font-size:.9rem}
th,td{border:1px solid var(--border);padding:.35rem .55rem;text-align:left;vertical-align:top}th{background:var(--code)}
.badge{display:inline-block;padding:.1rem .55rem;border-radius:999px;border:1px solid var(--border);font-size:.78rem;font-weight:600}
.summary{background:var(--quote);border:1px solid var(--border);border-left:5px solid var(--accent);border-radius:8px;padding:.8rem 1.1rem;margin:1rem 0}
.summary h2{margin:.1em 0 .4em;border:0;font-size:1.05rem}
nav.toc{border:1px solid var(--border);border-radius:8px;padding:.6rem 1.1rem;margin:1rem 0}
nav.toc h2{margin:.1em 0 .3em;border:0;font-size:1.05rem}nav.toc ol{margin:0;padding-left:1.3rem;columns:2}
footer{margin-top:3rem;color:var(--muted);font-size:.8rem;border-top:1px solid var(--border);padding-top:.6rem}
@page{size:A4;margin:18mm 14mm 20mm;@bottom-left{content:"Investally Business Platform · Rapport";font:8pt system-ui;color:#666}@bottom-right{content:"Page " counter(page) " / " counter(pages);font:8pt system-ui;color:#666}}
@media print{body{background:#fff;color:#000;font-size:10.5pt}main{max-width:none;padding:0}a{color:inherit;text-decoration:none}h2{break-after:avoid}table,pre,blockquote,.summary{break-inside:avoid}.cover-page{break-after:page}nav.toc ol{columns:1}th{background:#eee!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
`;
/** Page HTML autonome d'un rapport : couverture (méta + résumé + sommaire) puis le corps. */
export function renderHtmlPage(md, { kind = 'Rapport journalier' } = {}) {
  const { data, body } = parseFrontMatter(md);
  const sections = body.replace(/^# .+\n/m, '');
  const titleMatch = body.match(/^# (.+)$/m);
  const { html, headings } = markdownToHtml(sections.replace(/## Résumé exécutif\n[\s\S]*?(?=\n## )/, ''));
  const resume = (getBlock(body, 'manual', 'resume') ?? '').trim();
  const summaryHtml = resume && resume !== PLACEHOLDER ? markdownToHtml(resume).html : '<p><em>Résumé à compléter.</em></p>';
  const toc = headings.filter((h) => h.level === 2).map((h) => `<li><a href="#${h.id}">${esc(h.text)}</a></li>`).join('');
  const meta = Object.entries({ Date: data.date, Auteur: data.author, Sprint: data.sprint, Version: data.version, Branche: data.branch })
    .filter(([, v]) => v).map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titleMatch ? titleMatch[1] : kind)}</title><style>${CSS}</style></head><body><main>
<div class="cover-page"><header class="cover"><div class="kicker">Investally Business Platform · ${esc(kind)}</div><h1>${inline(titleMatch ? titleMatch[1] : kind)}</h1>${data.status ? `<span class="badge">${esc(data.status)}</span>` : ''}${data.origin && data.origin !== 'direct' ? ` <span class="badge">${esc(data.origin)}</span>` : ''}</header>
<table><tbody>${meta}</tbody></table>
<section class="summary"><h2>Résumé exécutif</h2>${summaryHtml}</section>
<nav class="toc" aria-label="Sommaire"><h2>Sommaire</h2><ol>${toc}</ol></nav></div>
${html}
<footer>Généré à partir de l'historique Git et du fichier Markdown. ${esc(data.generated ?? '')}</footer></main></body></html>`;
}

// ------------------------------------------------------------------------------------------------ PDF (Edge ou Chrome sans fenêtre)
export function findBrowser() {
  const candidates = [process.env.BROWSER_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium', '/usr/bin/google-chrome', '/usr/bin/chromium-browser'].filter(Boolean);
  return candidates.find((p) => existsSync(p)) ?? null;
}
export function htmlToPdf(htmlPath, pdfPath) {
  const browser = findBrowser();
  if (!browser) return { ok: false, reason: 'aucun navigateur Chromium trouvé (définissez BROWSER_PATH)' };
  const profile = mkdtempSync(join(tmpdir(), 'daily-report-pdf-'));
  rmSync(pdfPath, { force: true });
  try {
    // `--no-sandbox` seulement en conteneur (CI) : jamais par défaut.
    const sandbox = process.env.PDF_NO_SANDBOX ? ['--no-sandbox'] : [];
    spawnSync(browser, ['--headless=new', '--disable-gpu', ...sandbox, '--no-pdf-header-footer', `--user-data-dir=${profile}`, `--print-to-pdf=${pdfPath}`, pathToFileURL(htmlPath).href], { encoding: 'utf8', timeout: 90_000 });
    // Le navigateur rend la main avant d'avoir fini d'écrire : on attend un fichier de taille stable.
    const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
    let previous = -1;
    for (let i = 0; i < 80; i++) {
      const size = existsSync(pdfPath) ? statSync(pdfPath).size : 0;
      if (size > 1000 && size === previous) return { ok: true };
      previous = size;
      pause(500);
    }
    return { ok: false, reason: 'le navigateur n\'a pas produit de PDF (délai dépassé)' };
  } finally {
    try { rmSync(profile, { recursive: true, force: true, maxRetries: 3 }); } catch { /* profil temporaire, nettoyé par le système */ }
  }
}

// ------------------------------------------------------------------------------------------------ données d'une journée
function fileList(title, entries, cap = 120) {
  if (!entries.length) return '';
  const shown = entries.slice(0, cap).map((e) => `- ${code(e)}`);
  if (entries.length > cap) shown.push(`- … et ${entries.length - cap} autres`);
  return `**${title}** (${entries.length})\n\n${shown.join('\n')}\n`;
}
/** Collecte tout ce qui est calculable depuis Git pour une journée. */
export function collectDay(date, commits = loadCommits(), tags = loadTags()) {
  const day = commits.filter((c) => c.day === date).sort((a, b) => a.date.localeCompare(b.date));
  const sequences = new Map();
  const perCommit = new Map();
  let add = 0, del = 0;
  for (const c of day) {
    const files = commitFiles(c);
    perCommit.set(c.hash, files);
    for (const f of files) { if (!sequences.has(f.path)) sequences.set(f.path, []); sequences.get(f.path).push(f.status); }
    const n = commitNumstat(c); add += n.add; del += n.del;
  }
  const statuses = netStatuses(sequences);
  const allPaths = new Set([...statuses.keys()]);
  const dayTags = tags.filter((t) => t.day === date);
  const last = day[day.length - 1];
  const nearest = last ? gitTry('describe', '--tags', '--abbrev=0', last.hash) : '';
  const designVersion = last ? gitTry('show', `${last.hash}:docs/design/VERSION`) : '';
  let appVersion = '';
  if (last) { try { appVersion = JSON.parse(git('show', `${last.hash}:package.json`)).version ?? ''; } catch { /* pas de package.json */ } }
  return { date, day, perCommit, statuses, allPaths, add, del, dayTags, nearest, designVersion, appVersion };
}
const byStatus = (data, letter, filter = () => true) => [...data.statuses].filter(([p, s]) => s === letter && filter(p)).map(([p]) => p).sort();

function buildAutoBlocks(data) {
  const { day, perCommit, statuses, allPaths } = data;
  const nonMerge = day.filter((c) => !isMerge(c));
  const branches = [...new Set(day.map((c) => c.source).filter(Boolean))];
  const sprints = [];
  for (const label of [...branches.filter((b) => /^(sprint|design)\//.test(b)).map(sprintLabel), ...data.dayTags.map((t) => sprintLabel(t.name.replace(/-validated$/, '')))]) {
    // Une session validée (étiquette) et sa branche ne comptent qu'une fois (« H2a » = « h2a », « idor » ~ « idor-contrat »).
    const l = label.toLowerCase();
    if (!sprints.some((s) => s.toLowerCase() === l || s.toLowerCase().startsWith(l) || l.startsWith(s.toLowerCase()))) sprints.push(label);
  }
  const authors = [...new Set(day.map((c) => c.author))];
  const assistants = new Set(day.flatMap((c) => coAuthors(c.body)));
  // Branche principale du jour : celle qui porte le plus de commits (hors fusions, qui appartiennent à main).
  const count = (b) => day.filter((c) => c.source === b && !isMerge(c)).length;
  const main = [...branches].sort((a, b) => count(b) - count(a))[0] ?? '—';
  const t = (c) => `${c.time}`;
  const infos = [
    '| Champ | Valeur |', '|---|---|',
    `| Date | ${data.date} (${weekday(data.date)}) |`,
    `| Auteur(s) | ${authors.length ? authors.map((a) => `${a} (${day.filter((c) => c.author === a).length} commit(s))`).join(', ') : '—'} |`,
    `| Assistant | ${assistants.size ? [...assistants].join(', ') + ' (co-auteur)' : '—'} |`,
    `| Sprint(s) | ${sprints.length ? sprints.join(', ') : '—'} |`,
    `| Version | ${data.nearest ? `dernière étiquette ${code(data.nearest)}` : 'aucune étiquette'} · design ${data.designVersion || '—'} · application ${data.appVersion || '—'} |`,
    `| Branche Git | ${code(main)}${branches.length > 1 ? ` · autres : ${branches.filter((b) => b !== main).map(code).join(', ')}` : ''} |`,
    `| Activité | ${day.length ? `${t(day[0])} – ${t(day[day.length - 1])} (${TZ})` : '—'} |`,
  ].join('\n');

  const nets = (l) => byStatus(data, l).length;
  const stats = [
    '| Indicateur | Valeur |', '|---|---|',
    `| Commits | ${day.length} (dont ${day.length - nonMerge.length} fusion(s)) |`,
    `| Fichiers touchés | ${statuses.size} (${nets('A')} nouveaux, ${nets('M')} modifiés, ${nets('D')} supprimés) |`,
    `| Lignes | +${data.add} / −${data.del} |`,
    `| Étiquettes posées | ${data.dayTags.length ? data.dayTags.map((x) => code(x.name)).join(', ') : '0'} |`,
  ].join('\n');

  const modules = new Set(), pages = [], comps = [];
  for (const [p, s] of statuses) {
    const m = p.match(/^apps\/crm-api\/src\/modules\/([^/]+)\//); if (m) modules.add(m[1]);
    if (/^apps\/crm-web\/app\/.*page\.tsx$/.test(p)) pages.push(`${p.replace(/^apps\/crm-web\/app\//, '').replace(/\/?page\.tsx$/, '') || '/'} (${s})`);
    if (/^apps\/crm-web\/components\/.*\.tsx$/.test(p)) comps.push(`${p.replace(/^apps\/crm-web\/components\//, '')} (${s})`);
  }
  const realisations = [
    data.dayTags.length ? `**Étiquettes posées (sessions validées et versions du design)**\n\n${data.dayTags.map((x) => `- ${code(x.name)} : ${x.subject}`).join('\n')}\n` : '',
    day.filter(isMerge).length ? `**Fusions**\n\n${day.filter(isMerge).map((c) => `- ${code(c.short)} ${c.subject}`).join('\n')}\n` : '',
    modules.size ? `**Modules de l'API impactés** : ${[...modules].sort().map(code).join(', ')}\n` : '',
    pages.length ? `**Écrans (pages) créés ou modifiés** : ${pages.sort().map(code).join(', ')}\n` : '',
    comps.length ? `**Composants créés ou modifiés** : ${comps.sort().map(code).join(', ')}\n` : '',
  ].filter(Boolean).join('\n') || '_Aucune étiquette, fusion ou écran concerné automatiquement détecté._';

  const list = (paths, strip) => paths.map((p) => `- ${code(strip ? p.replace(strip, '') : p)} (${statuses.get(p)})`).join('\n');
  const uxFiles = [...allPaths].filter((p) => /^apps\/crm-web\/(components|app)\/|^docs\/design\/.+\.md$|^docs\/cadrages\/.+\.md$|^docs\/accessibilite\/.+\.md$/.test(p) && !/\/test\//.test(p)).sort();
  const feedback = nonMerge.filter((c) => /retour|UX-\d+|demande|recette/i.test(`${c.subject} ${c.body}`));
  const ux = [
    uxFiles.length ? `**Écrans, composants et documents de design touchés** (${uxFiles.length})\n\n${list(uxFiles.slice(0, 80))}${uxFiles.length > 80 ? `\n- … et ${uxFiles.length - 80} autres` : ''}\n` : '_Aucun fichier d\'interface ou de design touché._',
    feedback.length ? `**Retours et demandes traités (d'après les messages de commit)**\n\n${feedback.map((c) => `- ${code(c.short)} ${c.subject}`).join('\n')}\n` : '',
  ].filter(Boolean).join('\n');

  const be = [...allPaths].filter((p) => p.startsWith('apps/crm-api/'));
  const pick = (re) => be.filter((p) => re.test(p)).sort();
  const sec = [...allPaths].filter((p) => /\/iam\/|SECURITY\.md|rbac|idor|guard|auth/i.test(p) && !/\.(html|png)$/.test(p)).sort();
  const backend = be.length || sec.length ? [
    ['Routes (contrôleurs)', pick(/controller/)], ['Services et cas d\'usage', pick(/use-case|service\.ts|queries?\.ts|handler/)], ['Modules', pick(/\.module\.ts$/)],
    ['Migrations', pick(/prisma\/migrations\//)], ['Prisma (schéma)', pick(/prisma\/schema\.prisma$/)], ['Tests', pick(/(^|\/)test\/|\.spec\.ts$/)],
  ].filter(([, l]) => l.length).map(([title, l]) => `**${title}** (${l.length})\n\n${list(l.slice(0, 40), 'apps/crm-api/')}${l.length > 40 ? `\n- … et ${l.length - 40} autres` : ''}\n`).join('\n')
    + (sec.length ? `\n**Sécurité (fichiers concernés)** (${sec.length})\n\n${list(sec.slice(0, 30))}${sec.length > 30 ? `\n- … et ${sec.length - 30} autres` : ''}\n` : '')
    : '_Aucune évolution du backend._';

  const fe = [...allPaths].filter((p) => p.startsWith('apps/crm-web/'));
  const fpick = (re) => fe.filter((p) => re.test(p)).sort();
  const a11y = [...allPaths].filter((p) => /accessibilite|a11y/i.test(p)).length;
  const frontend = fe.length ? [
    ['Pages', fpick(/page\.tsx$/)], ['Composants', fpick(/\/components\//)], ['Bibliothèque (lib)', fpick(/\/lib\//)], ['Styles et thème', fpick(/\.css$|tailwind|postcss/)], ['Tests', fpick(/\/test\//)],
  ].filter(([, l]) => l.length).map(([title, l]) => `**${title}** (${l.length})\n\n${list(l.slice(0, 40), 'apps/crm-web/')}${l.length > 40 ? `\n- … et ${l.length - 40} autres` : ''}\n`).join('\n')
    + (a11y ? `\n**Accessibilité** : ${a11y} fichier(s) d'audit, de captures ou de protocole touché(s).\n` : '')
    : '_Aucune évolution du frontend._';

  const fixes = nonMerge.filter((c) => classify(c, perCommit.get(c.hash)).has('correctif'));
  const correctifs = fixes.length ? ['| Problème | Cause | Solution | Commit |', '|---|---|---|---|', ...fixes.map((c) => {
    const body = describeCommit(c.body);
    const cause = (body.match(/Cause\s*:\s*([^.]+\.?)/i) ?? [])[1] ?? '—', solution = (body.match(/(Solution|Correction)\s*:\s*([^.]+\.?)/i) ?? [])[2] ?? (body || '—');
    return `| ${cell(c.subject)} | ${cell(cause)} | ${cell(solution)} | ${code(c.short)} |`;
  })].join('\n') : '_Aucun correctif identifié par les messages de commit._';

  const decisions = collectDecisions(data.date);
  const commitsTable = day.length ? ['| Hash | Heure | Titre | Description | Branche |', '|---|---|---|---|---|', ...day.map((c) => `| ${code(c.short)} | ${c.time} | ${cell(c.subject)} | ${cell(describeCommit(c.body).slice(0, 220)) || '—'} | ${c.source ? code(c.source) : '—'} |`)].join('\n') : '_Aucun commit ce jour._';

  const noiseCount = {};
  const detailed = (l) => [...statuses].filter(([p, s]) => s === l).map(([p]) => p).filter((p) => { const n = isNoise(p, allPaths); if (n) noiseCount[n] = (noiseCount[n] ?? 0) + 1; return !n; }).sort();
  const files = [
    fileList('Nouveaux fichiers', detailed('A')), fileList('Fichiers modifiés', detailed('M')), fileList('Fichiers supprimés', detailed('D')),
    Object.keys(noiseCount).length ? `_Non détaillés (produits dérivés) : ${Object.entries(noiseCount).map(([k, v]) => `${v} ${k}`).join(', ')}._\n` : '',
  ].filter(Boolean).join('\n') || '_Aucun fichier touché._';

  const cats = { Ajouts: [], Modifications: [], Corrections: [], Sécurité: [] };
  for (const c of nonMerge) { const cat = changelogCategory(c, perCommit.get(c.hash)); if (cat) cats[cat].push(`- ${c.subject} (${code(c.short)})`); }
  const changelog = Object.entries(cats).map(([k, l]) => `### ${k}\n\n${l.length ? l.join('\n') : '_Aucun._'}`).join('\n\n');

  const areas = [be.length && 'backend', fe.length && 'frontend', uxFiles.length && 'interface et design', [...allPaths].some((p) => p.startsWith('docs/')) && 'documentation'].filter(Boolean);
  const draft = day.length
    ? `${DRAFT_MARK} ${day.length} commit(s) sur ${branches.length} branche(s)${sprints.length ? ` (${sprints.join(', ')})` : ''} ; domaines touchés : ${areas.join(', ') || '—'}. ${data.dayTags.length ? `Sessions validées : ${data.dayTags.map((x) => x.name).join(', ')}. ` : ''}${statuses.size} fichier(s), +${data.add}/−${data.del} lignes.`
    : `${DRAFT_MARK} Aucun commit ce jour.`;
  return { infos, stats, realisations, ux, backend, frontend, correctifs, decisions, commits: commitsTable, files, changelog, draft, sprints, authors, main };
}

/** Décisions datées du jour : registre des décisions, DDR et ADR (d'après la date écrite dans le document). */
export function collectDecisions(date) {
  const found = [];
  const reg = join(ROOT, 'docs', 'QUESTIONS-ET-DECISIONS.md');
  if (existsSync(reg)) for (const l of readFileSync(reg, 'utf8').split('\n')) {
    const m = l.match(/^\| (D\d+) \| \*\*(.+?)\*\*/);
    if (m && l.includes(date)) found.push(`- ${code(m[1])} ${m[2].replace(/\s+[—-]\s*$/, '')}`);
  }
  for (const dir of ['docs/design/decisions', 'docs/adr']) {
    const full = join(ROOT, dir);
    if (!existsSync(full)) continue;
    for (const f of readdirSync(full).filter((n) => n.endsWith('.md') && !/^(README|REGISTRE)/.test(n))) {
      const text = readFileSync(join(full, f), 'utf8');
      if (text.split('\n').slice(0, 12).join('\n').includes(date)) found.push(`- ${code(f.replace(/\.md$/, '').split('-').slice(0, 2).join('-'))} ${(text.match(/^# (.+)$/m) ?? [])[1] ?? f}`);
    }
  }
  return found.length ? found.join('\n') : '_Aucune décision datée de ce jour dans les registres._';
}

// ------------------------------------------------------------------------------------------------ génération d'un rapport
const templatePath = join(REPORTS, 'templates', 'daily-report-template.md');
export function renderReportMd(date, { existing = null, origin = 'direct', status, author, template = readFileSync(templatePath, 'utf8'), data = collectDay(date) } = {}) {
  const auto = buildAutoBlocks(data);
  const prev = existing ? parseFrontMatter(existing).data : {};
  const vars = {
    date, weekday: weekday(date), author: author ?? (auto.authors.join(', ') || gitTry('config', 'user.name') || '—'), sprint: auto.sprints.join(', ') || '—',
    version: `${data.nearest || '—'} · design ${data.designVersion || '—'}`, branch: auto.main, status: status ?? prev.status ?? 'draft', origin: prev.origin ?? origin,
    generated: `Généré le ${localDate(new Date().toISOString())} (fuseau ${TZ})`,
  };
  let md = template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
  for (const name of ['infos', 'stats', 'realisations', 'ux', 'backend', 'frontend', 'correctifs', 'decisions', 'commits', 'files', 'changelog']) md = setBlock(md, 'auto', name, auto[name]);
  for (const name of [...template.matchAll(/<!-- manual:(\w+) -->/g)].map((m) => m[1])) {
    const keep = existing ? getBlock(existing, 'manual', name) : null;
    if (keep !== null) md = setBlock(md, 'manual', name, keep);
    else if (name === 'resume') md = setBlock(md, 'manual', 'resume', auto.draft);
  }
  return md;
}
export function ensureYear(year, base = REPORTS) {
  for (let m = 0; m < 12; m++) {
    const dir = join(base, String(year), `${String(m + 1).padStart(2, '0')}-${MONTHS[m]}`);
    mkdirSync(dir, { recursive: true });
    if (!readdirSync(dir).length) writeFileSync(join(dir, '.gitkeep'), '');
  }
}
export function writeReport(date, opts = {}) {
  const paths = reportPaths(date);
  ensureYear(date.slice(0, 4));
  const existing = existsSync(paths.md) ? readFileSync(paths.md, 'utf8') : null;
  const md = renderReportMd(date, { ...opts, existing });
  writeFileSync(paths.md, md, { encoding: 'utf8' });
  return { paths, md, created: existing === null };
}
export function buildOutputs(date, { pdf = false } = {}) {
  const paths = reportPaths(date);
  const md = readFileSync(paths.md, 'utf8');
  writeFileSync(paths.html, renderHtmlPage(md), 'utf8');
  if (!pdf) return { html: true, pdf: null };
  return { html: true, pdf: htmlToPdf(paths.html, paths.pdf) };
}

// ------------------------------------------------------------------------------------------------ lecture des rapports
export function listReports(base = REPORTS) {
  const out = [];
  if (!existsSync(base)) return out;
  for (const year of readdirSync(base).filter((n) => /^\d{4}$/.test(n))) {
    for (const month of readdirSync(join(base, year))) {
      const dir = join(base, year, month);
      if (!statSync(dir).isDirectory()) continue;
      for (const f of readdirSync(dir).filter((n) => /^\d{4}-\d{2}-\d{2}\.md$/.test(n))) {
        const md = readFileSync(join(dir, f), 'utf8');
        out.push({ date: f.slice(0, 10), path: join(dir, f), md, fm: parseFrontMatter(md).data });
      }
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
export function section(md, title) {
  const m = md.match(new RegExp(`## ${title.replace(/[/()]/g, '\\$&')}\\n([\\s\\S]*?)(?=\\n## |$)`));
  return m ? m[1].replace(/<!--[\s\S]*?-->/g, '').trim() : '';
}
const meaningful = (s) => s && s !== PLACEHOLDER && !s.startsWith(DRAFT_MARK);
const stripDraft = (s) => s.replace(DRAFT_MARK, '').trim();

// ------------------------------------------------------------------------------------------------ changelog et versions
export function buildChangelog(reports) {
  const order = ['Ajouts', 'Modifications', 'Corrections', 'Sécurité'];
  const parts = ['# Changelog', '', '*Généré par `scripts/daily-report.mjs changelog` à partir de la section « Changelog du jour » de chaque rapport. Ne pas modifier ici : corrigez le rapport du jour puis régénérez.*', '', 'Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) ; les dates sont celles du fuseau du projet (' + TZ + ').', ''];
  for (const r of [...reports].reverse()) {
    const sec = section(r.md, 'Changelog du jour');
    const blocks = order.map((cat) => {
      // Toutes les occurrences de la rubrique : bloc automatique ET compléments manuels.
      const items = [...sec.matchAll(new RegExp(`### ${cat}\\n([\\s\\S]*?)(?=\\n### |$)`, 'g'))].flatMap((m) => m[1].split('\n').filter((l) => l.startsWith('- ')));
      return items.length ? `### ${cat}\n\n${items.join('\n')}\n` : '';
    }).filter(Boolean);
    if (blocks.length) parts.push(`## ${r.date}`, '', ...blocks);
  }
  return parts.join('\n').trimEnd() + '\n';
}
export function buildReleases(tags) {
  const kind = (n) => (/^design-v/.test(n) ? 'Design' : /-validated$/.test(n) ? 'Session validée' : 'Autre');
  const rows = [...tags].sort((a, b) => b.day.localeCompare(a.day) || b.name.localeCompare(a.name)).map((t) => `| ${code(t.name)} | ${t.day} | ${kind(t.name)} | ${code(t.commit.slice(0, 7))} | ${cell(t.subject)} |`);
  return ['# Versions et sessions validées', '', '*Généré par `scripts/daily-report.mjs changelog` à partir des étiquettes Git. Une étiquette `…-validated` est posée après l\'accord explicite de la direction produit.*', '', '| Étiquette | Date | Type | Commit | Description |', '|---|---|---|---|---|', ...rows, ''].join('\n');
}

/** Écrit CHANGELOG.md, RELEASES.md et leurs pages HTML. */
export function writeChangelog(reports, tags = loadTags()) {
  const dir = join(REPORTS, 'changelog');
  mkdirSync(dir, { recursive: true });
  for (const [name, md] of [['CHANGELOG', buildChangelog(reports)], ['RELEASES', buildReleases(tags)]]) {
    writeFileSync(join(dir, `${name}.md`), md, 'utf8');
    writeFileSync(join(dir, `${name}.html`), renderHtmlPage(md, { kind: name === 'CHANGELOG' ? 'Changelog' : 'Versions' }), 'utf8');
  }
}

// ------------------------------------------------------------------------------------------------ tableaux de bord
function techDebt() {
  const f = join(ROOT, 'docs', 'TECH-DEBT.md');
  if (!existsSync(f)) return { total: 0, blocking: 0 };
  const rows = readFileSync(f, 'utf8').split('\n').filter((l) => /^\| D\d+ /.test(l));
  return { total: rows.length, blocking: rows.filter((l) => /bloquant/i.test(l)).length };
}
function openDecisions() {
  const f = join(ROOT, 'docs', 'QUESTIONS-ET-DECISIONS.md');
  if (!existsSync(f)) return 0;
  const m = readFileSync(f, 'utf8').match(/## D\. Questions encore ouvertes[\s\S]*?(?=\n## )/);
  return m ? m[0].split('\n').filter((l) => /^\| D\d+ /.test(l)).length : 0;
}
function openBranches(commits) {
  const merged = new Set(gitTry('branch', '--merged', 'main', '--format=%(refname:short)').split('\n'));
  return gitTry('for-each-ref', '--format=%(refname:short)%09%(committerdate:iso-strict)', 'refs/heads').split('\n').filter(Boolean).map((l) => l.split('\t'))
    .filter(([n]) => n !== 'main' && !merged.has(n)).map(([n, d]) => ({ name: n, day: localDate(d) }));
}
function sessionLeadTimes() {
  const merges = gitTry('log', '--first-parent', '--merges', '--format=%H%x09%aI%x09%s', 'main').split('\n').filter(Boolean).map((l) => l.split('\t'));
  const out = [];
  for (const [hash, date, subject] of merges) {
    const first = gitTry('log', '--format=%aI', `${hash}^1..${hash}^2`).split('\n').filter(Boolean).pop();
    if (first) out.push({ subject, days: Math.max(0, (new Date(date) - new Date(first)) / 86400000) });
  }
  return out;
}
const sum = (a) => a.reduce((x, y) => x + y, 0);
function periodStats(reports, commits, from, to) {
  const days = reports.filter((r) => r.date >= from && r.date <= to);
  const cs = commits.filter((c) => c.day >= from && c.day <= to);
  let add = 0, del = 0, files = new Set();
  for (const c of cs.filter((x) => !isMerge(x))) { const n = commitNumstat(c); add += n.add; del += n.del; for (const f of commitFiles(c)) files.add(f.path); }
  return { days, cs, add, del, files: files.size, activeDays: new Set(cs.map((c) => c.day)).size };
}
export function buildWeekly(week, reports, commits, tags, existing = null) {
  const { from, to } = weekRange(week);
  const s = periodStats(reports, commits, from, to);
  const tagsIn = tags.filter((t) => t.day >= from && t.day <= to && /-validated$/.test(t.name));
  const highlights = s.days.map((r) => ({ date: r.date, text: stripDraft(section(r.md, 'Résumé exécutif')) })).filter((x) => x.text);
  const risks = s.days.map((r) => ({ date: r.date, text: section(r.md, 'Risques / Points bloquants') })).filter((x) => meaningful(x.text));
  const last = s.days[s.days.length - 1];
  const md = [`# Synthèse hebdomadaire ${week}`, '', `*Du ${from} au ${to} · généré par \`scripts/daily-report.mjs summary\`.*`, '',
    '## Réalisations majeures', '', ...(tagsIn.length ? tagsIn.map((t) => `- ${code(t.name)} (${t.day}) : ${t.subject}`) : ['_Aucune session validée cette semaine._']), '',
    ...(highlights.length ? ['**Résumés quotidiens**', '', ...highlights.map((h) => `- ${h.date} : ${h.text.replace(/\n+/g, ' ')}`), ''] : []),
    '## Indicateurs de développement', '', '| Indicateur | Valeur |', '|---|---|',
    `| Jours actifs | ${s.activeDays} |`, `| Commits | ${s.cs.length} (dont ${s.cs.filter(isMerge).length} fusion(s)) |`, `| Fichiers distincts touchés | ${s.files} |`, `| Lignes | +${s.add} / −${s.del} |`,
    `| Sessions validées | ${tagsIn.length} |`, `| Rapports journaliers | ${s.days.length} |`, '',
    '## Fonctionnalités terminées', '', ...(tagsIn.length ? tagsIn.map((t) => `- ${t.subject} (${code(t.name)})`) : ['_Aucune._']), '',
    '## En cours', '', ...(openBranches(commits).length ? openBranches(commits).map((b) => `- ${code(b.name)} (dernière activité ${b.day})`) : ['_Aucune branche ouverte non fusionnée._']), '',
    '## Risques', '', ...(risks.length ? risks.map((r) => `**${r.date}**\n\n${r.text}\n`) : ['_Aucun risque consigné dans les rapports de la semaine._']), '',
    '## Prochaines actions', '', last && meaningful(section(last.md, 'Actions du lendemain')) ? section(last.md, 'Actions du lendemain') : '_À compléter dans le dernier rapport de la semaine._', ''].join('\n');
  return md;
}
export function buildMonthly(month, reports, commits, tags) {
  const from = `${month}-01`, to = `${month}-31`;
  const s = periodStats(reports, commits, from, to);
  const tagsIn = tags.filter((t) => t.day >= from && t.day <= to && /-validated$/.test(t.name));
  const debt = techDebt();
  const lead = sessionLeadTimes();
  const authors = {};
  for (const c of s.cs) authors[c.author] = (authors[c.author] ?? 0) + 1;
  const weeks = [...new Set(s.cs.map((c) => isoWeek(c.day)))].sort();
  const perWeek = weeks.map((w) => { const r = weekRange(w); const cs = s.cs.filter((c) => c.day >= r.from && c.day <= r.to); return `| ${w} | ${new Set(cs.map((c) => c.day)).size} | ${cs.length} | ${tags.filter((t) => t.day >= r.from && t.day <= r.to && /-validated$/.test(t.name)).length} |`; });
  const allValidated = tags.filter((t) => /-validated$/.test(t.name)).length;
  const avg = lead.length ? (sum(lead.map((l) => l.days)) / lead.length).toFixed(1) : '—';
  const [y, m] = month.split('-').map(Number);
  return [`# Synthèse mensuelle ${MONTHS[m - 1]} ${y}`, '', `*Généré par \`scripts/daily-report.mjs summary\`. Les blocs « manuel » sont conservés.*`, '',
    '## Synthèse exécutive', '', '<!-- manual:synthese -->', PLACEHOLDER, '<!-- /manual:synthese -->', '',
    '## Progression globale', '', `- Sessions validées ce mois : **${tagsIn.length}** (cumul depuis le début : **${allValidated}**)`, ...tagsIn.map((t) => `  - ${code(t.name)} (${t.day}) : ${t.subject}`), `- Rapports journaliers : ${s.days.length} · jours actifs : ${s.activeDays}`, '',
    '| Semaine | Jours actifs | Commits | Sessions validées |', '|---|---|---|---|', ...(perWeek.length ? perWeek : ['| — | 0 | 0 | 0 |']), '',
    '## Indicateurs', '', '| Indicateur | Valeur |', '|---|---|', `| Commits | ${s.cs.length} |`, `| Fichiers distincts touchés | ${s.files} |`, `| Lignes | +${s.add} / −${s.del} |`, `| Commits par jour actif | ${s.activeDays ? (s.cs.length / s.activeDays).toFixed(1) : '—'} |`, '',
    '## Dette technique', '', `- Éléments suivis dans \`docs/TECH-DEBT.md\` : **${debt.total}** dont **${debt.blocking}** mentionnant une condition bloquante.`, '- Détail, échéances et responsables : [docs/TECH-DEBT.md](../../TECH-DEBT.md).', '',
    '## Performances de l\'équipe', '', '| Auteur | Commits |', '|---|---|', ...(Object.keys(authors).length ? Object.entries(authors).sort((a, b) => b[1] - a[1]).map(([a, n]) => `| ${a} | ${n} |`) : ['| — | 0 |']), '',
    `- Délai moyen d'une session (premier commit de la branche → fusion dans \`main\`) : **${avg} jour(s)** sur ${lead.length} fusion(s) mesurée(s).`, '',
    '## Roadmap', '', '- État d\'avancement et prochaines sessions : [docs/livrables/05-ETAT-D-AVANCEMENT.md](../../livrables/05-ETAT-D-AVANCEMENT.md) et [suivi des sessions](../../livrables/04-SUIVI-DES-SESSIONS.md).', ...(openBranches(commits).length ? ['- Branches en cours :', ...openBranches(commits).map((b) => `  - ${code(b.name)} (dernière activité ${b.day})`)] : []), ''].join('\n');
}
export function buildHealth(reports, commits, tags) {
  const debt = techDebt();
  const branches = openBranches(commits);
  const lastReport = reports[reports.length - 1];
  const ci = gitTry('config', '--get', 'remote.origin.url') ? 'voir l\'onglet Actions du dépôt' : 'aucun dépôt distant';
  return ['# Santé du projet', '', `*Généré par \`scripts/daily-report.mjs summary\` le ${today()}. Les blocs « manuel » sont conservés.*`, '',
    '| Indicateur | Valeur |', '|---|---|',
    `| Dernier rapport journalier | ${lastReport ? lastReport.date : '—'} |`,
    `| Sessions validées (étiquettes \`…-validated\`) | ${tags.filter((t) => /-validated$/.test(t.name)).length} |`,
    `| Versions du design (étiquettes \`design-v…\`) | ${tags.filter((t) => /^design-v/.test(t.name)).length} |`,
    `| Dernière étiquette | ${tags.length ? code(tags[tags.length - 1].name) : '—'} |`,
    `| Branches non fusionnées | ${branches.length} |`,
    `| Dette technique suivie | ${debt.total} (dont ${debt.blocking} bloquante(s) pour la production) |`,
    `| Questions de décision encore ouvertes | ${openDecisions()} |`,
    `| Intégration continue | ${ci} |`, '',
    '## Branches non fusionnées', '', ...(branches.length ? branches.map((b) => `- ${code(b.name)} (dernière activité ${b.day})`) : ['_Aucune._']), '',
    '## Points d\'attention', '', '<!-- manual:attention -->', PLACEHOLDER, '<!-- /manual:attention -->', ''].join('\n');
}
function writePreserving(path, md) {
  let out = md;
  if (existsSync(path)) {
    const old = readFileSync(path, 'utf8');
    for (const name of [...md.matchAll(/<!-- manual:(\w+) -->/g)].map((m) => m[1])) { const keep = getBlock(old, 'manual', name); if (keep !== null) out = setBlock(out, 'manual', name, keep); }
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, out, 'utf8');
}
export function writeSummaries(date, { html = true } = {}) {
  const commits = loadCommits(), tags = loadTags(), reports = listReports();
  const week = isoWeek(date), month = date.slice(0, 7);
  const dash = join(REPORTS, 'dashboards');
  const weekly = buildWeekly(week, reports, commits, tags);
  const monthly = buildMonthly(month, reports, commits, tags);
  const health = buildHealth(reports, commits, tags);
  const files = [[join(dash, 'weekly', `${week}.md`), weekly], [join(dash, 'weekly-summary.md'), weekly], [join(dash, 'monthly', `${month}.md`), monthly], [join(dash, 'monthly-summary.md'), monthly], [join(dash, 'project-health.md'), health]];
  for (const [p, md] of files) { writePreserving(p, md); if (html) writeFileSync(p.replace(/\.md$/, '.html'), renderHtmlPage(readFileSync(p, 'utf8'), { kind: 'Tableau de bord' }), 'utf8'); }
  return files.map(([p]) => p);
}

// ------------------------------------------------------------------------------------------------ contrôle
export function checkReports(reports, { final = false } = {}) {
  const problems = [];
  for (const r of reports) {
    const fm = r.fm;
    if (fm.date !== r.date) problems.push(`${r.date} : la date de l'en-tête (« ${fm.date} ») ne correspond pas au nom du fichier`);
    for (const k of ['author', 'sprint', 'version', 'branch', 'status']) if (!fm[k]) problems.push(`${r.date} : champ « ${k} » manquant`);
    if (!/^(draft|final)$/.test(fm.status ?? '')) problems.push(`${r.date} : statut « ${fm.status} » invalide (draft ou final)`);
    if (/@[\w-]+\.\w/.test(r.md.replace(/\[.*?\]\(.*?\)/g, ''))) problems.push(`${r.date} : une adresse e-mail figure dans le rapport (à retirer)`);
    for (const required of ['Résumé exécutif', 'Réalisations', 'Commits Git', 'Fichiers modifiés', 'Risques / Points bloquants', 'Actions du lendemain']) if (!r.md.includes(`## ${required}`)) problems.push(`${r.date} : section « ${required} » absente`);
    if ((final || fm.status === 'final') && (r.md.includes(PLACEHOLDER) || r.md.includes(DRAFT_MARK))) problems.push(`${r.date} : statut final mais des sections restent à compléter`);
  }
  return problems;
}

// ------------------------------------------------------------------------------------------------ gabarits HTML et PDF
export function renderTemplates() {
  const dir = join(REPORTS, 'templates');
  const md = readFileSync(templatePath, 'utf8');
  const sample = md.replace(/\{\{(\w+)\}\}/g, (_, k) => `⟨${k}⟩`);
  const html = renderHtmlPage(sample, { kind: 'Gabarit de rapport journalier' });
  writeFileSync(join(dir, 'daily-report-template.html'), html, 'utf8');
  return htmlToPdf(join(dir, 'daily-report-template.html'), join(dir, 'daily-report-template.pdf'));
}

// ------------------------------------------------------------------------------------------------ ligne de commande
const HELP = `Rapports journaliers Investally

  node scripts/daily-report.mjs new [--date AAAA-MM-JJ] [--author "Nom"] [--final]   crée ou rafraîchit le rapport (blocs manuels conservés)
  node scripts/daily-report.mjs build [--date D | --all] [--pdf]                     produit le HTML (et le PDF) depuis le Markdown
  node scripts/daily-report.mjs close [--date D] [--final] [--no-pdf]                new + build + changelog + tableaux de bord (fin de journée)
  node scripts/daily-report.mjs backfill --from D --to D [--no-pdf]                  reconstitue les jours passés ayant des commits
  node scripts/daily-report.mjs changelog                                            régénère CHANGELOG.md et RELEASES.md
  node scripts/daily-report.mjs summary [--date D]                                   synthèses hebdomadaire, mensuelle et santé du projet
  node scripts/daily-report.mjs templates                                            régénère les gabarits HTML et PDF
  node scripts/daily-report.mjs check [--final]                                      contrôle les rapports (en-tête, sections, brouillons, e-mails)

Date par défaut : aujourd'hui (fuseau ${TZ}).`;

function arg(name, fallback) { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : fallback; }
const flag = (name) => process.argv.includes(`--${name}`);
function report(date, { pdf, origin, final }) {
  const { paths, created } = writeReport(date, { origin, ...(final ? { status: 'final' } : {}), author: arg('author') });
  const out = buildOutputs(date, { pdf });
  console.log(`${created ? '✔ créé' : '↻ rafraîchi'} ${paths.md.replace(ROOT + '\\', '').replace(ROOT + '/', '')}${out.pdf ? (out.pdf.ok ? ' + HTML + PDF' : ` + HTML (PDF non produit : ${out.pdf.reason})`) : ' + HTML'}`);
}
function main() {
  const cmd = process.argv[2];
  const date = arg('date', today());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Date invalide : ${date}`);
  switch (cmd) {
    case 'new': { const { paths, created } = writeReport(date, { status: flag('final') ? 'final' : undefined, author: arg('author') }); console.log(`${created ? '✔ créé' : '↻ rafraîchi'} ${paths.md}`); break; }
    case 'build': {
      const dates = flag('all') ? listReports().map((r) => r.date) : [date];
      for (const d of dates) { const o = buildOutputs(d, { pdf: flag('pdf') }); console.log(`✔ ${d} HTML${o.pdf ? (o.pdf.ok ? ' + PDF' : ` (PDF : ${o.pdf.reason})`) : ''}`); }
      break;
    }
    case 'close': {
      report(date, { pdf: !flag('no-pdf'), origin: 'direct', final: flag('final') });
      const reports = listReports();
      writeChangelog(reports);
      writeSummaries(date);
      console.log('✔ changelog, versions et tableaux de bord à jour');
      break;
    }
    case 'backfill': {
      const from = arg('from'), to = arg('to', today());
      if (!from) throw new Error('--from est obligatoire');
      const days = [...new Set(loadCommits().map((c) => c.day))].filter((d) => d >= from && d <= to).sort();
      for (const d of days) report(d, { pdf: !flag('no-pdf'), origin: 'reconstitué depuis Git', final: false });
      break;
    }
    case 'changelog':
      writeChangelog(listReports());
      console.log('✔ CHANGELOG.md et RELEASES.md');
      break;
    case 'summary': for (const p of writeSummaries(date)) console.log(`✔ ${p.replace(ROOT, '')}`); break;
    case 'templates': { const r = renderTemplates(); console.log(r.ok ? '✔ gabarits HTML et PDF' : `✔ gabarit HTML (PDF : ${r.reason})`); break; }
    case 'check': {
      const problems = checkReports(listReports(), { final: flag('final') });
      problems.forEach((p) => console.log(`✘ ${p}`));
      console.log(problems.length ? `${problems.length} problème(s)` : `✔ ${listReports().length} rapport(s) conforme(s)`);
      process.exitCode = problems.length ? 1 : 0;
      break;
    }
    default: console.log(HELP);
  }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) main();
