'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CompanyDialog } from '../../../components/companies/company-dialog';
import { Badge } from '../../../components/data/badge';
import { Card } from '../../../components/data/card';
import { DataTable, type Column, type TableSort } from '../../../components/data/data-table';
import { EntityCell } from '../../../components/data/entity-cell';
import { PageHeader } from '../../../components/data/page-header';
import { Pagination } from '../../../components/data/pagination';
import { SelectionBar } from '../../../components/data/selection-bar';
import { QuickFilters, SearchField, Toolbar } from '../../../components/data/toolbar';
import { Icon } from '../../../components/icon';
import { PageHeading } from '../../../components/page-heading';
import { api, ApiError } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import {
  COMPANY_COLUMNS, type CompanyColumnId, type CompanyFilters, type CompanyOverview, type CompanySort, type CompanySortField, DEFAULT_COLUMNS, DEFAULT_SORT,
  hasActiveFilters, listParams, loadColumns, nextSort, NO_FILTERS, overviewParams, saveColumns, statusOptions, toggleColumn,
} from '../../../lib/company-table';
import { formatDate } from '../../../lib/format';
import { can } from '../../../lib/permissions';
import { COMPANY_STATUS, statusStyle } from '../../../lib/status';
import type { Company, Page } from '../../../lib/types';

const PAGE_SIZE = 20;

/** Toutes les colonnes affichables ; l'utilisateur choisit celles qu'il voit (mémorisé dans son navigateur). */
const ALL_COLUMNS: Record<CompanyColumnId, Column<Company>> = {
  name: { id: 'name', header: 'Entreprise', sortField: 'name', cell: (c) => <Link href={`/companies/${c.id}`} className="text-ink no-underline hover:underline"><EntityCell name={c.name} /></Link> },
  sector: { id: 'sector', header: 'Secteur', sortField: 'sector', cell: (c) => c.sector ?? <span className="text-ink-2">—</span> },
  country: { id: 'country', header: 'Pays', sortField: 'country', cell: (c) => c.country ?? <span className="text-ink-2">—</span> },
  email: { id: 'email', header: 'E-mail', cell: (c) => c.email ?? <span className="text-ink-2">—</span> },
  phone: { id: 'phone', header: 'Téléphone', cell: (c) => c.phone ?? <span className="text-ink-2">—</span> },
  status: {
    id: 'status',
    header: 'Statut',
    sortField: 'status',
    cell: (c) => {
      const style = statusStyle(COMPANY_STATUS, c.status);
      return <Badge tone={style.tone}>{style.label}</Badge>;
    },
  },
  created: { id: 'created', header: 'Créée le', sortField: 'createdAt', cell: (c) => formatDate(c.createdAt) },
};

/**
 * Entreprises visibles selon la portée de l'utilisateur : tableau du design avec recherche, filtres (statut avec effectifs,
 * pays, secteur), tri par colonne, colonnes au choix, pagination et sélection persistante ; création dans une fenêtre
 * (si le droit existe).
 */
