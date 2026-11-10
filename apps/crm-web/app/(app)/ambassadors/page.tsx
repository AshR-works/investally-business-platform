'use client';

import { useCallback, useEffect, useState } from 'react';
import { AmbassadorDialog } from '../../../components/ambassadors/ambassador-dialog';
import { AmbassadorStatusDialog } from '../../../components/ambassadors/ambassador-status-dialog';
import { CompanyContextBar } from '../../../components/company-context-bar';
import { EntityLink } from '../../../components/entity-link';
import { Badge } from '../../../components/data/badge';
import { Card } from '../../../components/data/card';
import { DataTable, type Column } from '../../../components/data/data-table';
import { EntityCell } from '../../../components/data/entity-cell';
import { PageHeader } from '../../../components/data/page-header';
import { Pagination } from '../../../components/data/pagination';
import { RowAction, RowActions } from '../../../components/data/row-actions';
import { QuickFilters, SearchField, Toolbar } from '../../../components/data/toolbar';
import { Icon } from '../../../components/icon';
import { PageHeading } from '../../../components/page-heading';
import { api, ApiError } from '../../../lib/api';
import { AMBASSADOR_ORIGINS, AMBASSADOR_STATE_FILTERS, ambassadorActions, isArchived, originLabel, sinceLabel } from '../../../lib/ambassadors';
import { useCompanyContext } from '../../../lib/company-context';
import { useAuth } from '../../../lib/auth-context';
import { can } from '../../../lib/permissions';
import type { Ambassador, Page } from '../../../lib/types';
import { MailLink } from '../../../components/mail-link';

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
  const [state, setState] = useState('ACTIVE');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ ambassador?: Ambassador } | null>(null);
  const [statusDialog, setStatusDialog] = useState<{ ambassador: Ambassador; to: 'ARCHIVED' | 'ACTIVE' } | null>(null);
  const canRead = can(profile, 'bd.ambassador.read');
  const canCreate = can(profile, 'bd.ambassador.create');
  const canUpdate = can(profile, 'bd.ambassador.update');

  const ctx = useCompanyContext();
  // Un autre contexte d'entreprise repart de la première page.
  useEffect(() => setPage(1), [ctx.companyId]);
  const load = useCallback(async () => {
    if (!canRead) return;
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (query) params.set('search', query);
    if (origin) params.set('origin', origin);
    if (state) params.set('status', state);
    if (ctx.companyId) params.set('companyId', ctx.companyId);
    try {
      setData(await api<Page<Ambassador>>(`/ambassadors?${params}`));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [canRead, page, query, origin, state, ctx.companyId]);
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
    { id: 'name', weight: 3, header: 'Ambassadeur', cell: (a) => <EntityLink kind="ambassador" id={a.id} label={`${a.firstName} ${a.lastName}`}><EntityCell name={`${a.firstName} ${a.lastName}`} round subtitle={isArchived(a) ? 'Archivé' : null} /></EntityLink> },
    { id: 'origin', weight: 1.6, header: 'Origine', cell: (a) => <Badge tone="neutral">{originLabel(a.origin)}</Badge> },
    { id: 'company', weight: 3, header: 'Entreprise', cell: (a) => (a.companyId ? <EntityLink kind="company" id={a.companyId} label={a.companyName ?? ''}>{a.companyName}</EntityLink> : <span className="text-ink-2">—</span>) },
    { id: 'since', weight: 1.4, header: 'Depuis', cell: (a) => sinceLabel(a.appointedOn) },
    { id: 'email', weight: 3.2, header: 'E-mail', cell: (a) => <MailLink email={a.email} /> },
    { id: 'phone', weight: 2.4, header: 'Téléphone', cell: (a) => a.phone ?? <span className="text-ink-2">—</span> },
    ...(canUpdate
      ? [{ id: 'actions', weight: 0.8, header: 'Actions', srOnlyHeader: true, cell: (a: Ambassador) => (
          <RowActions label={`Actions pour l’ambassadeur ${a.firstName} ${a.lastName}`}>
            {ambassadorActions(a, canUpdate).map((action) => action === 'edit'
              ? <RowAction key={action} onClick={() => setDialog({ ambassador: a })}>Modifier</RowAction>
              : <RowAction key={action} onClick={() => setStatusDialog({ ambassador: a, to: action === 'archive' ? 'ARCHIVED' : 'ACTIVE' })}>{action === 'archive' ? 'Archiver' : 'Réactiver'}</RowAction>)}
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
      <CompanyContextBar ctx={ctx} section="Ambassadeurs" />
      {loadError && <p role="alert" className="error">{loadError}</p>}
      <Card>
        <Toolbar>
          <QuickFilters label="Filtrer par état" value={state} options={[...AMBASSADOR_STATE_FILTERS]} onChange={(value) => { setPage(1); setState(value); }} />
        </Toolbar>
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
          empty={query || origin || state === 'ARCHIVED' ? 'Aucun ambassadeur ne correspond à ces critères.' : 'Aucun ambassadeur pour le moment.'}
        />
        <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPage={setPage} />
      </Card>
      {statusDialog && <AmbassadorStatusDialog ambassador={statusDialog.ambassador} to={statusDialog.to} onClose={() => setStatusDialog(null)} onDone={async () => { setStatusDialog(null); await load(); }} />}
      {dialog && <AmbassadorDialog ambassador={dialog.ambassador} onClose={() => setDialog(null)} onDone={async () => { setDialog(null); await load(); }} />}
    </>
  );
}
