// Générateur des diagrammes de workflows (couloirs par acteur) : lit `flows.mjs`, écrit un SVG par flux dans `svg/`,
// la galerie `index.html` et le catalogue `CATALOGUE.md`.
//
//   node docs/workflows/build.mjs
//
// Lecture : un couloir par acteur (de haut en bas), le temps de gauche à droite. Forme = type d'étape ; remplissage gris =
// étape déjà réalisée dans l'application, blanc = à venir ; pastille orange = règle ou point ouvert (liste sous le schéma).
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FLOWS as TRANSVERSES } from './flows.mjs';
import { FLOWS_COMMERCIAL } from './flows-commercial.mjs';

const FLOWS = [...TRANSVERSES, ...FLOWS_COMMERCIAL];

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, 'svg');
const COLW = 178, LANE_H = 128, LABEL_W = 156, TOP = 84;
const C = { ink: '#262626', mid: '#6b6b6b', soft: '#9a9a9a', line: '#c9c9c9', fill: '#f3f3f3', built: '#e2e2e2', dark: '#2f2c2a', note: '#b3541e', ok: '#2e7d32' };

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const wrap = (text, max) => {
  const lines = [];
  let line = '';
  for (const word of String(text).split(/\s+/)) {
    if ((line + ' ' + word).trim().length > max) { if (line) lines.push(line); line = word; } else line = (line + ' ' + word).trim();
  }
  if (line) lines.push(line);
  return lines;
};
const text = (x, y, s, o = {}) => `<text x="${x}" y="${y}" font-size="${o.size ?? 12}" font-weight="${o.weight ?? 400}" fill="${o.fill ?? C.ink}" text-anchor="${o.anchor ?? 'start'}"${o.style ? ` font-style="${o.style}"` : ''}>${esc(s)}</text>`;

const SIZE = { task: [146, 60], event: [146, 60], external: [146, 60], decision: [156, 92], start: [30, 30], end: [30, 30] };

