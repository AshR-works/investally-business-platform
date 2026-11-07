'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import type { CourseModule, Room, Trainer, Training } from '../../lib/catalogue';
import {
  dateText, EMPTY_PLAN_FORM, type EditForm, editBody, endDateFor, formFromSession, hasStarted, isIsoDate, isWorkingDay, planBody, type PlanForm, type PostponeForm, type Session,
  todayIso, validateCancel, validateEdit, validatePlan, validatePostpone,
} from '../../lib/sessions';
import type { Page } from '../../lib/types';
import { FormField, fieldProps } from '../form-field';
import { Modal } from '../modal';
import { FormDialog } from './catalogue-dialogs';

/** Ce que la page des sessions peut ouvrir. */
export type SessionDialogState =
  | { kind: 'plan' }
  | { kind: 'edit'; session: Session }
  | { kind: 'open'; session: Session }
  | { kind: 'postpone'; session: Session }
  | { kind: 'cancel'; session: Session };

interface RhythmOption { code: string; label: string; weeks: number; open: boolean; totalHours: number }

const PREFIX = 'catalogue';
const KIND_LABEL = { WORKSTATIONS: 'avec postes', CLASSROOM: 'salle de cours' } as const;

/** Toutes les fenêtres des sessions, rendues UNE fois par la page hôte, hors des tableaux. */
export function SessionDialogs({ dialog, onClose, onDone }: { dialog: SessionDialogState | null; onClose: () => void; onDone: () => Promise<void> }) {
  if (!dialog) return null;
  switch (dialog.kind) {
    case 'plan': return <PlanDialog onClose={onClose} onDone={onDone} />;
    case 'edit': return <EditDialog session={dialog.session} onClose={onClose} onDone={onDone} />;
    case 'open': return <OpenDialog session={dialog.session} onClose={onClose} onDone={onDone} />;
    case 'postpone': return <PostponeDialog session={dialog.session} onClose={onClose} onDone={onDone} />;
    case 'cancel': return <CancelDialog session={dialog.session} onClose={onClose} onDone={onDone} />;
  }
}

interface References { trainings: Training[]; modules: CourseModule[]; rooms: Room[]; trainers: Trainer[]; rhythms: RhythmOption[] }

/** Les listes de choix (certificats, modules, salles, formateurs actifs, rythmes) : une lecture à l'ouverture de la fenêtre. */
function useReferences(): { refs: References | null; error: string | null } {
  const [refs, setRefs] = useState<References | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    Promise.all([
      api<Page<Training>>('/trainings?status=ACTIVE&pageSize=100'),
      api<Page<CourseModule>>('/modules?pageSize=100'),
      api<Page<Room>>('/rooms?status=ACTIVE&pageSize=100'),
      api<Page<Trainer>>('/trainers?status=ACTIVE&pageSize=100'),
      api<RhythmOption[]>('/rhythms'),
    ])
      .then(([trainings, modules, rooms, trainers, rhythms]) => {
        if (live) setRefs({ trainings: trainings.items, modules: modules.items, rooms: rooms.items, trainers: trainers.items, rhythms });
      })
      .catch((e) => live && setError(e instanceof ApiError ? e.message : 'Chargement des listes impossible'));
    return () => { live = false; };
  }, []);
  return { refs, error };
}

function Loading({ title, onClose, error }: { title: string; onClose: () => void; error: string | null }) {
  return (
    <Modal title={title} onClose={onClose}>
      {error ? <p role="alert" className="error">{error}</p> : <p aria-live="polite">Chargement…</p>}
      <div className="row end"><button type="button" className="secondary" onClick={onClose}>Fermer</button></div>
    </Modal>
  );
}

