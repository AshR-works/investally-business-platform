'use client';

import { useCallback, useEffect, useState } from 'react';
import { ContactDialog } from '../../../components/contacts/contact-dialog';
import { Badge } from '../../../components/data/badge';
import { Card } from '../../../components/data/card';
import { DataTable, type Column } from '../../../components/data/data-table';
import { EntityCell } from '../../../components/data/entity-cell';
import { EntityLink } from '../../../components/entity-link';
import { PageHeader } from '../../../components/data/page-header';
import { Pagination } from '../../../components/data/pagination';
import { SelectionBar } from '../../../components/data/selection-bar';
import { SearchField, Toolbar } from '../../../components/data/toolbar';
import { Icon } from '../../../components/icon';
import { PageHeading } from '../../../components/page-heading';
import { api, ApiError } from '../../../lib/api';
import { CompanyContextBar } from '../../../components/company-context-bar';
import { useCompanyContext } from '../../../lib/company-context';
import { useAuth } from '../../../lib/auth-context';
import { CONTACT_ROLES, contactRoleLabel } from '../../../lib/contacts';
import { can } from '../../../lib/permissions';
import type { Contact, Page } from '../../../lib/types';

const PAGE_SIZE = 20;

const COLUMNS: Column<Contact>[] = [
  { id: 'name', weight: 3, header: 'Contact', cell: (c) => <EntityLink kind="contact" id={c.id} label={`${c.firstName} ${c.lastName}`}><EntityCell name={`${c.firstName} ${c.lastName}`} /></EntityLink> },
  { id: 'role', weight: 2, header: 'Fonction', cell: (c) => <Badge tone="neutral">{contactRoleLabel(c.role)}</Badge> },
  { id: 'company', weight: 3, header: 'Entreprise', cell: (c) => <EntityLink kind="company" id={c.companyId} label={c.companyName}>{c.companyName}</EntityLink> },
  { id: 'email', weight: 3.2, header: 'E-mail', cell: (c) => c.email ?? <span className="text-ink-2">—</span> },
  { id: 'phone', weight: 2.4, header: 'Téléphone', cell: (c) => c.phone ?? <span className="text-ink-2">—</span> },
];

/**
 * Contacts visibles selon la portée de l'utilisateur (celle de leur entreprise) : recherche, filtre par fonction, pagination,
 * sélection persistante, création dans une fenêtre (l'entreprise se choisit parmi celles de sa portée).
 */
export default function ContactsPage() {
  const { profile } = useAuth();
  const [data, setData] = useState<Page<Contact>>({ items: [], total: 0 });
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const canRead = can(profile, 'bd.contact.read');
  const canCreate = can(profile, 'bd.contact.create');

  const ctx = useCompanyContext();
  // Un autre contexte d'entreprise repart de la première page.
  useEffect(() => setPage(1), [ctx.companyId]);
  const load = useCallback(async () => {
    if (!canRead) return;
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (query) params.set('search', query);
    if (role) params.set('role', role);
    if (ctx.companyId) params.set('companyId', ctx.companyId);
    try {
      setData(await api<Page<Contact>>(`/contacts?${params}`));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [canRead, page, query, role, ctx.companyId]);
  useEffect(() => {
    void load();
  }, [load]);

  if (!canRead) {
    return (
      <>
        <PageHeading>Contacts</PageHeading>
        <p>Votre profil n&apos;a pas accès aux contacts.</p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Business Development"
        title="Contacts"
        description="Les interlocuteurs des entreprises visibles selon votre périmètre."
        actions={canCreate && (
          <button type="button" onClick={() => setCreating(true)} className="inline-flex items-center gap-2">
            <Icon name="plus" className="size-4" />Nouveau contact
          </button>
        )}
      />
      <SelectionBar count={selected.size} onClear={() => setSelected(new Set())} />
      <CompanyContextBar ctx={ctx} section="Contacts" />
      {loadError && <p role="alert" className="error">{loadError}</p>}
      <Card>
        <Toolbar>
          <p className="m-0 text-[length:var(--text-sm)] font-semibold">{data.total} contact{data.total > 1 ? 's' : ''}</p>
          <label className="m-0 flex items-center gap-2 text-[length:var(--text-sm)] font-normal">
            Fonction
            <select value={role} onChange={(e) => { setPage(1); setRole(e.target.value); }} style={{ width: 'auto', marginTop: 0 }}>
              <option value="">Toutes</option>
              {CONTACT_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </label>
          <SearchField label="Rechercher un contact" onSearch={(value) => { setPage(1); setQuery(value); }} />
        </Toolbar>
        <DataTable
          caption="Contacts"
          columns={COLUMNS}
          rows={data.items}
          rowId={(c) => c.id}
          rowLabel={(c) => `${c.firstName} ${c.lastName}`}
          selection={{ selected, onChange: setSelected }}
          busy={loading}
          empty={query || role ? 'Aucun contact ne correspond à cette recherche.' : 'Aucun contact pour le moment.'}
        />
        <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPage={setPage} />
      </Card>
      {creating && <ContactDialog onClose={() => setCreating(false)} onDone={async () => { setCreating(false); setPage(1); setQuery(''); setRole(''); await load(); }} />}
    </>
  );
}
