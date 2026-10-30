// Générateur des wireframes : lit `screens.mjs` (description de chaque écran) et écrit un SVG par écran dans `svg/`,
// la galerie `index.html` et le catalogue `CATALOGUE.md`.
//
//   node docs/design/wireframe/build.mjs
//
// Les wireframes sont volontairement en niveaux de gris (structure, contenu, droits, états), pas en couleurs : le style
// est celui du design validé (v0.4.1). Les pastilles numérotées renvoient aux annotations du panneau de droite.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCREENS, MODULES } from './screens.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, 'svg');
const W = 1500, SIDE = 76, TOP = 56, LEG = 300, MAIN_W = W - LEG;
const C = { ink: '#262626', mid: '#6b6b6b', soft: '#9a9a9a', line: '#c9c9c9', fill: '#f3f3f3', fill2: '#e4e4e4', dark: '#2f2c2a', note: '#b3541e', ok: '#2e7d32', warn: '#9a6a00' };

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const wrap = (text, max) => {
  const lines = [];
  let line = '';
  for (const word of String(text).split(/\s+/)) {
    if ((line + ' ' + word).trim().length > max) { lines.push(line); line = word; } else line = (line + ' ' + word).trim();
  }
  if (line) lines.push(line);
  return lines;
};

const rect = (x, y, w, h, o = {}) => `<rect x="${x}" y="${y}" width="${Math.max(w, 0)}" height="${h}" rx="${o.r ?? 6}" fill="${o.fill ?? 'none'}" stroke="${o.stroke ?? 'none'}"${o.dash ? ' stroke-dasharray="5 4"' : ''}${o.sw ? ` stroke-width="${o.sw}"` : ''}/>`;
const text = (x, y, s, o = {}) => `<text x="${x}" y="${y}" font-size="${o.size ?? 12}" font-weight="${o.weight ?? 400}" fill="${o.fill ?? C.ink}" text-anchor="${o.anchor ?? 'start'}">${esc(s)}</text>`;
const hline = (x1, y, x2, color = C.line) => `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${color}"/>`;
const clip = (s, max) => (String(s).length > max ? `${String(s).slice(0, Math.max(max - 1, 1))}…` : String(s));
const chars = (w, size = 12) => Math.floor(w / (size * 0.56));

const button = (x, y, label, primary = false) => {
  const w = Math.max(label.length * 7.4 + 28, 70);
  return { w, svg: rect(x, y, w, 32, { r: 7, fill: primary ? C.dark : '#fff', stroke: primary ? C.dark : C.mid }) + text(x + w / 2, y + 21, label, { anchor: 'middle', size: 12, weight: 600, fill: primary ? '#fff' : C.ink }) };
};
const field = (x, y, w, label, type = 'text') => {
  const req = /\*$/.test(label);
  if (type === 'check') return { h: 24, svg: rect(x, y + 4, 14, 14, { r: 3, fill: '#fff', stroke: C.mid }) + text(x + 22, y + 16, label, { size: 12 }) };
  const h = type === 'area' ? 72 : 34, ty = y + 18 + (type === 'area' ? 22 : 22);
  const inner = { select: text(x + w - 18, ty, '▾', { size: 11, fill: C.mid }), money: text(x + w - 12, ty, 'FCFA', { size: 11, fill: C.mid, anchor: 'end' }), date: text(x + w - 12, ty, '▦', { size: 12, fill: C.mid, anchor: 'end' }), file: text(x + 12, ty, 'Choisir un fichier…', { size: 11, fill: C.soft }), search: text(x + 12, ty, 'Rechercher…', { size: 11, fill: C.soft }) }[type] ?? '';
  return { h: h + 22, svg: text(x, y + 12, label.replace(/\*$/, ''), { size: 11, weight: 600, fill: C.mid }) + (req ? text(x + (label.length - 1) * 5.9 + 4, y + 12, '*', { size: 11, fill: C.note }) : '') + rect(x, y + 18, w, h, { r: 6, fill: '#fff', stroke: C.line }) + inner };
};

