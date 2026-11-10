import { CompanyView } from './company-view';
import { esc, kv, longDate, renderCharterDocument } from './charter/charter';

export { esc };

/** Libellés des statuts et des méthodes de contact (mêmes que l'interface). */
const STATUS: Record<string, string> = { TARGET: 'Cible', CONTACTED: 'Contactée', QUALIFIED: 'Qualifiée', CLIENT: 'Cliente', ARCHIVED: 'Archivée' };
const METHOD: Record<string, string> = {
  WHATSAPP_MESSAGE: 'Message WhatsApp', PHONE_CALL: 'Appel téléphonique', EMAIL: 'E-mail', MEETING: 'Rencontre', OTHER: 'Autre',
};

const money = (value: string): string => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value));
/** Référence lisible du document : ne contient aucune donnée personnelle. */
export const sheetReference = (company: CompanyView): string => `FIC-${company.id.replace(/-/g, '').slice(-8).toUpperCase()}`;

/**
 * Fiche d'entreprise imprimable (HTML autonome) selon la charte graphique des documents administratifs. Ne contient que ce que l'appelant a le droit
 * de voir : le facilitateur et la commission figurent dans la vue seulement s'ils lui sont accordés, et ce gabarit n'ajoute rien.
 */
export function renderCompanySheet(company: CompanyView, exportedAt: Date): string {
  const link = company.facilitation;
  const facilitator = link?.facilitator ?? null;
  const commission = link && 'commission' in link ? link.commission : undefined;
  const status = STATUS[company.status] ?? company.status;

  const commissionText = (): string => {
    if (!commission) return 'Aucune';
    if (commission.type === 'PERCENT') return `${money(commission.value)} %`;
    return `${money(commission.value)} ${commission.currency === 'XAF' ? 'FCFA' : (commission.currency ?? '')}`.trim();
  };

  const line = (label: string, value: string | null | undefined): string =>
    `<tr><td><div class="d1">${esc(label)}</div></td><td class="tot">${value ? esc(value) : '<span class="muted">—</span>'}</td></tr>`;

  const relationRows = !link
    ? ''
    : [
        line('Facilitateur', facilitator ? `${facilitator.firstName} ${facilitator.lastName}` : 'Non visible avec vos droits'),
        facilitator ? line('Téléphone du facilitateur', facilitator.phone) : '',
        line('Méthode de prise de contact', METHOD[link.contactMethod] ?? link.contactMethod),
        line('Employé de l’entreprise', link.isCompanyEmployee ? 'Oui' : 'Non'),
        facilitator?.comment ? line('Commentaire sur le facilitateur', facilitator.comment) : '',
        commission === undefined ? '' : line('Commission', commissionText()),
      ].join('');

  const relation = !link
    ? '<p class="muted">Aucun facilitateur renseigné.</p>'
    : `<table class="lignes"><thead><tr><th>Rubrique</th><th>Valeur</th></tr></thead><tbody>${relationRows}</tbody></table>`;

  const body = `
  <div class="titre"><div class="label">Fiche entreprise · interne</div><div class="t">${esc(company.name)}</div><span class="accent"></span></div>

  <section class="meta">
    <dl class="kv">
      ${kv('Statut', status)}${kv('Date d’export', longDate(exportedAt))}
      ${kv('Créée le', longDate(company.createdAt))}${kv('Diffusion', 'Interne — confidentiel')}
      ${kv('Référence', sheetReference(company))}
    </dl>
  </section>

  <section class="art"><h2><span>1 —</span> Identité</h2>
    <table class="lignes"><thead><tr><th>Rubrique</th><th>Valeur</th></tr></thead><tbody>
      ${line('Secteur d’activité', company.sector)}${line('Pays', company.country)}${line('E-mail', company.email)}${line('Téléphone', company.phone)}
    </tbody></table></section>

  <section class="art"><h2><span>2 —</span> Mise en relation</h2>${relation}</section>`;

  return renderCharterDocument({
    windowTitle: `Fiche entreprise — ${company.name}`,
    heading: 'FICHE ENTREPRISE',
    number: sheetReference(company),
    body,
    note: 'Document confidentiel, réservé à un usage interne. Chaque export est enregistré dans le journal d’audit.',
  });
}
