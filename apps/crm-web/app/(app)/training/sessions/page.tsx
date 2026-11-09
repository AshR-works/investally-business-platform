'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '../../../../components/data/badge';
import { Card } from '../../../../components/data/card';
import { DataTable, type Column } from '../../../../components/data/data-table';
import { PageHeader } from '../../../../components/data/page-header';
import { Pagination } from '../../../../components/data/pagination';
import { RowAction, RowActions } from '../../../../components/data/row-actions';
import { QuickFilters, Toolbar } from '../../../../components/data/toolbar';
import { PageHeading } from '../../../../components/page-heading';
import { SessionDialogs, type SessionDialogState } from '../../../../components/training/session-dialogs';
import { api, ApiError } from '../../../../lib/api';
import { useAuth } from '../../../../lib/auth-context';
import type { Room, Trainer } from '../../../../lib/catalogue';
import { can } from '../../../../lib/permissions';
import {
  capacityText, dateText, isIsoDate, SESSION_PERMISSIONS, SESSION_PHASE_LABEL, SESSION_STATUS, SESSION_STATUS_OPTIONS, type Session, sessionActions, todayIso,
} from '../../../../lib/sessions';
import type { Page } from '../../../../lib/types';

const PAGE_SIZE = 20;

/**
 * Sessions de formation (S5.2a). Lecture : tous les rôles qui détiennent `training.session.read` (le formateur ne voit que ses sessions) ;
 * écriture : Responsable Investudy (planifier, modifier, ouvrir, reporter, annuler). Le serveur re-contrôle chaque requête : ces droits ne
 * servent ici qu'à n'afficher que les actions possibles. Une session ne se supprime jamais : elle s'annule avec un motif.
 */