/** Chaque bloc renvoie { svg, h } ; `ctx.notes` collecte les annotations numérotées. */
const BLOCKS = {
  title(b, x, y, w) {
    let svg = text(x, y + 28, b.text, { size: 24, weight: 700 }) + (b.sub ? text(x, y + 50, b.sub, { size: 12, fill: C.mid }) : '');
    let bx = x + w;
    const actions = b.actions ?? [];
    for (let i = actions.length - 1; i >= 0; i--) {
      const primary = i === actions.length - 1 && b.primary !== false;
      const btn = button(0, y + 6, actions[i], primary);
      bx -= btn.w;
      svg += button(bx, y + 6, actions[i], primary).svg;
      bx -= 10;
    }
    return { svg, h: b.sub ? 66 : 48 };
  },
  tabs(b, x, y, w) {
    let svg = hline(x, y + 36, x + w);
    let tx = x;
    b.items.forEach((item, i) => {
      const tw = item.length * 7.6 + 30;
      svg += text(tx + 14, y + 24, item, { size: 12, weight: i === (b.active ?? 0) ? 700 : 400, fill: i === (b.active ?? 0) ? C.ink : C.mid });
      if (i === (b.active ?? 0)) svg += `<rect x="${tx}" y="${y + 34}" width="${tw}" height="3" fill="${C.dark}"/>`;
      tx += tw;
    });
    return { svg, h: 48 };
  },
  kpis(b, x, y, w) {
    const n = b.items.length, gap = 14, cw = (w - gap * (n - 1)) / n;
    return {
      svg: b.items.map(([label, value, hint], i) => rect(x + i * (cw + gap), y, cw, 88, { r: 10, fill: '#fff', stroke: C.line }) + text(x + i * (cw + gap) + 16, y + 26, label, { size: 11, fill: C.mid }) + text(x + i * (cw + gap) + 16, y + 58, value, { size: 24, weight: 700 }) + (hint ? text(x + i * (cw + gap) + 16, y + 78, hint, { size: 10, fill: C.soft }) : '')).join(''),
      h: 88,
    };
  },
  table(b, x, y, w) {
    const cols = b.cols, rows = b.rows ?? [], n = cols.length;
    const weights = b.widths ?? cols.map(() => 1), total = weights.reduce((a, c) => a + c, 0);
    const xs = []; let acc = x + 14;
    weights.forEach((wt) => { xs.push(acc); acc += ((w - 28) * wt) / total; });
    let svg = '', cy = y;
    if (b.toolbar !== false) {
      svg += rect(x, cy, Math.min(300, w * 0.4), 32, { r: 16, fill: '#fff', stroke: C.line }) + text(x + 16, cy + 21, 'Rechercher…', { size: 11, fill: C.soft });
      let fx = x + Math.min(300, w * 0.4) + 12;
      for (const f of b.filters ?? []) { const fw = f.length * 7 + 28; svg += rect(fx, cy, fw, 32, { r: 16, fill: '#fff', stroke: C.line }) + text(fx + 14, cy + 21, `${f} ▾`, { size: 11, fill: C.mid }); fx += fw + 8; }
      svg += text(x + w, cy + 21, b.count ?? `${rows.length} éléments`, { size: 11, weight: 600, anchor: 'end' });
      cy += 44;
    }
    const total_h = 34 + rows.length * 38 + 32;
    svg += rect(x, cy, w, total_h, { r: 10, fill: '#fff', stroke: C.line }) + rect(x, cy, w, 34, { r: 10, fill: C.fill }) + `<rect x="${x}" y="${cy + 20}" width="${w}" height="14" fill="${C.fill}"/>`;
    if (b.select !== false) svg += rect(x + 12, cy + 10, 14, 14, { r: 3, fill: '#fff', stroke: C.mid });
    cols.forEach((c, i) => { svg += text(xs[i] + (b.select !== false && i === 0 ? 26 : 0), cy + 22, c, { size: 11, weight: 700, fill: C.mid }); });
    rows.forEach((r, ri) => {
      const ry = cy + 34 + ri * 38;
      svg += hline(x, ry, x + w);
      if (b.select !== false) svg += rect(x + 12, ry + 12, 14, 14, { r: 3, fill: ri === (b.selected ?? -1) ? C.dark : '#fff', stroke: C.mid });
      r.forEach((cell, i) => {
        const cw = ((w - 28) * weights[i]) / total - 8;
        const s = String(cell);
        if (s.startsWith('●')) svg += rect(xs[i], ry + 9, Math.min(s.length * 6.4 + 14, cw), 20, { r: 10, fill: C.fill2 }) + text(xs[i] + 8, ry + 23, clip(s, chars(cw, 11)), { size: 10, weight: 600, fill: C.mid });
        else svg += text(xs[i] + (b.select !== false && i === 0 ? 26 : 0), ry + 24, clip(s, chars(cw - (i === 0 ? 26 : 0))), { size: 12, weight: i === 0 ? 600 : 400 });
      });
    });
    svg += hline(x, cy + 34 + rows.length * 38, x + w) + text(x + 14, cy + total_h - 11, b.footer ?? `Page 1 sur ${Math.max(1, Math.ceil(rows.length / 10))}`, { size: 10, fill: C.mid }) + (b.pager === false ? '' : text(x + w - 14, cy + total_h - 11, '‹  1  2  3  ›', { size: 11, anchor: 'end', fill: C.mid }));
    return { svg, h: cy - y + total_h };
  },
  cards(b, x, y, w) {
    const cols = b.cols ?? 3, gap = 14, cw = (w - gap * (cols - 1)) / cols, h = b.h ?? 96;
    const items = b.items ?? Array.from({ length: b.n ?? cols }, (_, i) => `Élément ${i + 1}`);
    const rows = Math.ceil(items.length / cols);
    const svg = items.map((it, i) => {
      const cx = x + (i % cols) * (cw + gap), cy = y + Math.floor(i / cols) * (h + gap);
      const [title, sub, tag] = Array.isArray(it) ? it : [it];
      return rect(cx, cy, cw, h, { r: 10, fill: i === (b.selected ?? -1) ? C.fill2 : '#fff', stroke: i === (b.selected ?? -1) ? C.dark : C.line, sw: i === (b.selected ?? -1) ? 2 : 1 })
        + rect(cx + 14, cy + 14, 28, 28, { r: 6, fill: C.fill2 }) + text(cx + 54, cy + 33, clip(title, chars(cw - 70, 13)), { size: 13, weight: 700 })
        + (sub ? text(cx + 14, cy + 62, clip(sub, chars(cw - 28)), { size: 11, fill: C.mid }) : '')
        + (tag ? rect(cx + cw - tag.length * 6.4 - 30, cy + 14, tag.length * 6.4 + 16, 18, { r: 9, fill: C.fill2 }) + text(cx + cw - tag.length * 6.4 - 22, cy + 27, tag, { size: 10, weight: 600, fill: C.mid }) : '');
    }).join('');
    return { svg, h: rows * h + (rows - 1) * gap };
  },
  form(b, x, y, w) {
    const cols = b.cols ?? 2, gap = 18, cw = (w - gap * (cols - 1)) / cols;
    let svg = '', cy = y, col = 0, rowH = 0;
    for (const f of b.fields) {
      const [label, type = 'text', span = 1] = f;
      const fw = cw * span + gap * (span - 1);
      if (col + span > cols) { cy += rowH + 6; col = 0; rowH = 0; }
      const fx = x + col * (cw + gap);
      const r = field(fx, cy, fw, label, type);
      svg += r.svg; rowH = Math.max(rowH, r.h); col += span;
      if (col >= cols) { cy += rowH + 6; col = 0; rowH = 0; }
    }
    if (col > 0) cy += rowH + 6;
    return { svg, h: cy - y };
  },
  kv(b, x, y, w) {
    const cols = b.cols ?? 3, cw = w / cols;
    const svg = b.items.map(([k, v], i) => text(x + (i % cols) * cw, y + Math.floor(i / cols) * 46 + 12, k, { size: 11, weight: 600, fill: C.mid }) + text(x + (i % cols) * cw, y + Math.floor(i / cols) * 46 + 32, clip(v, chars(cw - 10, 13)), { size: 13 })).join('');
    return { svg, h: Math.ceil(b.items.length / cols) * 46 };
  },
  panel(b, x, y, w) {
    const pad = 16;
    const inner = layout(b.children ?? [], x + pad, y + (b.title ? 44 : pad), w - pad * 2, 12);
    const h = (b.title ? 44 : pad) + inner.h + pad;
    return {
      svg: rect(x, y, w, h, { r: 10, fill: b.fill ?? '#fff', stroke: C.line, dash: b.dash }) + (b.title ? text(x + pad, y + 28, b.title, { size: 13, weight: 700 }) + (b.action ? text(x + w - pad, y + 28, b.action, { size: 11, weight: 600, fill: C.mid, anchor: 'end' }) : '') : '') + inner.svg,
      h,
    };
  },
  cols(b, x, y, w) {
    const gap = b.gap ?? 20, total = b.widths.reduce((a, c) => a + c, 0), avail = w - gap * (b.widths.length - 1);
    let cx = x, h = 0, svg = '';
    b.children.forEach((child, i) => {
      const cw = (avail * b.widths[i]) / total;
      const r = layout(child, cx, y, cw, 14);
      svg += r.svg; h = Math.max(h, r.h); cx += cw + gap;
    });
    return { svg, h };
  },
  chart(b, x, y, w) {
    const h = b.h ?? 180;
    let svg = rect(x, y, w, h, { r: 10, fill: '#fff', stroke: C.line }) + text(x + 16, y + 24, b.label, { size: 12, weight: 700 });
    const px = x + 20, py = y + 40, pw = w - 40, ph = h - 62;
    svg += hline(px, py + ph, px + pw);
    if (b.kind === 'line') {
      const pts = [0.2, 0.35, 0.3, 0.5, 0.45, 0.65, 0.6, 0.8].map((v, i, a) => `${px + (pw * i) / (a.length - 1)},${py + ph - ph * v}`).join(' ');
      svg += `<polyline points="${pts}" fill="none" stroke="${C.dark}" stroke-width="2"/>`;
    } else if (b.kind === 'donut') {
      svg += `<circle cx="${x + w / 2}" cy="${py + ph / 2}" r="${Math.min(ph, pw) / 2 - 6}" fill="none" stroke="${C.fill2}" stroke-width="18"/><circle cx="${x + w / 2}" cy="${py + ph / 2}" r="${Math.min(ph, pw) / 2 - 6}" fill="none" stroke="${C.dark}" stroke-width="18" stroke-dasharray="90 400"/>`;
    } else {
      const n = b.bars ?? 7, bw = pw / n;
      svg += Array.from({ length: n }, (_, i) => rect(px + i * bw + bw * 0.2, py + ph - ph * (0.25 + ((i * 37) % 60) / 100), bw * 0.6, ph * (0.25 + ((i * 37) % 60) / 100), { r: 3, fill: i === n - 1 ? C.dark : C.fill2 })).join('');
    }
    return { svg, h };
  },
  timeline(b, x, y, w) {
    const n = b.steps.length, step = w / n;
    let svg = hline(x + step / 2, y + 18, x + w - step / 2, C.mid);
    b.steps.forEach((s, i) => {
      const cx = x + step * i + step / 2;
      svg += `<circle cx="${cx}" cy="${y + 18}" r="11" fill="${i <= (b.current ?? 0) ? C.dark : '#fff'}" stroke="${C.mid}"/>` + text(cx, y + 22, i + 1, { size: 10, anchor: 'middle', fill: i <= (b.current ?? 0) ? '#fff' : C.mid, weight: 700 }) + text(cx, y + 46, clip(s, chars(step, 11)), { size: 11, anchor: 'middle', weight: i === (b.current ?? 0) ? 700 : 400 });
    });
    return { svg, h: 56 };
  },
  kanban(b, x, y, w) {
    const n = b.columns.length, gap = 12, cw = (w - gap * (n - 1)) / n;
    const maxCards = Math.max(...b.columns.map((c) => c[1]));
    const h = 44 + maxCards * 66 + 10;
    const svg = b.columns.map(([name, count], i) => {
      const cx = x + i * (cw + gap);
      return rect(cx, y, cw, h, { r: 10, fill: C.fill }) + text(cx + 12, y + 26, `${name}`, { size: 12, weight: 700 }) + text(cx + cw - 12, y + 26, String(count), { size: 11, anchor: 'end', fill: C.mid })
        + Array.from({ length: count }, (_, k) => rect(cx + 10, y + 40 + k * 66, cw - 20, 56, { r: 8, fill: '#fff', stroke: C.line }) + rect(cx + 20, y + 52 + k * 66, cw * 0.5, 8, { r: 4, fill: C.fill2 }) + rect(cx + 20, y + 68 + k * 66, cw * 0.32, 8, { r: 4, fill: C.fill }) ).join('');
    }).join('');
    return { svg, h };
  },
  calendar(b, x, y, w) {
    const days = b.days ?? ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'], hours = 8, hh = 44, labelW = 46, cw = (w - labelW) / days.length;
    const h = 36 + hours * hh;
    let svg = rect(x, y, w, h, { r: 10, fill: '#fff', stroke: C.line });
    days.forEach((d, i) => { svg += text(x + labelW + i * cw + cw / 2, y + 23, d, { size: 11, weight: 700, anchor: 'middle', fill: C.mid }) + `<line x1="${x + labelW + i * cw}" y1="${y + 36}" x2="${x + labelW + i * cw}" y2="${y + h}" stroke="${C.line}"/>`; });
    for (let r = 0; r < hours; r++) svg += hline(x, y + 36 + r * hh, x + w) + text(x + 8, y + 36 + r * hh + 14, `${8 + r}h`, { size: 10, fill: C.soft });
    for (const [d, start, len, label] of b.events ?? []) svg += rect(x + labelW + d * cw + 4, y + 36 + start * hh + 2, cw - 8, len * hh - 4, { r: 6, fill: C.fill2, stroke: C.mid }) + text(x + labelW + d * cw + 10, y + 36 + start * hh + 18, clip(label, chars(cw - 16, 10)), { size: 10, weight: 600 });
    return { svg, h };
  },
  list(b, x, y, w) {
    const items = b.items, ih = 34;
    const h = (b.title ? 40 : 0) + items.length * ih + 8;
    let svg = rect(x, y, w, h, { r: 10, fill: '#fff', stroke: C.line });
    if (b.title) svg += text(x + 16, y + 26, b.title, { size: 13, weight: 700 });
    items.forEach((it, i) => {
      const iy = y + (b.title ? 40 : 4) + i * ih;
      const [label, meta] = Array.isArray(it) ? it : [it];
      svg += hline(x + 12, iy, x + w - 12, C.fill2) + `<circle cx="${x + 24}" cy="${iy + 18}" r="4" fill="${C.mid}"/>` + text(x + 38, iy + 22, clip(label, chars(w - 150)), { size: 12 }) + (meta ? text(x + w - 16, iy + 22, meta, { size: 11, fill: C.mid, anchor: 'end' }) : '');
    });
    return { svg, h };
  },
  banner(b, x, y, w) {
    return { svg: rect(x, y, w, 40, { r: 8, fill: C.fill, stroke: b.tone === 'warn' ? C.warn : C.line }) + text(x + 16, y + 25, `${b.tone === 'warn' ? '⚠  ' : 'ⓘ  '}${b.text}`, { size: 12, fill: C.ink }), h: 40 };
  },
  placeholder(b, x, y, w) {
    const h = b.h ?? 120;
    return { svg: rect(x, y, w, h, { r: 8, fill: C.fill, stroke: C.line, dash: true }) + `<line x1="${x}" y1="${y}" x2="${x + w}" y2="${y + h}" stroke="${C.line}"/><line x1="${x + w}" y1="${y}" x2="${x}" y2="${y + h}" stroke="${C.line}"/>` + rect(x + w / 2 - 110, y + h / 2 - 14, 220, 28, { r: 6, fill: '#fff' }) + text(x + w / 2, y + h / 2 + 5, b.label ?? 'Zone', { size: 12, anchor: 'middle', fill: C.mid }), h };
  },
  code(b, x, y) {
    // Six cases de code (écran du second facteur).
    return { svg: Array.from({ length: 6 }, (_, i) => rect(x + i * 56, y, 46, 56, { r: 8, fill: '#fff', stroke: C.mid })).join(''), h: 64 };
  },
  buttons(b, x, y, w) {
    let bx = b.align === 'right' ? x + w : x, svg = '';
    const list = b.items;
    if (b.align === 'right') [...list].reverse().forEach((l) => { const btn = button(0, y, l, l === list[list.length - 1]); bx -= btn.w; svg += button(bx, y, l, l === list[list.length - 1]).svg; bx -= 10; });
    else list.forEach((l, i) => { const btn = button(bx, y, l, i === 0); svg += btn.svg; bx += btn.w + 10; });
    return { svg, h: 36 };
  },
  spacer(b) { return { svg: '', h: b.h ?? 12 }; },
};

