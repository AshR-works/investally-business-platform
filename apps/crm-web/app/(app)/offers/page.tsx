'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '../../../components/data/badge';
import { Card } from '../../../components/data/card';
import { DataTable, type Column } from '../../../components/data/data-table';
import { PageHeader } from '../../../components/data/page-header';
import { Pagination } from '../../../components/data/pagination';
import { SelectionBar } from '../../../components/data/selection-bar';
import { QuickFilters, SearchField, Toolbar } from '../../../components/data/toolbar';
import { Icon } from '../../../components/icon';
import { OfferDialogs, type OfferDialogState } from '../../../components/offers/offer-dialogs';
import { OfferRowActions, useOfferRights } from '../../../components/offers/offer-row-actions';
import { PageHeading } from '../../../components/page-heading';
import { api, ApiError } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { formatDate } from '../../../lib/format';
import { formatAmount } from '../../../lib/offers';
import { can } from '../../../lib/permissions';
import { OFFER_STATUS, statusStyle } from '../../../lib/status';
import type { Offer, Page } from '../../../lib/types';

const PAGE_SIZE = 20;

/** Filtre par état : « Toutes » puis chaque état de l'offre. */
const STATUS_OPTIONS = [{ value: '', label: 'Toutes' }, ...Object.entries(OFFER_STATUS).map(([value, style]) => ({ value, label: style.label }))];

/**
 * Offres visibles selon la portée de l'utilisateur (celle de leur entreprise) : recherche, filtre par état, pagination,
 * sélection persistante, et le cycle d'une offre (créer, modifier, déposer, réponse du client, retirer) depuis le menu d'une ligne.
 */
export default function OffersPage() {
  const { profile } = useAuth();
  const rights = useOfferRights();
  const [data, setData] = useState<Page<Offer>>({ items: [], total: 0 });
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<OfferDialogState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const canRead = can(profile, 'bd.offer.read');

  const load = useCallback(async () => {
    if (!canRead) return;
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (query) params.set('search', query);
    if (status) params.set('status', status);
    try {
      setData(await api<Page<Offer>>(`/offers?${params}`));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [canRead, page, query, status]);
  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo<Column<Offer>[]>(() => [
    { id: 'reference', weight: 2, header: 'Référence', cell: (o) => <strong>{o.reference}</strong> },
    { id: 'subject', weight: 4, header: 'Objet', cell: (o) => o.subject },
    { id: 'company', weight: 3, header: 'Entreprise', cell: (o) => <Link href={`/companies/${o.companyId}`} className="text-ink no-underline hover:underline">{o.companyName}</Link> },
    { id: 'amount', weight: 2.4, header: 'Montant', align: 'right', cell: (o) => formatAmount(o.amount, o.currency) },
    { id: 'status', weight: 1.8, header: 'État', cell: (o) => { const style = statusStyle(OFFER_STATUS, o.status); return <Badge tone={style.tone}>{style.label}</Badge>; } },
    { id: 'submitted', weight: 2, header: 'Déposée le', cell: (o) => formatDate(o.submittedAt) },
    { id: 'next', weight: 2.2, header: 'Prochaine relance', cell: (o) => (o.nextFollowupOn ? formatDate(`${o.nextFollowupOn}T00:00:00Z`) : <span className="text-ink-2">—</span>) },
    { id: 'actions', weight: 0.8, header: 'Actions', srOnlyHeader: true, align: 'right', cell: (o) => <OfferRowActions offer={o} rights={rights} onAction={(kind, offer) => setDialog({ kind, offer })} /> },
  ], [rights]);

  if (!canRead) {
    return (
      <>
        <PageHeading>Offres</PageHeading>
        <p>Votre profil n&apos;a pas accès aux offres.</p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Business Development"
        title="Offres"
        description="Les offres faites aux entreprises visibles selon votre périmètre."
        actions={rights.create && (
          <button type="button" onClick={() => setDialog({ kind: 'create' })} className="inline-flex items-center gap-2">
            <Icon name="plus" className="size-4" />Nouvelle offre
          </button>
        )}
      />
      <SelectionBar count={selected.size} onClear={() => setSelected(new Set())} />
      {loadError && <p role="alert" className="error">{loadError}</p>}
      <Card>
        <Toolbar>
          <QuickFilters label="Filtrer par état" value={status} options={STATUS_OPTIONS} onChange={(value) => { setPage(1); setStatus(value); }} />
        </Toolbar>
        <Toolbar>
          <p className="m-0 text-[length:var(--text-sm)] font-semibold" aria-live="polite">{data.total} offre{data.total > 1 ? 's' : ''}</p>
          <SearchField label="Rechercher une offre" onSearch={(value) => { setPage(1); setQuery(value); }} />
        </Toolbar>
        <DataTable
          caption="Offres"
          columns={columns}
          rows={data.items}
          rowId={(o) => o.id}
          rowLabel={(o) => o.reference}
          selection={{ selected, onChange: setSelected }}
          busy={loading}
          empty={query || status ? 'Aucune offre ne correspond à ces critères.' : 'Aucune offre pour le moment.'}
        />
        <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPage={setPage} />
      </Card>
      <OfferDialogs dialog={dialog} onClose={() => setDialog(null)} onDone={async () => { setDialog(null); setPage(1); await load(); }} onRefresh={load} />
    </>
  );
}
