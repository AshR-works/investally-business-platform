'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { CompanyDialog } from '../../../components/companies/company-dialog';
import { Badge } from '../../../components/data/badge';
import { Card } from '../../../components/data/card';
import { DataTable, type Column } from '../../../components/data/data-table';
import { EntityCell } from '../../../components/data/entity-cell';
import { PageHeader } from '../../../components/data/page-header';
import { Pagination } from '../../../components/data/pagination';
import { SelectionBar } from '../../../components/data/selection-bar';
import { SearchField, Toolbar } from '../../../components/data/toolbar';
import { Icon } from '../../../components/icon';
import { PageHeading } from '../../../components/page-heading';
import { api, ApiError } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { formatDate } from '../../../lib/format';
import { can } from '../../../lib/permissions';
import { COMPANY_STATUS, statusStyle } from '../../../lib/status';
import type { Company, Page } from '../../../lib/types';

const PAGE_SIZE = 20;

/** Colonnes du tableau : seules les données que l'API fournit aujourd'hui (nom, secteur, pays, statut, date de création). */
const COLUMNS: Column<Company>[] = [
  { id: 'name', header: 'Entreprise', cell: (c) => <Link href={`/companies/${c.id}`} className="text-ink no-underline hover:underline"><EntityCell name={c.name} /></Link> },
  { id: 'sector', header: 'Secteur', cell: (c) => c.sector ?? <span className="text-ink-2">—</span> },
  { id: 'country', header: 'Pays', cell: (c) => c.country ?? <span className="text-ink-2">—</span> },
  {
    id: 'status',
    header: 'Statut',
    cell: (c) => {
      const style = statusStyle(COMPANY_STATUS, c.status);
      return <Badge tone={style.tone}>{style.label}</Badge>;
    },
  },
  { id: 'created', header: 'Créée le', cell: (c) => formatDate(c.createdAt) },
];

/**
 * Entreprises visibles selon la portée de l'utilisateur : tableau du design (recherche, pagination, sélection
 * persistante) et création d'une entreprise dans une fenêtre (si le droit existe).
 */
export default function CompaniesPage() {
  const { profile } = useAuth();
  const [data, setData] = useState<Page<Company>>({ items: [], total: 0 });
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const canRead = can(profile, 'bd.company.read');
  const canCreate = can(profile, 'bd.company.create');

  const load = useCallback(async () => {
    if (!canRead) return;
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (query) params.set('search', query);
    try {
      setData(await api<Page<Company>>(`/companies?${params}`));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [canRead, page, query]);

  useEffect(() => {
    void load();
  }, [load]);

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
          <p className="m-0 text-[length:var(--text-sm)] font-semibold">{data.total} entreprise{data.total > 1 ? 's' : ''}</p>
          <SearchField label="Rechercher une entreprise" onSearch={(value) => { setPage(1); setQuery(value); }} />
        </Toolbar>
        <DataTable
          caption="Entreprises"
          columns={COLUMNS}
          rows={data.items}
          rowId={(c) => c.id}
          rowLabel={(c) => c.name}
          selection={{ selected, onChange: setSelected }}
          busy={loading}
          empty={query ? 'Aucune entreprise ne correspond à cette recherche.' : 'Aucune entreprise pour le moment.'}
        />
        <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPage={setPage} />
      </Card>

      {creating && (
        <CompanyDialog
          onClose={() => setCreating(false)}
          onDone={async () => {
            setCreating(false);
            setPage(1);
            setQuery('');
            await load();
          }}
        />
      )}
    </>
  );
}