function layout(blocks, x, y, w, gap = 16, ctx = CTX) {
  let cy = y, svg = '';
  for (const b of blocks) {
    const fn = BLOCKS[b.t];
    if (!fn) throw new Error(`Bloc inconnu : ${b.t}`);
    const r = fn(b, x, cy, w, ctx);
    svg += r.svg;
    if (b.note) {
      const n = CTX.notes.push(b.note);
      svg += `<circle cx="${x - 16}" cy="${cy + 14}" r="10" fill="${C.note}"/>` + text(x - 16, cy + 18, n, { size: 10, weight: 700, anchor: 'middle', fill: '#fff' });
    }
    cy += r.h + gap;
  }
  return { svg, h: Math.max(cy - y - gap, 0) };
}
let CTX = { notes: [] };

function shell(screen) {
  const navs = MODULES;
  let svg = rect(0, 0, MAIN_W, 100000, { r: 0, fill: '#fafafa' });
  if (screen.shell === 'auth') return '';
  svg += rect(0, 0, SIDE, 100000, { r: 0, fill: C.fill }) + hline(SIDE, 0, SIDE, C.line);
  svg += rect(18, 14, 40, 40, { r: 8, fill: '#fff', stroke: C.dark, sw: 2 }) + text(38, 41, 'i', { size: 18, weight: 800, anchor: 'middle' });
  Object.keys(navs).forEach((k, i) => {
    const active = navs[k].nav === screen.nav;
    svg += rect(8, 72 + i * 54, 60, 48, { r: 8, fill: active ? '#fff' : 'none', stroke: active ? C.dark : 'none' }) + rect(28, 80 + i * 54, 20, 16, { r: 3, fill: active ? C.dark : C.soft }) + text(38, 112 + i * 54, navs[k].short ?? k, { size: 8, anchor: 'middle', fill: active ? C.ink : C.mid, weight: active ? 700 : 400 });
  });
  svg += rect(SIDE, 0, MAIN_W - SIDE, TOP, { r: 0, fill: '#fff' }) + hline(SIDE, TOP, MAIN_W, C.line);
  svg += rect(SIDE + 24, 12, 360, 32, { r: 16, fill: C.fill, stroke: C.line }) + text(SIDE + 44, 33, 'Rechercher partout   Ctrl K', { size: 11, fill: C.soft });
  svg += `<circle cx="${MAIN_W - 150}" cy="28" r="14" fill="${C.fill2}"/>` + text(MAIN_W - 126, 25, screen.user ?? 'Utilisateur', { size: 11, weight: 700 }) + text(MAIN_W - 126, 40, screen.role ?? '', { size: 10, fill: C.mid });
  return svg;
}

