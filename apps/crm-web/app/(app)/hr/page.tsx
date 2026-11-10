'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '../../../components/data/card';
import { type Column, DataTable } from '../../../components/data/data-table';
import { EntityCell } from '../../../components/data/entity-cell';
import { PageHeader } from '../../../components/data/page-header';
import { Pagination } from '../../../components/data/pagination';
import { SearchField, Toolbar } from '../../../components/data/toolbar';
import { PageHeading } from '../../../components/page-heading';
import { api, ApiError } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { type DirectoryEntry, departmentsOf, fullName } from '../../../lib/hr';
import { can } from '../../../lib/permissions';
import type { Page } from '../../../lib/types';
import { MailLink } from '../../../components/mail-link';

const PAGE_SIZE = 20;
const dash = <span className="text-ink-2">—</span>;

/**
 * Annuaire du personnel : les employés en poste, avec leur poste, leur service et leurs **contacts professionnels** seulement. Lisible de tout
 * utilisateur connecté (D57) ; la fiche détaillée, elle, suit les droits de la RH. Recherche, filtre par service, pagination.
 */
export default function DirectoryPage() {
  const { profile } = useAuth();
  const canRead = can(profile, 'hr.directory.read');
  const [data, setData] = useState<Page<DirectoryEntry>>({ items: [], total: 0 });
  const [departments, setDepartments] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!canRead) return;
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (query) params.set('search', query);
    if (department) params.set('department', department);
    try {
      setData(await api<Page<DirectoryEntry>>(`/hr/directory?${params}`));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [canRead, page, query, department]);
  useEffect(() => {
    void load();
  }, [load]);
  // Les services proposés au filtre : ceux de tous les employés en poste (l'organigramme les liste à plat).
  useEffect(() => {
    if (!canRead) return;
    api<DirectoryEntry[]>('/hr/org-chart').then((all) => setDepartments(departmentsOf(all))).catch(() => setDepartments([]));
  }, [canRead]);

  const columns = useMemo<Column<DirectoryEntry>[]>(() => [
    { id: 'name', weight: 3, header: 'Nom', cell: (p) => <EntityCell name={fullName(p)} subtitle={p.jobTitle} round /> },
    { id: 'department', weight: 2, header: 'Service', cell: (p) => p.department },
    { id: 'email', weight: 3.2, header: 'E-mail professionnel', cell: (p) => <MailLink email={p.workEmail} /> },
    { id: 'phone', weight: 2.4, header: 'Téléphone professionnel', cell: (p) => p.workPhone ?? dash },
  ], []);

  if (!canRead) {
    return (
      <>
        <PageHeading>Annuaire</PageHeading>
        <p>Votre profil n&apos;a pas accès à l&apos;annuaire.</p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Ressources humaines"
        title="Annuaire"
        description="Le personnel d’Investally : poste, service et contacts professionnels. Seules les personnes en poste y figurent."
      />
      {loadError && <p role="alert" className="error">{loadError}</p>}
      <Card>
        <Toolbar>
          <p className="m-0 text-[length:var(--text-sm)] font-semibold" aria-live="polite">{loading ? 'Chargement…' : `${data.total} personne${data.total > 1 ? 's' : ''}`}</p>
          <label className="m-0 flex items-center gap-2 text-[length:var(--text-sm)] font-normal">
            Service
            <select value={department} onChange={(e) => { setPage(1); setDepartment(e.target.value); }} style={{ width: 'auto', marginTop: 0 }}>
              <option value="">Tous</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <SearchField label="Rechercher dans l’annuaire" onSearch={(value) => { setPage(1); setQuery(value); }} />
        </Toolbar>
        <DataTable
          caption="Annuaire du personnel"
          columns={columns}
          rows={data.items}
          rowId={(p) => p.id}
          rowLabel={fullName}
          busy={loading}
          empty={query || department ? 'Personne ne correspond à cette recherche.' : 'Aucune personne dans l’annuaire pour le moment.'}
        />
        <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPage={setPage} />
      </Card>
    </>
  );
}
