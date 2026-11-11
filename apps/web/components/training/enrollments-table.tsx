'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { type Enrollment, ENROLLMENT_PERMISSIONS, ENROLLMENT_STATUS, ENROLLMENT_STATUS_OPTIONS, enrollmentActions, LEARNER_KIND_LABEL, payerText } from '../../lib/enrollments';
import { can } from '../../lib/permissions';
import { dateText } from '../../lib/sessions';
import type { Page } from '../../lib/types';
import { Badge } from '../data/badge';
import { Card } from '../data/card';
import { DataTable, type Column } from '../data/data-table';
import { Pagination } from '../data/pagination';
import { RowAction, RowActions } from '../data/row-actions';
import { QuickFilters, Toolbar } from '../data/toolbar';
import { EnrollmentDialogs, type EnrollmentDialogState } from './enrollment-dialogs';

const PAGE_SIZE = 20;

/**
 * Tableau des inscriptions, d'une session (fiche de session) ou de toutes (file de confirmation). Les actions affichées suivent l'état de
 * l'inscription, l'état de sa session et les droits ; le serveur re-contrôle chaque requête.
 */
export function EnrollmentsTable({ sessionId, defaultStatus = '', refreshKey = 0, onChanged, caption }: {
  sessionId?: string; defaultStatus?: string; refreshKey?: number; onChanged?: () => void; caption: string;
}) {
  const { profile } = useAuth();
  const rights = { confirm: can(profile, ENROLLMENT_PERMISSIONS.confirm), cancel: can(profile, ENROLLMENT_PERMISSIONS.cancel) };
  const [status, setStatus] = useState(defaultStatus);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<Enrollment>>({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<EnrollmentDialogState | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (status) params.set('status', status);
      if (sessionId) params.set('sessionId', sessionId);
      setData(await api<Page<Enrollment>>(`/enrollments?${params}`));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [page, status, sessionId]);
  useEffect(() => {
    setLoading(true);
    void load();
  }, [load, refreshKey]);

  const actionsFor = (e: Enrollment) => {
    const allowed = enrollmentActions(e, rights);
    if (!allowed.confirm && !allowed.cancel && !allowed.replace) return <span className="sr-only">Aucune action</span>;
    return (
      <RowActions label={`Actions pour l’inscription de ${e.learnerName}`}>
        {allowed.confirm && <RowAction onClick={() => setDialog({ kind: 'confirm', enrollment: e })}>Confirmer</RowAction>}
        {allowed.replace && <RowAction onClick={() => setDialog({ kind: 'replace', enrollment: e })}>Replacer sur une autre session</RowAction>}
        {allowed.cancel && <RowAction danger onClick={() => setDialog({ kind: 'cancel', enrollment: e })}>Annuler l’inscription</RowAction>}
      </RowActions>
    );
  };

  const columns: Column<Enrollment>[] = [
    { id: 'learner', weight: 2.6, header: 'Apprenant', cell: (e) => <><strong>{e.learnerName}</strong><br /><span className="text-ink-2">{e.companyName || LEARNER_KIND_LABEL[e.learnerKind]}</span></> },
    ...(sessionId
      ? []
      : [{ id: 'session', weight: 3.2, header: 'Session', cell: (e: Enrollment) => <><Link href={`/training/sessions/${e.sessionId}`}>{e.trainingTitle}</Link><br /><span className="text-ink-2">{dateText(e.sessionStart)} → {dateText(e.sessionEnd)}</span></> }]),
    {
      id: 'approval', weight: 3, header: 'Agrément ou payeur',
      cell: (e) => (e.payer
        ? <>Payeur : {payerText(e.payer)}{e.chargedAmount ? <><br /><span className="text-ink-2">Montant dû : {Number(e.chargedAmount).toLocaleString('fr-FR')}</span></> : null}</>
        : <>{e.approvalLabel || '—'}{e.chargedAmount ? <><br /><span className="text-ink-2">Compte {Number(e.chargedAmount).toLocaleString('fr-FR').replace(/[  ]/g, ' ')} sur l’agrément</span></> : null}</>),
    },
    {
      id: 'status', weight: 2.6, header: 'État',
      cell: (e) => (
        <>
          <Badge tone={ENROLLMENT_STATUS[e.status].tone}>{ENROLLMENT_STATUS[e.status].label}</Badge>
          {e.cancelReason && <><br /><span className="text-ink-2 line-clamp-2">Motif : {e.cancelReason}</span></>}
          {e.comment && <><br /><span className="text-ink-2 line-clamp-2">{e.comment}</span></>}
        </>
      ),
    },
    { id: 'actions', weight: 1, header: 'Actions', srOnlyHeader: true, align: 'right', cell: actionsFor },
  ];

  return (
    <>
      {loadError && <p role="alert" className="error">{loadError}</p>}
      <Card>
        <Toolbar>
          <p className="m-0 text-[length:var(--text-sm)] font-semibold" aria-live="polite">{loading ? 'Chargement…' : `${data.total} inscription${data.total > 1 ? 's' : ''}`}</p>
          <QuickFilters label="État de l’inscription" value={status} options={[...ENROLLMENT_STATUS_OPTIONS]} onChange={(v) => { setPage(1); setStatus(v); }} />
        </Toolbar>
        <DataTable
          caption={caption}
          columns={columns}
          rows={data.items}
          rowId={(e) => e.id}
          rowLabel={(e) => `inscription de ${e.learnerName}`}
          busy={loading}
          empty={status ? 'Aucune inscription ne correspond à ce filtre.' : 'Aucune inscription pour le moment.'}
        />
        <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPage={setPage} />
      </Card>
      <EnrollmentDialogs dialog={dialog} onClose={() => setDialog(null)} onDone={async () => { setDialog(null); await load(); onChanged?.(); }} />
    </>
  );
}
