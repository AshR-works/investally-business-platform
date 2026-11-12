'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '../../../../../components/data/card';
import { type Column, DataTable } from '../../../../../components/data/data-table';
import { EntityCell } from '../../../../../components/data/entity-cell';
import { PageHeader } from '../../../../../components/data/page-header';
import { Pagination } from '../../../../../components/data/pagination';
import { RowAction, RowActions } from '../../../../../components/data/row-actions';
import { SearchField, Toolbar } from '../../../../../components/data/toolbar';
import { AdjustmentDialog } from '../../../../../components/hr/leave-dialogs';
import { LeaveNav } from '../../../../../components/hr/leave-nav';
import { PageHeading } from '../../../../../components/page-heading';
import { api, ApiError } from '../../../../../lib/api';
import { useAuth } from '../../../../../lib/auth-context';
import { type Employee, fullName } from '../../../../../lib/hr';
import { daysText, type LeaveBalance } from '../../../../../lib/leave';
import { canAll } from '../../../../../lib/permissions';
import { todayIso } from '../../../../../lib/receipts';
import type { Page } from '../../../../../lib/types';

const PAGE_SIZE = 20;
interface Line { employee: Employee; balance: LeaveBalance | null }

/**
 * Soldes (RH) : le solde de congé de chaque employé en poste pour l'année, et l'ajustement (report, correction ; motif obligatoire, ajout seul). Un employé dont le solde
 * ne peut pas être lu s'affiche sans chiffres plutôt que de bloquer la liste.
 */
export default function BalancesPage() {
  const { profile } = useAuth();
  const isHr = canAll(profile, 'hr.leave.manage');
  const thisYear = Number(todayIso().slice(0, 4));
  const [year, setYear] = useState(thisYear);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState<Employee | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isHr) return;
    const params = new URLSearchParams({ status: 'ACTIVE', page: String(page), pageSize: String(PAGE_SIZE) });
    if (query) params.set('search', query);
    try {
      const employees = await api<Page<Employee>>(`/hr/employees?${params}`);
      const balances = await Promise.all(employees.items.map((e) => api<LeaveBalance>(`/hr/leave/balance?employeeId=${e.id}&year=${year}`).catch(() => null)));
      setLines(employees.items.map((employee, i) => ({ employee, balance: balances[i] ?? null })));
      setTotal(employees.total);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [isHr, page, query, year]);
  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo<Column<Line>[]>(() => {
    const num = (pick: (b: LeaveBalance) => number) => (l: Line) => (l.balance ? daysText(pick(l.balance)) : <span className="text-ink-2">—</span>);
    return [
      { id: 'employee', weight: 3, header: 'Employé', cell: (l) => <EntityCell name={fullName(l.employee)} subtitle={`${l.employee.jobTitle} · ${l.employee.department}`} round /> },
      { id: 'available', weight: 1.6, header: 'Disponible', cell: (l) => (l.balance ? <strong>{daysText(l.balance.available)}</strong> : <span className="text-ink-2">—</span>) },
      { id: 'entitlement', weight: 1.4, header: 'Acquis', cell: num((b) => b.entitlement) },
      { id: 'adjustments', weight: 1.6, header: 'Ajustements', cell: num((b) => b.adjustments) },
      { id: 'taken', weight: 1.4, header: 'Pris', cell: num((b) => b.taken) },
      { id: 'pending', weight: 1.6, header: 'En attente', cell: num((b) => b.pending) },
      {
        id: 'actions', weight: 0.8, header: 'Actions', srOnlyHeader: true, align: 'right',
        cell: (l) => <RowActions label={`Actions pour ${fullName(l.employee)}`}><RowAction onClick={() => setAdjusting(l.employee)}>Ajuster le solde</RowAction></RowActions>,
      },
    ];
  }, []);

  if (!isHr) {
    return (
      <>
        <PageHeading>Soldes</PageHeading>
        <p>Les soldes de tout le personnel sont réservés à la RH.</p>
      </>
    );
  }

  return (
    <>
      <PageHeader eyebrow="Ressources humaines" title="Soldes" description="Le solde de congé annuel de chaque employé en poste. L’acquisition suit les paramètres RH ; un report ou une correction passe par un ajustement motivé." />
      <LeaveNav current="balances" />
      {notice && <p role="status" className="mb-4 rounded-panel bg-ok-bg px-4 py-2 text-ok">{notice}</p>}
      {loadError && <p role="alert" className="error">{loadError}</p>}
      <Card>
        <Toolbar>
          <p className="m-0 text-[length:var(--text-sm)] font-semibold" aria-live="polite">{loading ? 'Chargement…' : `${total} employé${total > 1 ? 's' : ''}`}</p>
          <label className="m-0 flex items-center gap-2 text-[length:var(--text-sm)] font-normal">
            Année
            <select value={year} onChange={(e) => { setPage(1); setYear(Number(e.target.value)); }} style={{ width: 'auto', marginTop: 0 }}>
              {[thisYear + 1, thisYear, thisYear - 1, thisYear - 2].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <SearchField label="Rechercher un employé" onSearch={(value) => { setPage(1); setQuery(value); }} />
        </Toolbar>
        <DataTable caption={`Soldes de congé ${year}`} columns={columns} rows={lines} rowId={(l) => l.employee.id} rowLabel={(l) => fullName(l.employee)} busy={loading} empty={query ? 'Aucun employé ne correspond à cette recherche.' : 'Aucun employé en poste.'} />
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
      </Card>
      {adjusting && (
        <AdjustmentDialog
          employeeId={adjusting.id}
          employeeName={fullName(adjusting)}
          year={year}
          onClose={() => setAdjusting(null)}
          onDone={async () => { setAdjusting(null); setNotice('L’ajustement est enregistré.'); await load(); }}
        />
      )}
    </>
  );
}
