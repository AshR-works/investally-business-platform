'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApprovalDialogs, type ApprovalDialogState } from '../../../components/approvals/approval-dialogs';
import { CompanyContextBar } from '../../../components/company-context-bar';
import { Badge } from '../../../components/data/badge';
import { Card } from '../../../components/data/card';
import { type Column, DataTable } from '../../../components/data/data-table';
import { PageHeader } from '../../../components/data/page-header';
import { Pagination } from '../../../components/data/pagination';
import { RowAction, RowActions } from '../../../components/data/row-actions';
import { QuickFilters, Toolbar } from '../../../components/data/toolbar';
import { EntityLink } from '../../../components/entity-link';
import { PageHeading } from '../../../components/page-heading';
import { api, ApiError } from '../../../lib/api';
import { APPROVAL_ACTION_LABEL, APPROVAL_STATUS, approvalActions, coverageText, payerText } from '../../../lib/approvals';
import { useAuth } from '../../../lib/auth-context';
import { useCompanyContext } from '../../../lib/company-context';
import { formatDate } from '../../../lib/format';
import { can } from '../../../lib/permissions';
import type { Approval, Page } from '../../../lib/types';

const PAGE_SIZE = 20;

/** Filtre par état : « Tous » puis chaque état de l'agrément. */
const STATUS_OPTIONS = [{ value: '', label: 'Tous' }, ...Object.entries(APPROVAL_STATUS).map(([value, style]) => ({ value, label: style.label }))];

/**
 * Agréments de toutes les entreprises de la portée de l'utilisateur (D-NAV-1) : filtre par état, filtre d'entreprise porté par
 * l'adresse (D52), fiche dédiée, et le cycle d'un agrément depuis le menu d'une ligne. L'enregistrement d'un agrément reste dans la
 * fiche de l'entreprise (il se fait pour une entreprise et une opportunité précises).
 */
export default function ApprovalsPage() {
  const { profile } = useAuth();
  const [data, setData] = useState<Page<Approval>>({ items: [], total: 0 });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<ApprovalDialogState | null>(null);
  const canRead = can(profile, 'bd.approval.read');
  const rights = { honor: can(profile, 'bd.approval.honor'), cancel: can(profile, 'bd.approval.cancel'), receive: can(profile, 'bd.approval.create') };

  const ctx = useCompanyContext();
  // Un autre contexte d'entreprise repart de la première page.
  useEffect(() => setPage(1), [ctx.companyId]);
  const load = useCallback(async () => {
    if (!canRead) return;
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (status) params.set('status', status);
    if (ctx.companyId) params.set('companyId', ctx.companyId);
    try {
      setData(await api<Page<Approval>>(`/approvals?${params}`));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [canRead, page, status, ctx.companyId]);
  useEffect(() => {
    void load();
  }, [load]);

  if (!canRead) {
    return (
      <>
        <PageHeading>Agréments</PageHeading>
        <p>Votre profil n&apos;a pas accès aux agréments.</p>
      </>
    );
  }

  const columns: Column<Approval>[] = [
    { id: 'opportunity', weight: 3, header: 'Agrément', cell: (a) => <EntityLink kind="approval" id={a.id} label={a.opportunityTitle}><strong>{a.opportunityTitle}</strong></EntityLink> },
    { id: 'company', weight: 3, header: 'Entreprise', cell: (a) => <EntityLink kind="company" id={a.companyId} label={a.companyName}>{a.companyName}</EntityLink> },
    { id: 'covers', weight: 2.6, header: 'Couvre', cell: (a) => coverageText(a) },
    { id: 'payer', weight: 2.2, header: 'Payeur', cell: (a) => payerText(a) },
    { id: 'valid', weight: 2.2, header: 'Valide jusqu’au', cell: (a) => <>{a.validUntil ? formatDate(`${a.validUntil}T00:00:00Z`) : '—'}{a.pastValidity && <> <Badge tone="warn">Validité dépassée</Badge></>}</> },
    { id: 'status', weight: 1.8, header: 'État', cell: (a) => { const s = APPROVAL_STATUS[a.status] ?? { label: a.status, tone: 'neutral' as const }; return <Badge tone={s.tone}>{s.label}</Badge>; } },
    {
      id: 'actions', weight: 0.8, header: 'Actions', srOnlyHeader: true, align: 'right',
      cell: (a) => (
        <RowActions label={`Actions pour l’agrément ${a.opportunityTitle}`}>
          <RowAction onClick={() => setDialog({ kind: 'document', approval: a })}>Document signé</RowAction>
          {approvalActions(a, rights).map((action) => (
            <RowAction key={action} danger={action === 'cancel'} onClick={() => setDialog({ kind: action, approval: a })}>{APPROVAL_ACTION_LABEL[action]}</RowAction>
          ))}
        </RowActions>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Business Development"
        title="Agréments"
        description="Les promesses de paiement signées par les clients, dans votre périmètre. Un agrément s’enregistre depuis la fiche de l’entreprise, une fois l’accord de principe obtenu."
      />
      <CompanyContextBar ctx={ctx} section="Agréments" />
      {loadError && <p role="alert" className="error">{loadError}</p>}
      <Card>
        <Toolbar>
          <QuickFilters label="Filtrer par état" value={status} options={STATUS_OPTIONS} onChange={(value) => { setPage(1); setStatus(value); }} />
        </Toolbar>
        <Toolbar>
          <p className="m-0 text-[length:var(--text-sm)] font-semibold" aria-live="polite">{data.total} agrément{data.total > 1 ? 's' : ''}</p>
        </Toolbar>
        <DataTable
          caption="Agréments"
          columns={columns}
          rows={data.items}
          rowId={(a) => a.id}
          rowLabel={(a) => a.opportunityTitle}
          busy={loading}
          empty={status ? 'Aucun agrément dans cet état.' : 'Aucun agrément pour le moment.'}
        />
        <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPage={setPage} />
      </Card>
      <ApprovalDialogs dialog={dialog} onClose={() => setDialog(null)} onDone={async () => { setDialog(null); await load(); }} />
    </>
  );
}