export default function SessionsPage() {
  const { profile } = useAuth();
  const canRead = can(profile, SESSION_PERMISSIONS.read);
  const canCreate = can(profile, SESSION_PERMISSIONS.create);
  const rights = { update: can(profile, SESSION_PERMISSIONS.update), cancel: can(profile, SESSION_PERMISSIONS.cancel) };
  const [status, setStatus] = useState('');
  const [roomId, setRoomId] = useState('');
  const [trainerId, setTrainerId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [data, setData] = useState<Page<Session>>({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<SessionDialogState | null>(null);

  const periodProblem = from && to && isIsoDate(from) && isIsoDate(to) && from > to ? 'La période est à l’envers : la fin précède le début.' : null;

  const load = useCallback(async () => {
    if (!canRead || periodProblem) {
      setLoading(false);
      return;
    }
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (status) params.set('status', status);
      if (roomId) params.set('roomId', roomId);
      if (trainerId) params.set('trainerId', trainerId);
      if (from && isIsoDate(from)) params.set('from', from);
      if (to && isIsoDate(to)) params.set('to', to);
      setData(await api<Page<Session>>(`/sessions?${params}`));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [canRead, periodProblem, page, status, roomId, trainerId, from, to]);
  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);
  useEffect(() => {
    if (!canRead) return;
    if (can(profile, 'training.room.read')) api<Page<Room>>('/rooms?pageSize=100').then((r) => setRooms(r.items)).catch(() => setRooms([]));
    if (can(profile, 'training.trainer.read')) api<Page<Trainer>>('/trainers?pageSize=100').then((r) => setTrainers(r.items)).catch(() => setTrainers([]));
  }, [canRead, profile]);

  if (!canRead) {
    return (
      <>
        <PageHeading>Sessions de formation</PageHeading>
        <p>Votre profil n&apos;a pas accès aux sessions de formation.</p>
      </>
    );
  }

  const today = todayIso();
  const reset = () => setPage(1);
  const actionsFor = (s: Session) => {
    const allowed = sessionActions(s, rights, today);
    const name = `${s.trainingTitle}, ${dateText(s.startDate)}`;
    if (!allowed.edit && !allowed.open && !allowed.postpone && !allowed.cancel) return <span className="sr-only">Aucune action</span>;
    return (
      <RowActions label={`Actions pour la session ${name}`}>
        {allowed.edit && <RowAction onClick={() => setDialog({ kind: 'edit', session: s })}>Modifier</RowAction>}
        {allowed.open && <RowAction onClick={() => setDialog({ kind: 'open', session: s })}>Ouvrir aux inscriptions</RowAction>}
        {allowed.postpone && <RowAction onClick={() => setDialog({ kind: 'postpone', session: s })}>Reporter</RowAction>}
        {allowed.cancel && <RowAction danger onClick={() => setDialog({ kind: 'cancel', session: s })}>Annuler la session</RowAction>}
      </RowActions>
    );
  };

  const columns: Column<Session>[] = [
    { id: 'training', weight: 3.2, header: 'Certificat', cell: (s) => <><Link href={`/training/sessions/${s.id}`}><strong>{s.trainingTitle}</strong></Link><br /><span className="text-ink-2">{s.rhythm.label}</span></> },
    { id: 'period', weight: 3.4, header: 'Dates', cell: (s) => <>{dateText(s.startDate)}<br />→ {dateText(s.endDate)}</> },
    { id: 'room', weight: 2.4, header: 'Salle', cell: (s) => s.roomName },
    { id: 'trainer', weight: 2.2, header: 'Formateur', cell: (s) => s.trainerName },
    { id: 'capacity', weight: 2.4, header: 'Capacité', cell: (s) => capacityText(s) },
    { id: 'enrolled', weight: 1.6, header: 'Inscrits', align: 'right', cell: (s) => `${s.enrolled} / ${s.capacity}` },
    {
      id: 'status', weight: 2.8, header: 'État',
      cell: (s) => (
        <>
          <Badge tone={SESSION_STATUS[s.status].tone}>{SESSION_STATUS[s.status].label}</Badge>
          {s.status !== 'CANCELLED' && <><br /><span className="text-ink-2">{SESSION_PHASE_LABEL[s.phase]}</span></>}
          {s.cancelReason && <><br /><span className="text-ink-2 line-clamp-2">Motif : {s.cancelReason}</span></>}
        </>
      ),
    },
    { id: 'actions', weight: 1, header: 'Actions', srOnlyHeader: true, align: 'right', cell: actionsFor },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Investudy"
        title="Sessions de formation"
        description="Une session est un certificat donné dans une salle par un formateur, selon un rythme (jour ou soir). La salle et le formateur doivent être libres pendant toute la session. Une session ne se supprime pas : elle s’annule avec un motif."
        actions={canCreate ? <button type="button" onClick={() => setDialog({ kind: 'plan' })}>Nouvelle session</button> : undefined}
      />
      <p className="m-0 mb-3"><Link href="/training">← Catalogue de formation</Link>{can(profile, 'training.enrollment.read') && <> · <Link href="/training/enrollments">Inscriptions</Link></>}{can(profile, 'training.learner.read') && <> · <Link href="/training/learners">Apprenants</Link></>}</p>
      {loadError && <p role="alert" className="error">{loadError}</p>}
      <Card>
        <Toolbar>
          <p className="m-0 text-[length:var(--text-sm)] font-semibold" aria-live="polite">{loading ? 'Chargement…' : `${data.total} session${data.total > 1 ? 's' : ''}`}</p>
          <QuickFilters label="État de la session" value={status} options={[...SESSION_STATUS_OPTIONS]} onChange={(v) => { reset(); setStatus(v); }} />
        </Toolbar>
        <Toolbar>
          {rooms.length > 0 && (
            <label className="m-0 flex items-center gap-2 text-[length:var(--text-sm)] font-normal">
              Salle
              <select value={roomId} onChange={(e) => { reset(); setRoomId(e.target.value); }} style={{ width: 'auto', marginTop: 0 }}>
                <option value="">Toutes</option>
                {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </label>
          )}
          {trainers.length > 0 && (
            <label className="m-0 flex items-center gap-2 text-[length:var(--text-sm)] font-normal">
              Formateur
              <select value={trainerId} onChange={(e) => { reset(); setTrainerId(e.target.value); }} style={{ width: 'auto', marginTop: 0 }}>
                <option value="">Tous</option>
                {trainers.map((t) => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
              </select>
            </label>
          )}
          <label className="m-0 flex items-center gap-2 text-[length:var(--text-sm)] font-normal">
            Du
            <input type="date" value={from} onChange={(e) => { reset(); setFrom(e.target.value); }} style={{ width: 'auto', marginTop: 0 }} />
          </label>
          <label className="m-0 flex items-center gap-2 text-[length:var(--text-sm)] font-normal">
            Au
            <input type="date" value={to} onChange={(e) => { reset(); setTo(e.target.value); }} style={{ width: 'auto', marginTop: 0 }} />
          </label>
        </Toolbar>
        {periodProblem && <p role="alert" className="error">{periodProblem}</p>}
        <DataTable
          caption="Sessions de formation"
          columns={columns}
          rows={data.items}
          rowId={(s) => s.id}
          rowLabel={(s) => `session ${s.trainingTitle} du ${dateText(s.startDate)}`}
          busy={loading}
          empty={status || roomId || trainerId || from || to ? 'Aucune session ne correspond à ces critères.' : 'Aucune session pour le moment.'}
        />
        <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPage={setPage} />
      </Card>
      <SessionDialogs dialog={dialog} onClose={() => setDialog(null)} onDone={async () => { setDialog(null); await load(); }} />
    </>
  );
}
