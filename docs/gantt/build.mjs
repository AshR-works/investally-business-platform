// Générateur du diagramme de Gantt du projet : écrit `gantt.svg` et `../GANTT-PROJET.md` (puis `python scripts/md-to-html.py` produit la page).
//
//   node docs/gantt/build.mjs
//
// Les dates PASSÉES viennent de l'historique Git (début = premier commit de la branche, fin = fusion dans `main`). Les dates À VENIR
// sont des PRÉVISIONS : une session = deux jours ouvrés (rythme prudent, validations et retours de tests compris), à partir du
// lundi 2026-11-02. Le rythme réellement observé la semaine du 2026-10-28 est d'environ un lot par jour ouvré : voir le résumé.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const TODAY = '2026-11-01';

// state : done = validé · wait = terminé, validation en attente · plan = prévu · ext = prérequis externe ou décision (échéance)
const ITEMS = [
  { phase: 'Cadrage et fondations', rows: [
    { name: 'Sprint 0 — vision, architecture, ADR, risques', start: '2026-10-20', end: '2026-10-20', state: 'done' },
    { name: 'S1 — squelette du CRM, garde-fous d’architecture', start: '2026-10-20', end: '2026-10-20', state: 'done', tag: 's1-validated' },
    { name: 'S2 — sécurité et données du noyau (droits, audit)', start: '2026-10-20', end: '2026-10-20', state: 'done', tag: 's2-validated' },
    { name: 'S3.1 — authentification', start: '2026-10-20', end: '2026-10-20', state: 'done', tag: 's3-1-validated' },
    { name: 'S3.2 — second facteur, premier SuperAdmin', start: '2026-10-20', end: '2026-10-20', state: 'done', tag: 's3-2-validated' },
    { name: 'S3.3 — autorisation et administration', start: '2026-10-20', end: '2026-10-20', state: 'done', tag: 's3-3-validated' },
    { name: 'S3.4 — interface de base', start: '2026-10-20', end: '2026-10-21', state: 'done', tag: 's3-4-validated' },
    { name: 'S3.5 — mot de passe oublié, livrables', start: '2026-10-21', end: '2026-10-21', state: 'done', tag: 's3-5-validated' },
  ] },
  { phase: 'Design, accessibilité, habillage', rows: [
    { name: 'Design v0.4.1 et cadrages H1, H2, S3.6, UX', start: '2026-10-21', end: '2026-10-21', state: 'done', tag: 'design-v0.4.1, cadrages-validated' },
    { name: 'A11Y-1 — accessibilité (audit automatique)', start: '2026-10-21', end: '2026-10-21', state: 'done', tag: 'a11y-1-validated' },
    { name: 'H1 — habillage minimal et hub', start: '2026-10-21', end: '2026-10-21', state: 'done', tag: 'h1-validated' },
    { name: 'H1b — composants de données', start: '2026-10-21', end: '2026-10-21', state: 'done', tag: 'h1b-validated' },
    { name: 'Arbitrage D21 — données de l’API des entreprises', start: '2026-10-21', end: '2026-10-22', state: 'done', tag: 'd21-validated' },
    { name: 'H2a — écrans d’accès au nouveau style', start: '2026-10-22', end: '2026-10-22', state: 'done', tag: 'h2a-validated' },
    { name: 'H2b — sessions et historique des connexions', start: '2026-10-22', end: '2026-10-22', state: 'done', tag: 'h2b-validated' },
    { name: 'S3.6 — documents', start: '2026-10-22', end: '2026-10-22', state: 'done', tag: 's3-6-validated' },
    { name: 'Contrat anti-IDOR et correctif CI', start: '2026-10-22', end: '2026-10-22', state: 'done', tag: 'idor-validated' },
  ] },
  { phase: 'Retours de tests et hygiène', rows: [
    { name: 'S3.7 — UX de l’authentification', start: '2026-10-22', end: '2026-10-27', state: 'done', tag: 's3-7-validated' },
    { name: 'Cadrage des retours de tests UX-01 à UX-04', start: '2026-10-22', end: '2026-10-27', state: 'done' },
    { name: 'Hygiène du dépôt public, dépendances, CLAUDE.md', start: '2026-10-22', end: '2026-10-27', state: 'done' },
    { name: 'Rapports journaliers et exécution locale', start: '2026-10-22', end: '2026-10-27', state: 'done' },
    { name: 'S3.8 — rôles : sélection par familles', start: '2026-10-28', end: '2026-10-28', state: 'done', tag: 's3-8-validated' },
  ] },
  { phase: 'Module commercial (Business Development)', rows: [
    { name: 'S4.0 — fiche d’entreprise, facilitateurs, commission', start: '2026-10-28', end: '2026-10-29', state: 'done', tag: 's4-0-validated' },
    { name: 'S4.0b — retours de tests de la fiche', start: '2026-10-29', end: '2026-10-30', state: 'done', tag: 's4-0b-validated' },
    { name: 'S4.0c — modifier et exporter une fiche', start: '2026-10-29', end: '2026-10-30', state: 'done', tag: 's4-0c-validated' },
    { name: 'Node 22 : environnement de développement', start: '2026-10-29', end: '2026-10-30', state: 'done' },
    { name: 'Wireframes (45 écrans de référence)', start: '2026-10-29', end: '2026-10-30', state: 'done' },
    { name: 'Cas d’usage : flux transverses F1 à F7', start: '2026-10-29', end: '2026-10-30', state: 'done' },
    { name: 'Cas d’usage : module commercial C1 à C5', start: '2026-10-30', end: '2026-10-30', state: 'done' },
    { name: 'S4.1a — contacts des entreprises', start: '2026-10-30', end: '2026-10-30', state: 'done', tag: 's4-1a-validated' },
    { name: 'S4.1b — tableau des entreprises (filtres, tri, colonnes)', start: '2026-10-30', end: '2026-10-30', state: 'done', tag: 's4-1b-validated' },
    { name: 'Cas d’usage : module Investudy I1 à I5', start: '2026-10-30', end: '2026-10-30', state: 'done' },
    { name: 'S4.2a — offres', start: '2026-10-30', end: '2026-11-01', state: 'done', tag: 's4-2a-validated' },
    { name: 'S4.2b — décharges signées', start: '2026-11-01', end: '2026-11-01', state: 'done', tag: 's4-2b-validated' },
    { name: 'S4.2c — relances', start: '2026-11-01', end: '2026-11-01', state: 'done', tag: 's4-2c-validated' },
    { name: 'S4.2d — agenda, rendez-vous, visites', start: '2026-11-01', end: '2026-11-01', state: 'done', tag: 's4-2d-validated' },
    { name: 'S4.3a — opportunités, pipeline', start: '2026-11-01', end: '2026-11-01', state: 'done', tag: 's4-3a-validated' },
    { name: 'S4.3b — statuts d’entreprise, responsable, fiche 360°', start: '2026-11-01', end: '2026-11-01', state: 'done', tag: 's4-3b-validated' },
    { name: 'S4.3c — colonne Valeur, lien rendez-vous ↔ opportunité', start: '2026-11-02', end: '2026-11-02', state: 'done', tag: 's4-3c-validated' },
    { name: 'S4.4a — agréments', start: '2026-11-02', end: '2026-11-02', state: 'done', tag: 's4-4a-validated' },
    { name: 'S4.4b — ambassadeurs', start: '2026-11-02', end: '2026-11-02', state: 'done', tag: 's4-4b-validated' },
    { name: 'Correctifs 1 — téléphones, fenêtres, barres de défilement, tableaux', start: '2026-11-03', end: '2026-11-03', state: 'done', tag: 'correctifs-1-validated' },
    { name: 'S4.4a-bis — correctifs D41 (agrément demandé, payeur, Finance, second facteur)', start: '2026-11-03', end: '2026-11-03', state: 'done', tag: 's4-4a-bis-validated' },
    { name: 'Jeu de données de démonstration (module commercial)', start: '2026-11-03', end: '2026-11-04', state: 'done', tag: 'jeu-de-donnees-enrichi-validated' },
    { name: 'S4.4c — commissions à verser', start: '2026-11-04', end: '2026-11-04', state: 'done', tag: 's4-4c-validated' },
  ] },
  { phase: 'Module Investudy (formation)', rows: [
    { name: 'S5.1 — catalogue (programmes, certificats, modules, salles, formateurs, rythmes)', start: '2026-11-05', end: '2026-11-05', state: 'wait' },
    { name: 'S5.2 — sessions, apprenants, inscriptions', start: '2026-11-24', end: '2026-11-26', state: 'plan' },
    { name: 'S5.3 — présences, évaluations, certifications', start: '2026-11-27', end: '2026-11-30', state: 'plan' },
  ] },
  { phase: 'Pilotage, stocks, production', rows: [
    { name: 'S6.1 — tableaux de bord commerciaux', start: '2026-12-01', end: '2026-12-02', state: 'plan' },
    { name: 'S6.2 — tableaux de bord Investudy, Admin, Sécurité', start: '2026-12-03', end: '2026-12-04', state: 'plan' },
    { name: 'S6.3 — reporting et incidents', start: '2026-12-07', end: '2026-12-09', state: 'plan' },
    { name: 'ST — module Stocks', start: '2026-12-10', end: '2026-12-15', state: 'plan' },
    { name: 'S7.1 — durcissement', start: '2026-12-16', end: '2026-12-18', state: 'plan' },
    { name: 'S7.2 — mise en production du CRM', start: '2026-12-21', end: '2026-12-23', state: 'plan' },
    { name: 'ERP — finance, RH, fiscalité (démarrage à décider)', start: '2026-12-24', end: '2026-12-31', state: 'plan', open: true },
  ] },
  { phase: 'Décisions et prérequis (échéance au plus tard)', rows: [
    { name: 'Confirmer les valeurs par défaut D29 à D35', start: '2026-11-09', end: '2026-11-09', state: 'ext' },
    { name: 'Détails de l’agrément (D1 à D5) et déclencheur de la commission', start: '2026-11-16', end: '2026-11-16', state: 'ext' },
    { name: 'Règles d’inscription et de certification (D31)', start: '2026-11-23', end: '2026-11-23', state: 'ext' },
    { name: 'Pays en liste fermée (D57) et définition des indicateurs', start: '2026-11-30', end: '2026-11-30', state: 'ext' },
    { name: 'Cas d’usage Reporting et Stocks à valider', start: '2026-12-04', end: '2026-12-04', state: 'ext' },
    { name: 'Accès Microsoft 365 et avis juridique (D9, D11)', start: '2026-12-18', end: '2026-12-18', state: 'ext' },
  ] },
];