export default function CompaniesPage() {
  const { profile } = useAuth();
  const [data, setData] = useState<Page<Company>>({ items: [], total: 0 });
  const [overview, setOverview] = useState<CompanyOverview | null>(null);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<CompanyFilters>(NO_FILTERS);
  const [sort, setSort] = useState<CompanySort>(DEFAULT_SORT);
  const [columns, setColumns] = useState<CompanyColumnId[]>(DEFAULT_COLUMNS);
  const [searchKey, setSearchKey] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const canRead = can(profile, 'bd.company.read');
  const canCreate = can(profile, 'bd.company.create');

  useEffect(() => setColumns(loadColumns()), []);

  const load = useCallback(async () => {
    if (!canRead) return;
    try {
      const [list, summary] = await Promise.all([
        api<Page<Company>>(`/companies?${listParams(filters, sort, page, PAGE_SIZE)}`),
        api<CompanyOverview>(`/companies/overview?${overviewParams(filters)}`),
      ]);
      setData(list);
      setOverview(summary);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [canRead, filters, sort, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const change = (patch: Partial<CompanyFilters>) => {
    setPage(1);
    setFilters((f) => ({ ...f, ...patch }));
  };
  const tableSort: TableSort = { field: sort.field, direction: sort.direction, onSort: (field) => { setPage(1); setSort((s) => nextSort(s, field as CompanySortField)); } };
  const shown = useMemo(() => columns.map((id) => ALL_COLUMNS[id]), [columns]);
  const filtered = hasActiveFilters(filters);

  if (!canRead) {
    return (
      <>
        <PageHeading>Bienvenue</PageHeading>
        <p>Votre profil n&apos;a pas accès au module commercial pour le moment.</p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Business Development"
        title="Entreprises"
        description="Les entreprises cibles visibles selon votre périmètre : les vôtres, celles de votre équipe, ou toutes."
        actions={
          canCreate && (
            <button type="button" onClick={() => setCreating(true)} className="inline-flex items-center gap-2">
              <Icon name="plus" className="size-4" />Nouvelle entreprise
            </button>
          )
        }
      />

      <SelectionBar count={selected.size} onClear={() => setSelected(new Set())} />
      {loadError && <p role="alert" className="error">{loadError}</p>}

      <Card>
        <Toolbar>
          <QuickFilters label="Filtrer par statut" value={filters.status} options={statusOptions(overview?.statusCounts ?? null)} onChange={(status) => change({ status })} />
        </Toolbar>
        <Toolbar>
          <FilterSelect label="Pays" value={filters.country} options={overview?.countries ?? []} onChange={(country) => change({ country })} />
          <FilterSelect label="Secteur" value={filters.sector} options={overview?.sectors ?? []} onChange={(sector) => change({ sector })} />
          <ColumnsMenu visible={columns} onToggle={(id) => { const next = toggleColumn(columns, id); setColumns(next); saveColumns(next); }} />
          {filtered && (
            <button type="button" className="secondary" onClick={() => { setPage(1); setFilters(NO_FILTERS); setSearchKey((k) => k + 1); }}>
              Réinitialiser les filtres
            </button>
          )}
          <SearchField key={searchKey} label="Rechercher une entreprise" onSearch={(search) => change({ search })} />
        </Toolbar>
        <p className="m-0 px-4 py-2 text-[length:var(--text-sm)] font-semibold" aria-live="polite">{data.total} entreprise{data.total > 1 ? 's' : ''}{filtered ? ' correspondante' + (data.total > 1 ? 's' : '') : ''}</p>
        <DataTable
          caption="Entreprises"
          columns={shown}
          rows={data.items}
          rowId={(c) => c.id}
          rowLabel={(c) => c.name}
          selection={{ selected, onChange: setSelected }}
          sort={tableSort}
          busy={loading}
          empty={filtered ? 'Aucune entreprise ne correspond à ces filtres.' : 'Aucune entreprise pour le moment.'}
        />
        <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPage={setPage} />
      </Card>

      {creating && (
        <CompanyDialog
          onClose={() => setCreating(false)}
          onDone={async () => {
            setCreating(false);
            setPage(1);
            setFilters(NO_FILTERS);
            setSearchKey((k) => k + 1);
            await load();
          }}
        />
      )}
    </>
  );
}

/** Liste déroulante d'un filtre (valeurs réellement présentes dans la portée de l'utilisateur). */
function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  const known = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <label className="flex items-center gap-2 text-[length:var(--text-sm)] text-ink-2">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-auto min-w-36">
        <option value="">Tous</option>
        {known.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

/** Menu « Colonnes » : une case par colonne ; la colonne du nom est toujours affichée. */
function ColumnsMenu({ visible, onToggle }: { visible: readonly CompanyColumnId[]; onToggle: (id: CompanyColumnId) => void }) {
  return (
    <details className="relative">
      <summary className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-field bg-surface px-4 text-[length:var(--text-sm)] font-semibold">Colonnes</summary>
      <fieldset className="absolute left-0 z-10 mt-2 min-w-48 rounded-lg border border-line bg-surface p-3 shadow-lg">
        <legend className="sr-only">Colonnes affichées</legend>
        {COMPANY_COLUMNS.map((column) => (
          <label key={column.id} className="flex items-center gap-2 py-1 text-[length:var(--text-sm)]">
            <input type="checkbox" checked={visible.includes(column.id)} disabled={column.locked} onChange={() => onToggle(column.id)} className="size-4 accent-[var(--brand-strong)]" />
            {column.label}
          </label>
        ))}
      </fieldset>
    </details>
  );
}
