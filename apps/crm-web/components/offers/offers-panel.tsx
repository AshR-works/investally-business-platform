'use client';

import Link from 'next/link';
import { EntityLink } from '../entity-link';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { formatAmount } from '../../lib/offers';
import { OFFER_STATUS, statusStyle } from '../../lib/status';
import type { Offer, Page } from '../../lib/types';
import { Badge } from '../data/badge';
import { Card } from '../data/card';
import { OfferDialogs, type OfferDialogState } from './offer-dialogs';
import { OfferRowActions, useOfferRights } from './offer-row-actions';

/**
 * Offres d'une entreprise, dans sa fiche : liste, création, modification d'un brouillon, dépôt, réponse du client, retrait.
 * Chaque bouton n'apparaît que si l'état de l'offre ET les droits de l'utilisateur le permettent ; le serveur re-contrôle chaque
 * requête, et la portée est celle de l'entreprise.
 */
export function OffersPanel({ company, archived }: { company: { id: string; name: string }; archived: boolean }) {
  const rights = useOfferRights();
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<OfferDialogState | null>(null);

  const load = useCallback(async () => {
    try {
      const page = await api<Page<Offer>>(`/offers?companyId=${company.id}&pageSize=100`);
      setOffers(page.items);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Chargement des offres impossible');
    }
  }, [company.id]);
  useEffect(() => {
    void load();
  }, [load]);

  const canCreate = rights.create && !archived;
  // Une entreprise archivée fige ses offres : on ne propose plus que la consultation de la décharge et des documents.
  const actionRights = archived ? { ...rights, update: false, withdraw: false } : rights;
  const showActions = actionRights.update || actionRights.withdraw || !!actionRights.receiptRead || !!actionRights.documentsRead;
  return (
    <Card className="mb-8">
      <section aria-labelledby="offers-title" className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="offers-title" className="m-0 text-[length:var(--text-md)]">Offres</h2>
          <div className="flex flex-wrap items-center gap-3">
            <Link href={`/offers?companyId=${company.id}`} className="text-ink">Ouvrir les offres de l’entreprise</Link>
            {canCreate && <button type="button" className="secondary" onClick={() => setDialog({ kind: 'create', company })}>Nouvelle offre</button>}
          </div>
        </div>
        {error && <p role="alert" className="error">{error}</p>}
        {offers === null && !error && <p role="status" className="m-0 text-ink-2">Chargement…</p>}
        {offers?.length === 0 && <p className="m-0 text-ink-2">Aucune offre pour cette entreprise{canCreate ? ' : préparez la première.' : '.'}</p>}
        {offers && offers.length > 0 && (
          <div className="table-wrap">
            <table>
              <caption className="sr-only">Offres faites à {company.name}</caption>
              <thead><tr><th scope="col">Référence</th><th scope="col">Objet</th><th scope="col">Montant</th><th scope="col">État</th><th scope="col">Déposée le</th><th scope="col">Prochaine relance</th>{showActions && <th scope="col"><span className="sr-only">Actions</span></th>}</tr></thead>
              <tbody>
                {offers.map((o) => {
                  const style = statusStyle(OFFER_STATUS, o.status);
                  return (
                    <tr key={o.id}>
                      <td><EntityLink kind="offer" id={o.id} label={o.reference}><strong>{o.reference}</strong></EntityLink></td>
                      <td>{o.subject}{o.withdrawnReason && <span className="block text-[length:var(--text-sm)] text-ink-2">Motif du retrait : {o.withdrawnReason}</span>}</td>
                      <td>{formatAmount(o.amount, o.currency)}</td>
                      <td><Badge tone={style.tone}>{style.label}</Badge></td>
                      <td>{formatDate(o.submittedAt)}</td>
                      <td>{o.nextFollowupOn ? formatDate(`${o.nextFollowupOn}T00:00:00Z`) : '—'}</td>
                      {showActions && <td><OfferRowActions offer={o} rights={actionRights} onAction={(kind, offer) => setDialog({ kind, offer })} /></td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <OfferDialogs dialog={dialog} onClose={() => setDialog(null)} onDone={async () => { setDialog(null); await load(); }} onRefresh={load} />
    </Card>
  );
}
