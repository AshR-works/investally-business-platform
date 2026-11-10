import { currencyLabel, esc, formatAmount, kv, longDate, renderCharterDocument } from './charter/charter';
import { OfferView } from './offer-view';

const STATUS: Record<string, string> = {
  DRAFT: 'Brouillon', SUBMITTED: 'Déposée', RECEIPT_RECEIVED: 'Décharge reçue', ACCEPTED: 'Acceptée', REFUSED: 'Refusée', WITHDRAWN: 'Retirée',
};

/**
 * Offre imprimable (HTML autonome) selon la charte graphique des documents administratifs, sur le modèle du devis : en-tête « OFFRE » et
 * référence, encarts émetteur / destinataire, tableau à en-tête noir, bloc de total, suivi, et cadre « Bon pour accord » pour l'acceptation
 * de l'entreprise. Le montant est celui saisi sur l'offre : le document n'ajoute ni taxe ni calcul.
 */
export function renderOfferSheet(offer: OfferView, exportedAt: Date): string {
  const status = STATUS[offer.status] ?? offer.status;
  const amount = `${formatAmount(offer.amount)} ${currencyLabel(offer.currency)}`.trim();

  const body = `
  <div class="titre"><div class="label">Offre commerciale</div><div class="t">${esc(offer.subject)}</div><span class="accent"></span></div>

  <section class="cards">
    <div class="card fill"><div class="label">Émetteur</div><div class="nom">Investally</div><p>Douala – Cameroun</p></div>
    <div class="card"><div class="label">Destinataire</div><div class="nom">${esc(offer.companyName)}</div><p>Offre n° ${esc(offer.reference)}</p></div>
  </section>

  <section class="meta">
    <dl class="kv">
      ${kv('Référence', offer.reference)}${kv('État', status)}
      ${kv('Établie le', longDate(offer.createdAt))}${kv('Déposée le', offer.submittedAt ? longDate(offer.submittedAt) : null)}
      ${kv('Décision le', offer.decidedAt ? longDate(offer.decidedAt) : null)}${kv('Date d’export', longDate(exportedAt))}
    </dl>
  </section>

  <section class="art">
    <table class="lignes"><thead><tr><th>Description</th><th style="width:48mm">Montant (${esc(currencyLabel(offer.currency))})</th></tr></thead><tbody>
      <tr><td><div class="d1">${esc(offer.subject)}</div>${offer.note ? `<div class="d2">${esc(offer.note)}</div>` : ''}</td><td class="tot">${esc(formatAmount(offer.amount))}</td></tr>
    </tbody></table>
  </section>

  <div class="total"><span class="t">Montant de l’offre</span><span class="m">${esc(amount)}</span></div>
  ${offer.withdrawnReason ? `<div class="note"><b>Motif du retrait :</b> ${esc(offer.withdrawnReason)}</div>` : ''}

  <section class="accept">
    <div><div class="titre-s">Acceptation</div><p>Pour accepter cette offre, merci de nous la retourner datée, signée et revêtue du cachet de l’entreprise, précédée de la mention « Bon pour accord ».</p></div>
    <div class="cachet">Bon pour accord, date, nom, cachet et signature</div>
  </section>`;

  return renderCharterDocument({ windowTitle: `Offre ${offer.reference}`, heading: 'OFFRE', number: offer.reference, body });
}