function render(screen, index) {
  CTX = { notes: [] };
  const auth = screen.shell === 'auth';
  const cx = auth ? (MAIN_W - 460) / 2 : SIDE + 32, cw = auth ? 460 : MAIN_W - SIDE - 64, cy = auth ? 110 : TOP + 24;
  const body = layout(screen.blocks, cx, cy, cw, 16);
  let overlay = '';
  let bottom = cy + body.h;
  if (screen.modal) {
    CTX.notes.length;
    const m = screen.modal, mw = m.w ?? 620, mx = (MAIN_W - mw) / 2, my = Math.max(TOP + 40, 90);
    const inner = layout(m.blocks, mx + 24, my + 64, mw - 48, 12);
    const mh = 64 + inner.h + (m.actions ? 70 : 24);
    const bg = Math.max(bottom, my + mh + 40);
    overlay += rect(auth ? 0 : SIDE, auth ? 0 : TOP, auth ? MAIN_W : MAIN_W - SIDE, 100000, { r: 0, fill: 'rgba(0,0,0,0.38)' }) + rect(mx, my, mw, mh, { r: 12, fill: '#fff', stroke: C.mid, sw: 1.5 })
      + text(mx + 24, my + 38, m.title, { size: 18, weight: 700 }) + text(mx + mw - 26, my + 36, '✕', { size: 16, anchor: 'end', fill: C.mid }) + inner.svg;
    if (m.actions) {
      let bx = mx + mw - 24;
      [...m.actions].reverse().forEach((l, i) => { const btn = button(0, 0, l, i === 0); bx -= btn.w; overlay += button(bx, my + mh - 52, l, i === 0).svg; bx -= 10; });
    }
    if (m.note) { const n = CTX.notes.push(m.note); overlay += `<circle cx="${mx + mw}" cy="${my}" r="11" fill="${C.note}"/>` + text(mx + mw, my + 4, n, { size: 11, weight: 700, anchor: 'middle', fill: '#fff' }); }
    bottom = bg;
  }
  const H = Math.max(900, bottom + 40);
  // Panneau d'annotations.
  const lx = MAIN_W, status = screen.status === 'Livré' ? C.ok : C.note;
  let legend = rect(lx, 0, LEG, H, { r: 0, fill: '#fff' }) + `<line x1="${lx}" y1="0" x2="${lx}" y2="${H}" stroke="${C.line}"/>`;
  let ly = 34;
  legend += text(lx + 20, ly, `${String(index + 1).padStart(2, '0')} · ${screen.module}`, { size: 11, weight: 700, fill: C.mid });
  ly += 24;
  for (const l of wrap(screen.title, 28)) { legend += text(lx + 20, ly, l, { size: 17, weight: 700 }); ly += 22; }
  legend += rect(lx + 20, ly + 2, screen.status.length * 7 + 20, 22, { r: 11, fill: 'none', stroke: status }) + text(lx + 30, ly + 17, screen.status.toUpperCase(), { size: 10, weight: 700, fill: status });
  ly += 44;
  for (const [k, v] of [['Sprint', screen.sprint], ['Vue pour', screen.role], ['Droits', screen.rights]]) {
    if (!v) continue;
    legend += text(lx + 20, ly, k, { size: 10, weight: 700, fill: C.mid });
    ly += 16;
    for (const l of wrap(v, 38)) { legend += text(lx + 20, ly, l, { size: 11 }); ly += 15; }
    ly += 8;
  }
  ly += 6;
  legend += hline(lx + 20, ly, lx + LEG - 20) ;
  ly += 24;
  legend += text(lx + 20, ly, 'Annotations', { size: 12, weight: 700 });
  ly += 22;
  CTX.notes.forEach((note, i) => {
    legend += `<circle cx="${lx + 30}" cy="${ly - 4}" r="10" fill="${C.note}"/>` + text(lx + 30, ly, i + 1, { size: 10, weight: 700, anchor: 'middle', fill: '#fff' });
    const lines = wrap(note, 36);
    lines.forEach((l, k) => { legend += text(lx + 48, ly + k * 15, l, { size: 11 }); });
    ly += Math.max(lines.length * 15, 15) + 12;
  });
  if (screen.states?.length) {
    ly += 6;
    legend += hline(lx + 20, ly, lx + LEG - 20);
    ly += 22;
    legend += text(lx + 20, ly, 'États à concevoir', { size: 12, weight: 700 });
    ly += 20;
    for (const s of screen.states) { for (const l of wrap(`• ${s}`, 40)) { legend += text(lx + 20, ly, l, { size: 11, fill: C.mid }); ly += 15; } }
  }
  const finalH = Math.max(H, ly + 40);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${finalH}" width="${W}" height="${finalH}" font-family="system-ui, 'Segoe UI', Roboto, Arial, sans-serif" role="img" aria-label="${esc(`Wireframe : ${screen.title}`)}">
<title>${esc(`${String(index + 1).padStart(2, '0')} — ${screen.title}`)}</title>
<rect width="${W}" height="${finalH}" fill="#fafafa"/>
${shell(screen)}
${body.svg}
${overlay}
${legend}
</svg>`;
  return { svg, notes: CTX.notes.length };
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const rows = [];
SCREENS.forEach((screen, i) => {
  const file = `${String(i + 1).padStart(2, '0')}-${screen.id}.svg`;
  const { svg, notes } = render(screen, i);
  writeFileSync(join(OUT, file), svg);
  rows.push({ ...screen, file, n: i + 1, notes });
});

// --- galerie ------------------------------------------------------------------------------------------------------
const gallery = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Wireframes — Investally Business Platform</title>
<style>
:root{--ink:#262626;--mid:#6b6b6b;--line:#d6d2cc;--taupe:#f3efea;--dark:#2f2c2a}
body{margin:0;font:15px/1.5 system-ui,'Segoe UI',Roboto,sans-serif;color:var(--ink);background:var(--taupe)}
header{padding:28px 32px 12px}h1{margin:0 0 4px;font-size:26px}p{margin:0;color:var(--mid)}
.bar{display:flex;flex-wrap:wrap;gap:8px;padding:12px 32px 20px}
button{font:inherit;padding:6px 14px;border:1px solid var(--dark);border-radius:999px;background:#fff;cursor:pointer}
button[aria-pressed=true]{background:var(--dark);color:#fff}
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:18px;padding:0 32px 40px}
a.card{display:block;text-decoration:none;color:inherit;background:#fff;border:1px solid var(--line);border-radius:12px;overflow:hidden}
a.card:hover,a.card:focus-visible{outline:3px solid var(--dark)}
a.card img{display:block;width:100%;aspect-ratio:1500/900;object-fit:cover;object-position:top left;border-bottom:1px solid var(--line);background:#fafafa}
.meta{padding:12px 14px}.meta strong{display:block}.meta span{font-size:13px;color:var(--mid)}
.tag{display:inline-block;margin-top:6px;padding:1px 10px;border-radius:999px;border:1px solid;font-size:11px;font-weight:700}
.tag.l{color:#2e7d32}.tag.p{color:#b3541e}
</style></head><body>
<header><h1>Wireframes</h1><p>${rows.length} écrans : ${rows.filter((r) => r.status === 'Livré').length} déjà réalisés (référence) et ${rows.filter((r) => r.status !== 'Livré').length} proposés. Niveaux de gris : structure, contenu, droits et états ; le style est celui du design validé.</p></header>
<div class="bar" role="group" aria-label="Filtrer par module">${['Tous', ...new Set(rows.map((r) => r.module))].map((m, i) => `<button type="button" aria-pressed="${i === 0}" data-m="${esc(m)}">${esc(m)}</button>`).join('')}</div>
<main>${rows.map((r) => `<a class="card" href="svg/${r.file}" data-m="${esc(r.module)}"><img loading="lazy" src="svg/${r.file}" alt="Aperçu : ${esc(r.title)}"><div class="meta"><strong>${String(r.n).padStart(2, '0')} · ${esc(r.title)}</strong><span>${esc(r.module)} · ${esc(r.sprint)}</span><br><span class="tag ${r.status === 'Livré' ? 'l' : 'p'}">${esc(r.status.toUpperCase())}</span></div></a>`).join('')}</main>
<script>
const bs=[...document.querySelectorAll('button[data-m]')],cs=[...document.querySelectorAll('a.card')];
bs.forEach(b=>b.addEventListener('click',()=>{bs.forEach(x=>x.setAttribute('aria-pressed',x===b));cs.forEach(c=>{c.hidden=b.dataset.m!=='Tous'&&c.dataset.m!==b.dataset.m})}));
</script></body></html>`;
writeFileSync(join(here, 'index.html'), gallery);

// --- catalogue ----------------------------------------------------------------------------------------------------
const catalogue = `# Catalogue des wireframes

*Généré par \`build.mjs\` à partir de \`screens.mjs\` : ne pas modifier à la main. Ouvrir \`index.html\` pour la galerie.*

| N° | Écran | Module | État | Sprint | Vue pour | Droits |
|---|---|---|---|---|---|---|
${rows.map((r) => `| ${String(r.n).padStart(2, '0')} | [${r.title}](svg/${r.file}) | ${r.module} | ${r.status} | ${r.sprint} | ${r.role ?? ''} | ${r.rights ?? ''} |`).join('\n')}
`;
writeFileSync(join(here, 'CATALOGUE.md'), catalogue);
console.log(`✔ ${rows.length} wireframes écrits dans ${OUT}`);
