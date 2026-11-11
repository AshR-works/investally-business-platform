'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '../../../../components/data/badge';
import { Card } from '../../../../components/data/card';
import { type Column, DataTable } from '../../../../components/data/data-table';
import { EntityCell } from '../../../../components/data/entity-cell';
import { PageHeader } from '../../../../components/data/page-header';
import { Pagination } from '../../../../components/data/pagination';
import { RowAction, RowActions } from '../../../../components/data/row-actions';
import { QuickFilters, SearchField, Toolbar } from '../../../../components/data/toolbar';
import { EntityLink } from '../../../../components/entity-link';
import { EmployeeDialog } from '../../../../components/hr/employee-dialog';
import { EmployeeStatusDialog } from '../../../../components/hr/employee-status-dialog';
import { Icon } from '../../../../components/icon';
import { PageHeading } from '../../../../components/page-heading';
import { api, ApiError } from '../../../../lib/api';
import { useAuth } from '../../../../lib/auth-context';
import { formatDate } from '../../../../lib/format';
import { type DirectoryEntry, departmentsOf, EMPLOYEE_STATE_FILTERS, type Employee, employeeActions, fullName, type HierarchyGap, isArchived } from '../../../../lib/hr';
import { can, canAll } from '../../../../lib/permissions';
import type { Page } from '../../../../lib/types';

const PAGE_SIZE = 20;
const dash = <span className="text-ink-2">—</span>;

/**
 * Personnel : les fiches détaillées, selon la portée de l'utilisateur (la RH et la Direction voient tout). La RH crée, modifie, enregistre une sortie
 * (archivage réversible, jamais de suppression) et réintègre. Pour ceux qui voient tout, un encadré signale les écarts entre l'organigramme RH et la
 * hiérarchie des comptes : signalés, jamais corrigés (D58).
 */
