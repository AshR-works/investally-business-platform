'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '../../../../../components/data/badge';
import { Card } from '../../../../../components/data/card';
import { type Column, DataTable } from '../../../../../components/data/data-table';
import { PageHeader } from '../../../../../components/data/page-header';
import { Toolbar } from '../../../../../components/data/toolbar';
import { EntityLink } from '../../../../../components/entity-link';
import { PageTabs } from '../../../../../components/hr/page-tabs';
import { PageHeading } from '../../../../../components/page-heading';
import { api, ApiError } from '../../../../../lib/api';
import { useAuth } from '../../../../../lib/auth-context';
import { CONTRACT_PAGES, DEADLINE_WINDOWS, daysLeftText, DEFAULT_DEADLINE_DAYS, type Deadline, deadlineKindLabel, deadlineTone } from '../../../../../lib/contracts';
import { formatDate } from '../../../../../lib/format';
import { canAll } from '../../../../../lib/permissions';

/**
 * Contrats à échéance : les contrats en cours dont la fin, ou la fin de la période d'essai, tombe dans la période choisie. Réservé à ceux qui voient tous les contrats
 * (la RH, le Super administrateur). Un écran, pas une notification : aucun courriel n'est envoyé (D67).
 */
export default function ContractDeadlinesPage() {
  const { profile } = useAuth();
  const allowed = canAll(profile, 'hr.contract.manage');
  const [days, setDays] = useState<number>(DEFAULT_DEADLINE_DAYS);
  const [rows, setRows] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    try {
      setRows(await api<Deadline[]>(`/hr/contracts/deadlines?days=${days}`));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [allowed, days]);
  useEffect(() => { void load(); }, [load]);

  const columns = useMemo<Column<Deadline>[]>(() => [
    { id: 'date', weight: 1.6, header: 'Date', cell: (d) => formatDate(`${d.date}T00:00:00Z`) },
    { id: 'left', weight: 1.8, header: 'Échéance', cell: (d) => <Badge tone={deadlineTone(d.daysLeft)}>{daysLeftText(d.daysLeft)}</Badge> },
    { id: 'employee', weight: 3, header: 'Employé', cell: (d) => <EntityLink kind="employee" id={d.employeeId} label={d.employeeName}>{d.employeeName}</EntityLink> },
    { id: 'kind', weight: 2.6, header: 'Nature', cell: (d) => deadlineKindLabel(d.kind) },
    { id: 'type', weight: 2.4, header: 'Contrat', cell: (d) => d.contractTypeLabel },
  ], []);

  if (!allowed) {
    return (
      <>
        <PageHeading>Contrats à échéance</PageHeading>
        <p>Les échéances de contrats sont réservées à la RH.</p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Ressources humaines"
        title="Contrats à échéance"
        description="Les contrats en cours dont la fin, ou la fin de la période d’essai, approche. Aucune notification n’est envoyée : consultez cet écran régulièrement."
      />
      <PageTabs label="Contrats" pages={CONTRACT_PAGES} current="deadlines" />
      {error && <p role="alert" className="error">{error}</p>}
      <Card>
        <Toolbar>
          <label className="m-0 flex items-center gap-2 text-[length:var(--text-sm)] font-normal">
            Période
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} style={{ width: 'auto', marginTop: 0 }}>
              {DEADLINE_WINDOWS.map((d) => <option key={d} value={d}>{d} prochains jours</option>)}
            </select>
          </label>
          <p className="m-0 text-[length:var(--text-sm)] font-semibold" aria-live="polite">{loading ? 'Chargement…' : `${rows.length} échéance${rows.length > 1 ? 's' : ''}`}</p>
        </Toolbar>
        <DataTable
          caption="Contrats à échéance"
          columns={columns}
          rows={rows}
          rowId={(d) => `${d.contractId}-${d.kind}`}
          rowLabel={(d) => `${d.employeeName}, ${deadlineKindLabel(d.kind)}`}
          busy={loading}
          empty={`Aucune échéance dans les ${days} prochains jours.`}
        />
      </Card>
    </>
  );
}