const C = { ink: '#262626', mid: '#6b6b6b', line: '#d6d2cc', band: '#f3efea', dark: '#2f2c2a', wait: '#b3541e', plan: '#8a8480', today: '#c0392b', ok: '#2e7d32' };
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const day = (s) => Math.round(Date.parse(`${s}T00:00:00Z`) / 86400000);
const fr = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
const frFull = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
const dow = (s) => new Date(`${s}T00:00:00Z`).getUTCDay();

const FIRST = '2026-10-19';
const LAST = '2027-01-15';
const D0 = day(FIRST);
const DAYS = day(LAST) - D0 + 1;
const LABEL_W = 400, DAY_W = 11, ROW = 22, HEAD = 100, PAD = 16;
const W = LABEL_W + DAYS * DAY_W + PAD;
const xOf = (s) => LABEL_W + (day(s) - D0) * DAY_W;

let y = HEAD;
const layout = [];
for (const group of ITEMS) {
  layout.push({ type: 'phase', y, label: group.phase });
  y += ROW + 4;
  for (const row of group.rows) {
    layout.push({ type: 'row', y, row });
    y += ROW;
  }
  y += 6;
}
const H = y + 90;

let svg = '';
// Week-ends et lignes des lundis.
for (let i = 0; i < DAYS; i++) {
  const d = new Date((D0 + i) * 86400000).toISOString().slice(0, 10);
  const x = LABEL_W + i * DAY_W;
  if ([0, 6].includes(dow(d))) svg += `<rect x="${x}" y="${HEAD - 8}" width="${DAY_W}" height="${H - HEAD - 70}" fill="${C.band}"/>`;
  if (dow(d) === 1) {
    svg += `<line x1="${x}" y1="${HEAD - 26}" x2="${x}" y2="${H - 78}" stroke="${C.line}" stroke-width="1"/>`;
    svg += `<text x="${x + 2}" y="${HEAD - 12}" font-size="10" fill="${C.mid}">${fr(d)}</text>`;
  }
}
// Mois.
for (const m of ['2026-11-01', '2026-12-01', '2027-01-01']) {
  const x = xOf(m);
  svg += `<line x1="${x}" y1="${HEAD - 46}" x2="${x}" y2="${H - 78}" stroke="${C.mid}" stroke-width="1.4"/>`;
}
const MONTHS = [['Octobre 2026', '2026-10-19'], ['Novembre 2026', '2026-11-01'], ['Décembre 2026', '2026-12-01'], ['Janvier 2027', '2027-01-01']];
for (const [label, start] of MONTHS) svg += `<text x="${xOf(start) + 4}" y="${HEAD - 32}" font-size="12" font-weight="700" fill="${C.ink}">${label}</text>`;

