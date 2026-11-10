'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Card } from '../../../../components/data/card';
import { DataTable, type Column } from '../../../../components/data/data-table';
import { PageHeader } from '../../../../components/data/page-header';
import { Pagination } from '../../../../components/data/pagination';
import { RowAction, RowActions } from '../../../../components/data/row-actions';
import { SearchField, Toolbar } from '../../../../components/data/toolbar';
import { EntityLink } from '../../../../components/entity-link';
import { PageHeading } from '../../../../components/page-heading';
import { EnrollmentDialogs, type EnrollmentDialogState } from '../../../../components/training/enrollment-dialogs';
import { api, ApiError } from '../../../../lib/api';
import { useAuth } from '../../../../lib/auth-context';
import { ENROLLMENT_PERMISSIONS, type Learner } from '../../../../lib/enrollments';
import { can } from '../../../../lib/permissions';
import type { Page } from '../../../../lib/types';
import { MailLink } from '../../../../components/mail-link';

const PAGE_SIZE = 20;
const dash = <span className="text-ink-2">—</span>;

/**
 * Apprenants (S5.2b) : les personnes inscrites à une formation pour le compte d'une entreprise. La portée est celle de l'entreprise (chargé de
 * compte : ses entreprises ; Responsable commercial : son équipe ; Investudy : toutes). Supprimer est réservé au Responsable Investudy.
 */
export default function LearnersPage() {
  const { profile } = useAuth();
  const canRead = can(profile, ENROLLMENT_PERMISSIONS.readLearners);
  const canCreate = can(profile, ENROLLMENT_PERMISSIONS.createLearner);
  const canEdit = can(profile, ENROLLMENT_PERMISSIONS.updateLearner);
  const canDelete = can(profile, ENROLLMENT_PERMISSIONS.deleteLearner);
  const canEnroll = can(profile, ENROLLMENT_PERMISSIONS.enroll);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<Learner>>({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<EnrollmentDialogState | null>(null);

  const load = useCallback(async () => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (search) params.set('search', search);
      setData(await api<Page<Learner>>(`/learners?${params}`));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [canRead, page, search]);
  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  if (!canRead) {
    return (
      <>
        <PageHeading>Apprenants</PageHeading>
        <p>Votre profil n&apos;a pas accès aux apprenants.</p>
      </>
    );
  }

  const actionsFor = (l: Learner) => {
    if (!canEdit && !canDelete && !canEnroll) return <span className="sr-only">Aucune action</span>;
    return (
      <RowActions label={`Actions pour ${l.firstName} ${l.lastName}`}>
        {canEnroll && <RowAction onClick={() => setDialog({ kind: 'enroll', learner: l })}>Inscrire à une session</RowAction>}
        {canEdit && <RowAction onClick={() => setDialog({ kind: 'learner', learner: l })}>Modifier</RowAction>}
        {canDelete && <RowAction danger onClick={() => setDialog({ kind: 'delete-learner', learner: l })}>Supprimer l’apprenant</RowAction>}
      </RowActions>
    );
  };
  const columns: Column<Learner>[] = [
    { id: 'name', weight: 3, header: 'Apprenant', cell: (l) => <EntityLink kind="learner" id={l.id} label={`${l.firstName} ${l.lastName}`}><strong>{l.firstName} {l.lastName}</strong></EntityLink> },
    { id: 'company', weight: 3, header: 'Entreprise', cell: (l) => <EntityLink kind="company" id={l.companyId} label={l.companyName}>{l.companyName}</EntityLink> },
    { id: 'contact', weight: 3.4, header: 'Contact', cell: (l) => (l.email || l.phone ? <>{l.email ? <MailLink email={l.email} /> : null}{l.email && l.phone ? <br /> : null}{l.phone}</> : dash) },
    { id: 'actions', weight: 1, header: 'Actions', srOnlyHeader: true, align: 'right', cell: actionsFor },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Investudy"
        title="Apprenants"
        description="Les personnes que vous inscrivez aux formations, par entreprise. Un apprenant n’est pas forcément un contact de l’entreprise. Il se supprime logiquement : ses inscriptions passées restent lisibles."
        actions={canCreate ? <button type="button" onClick={() => setDialog({ kind: 'learner' })}>Nouvel apprenant</button> : undefined}
      />
      <p className="m-0 mb-3"><Link href="/training/enrollments">Inscriptions →</Link></p>
      {loadError && <p role="alert" className="error">{loadError}</p>}
      <Card>
        <Toolbar>
          <p className="m-0 text-[length:var(--text-sm)] font-semibold" aria-live="polite">{loading ? 'Chargement…' : `${data.total} apprenant${data.total > 1 ? 's' : ''}`}</p>
          <SearchField label="Rechercher un apprenant" onSearch={(v) => { setPage(1); setSearch(v); }} />
        </Toolbar>
        <DataTable
          caption="Apprenants"
          columns={columns}
          rows={data.items}
          rowId={(l) => l.id}
          rowLabel={(l) => `apprenant ${l.firstName} ${l.lastName}`}
          busy={loading}
          empty={search ? 'Aucun apprenant ne correspond à cette recherche.' : 'Aucun apprenant pour le moment.'}
        />
        <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPage={setPage} />
      </Card>
      <EnrollmentDialogs dialog={dialog} onClose={() => setDialog(null)} onDone={async () => { setDialog(null); await load(); }} />
    </>
  );
}
