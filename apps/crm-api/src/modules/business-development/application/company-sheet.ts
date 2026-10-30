import { CompanyView } from './company-view';

/** Libellés des statuts et des méthodes de contact (mêmes que l'interface). */
const STATUS: Record<string, string> = { TARGET: 'Cible', CONTACTED: 'Contactée', QUALIFIED: 'Qualifiée', CLIENT: 'Cliente', ARCHIVED: 'Archivée' };
const METHOD: Record<string, string> = {
  WHATSAPP_MESSAGE: 'Message WhatsApp', PHONE_CALL: 'Appel téléphonique', EMAIL: 'E-mail', MEETING: 'Rencontre', OTHER: 'Autre',
};

/** Échappe le texte saisi par les utilisateurs : rien de ce qui est affiché ne peut être interprété comme du HTML. */
export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const longDate = (value: string | Date): string =>
  new Date(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const money = (value: string): string => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value));
const row = (label: string, value: string | null | undefined): string =>
  `<div class="row"><dt>${esc(label)}</dt><dd>${value ? esc(value) : '<span class="muted">—</span>'}</dd></div>`;

/** Référence lisible du document : ne contient aucune donnée personnelle. */
export const sheetReference = (company: CompanyView): string => `FIC-${company.id.replace(/-/g, '').slice(-8).toUpperCase()}`;

/**
 * Fiche d'entreprise imprimable (HTML autonome, aux couleurs de l'application ; gabarit PROVISOIRE en attendant la charte
 * des documents). Ne contient que ce que l'appelant a le droit de voir : le facilitateur et la commission figurent dans
 * la vue seulement s'ils lui sont accordés, et ce gabarit n'ajoute rien.
 */
export function renderCompanySheet(company: CompanyView, exportedAt: Date): string {
  const link = company.facilitation;
  const facilitator = link?.facilitator ?? null;
  const commission = link && 'commission' in link ? link.commission : undefined;

  const commissionText = (): string => {
    if (!commission) return 'Aucune';
    if (commission.type === 'PERCENT') return `${money(commission.value)} %`;
    return `${money(commission.value)} ${commission.currency === 'XAF' ? 'FCFA' : (commission.currency ?? '')}`.trim();
  };

  const relation = !link
    ? '<p class="muted">Aucun facilitateur renseigné.</p>'
    : `<dl>
        ${row('Facilitateur', facilitator ? `${facilitator.firstName} ${facilitator.lastName}` : 'Non visible avec vos droits')}
        ${facilitator ? row('Téléphone du facilitateur', facilitator.phone) : ''}
        ${row('Méthode de prise de contact', METHOD[link.contactMethod] ?? link.contactMethod)}
        ${row('Employé de l’entreprise', link.isCompanyEmployee ? 'Oui' : 'Non')}
        ${facilitator?.comment ? row('Commentaire sur le facilitateur', facilitator.comment) : ''}
        ${commission === undefined ? '' : row('Commission', commissionText())}
      </dl>`;

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Fiche entreprise — ${esc(company.name)}</title>
<style>
  @page { size: A4; margin: 16mm; }
  :root { --ink: #1d1d1b; --ink-2: #5c5651; --taupe: #f5f1ed; --line: #e0d9d2; --dark: #2f2c2a; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px; font: 14px/1.5 system-ui, 'Segoe UI', Roboto, sans-serif; color: var(--ink); background: #fff; }
  .page { max-width: 780px; margin: 0 auto; }
  header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; padding-bottom: 16px; border-bottom: 1px solid var(--line); }
  .brand { display: flex; gap: 12px; align-items: center; }
  .mark { width: 40px; height: 40px; border: 2px solid var(--dark); border-radius: 8px; display: grid; place-items: center; font-weight: 800; }
  .brand strong { display: block; font-size: 16px; }
  .brand span, .muted { color: var(--ink-2); }
  h1 { margin: 0; font-size: 28px; letter-spacing: .02em; text-align: right; }
  .ref { text-align: right; color: var(--ink-2); font-size: 13px; }
  .badge { display: inline-block; margin-top: 6px; padding: 2px 12px; border-radius: 999px; background: #faecd4; color: #6b4a12; font-size: 12px; font-weight: 600; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 20px 0; }
  .card { background: var(--taupe); border-radius: 12px; padding: 16px 18px; break-inside: avoid; }
  .card.plain { background: #fff; border: 1px solid var(--line); }
  h2 { margin: 0 0 10px; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-2); }
  .name { font-size: 20px; font-weight: 700; margin: 0 0 6px; }
  dl { margin: 0; } .row { display: flex; justify-content: space-between; gap: 16px; padding: 4px 0; }
  dt { color: var(--ink-2); } dd { margin: 0; font-weight: 600; text-align: right; overflow-wrap: anywhere; }
  section.wide { margin: 0 0 16px; }
  footer { margin-top: 28px; padding-top: 12px; border-top: 1px solid var(--line); color: var(--ink-2); font-size: 12px; }
</style>
</head>
<body>
<div class="page">
  <header>
    <div class="brand"><div class="mark">i</div><div><strong>Investally Group</strong><span>Fiche interne</span></div></div>
    <div><h1>FICHE ENTREPRISE</h1><div class="ref">${esc(sheetReference(company))}</div><div class="ref"><span class="badge">${esc(STATUS[company.status] ?? company.status)}</span></div></div>
  </header>
  <div class="grid">
    <div class="card">
      <h2>Entreprise</h2>
      <p class="name">${esc(company.name)}</p>
      <dl>${row('Secteur d’activité', company.sector)}${row('Pays', company.country)}${row('E-mail', company.email)}${row('Téléphone', company.phone)}</dl>
    </div>
    <div class="card plain">
      <h2>Détails</h2>
      <dl>${row('Statut', STATUS[company.status] ?? company.status)}${row('Créée le', longDate(company.createdAt))}${row('Exportée le', longDate(exportedAt))}</dl>
    </div>
  </div>
  <section class="card wide"><h2>Mise en relation</h2>${relation}</section>
  <footer>Document confidentiel, réservé à un usage interne. Chaque export est enregistré dans le journal d’audit.</footer>
</div>
</body>
</html>`;
}
