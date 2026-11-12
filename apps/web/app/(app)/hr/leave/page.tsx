'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '../../../../components/data/badge';
import { Card } from '../../../../components/data/card';
import { type Column, DataTable } from '../../../../components/data/data-table';
import { PageHeader } from '../../../../components/data/page-header';
import { Pagination } from '../../../../components/data/pagination';
import { RowAction, RowActions } from '../../../../components/data/row-actions';
import { QuickFilters, Toolbar } from '../../../../components/data/toolbar';
import { LeaveCancelDialog, LeaveRequestDialog } from '../../../../components/hr/leave-dialogs';
import { LeaveNav } from '../../../../components/hr/leave-nav';
import { Icon } from '../../../../components/icon';
import { PageHeading } from '../../../../components/page-heading';
import { api, ApiError } from '../../../../lib/api';
import { useAuth } from '../../../../lib/auth-context';
import { formatDate } from '../../../../lib/format';
import {
  canCancelRequest, daysText, type LeaveBalance, type LeaveRequest, type LeaveSettings, LEAVE_STATUS, LEAVE_STATUS_FILTERS, type LeaveType, periodLabel,
} from '../../../../lib/leave';
import { can, canAll } from '../../../../lib/permissions';
import { todayIso } from '../../../../lib/receipts';
import { statusStyle } from '../../../../lib/status';
import type { Page } from '../../../../lib/types';

const PAGE_SIZE = 20;
const dash = <span className="text-ink-2">—</span>;

/**
 * Mes absences : le solde de congé de l'année, la demande d'absence et l'historique de mes demandes. Une personne dont le compte n'est lié à aucune fiche
 * employé le voit dit en clair (la RH relie les comptes) au lieu d'une erreur.
 */
