'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '../../../../../components/data/badge';
import { Card } from '../../../../../components/data/card';
import { PageHeader } from '../../../../../components/data/page-header';
import { EntityLink } from '../../../../../components/entity-link';
import { CancelJourneyDialog } from '../../../../../components/hr/journey-dialogs';
import { PageHeading } from '../../../../../components/page-heading';
import { api, ApiError } from '../../../../../lib/api';
import { useAuth } from '../../../../../lib/auth-context';
import { formatDate } from '../../../../../lib/format';
import { canCancel, type Journey, progressPercent, progressText, statusLabel, statusTone, taskAction } from '../../../../../lib/journeys';
import { canAll } from '../../../../../lib/permissions';

const dateTime = (iso: string) => new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

/**
 * Un parcours : la liste de ses tâches, avec le responsable (une étiquette), l'échéance, et pour chaque tâche cochée la date et l'auteur. La RH coche et décoche ; les autres
 * lisent. Une tâche en retard (non cochée, échéance dépassée) est signalée tant que le parcours est en cours. Aucun texte libre n'est enregistré.
 */
export default function JourneySheetPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const canManage = canAll(profile, 'hr.journey.manage');
  const [journey, setJourney] = useState<Journey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyTask, setBusyTask] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(
    () => api<Journey>(`/hr/journeys/${encodeURIComponent(id)}`).then((j) => { setJourney(j); setError(null); }).catch((e) => setError(e instanceof ApiError ? e.message : 'Chargement impossible')),
    [id],
  );
  useEffect(() => { void load(); }, [load]);

  async function toggle(taskId: string, action: 'check' | 'reopen') {
    if (!journey) return;
    setBusyTask(taskId);
    setActionError(null);
    setNotice(null);
    try {
      setJourney(await api<Journey>(`/hr/journeys/${journey.id}/tasks/${taskId}/${action === 'check' ? 'complete' : 'reopen'}`, { method: 'POST', body: { version: journey.version } }));
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Action impossible');
      await load();
    } finally {
      setBusyTask(null);
    }
  }

  if (error) {
    return (
      <>
        <PageHeading title="Parcours introuvable">Parcours introuvable</PageHeading>
        <p role="alert" className="error">{error}</p>
        <p><Link href="/hr/journeys">← Tous les parcours</Link></p>
      </>
    );
  }
  if (!journey) return <p role="status">Chargement du parcours…</p>;

  const status = statusTone(journey.status);
  const percent = progressPercent(journey.progress);
  return (
    <>
      <PageHeader
        stacked
        eyebrow="Ressources humaines · Parcours"
        title={`${journey.kindLabel} : ${journey.employeeName}`}
        description="Cochez les tâches au fur et à mesure : la date et l’auteur de chaque coche sont conservés. Une tâche cochée par erreur se décoche."
        actions={canCancel(journey, canManage) && <button type="button" className="secondary" onClick={() => setCancelling(true)}>Annuler le parcours</button>}
      />
      <p className="m-0 mb-4 text-[length:var(--text-sm)]"><Link href="/hr/journeys">← Tous les parcours</Link></p>
      {notice && <p role="status" className="mb-4 rounded-panel bg-ok-bg px-4 py-2 text-ok">{notice}</p>}
      {actionError && <p role="alert" className="error">{actionError}</p>}
      <Card className="mb-8">
        <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-6 p-5">
          <div><dt className="text-xs font-semibold text-ink-2">Employé</dt><dd className="m-0 mt-1"><EntityLink kind="employee" id={journey.employeeId} label={journey.employeeName}>{journey.employeeName}</EntityLink></dd></div>
          <div><dt className="text-xs font-semibold text-ink-2">État</dt><dd className="m-0 mt-1"><Badge tone={status}>{statusLabel(journey.status)}</Badge></dd></div>
          <div><dt className="text-xs font-semibold text-ink-2">Date de référence</dt><dd className="m-0 mt-1">{formatDate(`${journey.referenceDate}T00:00:00Z`)}</dd></div>
          <div>
            <dt className="text-xs font-semibold text-ink-2">Avancement</dt>
            <dd className="m-0 mt-1">
              {progressText(journey.progress)}
              <span role="progressbar" aria-label="Avancement du parcours" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="mt-1 block h-2 w-full overflow-hidden rounded-full bg-surface-2">
                <span className="block h-full bg-brand-strong" style={{ width: `${percent}%` }} />
              </span>
            </dd>
          </div>
          {journey.overdueCount > 0 && <div><dt className="text-xs font-semibold text-ink-2">Retards</dt><dd className="m-0 mt-1"><Badge tone="bad">{journey.overdueCount} en retard</Badge></dd></div>}
          {journey.cancelledAt && <div><dt className="text-xs font-semibold text-ink-2">Annulé le</dt><dd className="m-0 mt-1">{dateTime(journey.cancelledAt)}</dd></div>}
          {journey.completedAt && <div><dt className="text-xs font-semibold text-ink-2">Terminé le</dt><dd className="m-0 mt-1">{dateTime(journey.completedAt)}</dd></div>}
        </dl>
      </Card>

      <h2 className="mt-2">Tâches</h2>
      <Card className="mb-8">
        <ul className="m-0 list-none p-0">
          {journey.tasks.map((task) => {
            const action = taskAction(journey, task, canManage);
            const inputId = `task-${task.id}`;
            return (
              <li key={task.id} className="flex flex-wrap items-start gap-x-4 gap-y-1 border-b border-line px-5 py-3 last:border-0">
                <input
                  id={inputId}
                  type="checkbox"
                  checked={task.done}
                  disabled={action === null || busyTask === task.id}
                  onChange={() => action && void toggle(task.id, action)}
                  style={{ width: 'auto', margin: '.3rem 0 0' }}
                />
                <div className="min-w-0 flex-1">
                  <label htmlFor={inputId} className={`m-0 font-semibold ${task.done ? 'text-ink-2 line-through' : ''}`}>{task.title}</label>
                  <p className="m-0 text-[length:var(--text-sm)] text-ink-2">
                    {task.ownerLabel} · échéance le {formatDate(`${task.dueOn}T00:00:00Z`)}
                    {task.done && task.doneAt && <> · fait le {dateTime(task.doneAt)}{task.doneByName ? ` par ${task.doneByName}` : ''}</>}
                  </p>
                </div>
                {task.overdue && <Badge tone="bad">En retard</Badge>}
              </li>
            );
          })}
        </ul>
      </Card>
      {!canManage && <p className="text-ink-2">Seule la RH coche les tâches.</p>}
      {cancelling && <CancelJourneyDialog journey={journey} onClose={() => setCancelling(false)} onDone={async () => { setCancelling(false); setNotice('Le parcours est annulé.'); await load(); }} />}
    </>
  );
}
