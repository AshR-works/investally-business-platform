'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AmbassadorDialog } from '../../../components/ambassadors/ambassador-dialog';
import { Badge } from '../../../components/data/badge';
import { Card } from '../../../components/data/card';
import { DataTable, type Column } from '../../../components/data/data-table';
import { EntityCell } from '../../../components/data/entity-cell';
import { PageHeader } from '../../../components/data/page-header';
import { Pagination } from '../../../components/data/pagination';
import { RowAction, RowActions } from '../../../components/data/row-actions';
import { SearchField, Toolbar } from '../../../components/data/toolbar';
import { Icon } from '../../../components/icon';
import { PageHeading } from '../../../components/page-heading';
import { api, ApiError } from '../../../lib/api';
import { AMBASSADOR_ORIGINS, originLabel, sinceLabel } from '../../../lib/ambassadors';
import { useAuth } from '../../../lib/auth-context';
import { can } from '../../../lib/permissions';
import type { Ambassador, Page } from '../../../lib/types';

const PAGE_SIZE = 20;

/**
 * Ambassadeurs : clients ou apprenants devenus relais commerciaux, visibles selon la portée de l'utilisateur (les siens pour le chargé
 * de compte, ceux de son équipe ou de tous pour le Responsable commercial et la Direction). Recherche, filtre par origine, pagination ;
 * création et modification dans une fenêtre, selon les droits. La création est toujours une décision manuelle.
 */
export default function AmbassadorsPage() {
  const { profile } = useAuth();
  const [data, setData] = useState<Page<Ambassador>>({ items: [], total: 0 });
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [origin, setOrigin] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ ambassador?: Ambassador } | null>(null);
  const canRead = can(profile, 'bd.ambassador.read');
  const canCreate = can(profile, 'bd.ambassador.create');
  const canUpdate = can(profile, 'bd.ambassador.update');

  const load = useCallback(async () => {
    if (!canRead) return;
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (query) params.set('search', query);
    if (origin) params.set('origin', origin);
    try {
      setData(await api<Page<Ambassador>>(`/ambassadors?${params}`));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [canRead, page, query, origin]);
  useEffect(() => {
    void load();
  }, [load]);

  if (!canRead) {
    return (
      <>
        <PageHeading>Ambassadeurs</PageHeading>
        <p>Votre profil n&apos;a pas accès aux ambassadeurs.</p>
      </>
    );
  }

  const columns: Column<Ambassador>[] = [
    { id: 'name', weight: 3, header: 'Ambassadeur', cell: (a) => <EntityCell name={`${a.firstName} ${a.lastName}`} /> },
    { id: 'origin', weight: 1.6, header: 'Origine', cell: (a) => <Badge tone="neutral">{originLabel(a.origin)}</Badge> },
    { id: 'company', weight: 3, header: 'Entreprise', cell: (a) => (a.companyId ? <Link href={`/companies/${a.companyId}`} className="text-ink no-underline hover:underline">{a.companyName}</Link> : <span className="text-ink-2">—</span>) },
    { id: 'since', weight: 1.4, header: 'Depuis', cell: (a) => sinceLabel(a.appointedOn) },
    { id: 'email', weight: 3.2, header: 'E-mail', cell: (a) => a.email ?? <span className="text-ink-2">—</span> },
    { id: 'phone', weight: 2.4, header: 'Téléphone', cell: (a) => a.phone ?? <span className="text-ink-2">—</span> },
    ...(canUpdate
      ? [{ id: 'actions', weight: 0.8, header: 'Actions', srOnlyHeader: true, cell: (a: Ambassador) => (
          <RowActions label={`Actions pour l’ambassadeur ${a.firstName} ${a.lastName}`}>
            <RowAction onClick={() => setDialog({ ambassador: a })}>Modifier</RowAction>
          </RowActions>
        ) } satisfies Column<Ambassador>]
      : []),
  ];

  return (
    <>
      <PageHeader
        eyebrow="Business Development"
        title="Ambassadeurs"
        description="Clients ou apprenants devenus relais commerciaux. Créer un ambassadeur est toujours une décision manuelle."
        actions={canCreate && (
          <button type="button" onClick={() => setDialog({})} className="inline-flex items-center gap-2">
            <Icon name="plus" className="size-4" />Nouvel ambassadeur
          </button>
        )}
      />
      {loadError && <p role="alert" className="error">{loadError}</p>}
      <Card>
        <Toolbar>
          <p className="m-0 text-[length:var(--text-sm)] font-semibold" aria-live="polite">{loading ? 'Chargement…' : `${data.total} ambassadeur${data.total > 1 ? 's' : ''}`}</p>
          <label className="m-0 flex items-center gap-2 text-[length:var(--text-sm)] font-normal">
            Origine
            <select value={origin} onChange={(e) => { setPage(1); setOrigin(e.target.value); }} style={{ width: 'auto', marginTop: 0 }}>
              <option value="">Toutes</option>
              {AMBASSADOR_ORIGINS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <SearchField label="Rechercher un ambassadeur" onSearch={(value) => { setPage(1); setQuery(value); }} />
        </Toolbar>
        <DataTable
          caption="Ambassadeurs"
          columns={columns}
          rows={data.items}
          rowId={(a) => a.id}
          rowLabel={(a) => `${a.firstName} ${a.lastName}`}
          busy={loading}
          empty={query || origin ? 'Aucun ambassadeur ne correspond à cette recherche.' : 'Aucun ambassadeur pour le moment.'}
        />
        <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPage={setPage} />
      </Card>
      {dialog && <AmbassadorDialog ambassador={dialog.ambassador} onClose={() => setDialog(null)} onDone={async () => { setDialog(null); await load(); }} />}
    </>
  );
}
