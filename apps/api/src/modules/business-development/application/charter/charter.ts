import { LOGO_HORIZONTAL, LOGO_SYMBOLE } from './charter-assets';

/**
 * Charte graphique des documents administratifs d'Investally (modèles Devis, Rapport, etc.) appliquée aux documents exportés par la plateforme :
 * en-tête (logo à gauche, titre du document et numéro à droite), titres en Montserrat, tableaux à en-tête noir aux coins arrondis, encarts crème,
 * filets taupe, pied de page légal (symbole, coordonnées, immatriculation, motif de chandeliers). Le document est AUTONOME (ni script, ni lien,
 * ni ressource externe : logos embarqués) ; les polices de la charte (Montserrat, Inter) sont utilisées si elles sont installées, sinon repli sur Arial.
 */

/** Échappe le texte saisi par les utilisateurs : rien de ce qui est affiché ne peut être interprété comme du HTML. */
export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Coordonnées et immatriculation du pied de page, telles que figurent sur les modèles de la charte (à modifier ICI uniquement). */
export const LEGAL_FOOTER = {
  contact: ['Tél : +237 699 058 230', 'BP : 5468 Rue tokoto bonapriso', 'Email : contact@investally.io', 'www.education.investally.io'],
  registration: ['Douala – Cameroun', 'RC : CM-DLA-01-2026-B14-00033', 'NIU : M082618939960W'],
} as const;

export const longDate = (value: string | Date): string =>
  new Date(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Douala' });

/** Montant avec séparateur de milliers, sans centimes inutiles (« 4 500 000 », « 1 250,50 »). */
export function formatAmount(value: string | number): string {
  const number = Number(value);
  const whole = Number.isInteger(number);
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 }).format(number).replace(/[  ]/g, ' ');
}

export const currencyLabel = (code: string | null | undefined): string => (code === 'XAF' ? 'XAF' : (code ?? ''));

/** Ligne « libellé / valeur » d'un encart ; une valeur absente s'affiche « — ». */
export const kv = (label: string, value: string | null | undefined): string =>
  `<dt>${esc(label)}</dt><dd>${value ? esc(value) : '<span class="muted">—</span>'}</dd>`;

/** Motif de chandeliers du pied de page (décor de la charte). */
const CANDLES = `<svg class="candles" viewBox="0 0 190 80" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
  <g stroke="#BEACA0" stroke-width=".6" fill="#BEACA0">
    <line x1="6" y1="22" x2="6" y2="78"/><rect x="2.5" y="36" width="7" height="14"/>
    <line x1="24" y1="14" x2="24" y2="66"/><rect x="20.5" y="26" width="7" height="14"/>
    <line x1="42" y1="30" x2="42" y2="80"/><rect x="38.5" y="44" width="7" height="22"/>
    <line x1="60" y1="8" x2="60" y2="70"/><rect x="56.5" y="26" width="7" height="26"/>
    <line x1="78" y1="22" x2="78" y2="62"/><rect x="74.5" y="30" width="7" height="12"/>
    <line x1="96" y1="16" x2="96" y2="78"/><rect x="92.5" y="30" width="7" height="34"/>
    <line x1="114" y1="40" x2="114" y2="64"/><rect x="110.5" y="48" width="7" height="6"/>
    <line x1="132" y1="26" x2="132" y2="72"/><rect x="128.5" y="40" width="7" height="18"/>
    <line x1="150" y1="2" x2="150" y2="54"/><rect x="146.5" y="14" width="7" height="22"/>
  </g></svg>`;

