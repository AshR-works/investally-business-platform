'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '../../../components/data/badge';
import { Card } from '../../../components/data/card';
import { DataTable, type Column } from '../../../components/data/data-table';
import { PageHeader } from '../../../components/data/page-header';
import { Pagination } from '../../../components/data/pagination';
import { RowAction, RowActions } from '../../../components/data/row-actions';
import { SelectionBar } from '../../../components/data/selection-bar';
import { QuickFilters, Toolbar } from '../../../components/data/toolbar';
import { FollowupDialogs, type FollowupDialogState } from '../../../components/followups/followup-dialogs';
import { Icon } from '../../../components/icon';
import { PageHeading } from '../../../components/page-heading';
import { api, ApiError } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { formatDate } from '../../../lib/format';
import { channelLabel, FOLLOWUP_ACTION_LABEL, FOLLOWUP_FILTERS, FOLLOWUP_STATUS, followupActions, type FollowupFilter, followupListParams } from '../../../lib/followups';
import { can } from '../../../lib/permissions';
import { statusStyle } from '../../../lib/status';
import type { Followup, Offer, Page } from '../../../lib/types';

const PAGE_SIZE = 20;

/** La page « Relances » : la liste « À faire » des offres visibles selon la portée de l'utilisateur, triée par échéance. */
export default function FollowupsPage() {
  return (
    <Suspense fallback={null}>
      <FollowupsContent />
    </Suspense>
  );
}

function FollowupsContent() {
  const { profile } = useAuth();
  const offerId = useSearchParams().get('offerId') ?? undefined;
  const [data, setData] = useState<Page<Followup>>({ items: [], total: 0 });
  const [offer, setOffer] = useState<Offer | null>(null);
  const [filter, setFilter] = useState<FollowupFilter>('todo');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<FollowupDialogState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const canRead = can(profile, 'bd.followup.read');
  const canCreate = can(profile, 'bd.followup.create');
  const rights = useMemo(() => ({ complete: can(profile, 'bd.followup.complete'), update: can(profile, 'bd.followup.update') }), [profile]);

  const load = useCallback(async () => {
    if (!canRead) return;
    try {
      setData(await api<Page<Followup>>(`/followups?${followupListParams(filter, page, PAGE_SIZE, offerId)}`));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [canRead, filter, page, offerId]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!offerId) {
      setOffer(null);
      return;
    }
    api<Offer>(`/offers/${offerId}`).then(setOffer).catch(() => setOffer(null));
  }, [offerId]);

  const columns = useMemo<Column<Followup>[]>(() => [
    {
      id: 'due',
      header: 'Échéance',
      cell: (f) => (
        <span className="inline-flex flex-wrap items-center gap-2">
          <strong>{formatDate(`${f.dueOn}T00:00:00Z`)}</strong>
          {f.overdue && <Badge tone="bad">En retard</Badge>}
        </span>
      ),
    },
    { id: 'offer', header: 'Offre', cell: (f) => <strong>{f.offerReference}</strong> },
    { id: 'company', header: 'Entreprise', cell: (f) => <Link href={`/companies/${f.companyId}`} className="text-ink no-underline hover:underline">{f.companyName}</Link> },
    { id: 'channel', header: 'Canal', cell: (f) => channelLabel(f.channel) },
    {
      id: 'note',
      header: 'Note ou résultat',
      cell: (f) => f.resultNote ?? f.note ?? <span className="text-ink-2">—</span>,
    },
    { id: 'status', header: 'État', cell: (f) => { const s = statusStyle(FOLLOWUP_STATUS, f.status); return <Badge tone={s.tone}>{s.label}</Badge>; } },
    {
      id: 'actions',
      header: 'Actions',
      srOnlyHeader: true,
      align: 'right',
      cell: (f) => {
        const actions = followupActions(f.status, rights);
        if (actions.length === 0) return <span className="sr-only">Aucune action</span>;
        return (
          <RowActions label={`Actions pour la relance de l’offre ${f.offerReference}`}>
            {actions.map((a) => (
              <RowAction key={a} danger={a === 'cancel'} onClick={() => setDialog({ kind: a, followup: f })}>{FOLLOWUP_ACTION_LABEL[a]}</RowAction>
            ))}
          </RowActions>
        );
      },
    },
  ], [rights]);

  if (!canRead) {
    return (
      <>
        <PageHeading>Relances</PageHeading>
        <p>Votre profil n&apos;a pas accès aux relances.</p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Business Development"
        title="Relances"
        description="Les relances à faire sur vos offres, classées par échéance ; celles dont l’échéance est dépassée sont signalées."
        actions={canCreate && (
          <button type="button" onClick={() => setDialog({ kind: 'plan', offer: offer && (offer.status === 'SUBMITTED' || offer.status === 'RECEIPT_RECEIVED') ? { id: offer.id, reference: offer.reference, companyName: offer.companyName } : undefined })} className="inline-flex items-center gap-2">
            <Icon name="plus" className="size-4" />Nouvelle relance
          </button>
        )}
      />
      {offerId && (
        <p className="m-0 mb-3 text-ink-2">
          Relances de l’offre <strong>{offer?.reference ?? '…'}</strong>{offer ? ` · ${offer.companyName}` : ''}. <Link href="/followups">Voir toutes les relances</Link>
        </p>
      )}
      <SelectionBar count={selected.size} onClear={() => setSelected(new Set())} />
      {loadError && <p role="alert" className="error">{loadError}</p>}
      <Card>
        <Toolbar>
          <QuickFilters label="Filtrer les relances" value={filter} options={FOLLOWUP_FILTERS.map((f) => ({ value: f.value, label: f.label }))} onChange={(value) => { setPage(1); setFilter(value as FollowupFilter); }} />
        </Toolbar>
        <Toolbar>
          <p className="m-0 text-[length:var(--text-sm)] font-semibold" aria-live="polite">{data.total} relance{data.total > 1 ? 's' : ''}</p>
        </Toolbar>
        <DataTable
          caption="Relances"
          columns={columns}
          rows={data.items}
          rowId={(f) => f.id}
          rowLabel={(f) => `Relance de l’offre ${f.offerReference}`}
          selection={{ selected, onChange: setSelected }}
          busy={loading}
          empty={filter === 'todo' ? 'Aucune relance à faire.' : 'Aucune relance ne correspond à ce filtre.'}
        />
        <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPage={setPage} />
      </Card>
      <FollowupDialogs dialog={dialog} onClose={() => setDialog(null)} onDone={async () => { setDialog(null); setPage(1); await load(); }} />
    </>
  );
}