function render(flow) {
  const n = flow.lanes.length;
  const ncols = Math.max(...flow.steps.map((s) => s.col)) + 1;
  const W = LABEL_W + 30 + ncols * COLW + 30;
  const laneBottom = TOP + n * LANE_H;
  const pos = {};
  const notes = [];
  for (const s of flow.steps) {
    const li = flow.lanes.indexOf(s.lane);
    if (li < 0) throw new Error(`${flow.id} : couloir inconnu « ${s.lane} » (étape ${s.id})`);
    const [w, h] = SIZE[s.kind ?? 'task'];
    pos[s.id] = { x: LABEL_W + 30 + s.col * COLW + COLW / 2, y: TOP + li * LANE_H + LANE_H / 2, w, h, s };
  }
  let body = '';
  // Couloirs.
  flow.lanes.forEach((lane, i) => {
    const y = TOP + i * LANE_H;
    body += `<rect x="0" y="${y}" width="${W}" height="${LANE_H}" fill="${i % 2 ? '#fafafa' : '#f3f3f3'}" stroke="${C.line}"/>`;
    body += `<rect x="0" y="${y}" width="${LABEL_W}" height="${LANE_H}" fill="#e9e9e9" stroke="${C.line}"/>`;
    const lines = wrap(lane, 16);
    lines.forEach((l, k) => { body += text(LABEL_W / 2, y + LANE_H / 2 + 4 + (k - (lines.length - 1) / 2) * 15, l, { size: 12, weight: 700, anchor: 'middle' }); });
  });
  // Flèches (sous les formes).
  let edges = '', labels = '';
  for (const s of flow.steps) {
    const a = pos[s.id];
    for (const e of s.next ?? []) {
      const b = pos[e.to];
      if (!b) throw new Error(`${flow.id} : étape inconnue « ${e.to} » (depuis ${s.id})`);
      let pts;
      if (e.exit === 'bottom' || (a.s.col === b.s.col && b.y !== a.y)) {
        // Sortie verticale d'abord : vers le bas ou vers le haut selon la position de la cible.
        const down = b.y > a.y;
        const sy = down ? a.y + a.h / 2 : a.y - a.h / 2;
        pts = a.s.col !== b.s.col ? [[a.x, sy], [a.x, b.y], [b.x - b.w / 2, b.y]] : [[a.x, sy], [b.x, down ? b.y - b.h / 2 : b.y + b.h / 2]];
      } else if (Math.abs(a.y - b.y) < 2) {
        pts = [[a.x + a.w / 2, a.y], [b.x - b.w / 2, b.y]];
      } else {
        const mx = a.x + a.w / 2 + (b.x - b.w / 2 - (a.x + a.w / 2)) / 2;
        pts = [[a.x + a.w / 2, a.y], [mx, a.y], [mx, b.y], [b.x - b.w / 2, b.y]];
      }
      edges += `<polyline points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="${C.mid}" stroke-width="1.6" marker-end="url(#arrow)"${e.dashed ? ' stroke-dasharray="5 4"' : ''}/>`;
      if (e.label) {
        const [x0, y0] = pts[0], [x1, y1] = pts[1];
        const vertical = Math.abs(x1 - x0) < 2;
        const up = vertical && y1 < y0;
        labels += `<text x="${x0 + 8}" y="${vertical ? (up ? y0 - 8 : y0 + 16) : y0 - 6}" font-size="11" font-weight="700" fill="${C.dark}" stroke="#fff" stroke-width="3" paint-order="stroke">${esc(e.label)}</text>`;
      }
    }
  }
  // Formes.
  let shapes = '';
  for (const id of Object.keys(pos)) {
    const { x, y, w, h, s } = pos[id];
    const kind = s.kind ?? 'task';
    const fill = s.built ? C.built : '#fff';
    if (kind === 'start' || kind === 'end') {
      shapes += `<circle cx="${x}" cy="${y}" r="${w / 2}" fill="${kind === 'end' ? C.dark : '#fff'}" stroke="${C.dark}" stroke-width="2"/>`;
      if (s.label) shapes += text(x, y + w / 2 + 16, s.label, { size: 11, anchor: 'middle', weight: 600 });
    } else {
      if (kind === 'decision') shapes += `<polygon points="${x},${y - h / 2} ${x + w / 2},${y} ${x},${y + h / 2} ${x - w / 2},${y}" fill="${fill}" stroke="${C.dark}" stroke-width="1.6"/>`;
      else shapes += `<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="${kind === 'event' ? 28 : 9}" fill="${fill}" stroke="${C.dark}" stroke-width="1.6"${kind === 'external' ? ' stroke-dasharray="6 4"' : ''}/>`;
      const lines = wrap(s.label, kind === 'decision' ? 17 : 23);
      const lh = 13.5;
      lines.forEach((l, k) => { shapes += text(x, y + 4 + (k - (lines.length - 1) / 2) * lh, l, { size: 11.5, anchor: 'middle', weight: kind === 'decision' ? 600 : 500 }); });
      if (kind === 'event') shapes += text(x - w / 2 + 14, y - h / 2 + 4, '⚡', { size: 12, anchor: 'middle' });
    }
    if (s.note) {
      const k = notes.push(s.note);
      shapes += `<circle cx="${x + w / 2 - 2}" cy="${y - h / 2 + 2}" r="10" fill="${C.note}"/>` + text(x + w / 2 - 2, y - h / 2 + 6, k, { size: 10, weight: 700, anchor: 'middle', fill: '#fff' });
    }
  }
  // Légende des formes + notes sous le schéma.
  let y = laneBottom + 28;
  let foot = '';
  foot += `<rect x="20" y="${y - 14}" width="24" height="16" rx="5" fill="${C.built}" stroke="${C.dark}"/>` + text(52, y - 2, 'Déjà réalisé dans l’application', { size: 11 });
  foot += `<rect x="260" y="${y - 14}" width="24" height="16" rx="5" fill="#fff" stroke="${C.dark}"/>` + text(292, y - 2, 'À venir', { size: 11 });
  foot += `<rect x="360" y="${y - 14}" width="24" height="16" rx="5" fill="#fff" stroke="${C.dark}" stroke-dasharray="5 3"/>` + text(392, y - 2, 'Acteur ou action externe', { size: 11 });
  foot += `<rect x="560" y="${y - 14}" width="26" height="16" rx="8" fill="#fff" stroke="${C.dark}"/>` + text(594, y - 2, '⚡ Événement automatique', { size: 11 });
  foot += `<polygon points="770,${y - 14} 784,${y - 6} 770,${y + 2} 756,${y - 6}" fill="#fff" stroke="${C.dark}"/>` + text(796, y - 2, 'Décision', { size: 11 });
  y += 30;
  const sections = [['Règles', flow.rules], ['Points à trancher', flow.questions]].filter(([, v]) => v?.length);
  notes.forEach((note, i) => {
    foot += `<circle cx="32" cy="${y - 4}" r="10" fill="${C.note}"/>` + text(32, y, i + 1, { size: 10, weight: 700, anchor: 'middle', fill: '#fff' });
    const lines = wrap(note, 150);
    lines.forEach((l, k) => { foot += text(52, y + k * 15, l, { size: 12 }); });
    y += Math.max(lines.length * 15, 15) + 8;
  });
  for (const [name, items] of sections) {
    y += 10;
    foot += text(20, y, name, { size: 13, weight: 700 });
    y += 20;
    for (const it of items) {
      const lines = wrap(`• ${it}`, 160);
      lines.forEach((l, k) => { foot += text(26, y + k * 15, l, { size: 12, fill: C.ink }); });
      y += lines.length * 15 + 4;
    }
  }
  const H = y + 30;
  const header = text(20, 32, flow.title, { size: 21, weight: 700 }) + text(20, 54, flow.sub, { size: 12, fill: C.mid }) + text(W - 20, 32, `${flow.id} · ${flow.status}`, { size: 12, weight: 700, anchor: 'end', fill: flow.status === 'Réalisé' ? C.ok : C.note });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="system-ui, 'Segoe UI', Roboto, Arial, sans-serif" role="img" aria-label="${esc(`Workflow : ${flow.title}`)}">
<title>${esc(`${flow.id} — ${flow.title}`)}</title>
<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${C.mid}"/></marker></defs>
<rect width="${W}" height="${H}" fill="#ffffff"/>
${header}
${body}
${edges}
${shapes}
${labels}
${foot}
</svg>`;
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const rows = FLOWS.map((flow) => {
  const file = `${flow.id}-${flow.slug}.svg`;
  writeFileSync(join(OUT, file), render(flow));
  return { ...flow, file };
});

writeFileSync(join(here, 'index.html'), `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Workflows — Investally Business Platform</title>
<style>
:root{--ink:#262626;--mid:#6b6b6b;--line:#d6d2cc;--taupe:#f3efea;--dark:#2f2c2a}
body{margin:0;font:15px/1.5 system-ui,'Segoe UI',Roboto,sans-serif;color:var(--ink);background:var(--taupe)}
header{padding:28px 32px 12px}h1{margin:0 0 4px;font-size:26px}p{margin:0;color:var(--mid)}
main{padding:8px 32px 40px;display:grid;gap:26px}
section{background:#fff;border:1px solid var(--line);border-radius:12px;padding:16px;overflow:auto}
h2{margin:0 0 4px;font-size:18px}.tag{display:inline-block;margin-left:8px;padding:1px 10px;border-radius:999px;border:1px solid;font-size:11px;font-weight:700}
.tag.r{color:#2e7d32}.tag.p{color:#b3541e}img{display:block;max-width:none;margin-top:10px}
</style></head><body>
<header><h1>Workflows</h1><p>${rows.length} flux : transverses (F) et module commercial (C). Un couloir par acteur, le temps de gauche à droite. Cas d'usage : <a href="../CAS-D-USAGE-FLUX-TRANSVERSES.html">flux transverses</a> et <a href="../CAS-D-USAGE-MODULE-COMMERCIAL.html">module commercial</a>.</p></header>
<main>${rows.map((r) => `<section><h2>${esc(r.id)} · ${esc(r.title)}<span class="tag ${r.status === 'Réalisé' ? 'r' : 'p'}">${esc(r.status.toUpperCase())}</span></h2><p>${esc(r.sub)}</p><img src="svg/${r.file}" alt="Workflow : ${esc(r.title)}"></section>`).join('')}</main>
</body></html>`);

writeFileSync(join(here, 'CATALOGUE.md'), `# Catalogue des workflows

*Généré par \`build.mjs\` à partir de \`flows.mjs\` : ne pas modifier à la main. Ouvrir \`index.html\` pour voir tous les schémas.*

| Flux | Titre | État | Acteurs |
|---|---|---|---|
${rows.map((r) => `| ${r.id} | [${r.title}](svg/${r.file}) | ${r.status} | ${r.lanes.join(', ')} |`).join('\n')}
`);
console.log(`✔ ${rows.length} workflows écrits dans ${OUT}`);