function PlanDialog({ onClose, onDone }: { onClose: () => void; onDone: () => Promise<void> }) {
  const { refs, error } = useReferences();
  const [form, setForm] = useState<PlanForm>(EMPTY_PLAN_FORM);
  if (!refs) return <Loading title="Nouvelle session" onClose={onClose} error={error} />;
  const set = (key: keyof PlanForm, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const training = refs.trainings.find((t) => t.id === form.trainingId);
  const needsWorkstations = training ? training.modules.some((m) => refs.modules.find((x) => x.id === m.id)?.requiresWorkstations) : null;
  const rhythm = refs.rhythms.find((r) => r.code === form.rhythm);
  const room = refs.rooms.find((r) => r.id === form.roomId);
  const errors = validatePlan(form, { rooms: refs.rooms, needsWorkstations, today: todayIso() });
  const validStart = isIsoDate(form.startDate) && isWorkingDay(form.startDate);
  return (
    <FormDialog
      title="Nouvelle session"
      intro="Une session est un certificat donné dans une salle par un formateur, selon un rythme. Vous choisissez la date de début ; la date de fin se calcule d’après le rythme."
      errors={errors}
      onClose={onClose}
      submit={async () => {
        await api('/sessions', { method: 'POST', body: planBody(form) });
        await onDone();
      }}
    >
      {({ submitted }) => {
        const shown = (name: keyof PlanForm) => (submitted ? errors[name] : undefined);
        return (
          <fieldset>
            <legend>La session</legend>
            <FormField prefix={PREFIX} name="trainingId" label="Certificat" error={shown('trainingId')}>
              <select {...fieldProps(PREFIX, 'trainingId', shown('trainingId'))} value={form.trainingId} onChange={(e) => set('trainingId', e.target.value)} required aria-required="true">
                <option value="">Choisir…</option>
                {refs.trainings.map((t) => <option key={t.id} value={t.id}>{t.title} ({t.programName})</option>)}
              </select>
            </FormField>
            <FormField prefix={PREFIX} name="rhythm" label="Rythme" error={shown('rhythm')}>
              <select {...fieldProps(PREFIX, 'rhythm', shown('rhythm'))} value={form.rhythm} onChange={(e) => set('rhythm', e.target.value)} required aria-required="true">
                {refs.rhythms.filter((r) => r.open).map((r) => <option key={r.code} value={r.code}>{r.label} : {r.weeks} semaine{r.weeks > 1 ? 's' : ''}, {r.totalHours} h</option>)}
              </select>
            </FormField>
            <FormField prefix={PREFIX} name="startDate" label="Date de début (un jour de cours)" error={shown('startDate')}>
              <input {...fieldProps(PREFIX, 'startDate', shown('startDate'))} type="date" value={form.startDate} min={todayIso()} onChange={(e) => set('startDate', e.target.value)} required aria-required="true" />
            </FormField>
            {rhythm && validStart && <p className="m-0 mb-3 text-ink-2" aria-live="polite">Dernier jour de cours : <strong>{dateText(endDateFor(form.startDate, rhythm.weeks))}</strong></p>}
            <FormField prefix={PREFIX} name="roomId" label="Salle" error={shown('roomId')}>
              <select {...fieldProps(PREFIX, 'roomId', shown('roomId'))} value={form.roomId} onChange={(e) => set('roomId', e.target.value)} required aria-required="true">
                <option value="">Choisir…</option>
                {refs.rooms.map((r) => <option key={r.id} value={r.id}>{r.name} ({KIND_LABEL[r.kind]}, {r.usableSeats} places utiles)</option>)}
              </select>
            </FormField>
            {needsWorkstations === true && <p className="m-0 mb-3 text-ink-2">Ce certificat contient un module pratique : il se donne dans une salle avec postes de travail.</p>}
            <FormField prefix={PREFIX} name="trainerId" label="Formateur" error={shown('trainerId')}>
              <select {...fieldProps(PREFIX, 'trainerId', shown('trainerId'))} value={form.trainerId} onChange={(e) => set('trainerId', e.target.value)} required aria-required="true">
                <option value="">Choisir…</option>
                {refs.trainers.map((t) => <option key={t.id} value={t.id}>{t.firstName} {t.lastName} ({t.internal ? 'interne' : 'externe'})</option>)}
              </select>
            </FormField>
            <FormField prefix={PREFIX} name="capacity" label={room ? `Capacité (au plus ${room.usableSeats})` : 'Capacité'} error={shown('capacity')}>
              <input {...fieldProps(PREFIX, 'capacity', shown('capacity'))} type="number" inputMode="numeric" min={1} max={room?.usableSeats ?? 1000} value={form.capacity} onChange={(e) => set('capacity', e.target.value)} required aria-required="true" />
            </FormField>
            <p className="m-0 mb-3 text-ink-2">La salle et le formateur doivent être libres pendant toute la session : le serveur refuse un chevauchement et indique la session en conflit.</p>
          </fieldset>
        );
      }}
    </FormDialog>
  );
}

function EditDialog({ session, onClose, onDone }: { session: Session; onClose: () => void; onDone: () => Promise<void> }) {
  const { refs, error } = useReferences();
  const [form, setForm] = useState<EditForm>(() => formFromSession(session));
  if (!refs) return <Loading title="Modifier la session" onClose={onClose} error={error} />;
  const started = hasStarted(session, todayIso());
  const set = (key: keyof EditForm, value: string) => setForm((f) => ({ ...f, [key]: value }));
  // La salle et le formateur actuels restent proposés même s'ils ont été désactivés depuis.
  const rooms = refs.rooms.some((r) => r.id === session.roomId) ? refs.rooms : [{ id: session.roomId, name: session.roomName, kind: session.roomKind, usableSeats: session.roomUsableSeats } as Room, ...refs.rooms];
  const trainers = refs.trainers.some((t) => t.id === session.trainerId) ? refs.trainers : [{ id: session.trainerId, firstName: session.trainerName, lastName: '', internal: false } as Trainer, ...refs.trainers];
  const errors = validateEdit(form, rooms, session.needsWorkstations);
  return (
    <FormDialog
      title="Modifier la session"
      intro={started ? 'La session a commencé : la salle et le formateur ne changent plus ; seule la capacité peut être ajustée.' : 'Vous pouvez changer la salle, le formateur ou la capacité. Pour changer les dates, utilisez « Reporter ».'}
      errors={errors}
      onClose={onClose}
      submit={async () => {
        const body = editBody(form, session);
        if (Object.keys(body).length > 1) await api(`/sessions/${session.id}`, { method: 'PUT', body });
        await onDone();
      }}
    >
      {({ submitted }) => {
        const shown = (name: keyof EditForm) => (submitted ? errors[name] : undefined);
        return (
          <fieldset>
            <legend>{session.trainingTitle}</legend>
            <p className="m-0 mb-3 text-ink-2">{dateText(session.startDate)} → {dateText(session.endDate)}</p>
            <FormField prefix={PREFIX} name="roomId" label="Salle" error={shown('roomId')}>
              <select {...fieldProps(PREFIX, 'roomId', shown('roomId'))} value={form.roomId} disabled={started} onChange={(e) => set('roomId', e.target.value)}>
                {rooms.map((r) => <option key={r.id} value={r.id}>{r.name} ({KIND_LABEL[r.kind]}, {r.usableSeats} places utiles)</option>)}
              </select>
            </FormField>
            <FormField prefix={PREFIX} name="trainerId" label="Formateur" error={shown('trainerId')}>
              <select {...fieldProps(PREFIX, 'trainerId', shown('trainerId'))} value={form.trainerId} disabled={started} onChange={(e) => set('trainerId', e.target.value)}>
                {trainers.map((t) => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
              </select>
            </FormField>
            <FormField prefix={PREFIX} name="capacity" label="Capacité" error={shown('capacity')}>
              <input {...fieldProps(PREFIX, 'capacity', shown('capacity'))} type="number" inputMode="numeric" min={1} max={1000} value={form.capacity} onChange={(e) => set('capacity', e.target.value)} required aria-required="true" />
            </FormField>
          </fieldset>
        );
      }}
    </FormDialog>
  );
}

function PostponeDialog({ session, onClose, onDone }: { session: Session; onClose: () => void; onDone: () => Promise<void> }) {
  const [form, setForm] = useState<PostponeForm>({ startDate: '', reason: '' });
  const set = (key: keyof PostponeForm, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const errors = validatePostpone(form, session, todayIso());
  const validStart = isIsoDate(form.startDate) && isWorkingDay(form.startDate);
  return (
    <FormDialog
      title="Reporter la session"
      intro="La session garde ses inscrits ; seule la date de début change, et la fin suit le rythme. Le motif est obligatoire et conservé."
      errors={errors}
      onClose={onClose}
      submit={async () => {
        await api(`/sessions/${session.id}/postpone`, { method: 'POST', body: { version: session.version, startDate: form.startDate.trim(), reason: form.reason.trim() } });
        await onDone();
      }}
    >
      {({ submitted }) => {
        const shown = (name: keyof PostponeForm) => (submitted ? errors[name] : undefined);
        return (
          <fieldset>
            <legend>{session.trainingTitle}</legend>
            <p className="m-0 mb-3 text-ink-2">Actuellement : {dateText(session.startDate)} → {dateText(session.endDate)}</p>
            <FormField prefix={PREFIX} name="startDate" label="Nouvelle date de début (un jour de cours)" error={shown('startDate')}>
              <input {...fieldProps(PREFIX, 'startDate', shown('startDate'))} type="date" value={form.startDate} min={todayIso()} onChange={(e) => set('startDate', e.target.value)} required aria-required="true" />
            </FormField>
            {validStart && <p className="m-0 mb-3 text-ink-2" aria-live="polite">Nouveau dernier jour de cours : <strong>{dateText(endDateFor(form.startDate, session.rhythm.weeks))}</strong></p>}
            <FormField prefix={PREFIX} name="reason" label="Motif du report" error={shown('reason')}>
              <textarea {...fieldProps(PREFIX, 'reason', shown('reason'))} value={form.reason} onChange={(e) => set('reason', e.target.value)} rows={3} maxLength={500} required aria-required="true" />
            </FormField>
          </fieldset>
        );
      }}
    </FormDialog>
  );
}

function CancelDialog({ session, onClose, onDone }: { session: Session; onClose: () => void; onDone: () => Promise<void> }) {
  const [reason, setReason] = useState('');
  const errors = { reason: validateCancel(reason) } as Partial<Record<'reason', string>>;
  if (!errors.reason) delete errors.reason;
  return (
    <FormDialog
      title="Annuler la session"
      intro="L’annulation est définitive pour cette session (une nouvelle session peut être planifiée). Les inscriptions ne sont pas supprimées. Le motif est obligatoire et conservé."
      errors={errors}
      onClose={onClose}
      submit={async () => {
        await api(`/sessions/${session.id}/cancel`, { method: 'POST', body: { version: session.version, reason: reason.trim() } });
        await onDone();
      }}
    >
      {({ submitted }) => (
        <fieldset>
          <legend>{session.trainingTitle}</legend>
          <p className="m-0 mb-3 text-ink-2">{dateText(session.startDate)} → {dateText(session.endDate)}, {session.roomName}</p>
          <FormField prefix={PREFIX} name="reason" label="Motif de l’annulation" error={submitted ? errors.reason : undefined}>
            <textarea {...fieldProps(PREFIX, 'reason', submitted ? errors.reason : undefined)} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} required aria-required="true" />
          </FormField>
        </fieldset>
      )}
    </FormDialog>
  );
}

function OpenDialog({ session, onClose, onDone }: { session: Session; onClose: () => void; onDone: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await api(`/sessions/${session.id}/open`, { method: 'POST', body: { version: session.version } });
      await onDone();
    } catch (e) {
      setBusy(false);
      setError(e instanceof ApiError ? e.message : 'Action impossible');
    }
  }
  return (
    <Modal title="Ouvrir aux inscriptions" onClose={onClose}>
      <p className="m-0 mb-3">
        La session « {session.trainingTitle} » ({dateText(session.startDate)} → {dateText(session.endDate)}, {session.roomName}) deviendra visible des chargés de compte, avec ses {session.capacity} places.
      </p>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="row end">
        <button type="button" className="secondary" onClick={onClose}>Retour</button>
        <button type="button" disabled={busy} onClick={() => void confirm()}>Ouvrir aux inscriptions</button>
      </div>
    </Modal>
  );
}
