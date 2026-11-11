'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { OfferDialogs } from '../../../../components/offers/offer-dialogs';
import { Badge } from '../../../../components/data/badge';
import { Card } from '../../../../components/data/card';
import { EntityLink } from '../../../../components/entity-link';
import { EntitySheet, SheetState, useEntity } from '../../../../components/entity-sheet';
import { api, ApiError } from '../../../../lib/api';
import { openOfferSheet } from '../../../../lib/export-sheet';
import { useAuth } from '../../../../lib/auth-context';
import { listFor } from '../../../../lib/company-context';
import { formatDate } from '../../../../lib/format';
import { formatAmount } from '../../../../lib/offers';
import { can } from '../../../../lib/permissions';
import { OFFER_STATUS, statusStyle } from '../../../../lib/status';
import type { Followup, Offer, Page } from '../../../../lib/types';

const FOLLOWUP_STATUS: Record<string, string> = { PLANNED: 'À faire', DONE: 'Terminée', CANCELLED: 'Annulée' };

/** Fiche d'une offre : état, montant, entreprise (lien), relances de l'offre. Le cycle de vie se pilote depuis la liste des offres. */
export default function OfferSheetPage() {
  const { profile } = useAuth();
  const { entity: offer, error } = useEntity<Offer>('offers');
  const [followups, setFollowups] = useState<Followup[] | null>(null);
  const [cloning, setCloning] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const canFollowups = can(profile, 'bd.followup.read');
  const offerId = offer?.id;
  useEffect(() => {
    if (!offerId || !canFollowups) return;
    api<Page<Followup>>(`/followups?offerId=${encodeURIComponent(offerId)}&pageSize=50`).then((p) => setFollowups(p.items)).catch(() => setFollowups([]));
  }, [offerId, canFollowups]);

  /** Exporte l'offre au format de la charte graphique : le serveur contrôle la portée et trace l'export ; le navigateur propose l'enregistrement en PDF. */
  async function exportOffer(id: string) {
    setExportError(null);
    try {
      await openOfferSheet(id);
    } catch (e) {
      setExportError(e instanceof ApiError || e instanceof Error ? e.message : 'Export impossible');
    }
  }

  if (!offer) return <SheetState kind="offer" error={error} loaded={false} listHref="/offers" listLabel="Toutes les offres" />;
  const status = statusStyle(OFFER_STATUS, offer.status);
  return (
    <EntitySheet
      eyebrow="Business Development · Offre"
      title={offer.reference}
      description={offer.subject}
      listHref="/offers"
      listLabel="Toutes les offres"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="secondary" onClick={() => void exportOffer(offer.id)}>Exporter l’offre</button>
          {can(profile, 'bd.offer.create') && <button type="button" className="secondary" onClick={() => setCloning(true)}>Cloner en nouveau brouillon</button>}
          {exportError && <p role="alert" className="error m-0">{exportError}</p>}
        </div>
      }
      facts={[
        { label: 'État', value: <Badge tone={status.tone}>{status.label}</Badge> },
        { label: 'Entreprise', value: <EntityLink kind="company" id={offer.companyId} label={offer.companyName}>{offer.companyName}</EntityLink> },
        { label: 'Montant', value: formatAmount(offer.amount, offer.currency) },
        { label: 'Déposée le', value: formatDate(offer.submittedAt) },
        { label: 'Décision le', value: formatDate(offer.decidedAt) },
        { label: 'Créée le', value: formatDate(offer.createdAt) },
        ...(offer.withdrawnReason ? [{ label: 'Motif du retrait', value: offer.withdrawnReason }] : []),
        ...(offer.note ? [{ label: 'Note', value: offer.note }] : []),
      ]}
    >
      {canFollowups && (
        <Card className="mb-8">
          <div className="flex items-center justify-between gap-4 p-5 pb-0">
            <h2 className="m-0 text-[length:var(--text-lg)]">Relances de l’offre</h2>
            <Link href={`/followups?offerId=${offer.id}`}>Ouvrir dans les relances</Link>
          </div>
          <div className="p-5">
            {followups === null ? <p role="status" className="m-0">Chargement…</p> : followups.length === 0 ? <p className="m-0 text-ink-2">Aucune relance pour cette offre.</p> : (
              <ul className="m-0 list-none p-0">
                {followups.map((f) => (
                  <li key={f.id} className="flex flex-wrap items-center gap-3 border-b border-line py-2 last:border-0">
                    <strong>{formatDate(`${f.dueOn}T00:00:00Z`)}</strong>
                    <Badge tone={f.overdue ? 'bad' : f.status === 'DONE' ? 'ok' : 'neutral'}>{f.overdue ? 'En retard' : (FOLLOWUP_STATUS[f.status] ?? f.status)}</Badge>
                    <span className="text-ink-2">{f.note ?? f.resultNote ?? ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      )}
      {cloning && <OfferDialogs dialog={{ kind: 'clone', offer }} onClose={() => setCloning(false)} onDone={async () => setCloning(false)} />}
      <nav aria-label={`Autour de ${offer.companyName}`} className="flex flex-wrap gap-4">
        {can(profile, 'bd.contact.read') && <Link href={listFor('/contacts', offer.companyId)}>Contacts de {offer.companyName}</Link>}
        {can(profile, 'bd.opportunity.read') && <Link href={listFor('/opportunities', offer.companyId)}>Opportunités de {offer.companyName}</Link>}
        {can(profile, 'bd.offer.read') && <Link href={listFor('/offers', offer.companyId)}>Autres offres de {offer.companyName}</Link>}
      </nav>
    </EntitySheet>
  );
}