export default function MyLeavePage() {
  const { profile } = useAuth();
  const canRead = can(profile, 'hr.leave.read');
  const canRequest = can(profile, 'hr.leave.create');
  const isHr = canAll(profile, 'hr.leave.manage');
  const thisYear = Number(todayIso().slice(0, 4));
  const [year, setYear] = useState(thisYear);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<LeaveRequest>>({ items: [], total: 0 });
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [unlinked, setUnlinked] = useState(false);
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [settings, setSettings] = useState<LeaveSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [cancelling, setCancelling] = useState<LeaveRequest | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!canRead) return;
    const params = new URLSearchParams({ view: 'mine', year: String(year), page: String(page), pageSize: String(PAGE_SIZE) });
    if (status) params.set('status', status);
    try {
      setData(await api<Page<LeaveRequest>>(`/hr/leave/requests?${params}`));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Chargement impossible');
    } finally {
      setLoading(false);
    }
    try {
      setBalance(await api<LeaveBalance>(`/hr/leave/balance?year=${year}`));
      setUnlinked(false);
    } catch {
      setBalance(null);
      setUnlinked(true);
    }
  }, [canRead, year, page, status]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!canRead) return;
    api<LeaveType[]>('/hr/leave/types').then(setTypes).catch(() => setTypes([]));
    api<LeaveSettings>('/hr/leave/settings').then(setSettings).catch(() => setSettings(null));
  }, [canRead]);

  const today = todayIso();
  const columns = useMemo<Column<LeaveRequest>[]>(() => [
    { id: 'type', weight: 2, header: 'Type', cell: (r) => r.leaveTypeLabel },
    { id: 'period', weight: 3.4, header: 'Période', cell: (r) => periodLabel(r) },
    { id: 'days', weight: 1.4, header: 'Durée', cell: (r) => daysText(r.days) },
    { id: 'status', weight: 1.8, header: 'État', cell: (r) => { const s = statusStyle(LEAVE_STATUS, r.status); return <Badge tone={s.tone}>{s.label}</Badge>; } },
    {
      id: 'decision', weight: 3, header: 'Décision', nowrap: false,
      cell: (r) => (r.status === 'REJECTED' ? <>Refusée : {r.decisionNote ?? dash}</> : r.status === 'CANCELLED' ? <>Annulée le {formatDate(r.cancelledAt)}{r.cancelReason ? ` : ${r.cancelReason}` : ''}</> : r.decidedAt ? <>Validée le {formatDate(r.decidedAt)}</> : dash),
    },
    {
      id: 'actions', weight: 0.8, header: 'Actions', srOnlyHeader: true, align: 'right',
      cell: (r) => (canCancelRequest(r, today, isHr)
        ? <RowActions label={`Actions pour la demande ${periodLabel(r)}`}><RowAction danger onClick={() => setCancelling(r)}>Annuler la demande</RowAction></RowActions>
        : <span className="sr-only">Aucune action</span>),
    },
  ], [today, isHr]);

  if (!canRead) {
    return (
      <>
        <PageHeading>Mes absences</PageHeading>
        <p>Votre profil n&apos;a pas accès aux absences et congés.</p>
      </>
    );
  }

  const activeTypes = types.filter((t) => t.active);
  return (
    <>
      <PageHeader
        eyebrow="Ressources humaines"
        title="Mes absences"
        description="Votre solde de congé, vos demandes d’absence et leur suite. Les week-ends et les jours fériés ne sont pas décomptés."
        actions={canRequest && (
          <button type="button" disabled={activeTypes.length === 0 || !settings} onClick={() => setRequesting(true)} className="inline-flex items-center gap-2">
            <Icon name="plus" className="size-4" />Demander une absence
          </button>
        )}
      />
      <LeaveNav current="mine" />
      {notice && <p role="status" className="mb-4 rounded-panel bg-ok-bg px-4 py-2 text-ok">{notice}</p>}
      {unlinked && (
        <p role="status" className="mb-4 rounded-panel border border-line-strong bg-surface p-4">
          Aucune fiche employé n’est liée à votre compte : vous ne pouvez pas encore demander d’absence. Demandez à la RH de relier votre compte à votre fiche.
        </p>
      )}
      {balance && (
        <section aria-label={`Solde de congé ${year}`} className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-3">
          {[
            ['Disponible', balance.available, true],
            ['Acquis', balance.entitlement, false],
            ['Ajustements', balance.adjustments, false],
            ['Pris', balance.taken, false],
            ['En attente', balance.pending, false],
          ].map(([label, value, strong]) => (
            <div key={String(label)} className="rounded-panel border border-line-strong bg-surface p-4">
              <p className="m-0 text-xs font-semibold text-ink-2">{label}</p>
              <p className={`m-0 mt-1 ${strong ? 'text-[length:var(--text-xl)] font-bold' : 'text-[length:var(--text-md)] font-semibold'}`}>{daysText(value as number)}</p>
            </div>
          ))}
        </section>
      )}
      {loadError && <p role="alert" className="error">{loadError}</p>}
      <Card>
        <Toolbar>
          <QuickFilters label="Filtrer par état" value={status} options={[...LEAVE_STATUS_FILTERS]} onChange={(value) => { setPage(1); setStatus(value); }} />
        </Toolbar>
        <Toolbar>
          <p className="m-0 text-[length:var(--text-sm)] font-semibold" aria-live="polite">{loading ? 'Chargement…' : `${data.total} demande${data.total > 1 ? 's' : ''}`}</p>
          <label className="m-0 flex items-center gap-2 text-[length:var(--text-sm)] font-normal">
            Année
            <select value={year} onChange={(e) => { setPage(1); setYear(Number(e.target.value)); }} style={{ width: 'auto', marginTop: 0 }}>
              {[thisYear + 1, thisYear, thisYear - 1, thisYear - 2].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
        </Toolbar>
        <DataTable caption="Mes demandes d’absence" columns={columns} rows={data.items} rowId={(r) => r.id} rowLabel={(r) => `${r.leaveTypeLabel} ${periodLabel(r)}`} busy={loading} empty={status ? 'Aucune demande ne correspond à ce filtre.' : `Aucune demande en ${year}.`} />
        <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPage={setPage} />
      </Card>
      {requesting && settings && (
        <LeaveRequestDialog
          types={activeTypes}
          allowHalfDays={settings.allowHalfDays}
          canBackdate={isHr}
          canPickEmployee={canAll(profile, 'hr.leave.create')}
          onClose={() => setRequesting(false)}
          onDone={async () => { setRequesting(false); setNotice('La demande est enregistrée.'); await load(); }}
        />
      )}
      {cancelling && <LeaveCancelDialog request={cancelling} onClose={() => setCancelling(null)} onDone={async () => { setCancelling(null); setNotice('La demande est annulée.'); await load(); }} />}
    </>
  );
}
