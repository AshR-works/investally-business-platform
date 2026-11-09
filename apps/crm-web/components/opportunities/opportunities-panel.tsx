'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { formatAmount } from '../../lib/offers';
import { OPPORTUNITY_STATUS, stageLabel } from '../../lib/opportunities';
import { statusStyle } from '../../lib/status';
import type { Opportunity, Page } from '../../lib/types';
import { Badge } from '../data/badge';
import { Card } from '../data/card';

/**
 * Opportunités d'une entreprise, dans sa fiche (vue 360°) : lecture seule. Les actions (avancer, déroger, clore) se font dans le
 * module « Opportunités », qui contrôle les droits ; la portée est celle de l'entreprise.
 */
export function OpportunitiesPanel({ company }: { company: { id: string; name: string } }) {
  const [items, setItems] = useState<Opportunity[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<Page<Opportunity>>(`/opportunities?companyId=${company.id}&pageSize=100`)
      .then((page) => {
        if (!cancelled) setItems(page.items);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : 'Chargement des opportunités impossible');
      });
    return () => {
      cancelled = true;
    };
  }, [company.id]);

  return (
    <Card className="mb-8">
      <section aria-labelledby="opportunities-title" className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="opportunities-title" className="m-0 text-[length:var(--text-md)]">Opportunités</h2>
          <Link href={`/opportunities?companyId=${company.id}`} className="text-ink">Ouvrir le pipeline de l’entreprise</Link>
        </div>
        {error && <p role="alert" className="error">{error}</p>}
        {items === null && !error && <p role="status" className="m-0 text-ink-2">Chargement…</p>}
        {items?.length === 0 && <p className="m-0 text-ink-2">Aucune opportunité pour cette entreprise.</p>}
        {items && items.length > 0 && (
          <div className="table-wrap">
            <table>
              <caption className="sr-only">Opportunités de {company.name}</caption>
              <thead><tr><th scope="col">Intitulé</th><th scope="col">Montant</th><th scope="col">Étape</th><th scope="col">État</th><th scope="col">Dernière activité</th></tr></thead>
              <tbody>
                {items.map((o) => {
                  const style = statusStyle(OPPORTUNITY_STATUS, o.status);
                  return (
                    <tr key={o.id}>
                      <td><strong>{o.title}</strong></td>
                      <td>{formatAmount(o.amount, o.currency)}</td>
                      <td>{stageLabel(o.stage)}</td>
                      <td><Badge tone={style.tone}>{style.label}</Badge>{o.waivedAt && <> <Badge tone="warn">Dérogation</Badge></>}</td>
                      <td>{formatDate(o.lastActivityAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </Card>
  );
}
