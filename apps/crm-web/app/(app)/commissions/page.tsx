'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { PayoutDialogs, type PayoutDialogState } from '../../../components/commissions/payout-dialogs';
import { Badge } from '../../../components/data/badge';
import { Card } from '../../../components/data/card';
import { DataTable, type Column } from '../../../components/data/data-table';
import { PageHeader } from '../../../components/data/page-header';
import { Pagination } from '../../../components/data/pagination';
import { RowAction, RowActions } from '../../../components/data/row-actions';
import { Toolbar } from '../../../components/data/toolbar';
import { PageHeading } from '../../../components/page-heading';
import { api, ApiError } from '../../../lib/api';
import { CompanyContextBar } from '../../../components/company-context-bar';
import { useCompanyContext } from '../../../lib/company-context';
import { useAuth } from '../../../lib/auth-context';
import { PAYOUT_ACTION_LABEL, PAYOUT_STATUS, PAYOUT_STATUS_OPTIONS, payoutActions, payoutAmountText, payoutDefinitionText } from '../../../lib/commissions';
import { formatDate } from '../../../lib/format';
import { can } from '../../../lib/permissions';
import type { Page, Payout } from '../../../lib/types';

const PAGE_SIZE = 20;

/**
 * Commissions des facilitateurs à verser (flux F3) : une commission naît quand l'agrément d'une entreprise qui a un facilitateur
 * commissionné est honoré. La Finance débloque ou met en attente ; le chargé de compte verse avec son justificatif ; le Responsable
 * commercial annule ou fixe un montant manquant. Chaque bouton n'apparaît que si l'état ET les droits le permettent ; le serveur
 * re-contrôle chaque requête, et la portée est celle de l'entreprise.
 */
export default function CommissionsPage() {
  const { profile } = useAuth();
  const [data, setData] = useState<Page<Payout>>({ items: [], total: 0 });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<PayoutDialogState | null>(null);
  const canRead = can(profile, 'bd.commission.read');
  const rights = { release: can(profile, 'bd.commission.release'), pay: can(profile, 'bd.commission.pay'), manage: can(profile, 'bd.commission.manage') };
  const canSeeProof = can(profile, 'docs.document.read');

  const ctx = useCompanyContext();
  // Un autre contexte d'entreprise repart de la première page.
  useEffect(() => setPage(1), [ctx.companyId]);
  const load = useCallback(async () => {
    if (!canRead) return;
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (status) params.set('status', status);
    if (ctx.companyId) params.set('companyId', ctx.companyId);
    try {
      setData(await api<Page<Payout>>(`/commissions?${params}`));
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
        <PageHeading>Commissions</PageHeading>
        <p>Votre profil n&apos;a pas accès aux commissions.</p>
      </>
    );
  }

  const columns: Column<Payout>[] = [
    { id: 'facilitator', weight: 3, header: 'Facilitateur', cell: (p) => <strong>{p.facilitatorName}</strong> },
    { id: 'company', weight: 3, header: 'Entreprise', cell: (p) => <Link href={`/companies/${p.companyId}`} className="text-ink no-underline hover:underline">{p.companyName}</Link> },
    { id: 'amount', weight: 2.4, header: 'À verser', align: 'right', cell: (p) => payoutAmountText(p) },
    { id: 'definition', weight: 1.8, header: 'Commission', cell: (p) => payoutDefinitionText(p) },
    {
      id: 'status', weight: 2.6, header: 'État',
      cell: (p) => {
        const style = PAYOUT_STATUS[p.status] ?? { label: p.status, tone: 'neutral' as const };
        return (
          <>
            <Badge tone={style.tone}>{style.label}</Badge>
            {p.holdReason && <span className="block text-[length:var(--text-sm)] text-ink-2">Motif : {p.holdReason}</span>}
            {p.cancelledReason && <span className="block text-[length:var(--text-sm)] text-ink-2">Motif : {p.cancelledReason}</span>}
          </>
        );
      },
    },
    { id: 'date', weight: 1.8, header: 'Versée le', cell: (p) => (p.paidOn ? formatDate(`${p.paidOn}T00:00:00Z`) : <span className="text-ink-2">—</span>) },
    {
      id: 'actions', weight: 1, header: 'Actions', srOnlyHeader: true, align: 'right',
      cell: (p) => {
        const actions = payoutActions(p, rights);
        if (actions.length === 0 && !canSeeProof) return <span className="sr-only">Aucune action</span>;
        return (
          <RowActions label={`Actions pour la commission de ${p.facilitatorName}`}>
            {canSeeProof && <RowAction onClick={() => setDialog({ kind: 'proof', payout: p })}>Justificatif</RowAction>}
            {actions.map((action) => (
              <RowAction key={action} danger={action === 'cancel'} onClick={() => setDialog({ kind: action, payout: p })}>{PAYOUT_ACTION_LABEL[action]}</RowAction>
            ))}
          </RowActions>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Business Development"
        title="Commissions"
        description="Commissions dues aux facilitateurs, à partir des agréments honorés. La Finance débloque les fonds ; le chargé de compte verse et dépose le justificatif."
      />
      <CompanyContextBar ctx={ctx} section="Commissions" />
      {loadError && <p role="alert" className="error">{loadError}</p>}
      <Card>
        <Toolbar>
          <p className="m-0 text-[length:var(--text-sm)] font-semibold" aria-live="polite">{loading ? 'Chargement…' : `${data.total} commission${data.total > 1 ? 's' : ''}`}</p>
          <label className="m-0 flex items-center gap-2 text-[length:var(--text-sm)] font-normal">
            État
            <select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} style={{ width: 'auto', marginTop: 0 }}>
              <option value="">Tous</option>
              {PAYOUT_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </Toolbar>
        <DataTable
          caption="Commissions des facilitateurs"
          columns={columns}
          rows={data.items}
          rowId={(p) => p.id}
          rowLabel={(p) => `la commission de ${p.facilitatorName}`}
          busy={loading}
          empty={status ? 'Aucune commission dans cet état.' : 'Aucune commission pour le moment : elles naissent quand un agrément est honoré.'}
        />
        <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPage={setPage} />
      </Card>
      <PayoutDialogs dialog={dialog} onClose={() => setDialog(null)} onDone={async () => { setDialog(null); await load(); }} />
    </>
  );
}
