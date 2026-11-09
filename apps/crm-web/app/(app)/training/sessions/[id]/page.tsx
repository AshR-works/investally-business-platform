'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '../../../../../components/data/badge';
import { Card } from '../../../../../components/data/card';
import { PageHeader } from '../../../../../components/data/page-header';
import { PageHeading } from '../../../../../components/page-heading';
import { EnrollmentDialogs, type EnrollmentDialogState } from '../../../../../components/training/enrollment-dialogs';
import { EnrollmentsTable } from '../../../../../components/training/enrollments-table';
import { api, ApiError } from '../../../../../lib/api';
import { useAuth } from '../../../../../lib/auth-context';
import type { Training } from '../../../../../lib/catalogue';
import { ENROLLMENT_PERMISSIONS, isFull, seatsFill } from '../../../../../lib/enrollments';
import { can } from '../../../../../lib/permissions';
import { dateText, periodText, SESSION_PHASE_LABEL, SESSION_STATUS, type Session } from '../../../../../lib/sessions';
import { ROOM_KIND_LABEL } from '../../../../../lib/catalogue';

/**
 * Fiche d'une session (S5.2b) : le certificat et ses modules, les dates, la salle, le formateur, la jauge de places et la liste des inscrits
 * avec leurs actions. Le formateur n'ouvre que ses propres sessions (le serveur répond « introuvable » sinon).
 */
export default function SessionSheetPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const [session, setSession] = useState<Session | null>(null);
  const [training, setTraining] = useState<Training | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<EnrollmentDialogState | null>(null);
  const [refresh, setRefresh] = useState(0);

  const load = useCallback(async () => {
    try {
      setSession(await api<Session>(`/sessions/${id}`));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Chargement impossible');
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!session || !can(profile, 'training.training.read')) return;
    api<Training>(`/trainings/${session.trainingId}`).then(setTraining).catch(() => setTraining(null));
  }, [session, profile]);

  if (error || !session) {
    return (
      <>
        <PageHeading>Session de formation</PageHeading>
        {error ? <p role="alert" className="error">{error}</p> : <p aria-live="polite">Chargement…</p>}
        <p><Link href="/training/sessions">← Sessions de formation</Link></p>
      </>
    );
  }

  const canEnroll = can(profile, ENROLLMENT_PERMISSIONS.enroll) && session.status === 'OPEN';
  const full = isFull(session.enrolled, session.capacity);
  return (
    <>
      <PageHeader
        eyebrow="Session de formation"
        title={session.trainingTitle}
        description={`${session.programName} · ${periodText(session)} · ${session.rhythm.label}`}
        actions={canEnroll ? <button type="button" disabled={full} onClick={() => setDialog({ kind: 'enroll', session })}>Inscrire un apprenant</button> : undefined}
      />
      <p className="m-0 mb-3"><Link href="/training/sessions">← Sessions de formation</Link></p>
      <Card>
        <dl className="grid gap-x-6 gap-y-2 p-4 sm:grid-cols-2 m-0">
          <div><dt className="text-ink-2">État</dt><dd className="m-0"><Badge tone={SESSION_STATUS[session.status].tone}>{SESSION_STATUS[session.status].label}</Badge>{session.status !== 'CANCELLED' && <> · {SESSION_PHASE_LABEL[session.phase]}</>}</dd></div>
          <div><dt className="text-ink-2">Dates</dt><dd className="m-0">{dateText(session.startDate)} → {dateText(session.endDate)} ({session.rhythm.totalHours} h)</dd></div>
          <div><dt className="text-ink-2">Salle</dt><dd className="m-0">{session.roomName} ({ROOM_KIND_LABEL[session.roomKind].toLowerCase()})</dd></div>
          <div><dt className="text-ink-2">Formateur</dt><dd className="m-0">{session.trainerName}</dd></div>
          <div>
            <dt className="text-ink-2">Places</dt>
            <dd className="m-0">
              <meter min={0} max={session.capacity} value={Math.min(session.enrolled, session.capacity)} aria-label={`Places occupées : ${seatsFill(session.enrolled, session.capacity)}`} />{' '}
              <strong>{seatsFill(session.enrolled, session.capacity)}</strong> inscrits{full ? ' : session complète' : ''}
            </dd>
          </div>
          {session.cancelReason && <div><dt className="text-ink-2">Motif d’annulation</dt><dd className="m-0">{session.cancelReason}</dd></div>}
          {training && (
            <div className="sm:col-span-2">
              <dt className="text-ink-2">Modules du certificat</dt>
              <dd className="m-0">
                <ol className="m-0 pl-5">{training.modules.map((m) => <li key={m.id}>{m.title}</li>)}</ol>
              </dd>
            </div>
          )}
        </dl>
      </Card>
      {session.status === 'PLANNED' && <p className="mt-3 text-ink-2">La session n’est pas encore ouverte aux inscriptions : le Responsable Investudy doit l’ouvrir d’abord.</p>}
      {session.status === 'CANCELLED' && <p className="mt-3 text-ink-2">La session est annulée : ses inscriptions sont « à replacer » sur une autre session.</p>}
      <h2 className="mt-6">Inscrits</h2>
      <EnrollmentsTable caption={`Inscriptions à la session ${session.trainingTitle} du ${dateText(session.startDate)}`} sessionId={session.id} refreshKey={refresh} onChanged={() => { void load(); setRefresh((n) => n + 1); }} />
      <EnrollmentDialogs dialog={dialog} onClose={() => setDialog(null)} onDone={async () => { setDialog(null); await load(); setRefresh((n) => n + 1); }} />
    </>
  );
}
