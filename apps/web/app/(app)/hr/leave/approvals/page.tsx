'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '../../../../../components/data/badge';
import { Card } from '../../../../../components/data/card';
import { type Column, DataTable } from '../../../../../components/data/data-table';
import { PageHeader } from '../../../../../components/data/page-header';
import { Pagination } from '../../../../../components/data/pagination';
import { RowAction, RowActions } from '../../../../../components/data/row-actions';
import { QuickFilters, Toolbar } from '../../../../../components/data/toolbar';
import { LeaveDecisionDialog } from '../../../../../components/hr/leave-dialogs';
import { LeaveNav } from '../../../../../components/hr/leave-nav';
import { PageHeading } from '../../../../../components/page-heading';
import { api, ApiError } from '../../../../../lib/api';
import { useAuth } from '../../../../../lib/auth-context';
import { daysText, type LeaveRequest, LEAVE_STATUS, LEAVE_STATUS_FILTERS, periodLabel } from '../../../../../lib/leave';
import { can, canAll } from '../../../../../lib/permissions';
import { statusStyle } from '../../../../../lib/status';
import type { Page } from '../../../../../lib/types';

const PAGE_SIZE = 20;
const dash = <span className="text-ink-2">—</span>;
const SCOPES = [{ value: 'team', label: 'Mon équipe' }, { value: 'all', label: 'Toutes les demandes' }];

/**
 * À valider : les demandes des collaborateurs directs du responsable (organigramme RH). La RH peut aussi voir toutes les demandes. On ne valide jamais sa propre
 * demande ; le serveur le refuse, et la page n'en propose pas l'action.
 */
export default function ApprovalsPage() {
  const { profile } = useAuth();
  const canApprove = can(profile, 'hr.leave.approve');
  const seesAll = canAll(profile, 'hr.leave.read');
  const [scope, setScope] = useState('team');
  const [status, setStatus] = useState('PENDING');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<LeaveRequest>>({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ request: LeaveRequest; decision: 'APPROVE' | 'REJECT' } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!canApprove) return;
    const params = new URLSearchParams({ view: scope, page: String(page), pageSize: String(PAGE_SIZE) });
    if (status) params.set('status', status);
    try {
      setData(await api<Page<LeaveRequest>>(`/hr/leave/requests?${params}`));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [canApprove, scope, status, page]);
  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo<Column<LeaveRequest>[]>(() => [
    { id: 'employee', weight: 2.4, header: 'Employé', cell: (r) => r.employeeName },
    { id: 'type', weight: 2, header: 'Type', cell: (r) => r.leaveTypeLabel },
    { id: 'period', weight: 3.4, header: 'Période', cell: (r) => periodLabel(r) },
    { id: 'days', weight: 1.4, header: 'Durée', cell: (r) => daysText(r.days) },
    { id: 'note', weight: 3, header: 'Motif', nowrap: false, cell: (r) => r.note ?? dash },
    { id: 'status', weight: 1.8, header: 'État', cell: (r) => { const s = statusStyle(LEAVE_STATUS, r.status); return <Badge tone={s.tone}>{s.label}</Badge>; } },
    {
      id: 'actions', weight: 0.8, header: 'Actions', srOnlyHeader: true, align: 'right',
      cell: (r) => (r.status === 'PENDING'
        ? (
          <RowActions label={`Actions pour la demande de ${r.employeeName}`}>
            <RowAction onClick={() => setDialog({ request: r, decision: 'APPROVE' })}>Valider</RowAction>
            <RowAction danger onClick={() => setDialog({ request: r, decision: 'REJECT' })}>Refuser</RowAction>
          </RowActions>
        )
        : <span className="sr-only">Aucune action</span>),
    },
  ], []);

  if (!canApprove) {
    return (
      <>
        <PageHeading>À valider</PageHeading>
        <p>Votre profil ne valide pas de demandes d’absence.</p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Ressources humaines"
        title="À valider"
        description="Les demandes d’absence de vos collaborateurs directs. Un refus exige un motif ; le solde est vérifié de nouveau à la validation."
      />
      <LeaveNav current="approvals" />
      {notice && <p role="status" className="mb-4 rounded-panel bg-ok-bg px-4 py-2 text-ok">{notice}</p>}
      {loadError && <p role="alert" className="error">{loadError}</p>}
      <Card>
        <Toolbar>
          <QuickFilters label="Filtrer par état" value={status} options={[...LEAVE_STATUS_FILTERS]} onChange={(value) => { setPage(1); setStatus(value); }} />
        </Toolbar>
        <Toolbar>
          <p className="m-0 text-[length:var(--text-sm)] font-semibold" aria-live="polite">{loading ? 'Chargement…' : `${data.total} demande${data.total > 1 ? 's' : ''}`}</p>
          {seesAll && <QuickFilters label="Périmètre" value={scope} options={SCOPES} onChange={(value) => { setPage(1); setScope(value); }} />}
        </Toolbar>
        <DataTable
          caption="Demandes d’absence à valider"
          columns={columns}
          rows={data.items}
          rowId={(r) => r.id}
          rowLabel={(r) => `${r.employeeName} ${periodLabel(r)}`}
          busy={loading}
          empty={status === 'PENDING' ? 'Aucune demande en attente de votre décision.' : 'Aucune demande ne correspond à ce filtre.'}
        />
        <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPage={setPage} />
      </Card>
      {dialog && <LeaveDecisionDialog request={dialog.request} decision={dialog.decision} onClose={() => setDialog(null)} onDone={async () => { setNotice(dialog.decision === 'APPROVE' ? 'La demande est validée.' : 'La demande est refusée.'); setDialog(null); await load(); }} />}
    </>
  );
}