export default function StaffPage() {
  const { profile } = useAuth();
  const canRead = can(profile, 'hr.employee.read');
  const canCreate = can(profile, 'hr.employee.create');
  const rights = { update: can(profile, 'hr.employee.update'), archive: can(profile, 'hr.employee.archive') };
  const seesAll = canAll(profile, 'hr.employee.read');
  const [data, setData] = useState<Page<Employee>>({ items: [], total: 0 });
  const [departments, setDepartments] = useState<string[]>([]);
  const [gaps, setGaps] = useState<HierarchyGap[]>([]);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [state, setState] = useState('ACTIVE');
  const [department, setDepartment] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ employee?: Employee } | null>(null);
  const [statusDialog, setStatusDialog] = useState<{ employee: Employee; to: 'ARCHIVED' | 'ACTIVE' } | null>(null);

  const load = useCallback(async () => {
    if (!canRead) return;
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (query) params.set('search', query);
    if (state) params.set('status', state);
    if (department) params.set('department', department);
    try {
      setData(await api<Page<Employee>>(`/hr/employees?${params}`));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [canRead, page, query, state, department]);
  useEffect(() => {
    void load();
  }, [load]);
  const loadSide = useCallback(() => {
    if (!canRead) return;
    api<DirectoryEntry[]>('/hr/org-chart').then((all) => setDepartments(departmentsOf(all))).catch(() => setDepartments([]));
    if (seesAll) api<HierarchyGap[]>('/hr/employees/hierarchy-gaps').then(setGaps).catch(() => setGaps([]));
  }, [canRead, seesAll]);
  useEffect(() => {
    loadSide();
  }, [loadSide]);

  const columns = useMemo<Column<Employee>[]>(() => [
    { id: 'name', weight: 3, header: 'Employé', cell: (e) => <EntityLink kind="employee" id={e.id} label={fullName(e)}><EntityCell name={fullName(e)} subtitle={e.matricule} round /></EntityLink> },
    { id: 'job', weight: 3, header: 'Poste', cell: (e) => e.jobTitle },
    { id: 'department', weight: 2, header: 'Service', cell: (e) => e.department },
    { id: 'manager', weight: 2.6, header: 'Responsable', cell: (e) => e.managerName ?? dash },
    { id: 'hired', weight: 1.8, header: 'Entrée', cell: (e) => formatDate(`${e.hiredOn}T00:00:00Z`) },
    { id: 'status', weight: 1.8, header: 'État', cell: (e) => (isArchived(e) ? <Badge tone="neutral">Sorti le {formatDate(`${e.leftOn}T00:00:00Z`)}</Badge> : <Badge tone="ok">En poste</Badge>) },
    {
      id: 'actions', weight: 0.8, header: 'Actions', srOnlyHeader: true, align: 'right',
      cell: (e) => {
        const actions = employeeActions(e, rights);
        if (actions.length === 0) return <span className="sr-only">Aucune action</span>;
        return (
          <RowActions label={`Actions pour ${fullName(e)}`}>
            {actions.map((action) => action === 'edit'
              ? <RowAction key={action} onClick={() => setDialog({ employee: e })}>Modifier</RowAction>
              : <RowAction key={action} danger={action === 'archive'} onClick={() => setStatusDialog({ employee: e, to: action === 'archive' ? 'ARCHIVED' : 'ACTIVE' })}>{action === 'archive' ? 'Enregistrer une sortie' : 'Réintégrer'}</RowAction>)}
          </RowActions>
        );
      },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [rights.update, rights.archive]);

  if (!canRead) {
    return (
      <>
        <PageHeading>Personnel</PageHeading>
        <p>Votre profil n&apos;a pas accès aux fiches du personnel.</p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Ressources humaines"
        title="Personnel"
        description="Les fiches du personnel : identité professionnelle, poste, service et responsable. La sortie d’un employé s’enregistre et se défait ; rien n’est supprimé."
        actions={canCreate && (
          <button type="button" onClick={() => setDialog({})} className="inline-flex items-center gap-2">
            <Icon name="plus" className="size-4" />Nouvel employé
          </button>
        )}
      />
      {gaps.length > 0 && (
        <section aria-labelledby="gaps-title" className="mb-6 rounded-panel border border-line-strong bg-surface p-5">
          <h2 id="gaps-title" className="m-0 text-[length:var(--text-md)]">Écarts avec la hiérarchie des comptes ({gaps.length})</h2>
          <p className="m-0 mb-3 mt-1 text-ink-2">Le responsable indiqué ici n’est pas celui du compte de la personne. La hiérarchie des comptes décide de la portée « Équipe » des droits : elle n’est <strong>jamais</strong> modifiée depuis cette page.</p>
          <ul className="m-0 list-none p-0">
            {gaps.map((g) => (
              <li key={g.employeeId} className="border-b border-line py-2 last:border-0">
                <EntityLink kind="employee" id={g.employeeId} label={g.employeeName}><strong>{g.employeeName}</strong></EntityLink>
                {' '}: responsable RH <strong>{g.hrManagerName}</strong>, responsable du compte <strong>{g.accountManagerName ?? 'aucun'}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}
      {loadError && <p role="alert" className="error">{loadError}</p>}
      <Card>
        <Toolbar>
          <QuickFilters label="Filtrer par état" value={state} options={[...EMPLOYEE_STATE_FILTERS]} onChange={(value) => { setPage(1); setState(value); }} />
        </Toolbar>
        <Toolbar>
          <p className="m-0 text-[length:var(--text-sm)] font-semibold" aria-live="polite">{loading ? 'Chargement…' : `${data.total} employé${data.total > 1 ? 's' : ''}`}</p>
          <label className="m-0 flex items-center gap-2 text-[length:var(--text-sm)] font-normal">
            Service
            <select value={department} onChange={(e) => { setPage(1); setDepartment(e.target.value); }} style={{ width: 'auto', marginTop: 0 }}>
              <option value="">Tous</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <SearchField label="Rechercher un employé" onSearch={(value) => { setPage(1); setQuery(value); }} />
        </Toolbar>
        <DataTable
          caption="Personnel"
          columns={columns}
          rows={data.items}
          rowId={(e) => e.id}
          rowLabel={fullName}
          busy={loading}
          empty={query || department || state === 'ARCHIVED' ? 'Aucun employé ne correspond à ces critères.' : 'Aucun employé pour le moment.'}
        />
        <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPage={setPage} />
      </Card>
      {statusDialog && <EmployeeStatusDialog employee={statusDialog.employee} to={statusDialog.to} onClose={() => setStatusDialog(null)} onDone={async () => { setStatusDialog(null); await load(); loadSide(); }} />}
      {dialog && <EmployeeDialog employee={dialog.employee} onClose={() => setDialog(null)} onDone={async () => { setDialog(null); await load(); loadSide(); }} />}
    </>
  );
}