for (const entry of layout) {
  if (entry.type === 'phase') {
    svg += `<rect x="0" y="${entry.y}" width="${W}" height="${ROW}" fill="#e9e4de"/>`;
    svg += `<text x="10" y="${entry.y + 15}" font-size="12" font-weight="700" fill="${C.ink}">${esc(entry.label)}</text>`;
    continue;
  }
  const { row } = entry;
  const cy = entry.y + ROW / 2;
  const dates = row.start === row.end ? fr(row.start) : `${fr(row.start)} → ${fr(row.end)}`;
  svg += `<text x="10" y="${cy + 4}" font-size="11" fill="${C.ink}">${esc(row.name.length > 60 ? `${row.name.slice(0, 58)}…` : row.name)}</text>`;
  svg += `<text x="${LABEL_W - 8}" y="${cy + 4}" font-size="10" fill="${C.mid}" text-anchor="end">${dates}</text>`;
  const x1 = xOf(row.start);
  const x2 = xOf(row.end) + DAY_W;
  if (row.state === 'ext') {
    const x = xOf(row.end) + DAY_W / 2;
    svg += `<polygon points="${x},${cy - 8} ${x + 8},${cy} ${x},${cy + 8} ${x - 8},${cy}" fill="#fff" stroke="${C.wait}" stroke-width="2"/>`;
    continue;
  }
  const fill = row.state === 'done' ? C.dark : row.state === 'wait' ? C.wait : 'url(#hatch)';
  const stroke = row.state === 'plan' ? C.plan : fill;
  svg += `<rect x="${x1}" y="${cy - 7}" width="${Math.max(x2 - x1, DAY_W)}" height="14" rx="3" fill="${fill}" stroke="${stroke}" stroke-width="1.2"${row.open ? ' stroke-dasharray="4 3"' : ''}/>`;
  if (row.open) svg += `<text x="${x2 + 4}" y="${cy + 4}" font-size="11" fill="${C.plan}">→ à chiffrer</text>`;
}
// Aujourd'hui.
const tx = xOf(TODAY) + DAY_W / 2;
svg += `<line x1="${tx}" y1="${HEAD - 26}" x2="${tx}" y2="${H - 78}" stroke="${C.today}" stroke-width="2" stroke-dasharray="5 3"/>`;
svg += `<text x="${tx + 4}" y="${HEAD - 46}" font-size="11" font-weight="700" fill="${C.today}">Aujourd’hui ${fr(TODAY)}</text>`;
// Légende.
const ly = H - 56;
svg += `<rect x="10" y="${ly - 10}" width="24" height="14" rx="3" fill="${C.dark}"/><text x="42" y="${ly + 2}" font-size="11">Réalisé et validé</text>`;
svg += `<rect x="170" y="${ly - 10}" width="24" height="14" rx="3" fill="${C.wait}"/><text x="202" y="${ly + 2}" font-size="11">Terminé, validation en attente</text>`;
svg += `<rect x="400" y="${ly - 10}" width="24" height="14" rx="3" fill="url(#hatch)" stroke="${C.plan}"/><text x="432" y="${ly + 2}" font-size="11">Prévu (prévision)</text>`;
svg += `<polygon points="580,${ly - 10} 588,${ly - 2} 580,${ly + 6} 572,${ly - 2}" fill="#fff" stroke="${C.wait}" stroke-width="2"/><text x="596" y="${ly + 2}" font-size="11">Décision ou prérequis, échéance au plus tard</text>`;
svg += `<text x="10" y="${ly + 26}" font-size="11" fill="${C.mid}">Passé : dates de l’historique Git (début = premier commit, fin = fusion). Avenir : une session = deux jours ouvrés à partir du lundi 02/11, hors jours fériés ; week-ends en grisé.</text>`;

