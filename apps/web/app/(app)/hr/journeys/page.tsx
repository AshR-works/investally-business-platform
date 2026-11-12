'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '../../../../components/data/badge';
import { Card } from '../../../../components/data/card';
import { type Column, DataTable } from '../../../../components/data/data-table';
import { PageHeader } from '../../../../components/data/page-header';
import { Pagination } from '../../../../components/data/pagination';
import { QuickFilters, Toolbar } from '../../../../components/data/toolbar';
import { EntityLink } from '../../../../components/entity-link';
import { LaunchJourneyDialog } from '../../../../components/hr/journey-dialogs';
import { PageTabs } from '../../../../components/hr/page-tabs';
import { Icon } from '../../../../components/icon';
import { PageHeading } from '../../../../components/page-heading';
import { api, ApiError } from '../../../../lib/api';
import { useAuth } from '../../../../lib/auth-context';
import { formatDate } from '../../../../lib/format';
import { type Journey, JOURNEY_PAGES, JOURNEY_STATE_FILTERS, KIND_FILTERS, progressText, statusLabel, statusTone } from '../../../../lib/journeys';
import { can, canAll } from '../../../../lib/permissions';
import type { Page } from '../../../../lib/types';

const PAGE_SIZE = 20;

/**
 * Parcours d'intégration et de départ. La RH et le Super administrateur lancent et suivent tout ; la Direction lit tout ; chaque employé lit les siens ; les responsables et
 * les collègues ne voient rien. Un parcours se lance à la main et ses tâches se cochent avec leur date et leur auteur (D68).
 */
export default function JourneysPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const canRead = can(profile, 'hr.journey.read');
  const seesAll = canAll(profile, 'hr.journey.read');
  const canManage = canAll(profile, 'hr.journey.manage');
  const [data, setData] = useState<Page<Journey>>({ items: [], total: 0 });
  const [page, setPage] = useState(1);
  const [state, setState] = useState('ACTIVE');
  const [kind, setKind] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);

  const load = useCallback(async () => {
    if (!canRead) return;
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (state) params.set('status', state);
    if (kind) params.set('kind', kind);
    try {
      setData(await api<Page<Journey>>(`/hr/journeys?${params}`));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [canRead, page, state, kind]);
  useEffect(() => { void load(); }, [load]);

  const columns = useMemo<Column<Journey>[]>(() => [
    ...(seesAll ? [{ id: 'employee', weight: 3, header: 'Employé', cell: (j: Journey) => <EntityLink kind="employee" id={j.employeeId} label={j.employeeName}>{j.employeeName}</EntityLink> }] : []),
    { id: 'kind', weight: 1.8, header: 'Nature', cell: (j) => <Link href={`/hr/journeys/${j.id}`}>{j.kindLabel}</Link> },
    { id: 'reference', weight: 1.8, header: 'Référence', cell: (j) => formatDate(`${j.referenceDate}T00:00:00Z`) },
    { id: 'progress', weight: 2, header: 'Avancement', cell: (j) => progressText(j.progress) },
    { id: 'overdue', weight: 2, header: 'Retards', cell: (j) => (j.overdueCount > 0 ? <Badge tone="bad">{j.overdueCount} en retard</Badge> : <span className="text-ink-2">Aucun</span>) },
    { id: 'status', weight: 1.6, header: 'État', cell: (j) => <Badge tone={statusTone(j.status)}>{statusLabel(j.status)}</Badge> },
  ], [seesAll]);

  if (!canRead) {
    return (
      <>
        <PageHeading>Parcours</PageHeading>
        <p>Votre profil n&apos;a pas accès aux parcours.</p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Ressources humaines"
        title={seesAll ? 'Parcours' : 'Mes parcours'}
        description={seesAll
          ? 'Les parcours d’intégration et de départ : lancés à la main, leurs tâches se cochent avec leur date et leur auteur. Ouvrez un parcours pour voir et cocher ses tâches.'
          : 'Vos parcours d’intégration ou de départ et l’avancement de leurs tâches.'}
        actions={canManage && (
          <button type="button" onClick={() => setLaunching(true)} className="inline-flex items-center gap-2"><Icon name="plus" className="size-4" />Lancer un parcours</button>
        )}
      />
      <PageTabs label="Parcours" pages={JOURNEY_PAGES} current="journeys" />
      {loadError && <p role="alert" className="error">{loadError}</p>}
      <Card>
        <Toolbar>
          <QuickFilters label="Filtrer par état" value={state} options={[...JOURNEY_STATE_FILTERS]} onChange={(value) => { setPage(1); setState(value); }} />
          <label className="m-0 flex items-center gap-2 text-[length:var(--text-sm)] font-normal">
            Nature
            <select value={kind} onChange={(e) => { setPage(1); setKind(e.target.value); }} style={{ width: 'auto', marginTop: 0 }}>
              {KIND_FILTERS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </label>
          <p className="m-0 text-[length:var(--text-sm)] font-semibold" aria-live="polite">{loading ? 'Chargement…' : `${data.total} parcours`}</p>
        </Toolbar>
        <DataTable
          caption="Parcours"
          columns={columns}
          rows={data.items}
          rowId={(j) => j.id}
          rowLabel={(j) => `${j.kindLabel} de ${j.employeeName}`}
          busy={loading}
          empty={state === 'ACTIVE' ? 'Aucun parcours en cours.' : 'Aucun parcours pour ces critères.'}
        />
        <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPage={setPage} />
      </Card>
      {launching && <LaunchJourneyDialog onClose={() => setLaunching(false)} onDone={async (journey) => { setLaunching(false); router.push(`/hr/journeys/${journey.id}`); }} />}
    </>
  );
}