const STYLE = `
  :root{ --noir:#1A1A18; --taupe:#BEACA0; --taupe-fonce:#6F5F54; --creme:#F6F2EE; --filet:#E4DDD6; --gris:#5B5750; }
  @page{ size:A4; margin:0 }
  *{ box-sizing:border-box }
  html,body{ margin:0; background:#fff }
  body{ font-family:'Inter','Segoe UI',Arial,sans-serif; font-size:8.8pt; line-height:1.45; color:var(--noir); -webkit-print-color-adjust:exact; print-color-adjust:exact }
  .page{ width:210mm; min-height:297mm; margin:0 auto; padding:14mm 16mm 12mm; display:flex; flex-direction:column }
  h1,h2,.mont{ font-family:'Montserrat','Segoe UI',Arial,sans-serif }
  .muted{ color:var(--gris) }
  .label{ font-size:6.6pt; letter-spacing:.12em; text-transform:uppercase; font-weight:600; color:var(--taupe-fonce) }
  header{ display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:7mm }
  header img{ display:block; height:13mm; width:auto }
  .doc-title{ text-align:right }
  .doc-title h1{ margin:0; font-size:23pt; font-weight:800; letter-spacing:.02em; line-height:1 }
  .doc-title .num{ margin-top:2.2mm; font-family:'Montserrat','Segoe UI',Arial,sans-serif; font-weight:600; font-size:9pt; color:var(--taupe-fonce) }
  .titre{ margin-top:2mm }
  .titre .t{ font-family:'Montserrat','Segoe UI',Arial,sans-serif; font-weight:800; font-size:15pt; margin-top:1.2mm; overflow-wrap:anywhere }
  .accent{ display:block; width:8mm; height:1.2mm; background:var(--taupe); margin-top:3mm }
  .meta{ margin-top:6mm; padding:4mm 5mm; border:1px solid var(--filet); border-radius:3mm }
  dl.kv{ margin:0; display:grid; grid-template-columns:34mm 1fr 34mm 1fr; gap:1.8mm 4mm; font-size:8.4pt }
  dl.kv dt{ color:var(--gris) } dl.kv dd{ margin:0; font-weight:600; overflow-wrap:anywhere }
  .resume{ margin-top:6mm; padding:3.6mm 4.4mm; border-left:2.2px solid var(--taupe); background:var(--creme); break-inside:avoid }
  .resume p{ margin:1.4mm 0 0; font-size:9pt; line-height:1.6 }
  .art{ margin-top:6mm; break-inside:avoid }
  .art h2{ margin:0 0 2mm; font-size:9.4pt; font-weight:700 }
  .art h2 span{ color:var(--taupe-fonce) }
  table.lignes{ width:100%; border-collapse:separate; border-spacing:0 }
  .lignes thead th{ background:var(--noir); color:#fff; font-family:'Montserrat','Segoe UI',Arial,sans-serif; font-weight:700; font-size:7.6pt; padding:2.6mm 3.5mm; text-align:right }
  .lignes thead th:first-child{ text-align:left; border-radius:2.4mm 0 0 2.4mm }
  .lignes thead th:last-child{ border-radius:0 2.4mm 2.4mm 0 }
  .lignes td{ padding:3mm 3.5mm; border-bottom:1px solid var(--filet); text-align:right; vertical-align:top }
  .lignes td:first-child{ text-align:left }
  .lignes .d1{ font-weight:600; font-size:8.8pt; overflow-wrap:anywhere }
  .lignes .d2{ color:var(--gris); font-size:7.8pt; margin-top:.5mm; overflow-wrap:anywhere }
  .lignes td.tot{ font-weight:700 }
  .cards{ display:grid; grid-template-columns:1fr 1fr; gap:4mm; margin-top:6mm }
  .card{ border:1px solid var(--filet); border-radius:3mm; padding:3.6mm 4mm; break-inside:avoid }
  .card.fill{ background:var(--creme); border-color:var(--creme) }
  .card .label{ margin-bottom:1.8mm }
  .card .nom{ font-family:'Montserrat','Segoe UI',Arial,sans-serif; font-weight:700; font-size:10pt; margin-bottom:.8mm; overflow-wrap:anywhere }
  .card p{ margin:0; color:var(--gris); font-size:8pt }
  .total{ margin-top:5mm; background:var(--noir); color:#fff; border-radius:3mm; padding:4.2mm 5mm; display:flex; justify-content:space-between; align-items:center; font-family:'Montserrat','Segoe UI',Arial,sans-serif; break-inside:avoid }
  .total .t{ font-weight:600; font-size:8.8pt; color:#E4DDD6 } .total .m{ font-weight:800; font-size:13pt }
  .note{ margin-top:5mm; padding:3.2mm 4mm; border-left:2.2px solid var(--taupe); background:var(--creme); font-size:8.2pt; break-inside:avoid }
  .accept{ display:grid; grid-template-columns:1.15fr 1fr; gap:10mm; margin-top:7mm; align-items:end; break-inside:avoid }
  .accept p{ margin:0; font-size:7.8pt; color:var(--gris) }
  .accept .titre-s{ font-family:'Montserrat','Segoe UI',Arial,sans-serif; font-weight:700; font-size:8pt; text-transform:uppercase; margin-bottom:1.2mm; color:var(--noir) }
  .cachet{ height:27mm; border:1px solid var(--taupe-fonce); border-radius:3mm; padding:2.6mm 3.4mm; font-size:7.8pt; color:var(--gris) }
  footer{ margin-top:auto; padding-top:8mm; display:flex; align-items:flex-end; gap:6mm; font-size:7pt; line-height:1.4; color:var(--noir) }
  footer .sym{ height:11mm; width:auto; display:block; border:1px solid var(--noir); border-radius:1.6mm; padding:1mm }
  footer .col{ min-width:0 }
  footer .candles{ margin-left:auto; height:18mm; width:auto }
  .conf{ margin-top:4mm; font-size:6.6pt; color:var(--gris) }
  @media screen{ body{ background:#eee } .page{ background:#fff; box-shadow:0 0 0 1px #ddd } }
  @media print{ body{ background:#fff } .page{ box-shadow:none; min-height:297mm } }`;

export interface CharterDocument {
  /** Titre de la fenêtre / du PDF. */
  windowTitle: string;
  /** Titre du document, en majuscules (« FICHE ENTREPRISE », « OFFRE »). */
  heading: string;
  /** Numéro ou référence du document. */
  number: string;
  /** Corps du document (HTML déjà échappé). */
  body: string;
  /** Mention de confidentialité en bas de page. */
  note?: string;
}

/** Enveloppe commune : en-tête, corps, pied de page légal de la charte. Le corps doit être déjà échappé par l'appelant. */
export function renderCharterDocument(doc: CharterDocument): string {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(doc.windowTitle)}</title>
<style>${STYLE}
</style>
</head>
<body>
<div class="page">
  <header>
    <img src="${LOGO_HORIZONTAL}" alt="Investally">
    <div class="doc-title"><h1>${esc(doc.heading)}</h1><div class="num">N° ${esc(doc.number)}</div></div>
  </header>
${doc.body}
  ${doc.note ? `<p class="conf">${esc(doc.note)}</p>` : ''}
  <footer>
    <img class="sym" src="${LOGO_SYMBOLE}" alt="">
    <div class="col">${LEGAL_FOOTER.contact.map(esc).join('<br>')}</div>
    <div class="col">${LEGAL_FOOTER.registration.map(esc).join('<br>')}</div>
    ${CANDLES}
  </footer>
</div>
</body>
</html>`;
}