const out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="system-ui, 'Segoe UI', Roboto, Arial, sans-serif" role="img" aria-label="Diagramme de Gantt du projet Investally, du 20 octobre 2026 à janvier 2027">
<title>Diagramme de Gantt du projet</title>
<defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#fff"/><line x1="0" y1="0" x2="0" y2="6" stroke="${C.plan}" stroke-width="2"/></pattern></defs>
<rect width="${W}" height="${H}" fill="#fff"/>
<text x="10" y="26" font-size="20" font-weight="700" fill="${C.ink}">Projet Investally — diagramme de Gantt</text>
<text x="10" y="44" font-size="12" fill="${C.mid}">Du lancement (20/10/2026) à la mise en production du CRM (prévision 23/12/2026) ; ERP à chiffrer</text>
${svg}
</svg>`;
writeFileSync(join(here, 'gantt.svg'), out);
writeFileSync(join(here, 'items.json'), JSON.stringify({ today: TODAY, first: FIRST, last: LAST, items: ITEMS }, null, 2));

// Page Markdown (convertie en HTML par scripts/md-to-html.py).
const STATE = { done: 'Validé', wait: 'Terminé, validation en attente', plan: 'Prévu', ext: 'Échéance' };
const done = ITEMS.flatMap((g) => g.rows).filter((r) => r.state === 'done');
const tables = ITEMS.map((g) => `### ${g.phase}\n| Lot | Début | Fin | État | Étiquette |\n|---|---|---|---|---|\n${g.rows.map((r) => `| ${r.name} | ${frFull(r.start)} | ${r.open ? 'à décider' : frFull(r.end)} | ${STATE[r.state]} | ${r.tag ? `\`${r.tag}\`` : '—'} |`).join('\n')}`).join('\n\n');
const md = `# Diagramme de Gantt du projet

**Date** : ${frFull(TODAY)} · **Statut** : **état réel jusqu'à aujourd'hui, prévisions au-delà (à valider)** · **Lié à** : [reste à faire sur le développement](RESTE-A-FAIRE-DEVELOPPEMENT.md) · **Généré par** \`docs/gantt/build.mjs\`

> Le passé vient de l'historique Git : le début d'un lot est son premier commit, la fin est sa fusion dans la branche principale. L'avenir est une **prévision**, pas un engagement : elle dépend de vos validations, des décisions listées en bas du schéma et des prérequis externes (Microsoft 365, avis juridique).

![Diagramme de Gantt du projet](gantt/gantt.svg)

## Résumé
| Repère | Date |
|---|---|
| **Lancement** (Sprint 0) | 20/10/2026 |
| Premier jalon de code validé (S1 à S3.3) | 20/10/2026 (le même jour) |
| Fin de la fondation et du design | 22/10/2026 |
| Module commercial : dernier lot validé (S4.4c, commissions à verser) | 05/11/2026 |
| Lots réalisés et validés au ${frFull(TODAY)} | ${done.length} (dont ${done.filter((r) => r.tag).length} étiquetés) |
| **Prochaine session** | S5 (Investudy), après vos réponses sur FD-9 et FD-11 |
| Fin du module commercial | **Terminé le 05/11/2026** (S4.4c validé) |
| Fin d'Investudy (prévision) | 30/11/2026 |
| **Mise en production du CRM, prévision prudente** | **23/12/2026** |
| Mise en production du CRM au rythme observé la semaine du 28/10 (un lot par jour ouvré) | vers le 26/11/2026 |
| ERP (finance, RH, fiscalité) | Démarrage à décider, non chiffré |

## Hypothèses de la prévision
1. **Une session = deux jours ouvrés**, soit le double du rythme observé : elle tient compte des validations, des retours de tests (S4.0 en a demandé deux : S4.0b et S4.0c) et des décisions à obtenir.
2. Départ le **lundi 02/11/2026** ; aucun jour férié ni congé n'est retiré (les fêtes de fin d'année pourraient décaler S7.1 et S7.2).
3. Les tailles par lot sont celles de [reste à faire](RESTE-A-FAIRE-DEVELOPPEMENT.md) : ordres de grandeur.
4. Les **échéances de décision** (losanges orange) sont les dates **au plus tard** : une réponse tardive décale le lot qu'elle bloque.
5. S7.2 exige l'accès Microsoft 365, l'avis juridique et l'analyse antivirus des documents ; **sans eux, la mise en production ne peut pas avoir lieu**, quelle que soit l'avancée du code.

## Détail par phase
${tables}
`;
writeFileSync(join(here, '..', 'GANTT-PROJET.md'), md);
console.log(`✔ Gantt écrit (${ITEMS.flatMap((g) => g.rows).length} lignes, ${W}×${H})`);
