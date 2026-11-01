'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import {
  type AgendaRights, APPOINTMENT_ACTION_LABEL, APPOINTMENT_STATUS, type AppointmentField, type AppointmentForm, appointmentActions, appointmentTypeLabel, buildAppointmentBody,
  EMPTY_APPOINTMENT_FORM, formFromAppointment, localDay, localTime, plannableTypes, timeRange, toInstant, validateAppointmentFields,
} from '../../lib/appointments';
import { validateClosingText } from '../../lib/followups';
import { statusStyle } from '../../lib/status';
import type { Appointment, Company, Contact, Offer, Page } from '../../lib/types';
import { Badge } from '../data/badge';
import { FormField, fieldProps } from '../form-field';
import { Modal } from '../modal';

const PREFIX = 'appointment';

/** Valeurs imposées à la planification (depuis une entreprise ou une offre) ; l'entreprise imposée n'est pas modifiable. */
export interface PlanDefaults {
  companyId?: string;
  companyName?: string;
  offerId?: string;
  offerReference?: string;
  type?: string;
  date?: string;
}

/** Fenêtre ouverte sur un rendez-vous, ou pour en planifier un. */
export type AppointmentDialogState =
  | { kind: 'plan'; defaults?: PlanDefaults }
  | { kind: 'detail'; appointment: Appointment }
  | { kind: 'edit'; appointment: Appointment }
  | { kind: 'postpone'; appointment: Appointment }
  | { kind: 'hold'; appointment: Appointment }
  | { kind: 'cancel'; appointment: Appointment };

const dateLong = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/**
 * Toutes les fenêtres du cycle d'un rendez-vous (fiche, planifier, modifier, reporter, tenir, annuler), rendues UNE fois par
 * l'écran hôte. Un enregistrement qui chevauche un autre rendez-vous de l'organisateur affiche l'avertissement avant de se fermer.
 */
export function AppointmentDialogs({ dialog, rights, onOpen, onClose, onDone }: {
  dialog: AppointmentDialogState | null;
  rights: AgendaRights;
  onOpen: (dialog: AppointmentDialogState) => void;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [warning, setWarning] = useState<Appointment | null>(null);
  if (warning) return <ConflictNotice appointment={warning} onClose={() => { setWarning(null); void onDone(); }} />;
  if (!dialog) return null;
  const finish = async (saved?: Appointment) => {
    if (saved?.conflicts?.length) setWarning(saved);
    else await onDone();
  };
  if (dialog.kind === 'detail') return <DetailDialog appointment={dialog.appointment} rights={rights} onOpen={onOpen} onClose={onClose} />;
  if (dialog.kind === 'plan') return <AppointmentFormDialog defaults={dialog.defaults} rights={rights} onClose={onClose} onDone={finish} />;
  if (dialog.kind === 'edit') return <AppointmentFormDialog appointment={dialog.appointment} rights={rights} onClose={onClose} onDone={finish} />;
  if (dialog.kind === 'postpone') return <PostponeDialog appointment={dialog.appointment} onClose={onClose} onDone={finish} />;
  return <ClosingDialog appointment={dialog.appointment} closing={dialog.kind} onClose={onClose} onDone={finish} />;
}

/** Avertissement de conflit d'horaire : le rendez-vous est enregistré, mais l'organisateur en a un autre sur le même créneau. */
function ConflictNotice({ appointment, onClose }: { appointment: Appointment; onClose: () => void }) {
  return (
    <Modal title="Rendez-vous enregistré" onClose={onClose}>
      <p role="alert" className="error">
        Attention : ce rendez-vous chevauche {appointment.conflicts!.length > 1 ? 'd’autres rendez-vous' : 'un autre rendez-vous'} de votre agenda.
      </p>
      <ul className="m-0 mb-3 pl-5">
        {appointment.conflicts!.map((c) => (
          <li key={c.id}>{appointmentTypeLabel(c.type)} · {c.companyName} · {dateLong(c.startsAt)}, {timeRange(c)}</li>
        ))}
      </ul>
      <p className="m-0 mb-3 text-ink-2">Le rendez-vous reste enregistré ; vous pouvez le reporter ou l’annuler depuis l’agenda.</p>
      <div className="row end"><button type="button" onClick={onClose}>Compris</button></div>
    </Modal>
  );
}

/** Fiche d'un rendez-vous : tous ses éléments, et les actions possibles selon son état et les droits. */
function DetailDialog({ appointment: a, rights, onOpen, onClose }: { appointment: Appointment; rights: AgendaRights; onOpen: (d: AppointmentDialogState) => void; onClose: () => void }) {
  const actions = appointmentActions(a, rights);
  const status = statusStyle(APPOINTMENT_STATUS, a.status);
  const rows: [string, string | null][] = [
    ['Entreprise', a.companyName],
    ['Contact', a.contactName],
    ['Offre', a.offerReference],
    ['Quand', `${dateLong(a.startsAt)}, ${timeRange(a)} (${a.durationMinutes} min)`],
    ['Lieu ou lien', a.location],
    ['Note', a.note],
    ['Reports', a.postponements > 0 ? `${a.postponements} (dernier motif : ${a.lastPostponeReason})` : null],
    [a.status === 'HELD' ? 'Compte rendu' : 'Motif d’annulation', a.outcomeNote],
  ];
  return (
    <Modal title={appointmentTypeLabel(a.type)} onClose={onClose}>
      <p className="m-0 mb-3 inline-flex flex-wrap items-center gap-2">
        <Badge tone={status.tone}>{status.label}</Badge>
        {a.reportDue && <Badge tone="warn">Compte rendu attendu</Badge>}
      </p>
      <dl className="m-0 mb-3 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
        {rows.filter(([, value]) => value).map(([label, value]) => (
          <div key={label} className="contents"><dt className="text-ink-2">{label}</dt><dd className="m-0">{value}</dd></div>
        ))}
      </dl>
      <div className="row end">
        <button type="button" className="secondary" onClick={onClose}>Fermer</button>
        {actions.map((action) => (
          <button key={action} type="button" className={action === 'cancel' ? 'danger' : 'secondary'} onClick={() => onOpen({ kind: action, appointment: a })}>{APPOINTMENT_ACTION_LABEL[action]}</button>
        ))}
      </div>
    </Modal>
  );
}

/** Planification (entreprise imposée ou choisie dans la portée) et modification d'un rendez-vous à venir. */
function AppointmentFormDialog({ appointment, defaults, rights, onClose, onDone }: {
  appointment?: Appointment;
  defaults?: PlanDefaults;
  rights: AgendaRights;
  onClose: () => void;
  onDone: (saved?: Appointment) => Promise<void>;
}) {
  const types = plannableTypes(rights);
  const [form, setForm] = useState<AppointmentForm>(() =>
    appointment
      ? formFromAppointment(appointment)
      : EMPTY_APPOINTMENT_FORM({ companyId: defaults?.companyId ?? '', offerId: defaults?.offerId ?? '', type: defaults?.type ?? types[0]?.value ?? 'FINANCE_DIRECTOR', ...(defaults?.date ? { date: defaults.date } : {}) }),
  );
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const editing = Boolean(appointment);
  const fixedCompany = editing || Boolean(defaults?.companyId);
  const context = { now: new Date(), editing };
  const errors = submitted ? validateAppointmentFields(form, context) : {};
  const props = (name: AppointmentField) => fieldProps(PREFIX, name, errors[name]);
  const set = <K extends keyof AppointmentForm>(key: K, value: AppointmentForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    if (fixedCompany) return;
    api<Page<Company>>('/companies?pageSize=100').then((r) => setCompanies(r.items)).catch(() => setError('La liste des entreprises est indisponible.'));
  }, [fixedCompany]);
  useEffect(() => {
    if (!form.companyId) {
      setContacts([]);
      setOffers([]);
      return;
    }
    api<Page<Contact>>(`/contacts?companyId=${form.companyId}&pageSize=100`).then((r) => setContacts(r.items)).catch(() => setContacts([]));
    if (!editing) api<Page<Offer>>(`/offers?companyId=${form.companyId}&pageSize=100`).then((r) => setOffers(r.items)).catch(() => setOffers([]));
  }, [form.companyId, editing]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitted(true);
    const first = Object.keys(validateAppointmentFields(form, { now: new Date(), editing }))[0];
    if (first) {
      setTimeout(() => document.getElementById(`${PREFIX}-${first}`)?.focus(), 0);
      return;
    }
    setBusy(true);
    try {
      const saved = appointment
        ? await api<Appointment>(`/appointments/${appointment.id}`, { method: 'PUT', body: buildAppointmentBody(form, { version: appointment.version }) })
        : await api<Appointment>('/appointments', { method: 'POST', body: buildAppointmentBody(form) });
      await onDone(saved);
    } catch (e) {
      setBusy(false);
      setError(e instanceof ApiError ? e.message : "Échec de l'enregistrement");
    }
  }

  const problems = Object.values(errors);
  const companyName = appointment?.companyName ?? defaults?.companyName ?? '';
  return (
    <Modal title={appointment ? `Modifier le rendez-vous · ${appointment.companyName}` : 'Nouveau rendez-vous'} onClose={onClose} size="wide">
      <form onSubmit={(e) => void submit(e)} noValidate>
        <fieldset>
          <legend>Le rendez-vous</legend>
          {editing ? (
            <p className="m-0 mb-3 text-ink-2">{appointmentTypeLabel(appointment!.type)} · {dateLong(appointment!.startsAt)}, {timeRange(appointment!)}. Pour changer l’heure, utilisez « Reporter ».</p>
          ) : (
            <FormField prefix={PREFIX} name="type" label="Type" error={errors.type}>
              <select {...props('type')} value={form.type} onChange={(e) => set('type', e.target.value)}>
                {types.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </FormField>
          )}
          {fixedCompany ? (
            <p className="m-0 mb-3 text-ink-2">Entreprise : <strong>{companyName}</strong>{defaults?.offerReference ? <> · offre <strong>{defaults.offerReference}</strong></> : null}</p>
          ) : (
            <FormField prefix={PREFIX} name="companyId" label="Entreprise" error={errors.companyId}>
              <select {...props('companyId')} value={form.companyId} onChange={(e) => setForm((f) => ({ ...f, companyId: e.target.value, contactId: '', offerId: '' }))} required aria-required="true">
                <option value="">— Choisir —</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </FormField>
          )}
          <FormField prefix={PREFIX} name="contactId" label="Contact (facultatif)" error={errors.contactId}>
            <select {...props('contactId')} value={form.contactId} onChange={(e) => set('contactId', e.target.value)} disabled={!form.companyId}>
              <option value="">— Aucun —</option>
              {contacts.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
            </select>
          </FormField>
          {!editing && !defaults?.offerId && (
            <FormField prefix={PREFIX} name="offerId" label="Offre liée (facultatif)" error={errors.offerId}>
              <select {...props('offerId')} value={form.offerId} onChange={(e) => set('offerId', e.target.value)} disabled={!form.companyId}>
                <option value="">— Aucune —</option>
                {offers.map((o) => <option key={o.id} value={o.id}>{o.reference} · {o.subject}</option>)}
              </select>
            </FormField>
          )}
          {!editing && (
            <>
              <FormField prefix={PREFIX} name="date" label="Date" error={errors.date}>
                <input {...props('date')} type="date" value={form.date} min={localDay(new Date())} onChange={(e) => set('date', e.target.value)} required aria-required="true" />
              </FormField>
              <FormField prefix={PREFIX} name="time" label="Heure de début" error={errors.time}>
                <input {...props('time')} type="time" value={form.time} onChange={(e) => set('time', e.target.value)} required aria-required="true" />
              </FormField>
            </>
          )}
          <FormField prefix={PREFIX} name="durationMinutes" label="Durée (minutes)" error={errors.durationMinutes}>
            <input {...props('durationMinutes')} type="number" inputMode="numeric" min={15} max={480} step={5} value={form.durationMinutes} onChange={(e) => set('durationMinutes', e.target.value)} required aria-required="true" />
          </FormField>
          <FormField prefix={PREFIX} name="location" label="Lieu ou lien de visioconférence" error={errors.location}>
            <input {...props('location')} value={form.location} onChange={(e) => set('location', e.target.value)} maxLength={200} />
          </FormField>
          <FormField prefix={PREFIX} name="note" label="Note" error={errors.note}>
            <textarea {...props('note')} value={form.note} onChange={(e) => set('note', e.target.value)} maxLength={500} rows={3} placeholder="Ordre du jour, points à aborder" />
          </FormField>
        </fieldset>
        {problems.length > 0 && (
          <div role="alert" className="error">
            <p className="m-0 font-semibold">Corrigez les champs en surbrillance avant d’enregistrer :</p>
            <ul className="m-0 pl-5">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
          </div>
        )}
        {error && <p role="alert" className="error">{error}</p>}
        <div className="row end">
          <button type="button" className="secondary" onClick={onClose}>Annuler</button>
          <button type="submit" disabled={busy}>Enregistrer</button>
        </div>
      </form>
    </Modal>
  );
}

/** Report : nouvelle date et heure (dans le futur) et motif obligatoire. */
function PostponeDialog({ appointment, onClose, onDone }: { appointment: Appointment; onClose: () => void; onDone: (saved?: Appointment) => Promise<void> }) {
  const [date, setDate] = useState(localDay(appointment.startsAt));
  const [time, setTime] = useState(localTime(appointment.startsAt));
  const [reason, setReason] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const instant = toInstant(date, time);
  const whenProblem = !instant ? 'La date et l’heure doivent être valides.'
    : new Date(instant).getTime() <= Date.now() ? 'La nouvelle heure ne peut pas être dans le passé.'
    : instant === appointment.startsAt ? 'Choisissez une heure différente de l’heure actuelle.' : null;
  const reasonProblem = validateClosingText(reason, 500);
  async function confirm() {
    setTried(true);
    if (whenProblem || reasonProblem) {
      document.getElementById(whenProblem ? `${PREFIX}-postpone-date` : `${PREFIX}-postpone-reason`)?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const saved = await api<Appointment>(`/appointments/${appointment.id}/postpone`, { method: 'POST', body: { version: appointment.version, startsAt: instant, text: reason.trim() } });
      await onDone(saved);
    } catch (e) {
      setBusy(false);
      setError(e instanceof ApiError ? e.message : 'Action impossible');
    }
  }
  return (
    <Modal title="Reporter le rendez-vous" onClose={onClose}>
      <p className="m-0 mb-3">{appointmentTypeLabel(appointment.type)} avec <strong>{appointment.companyName}</strong>, actuellement le <strong>{dateLong(appointment.startsAt)}</strong>, {timeRange(appointment)}.</p>
      <FormField prefix={PREFIX} name="postpone-date" label="Nouvelle date" error={tried && whenProblem ? whenProblem : undefined}>
        <input {...fieldProps(PREFIX, 'postpone-date', tried && whenProblem ? whenProblem : undefined)} type="date" value={date} onChange={(e) => setDate(e.target.value)} required aria-required="true" />
      </FormField>
      <FormField prefix={PREFIX} name="postpone-time" label="Nouvelle heure de début">
        <input id={`${PREFIX}-postpone-time`} type="time" value={time} onChange={(e) => setTime(e.target.value)} required aria-required="true" />
      </FormField>
      <FormField prefix={PREFIX} name="postpone-reason" label="Motif du report" error={tried && reasonProblem ? reasonProblem : undefined}>
        <textarea {...fieldProps(PREFIX, 'postpone-reason', tried && reasonProblem ? reasonProblem : undefined)} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={3} required aria-required="true" placeholder="Pourquoi le rendez-vous est décalé" />
      </FormField>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="row end">
        <button type="button" className="secondary" onClick={onClose}>Retour</button>
        <button type="button" disabled={busy} onClick={() => void confirm()}>Reporter</button>
      </div>
    </Modal>
  );
}

/** Marquer tenu (compte rendu obligatoire) ou annuler (motif obligatoire) un rendez-vous à venir. */
function ClosingDialog({ appointment, closing, onClose, onDone }: { appointment: Appointment; closing: 'hold' | 'cancel'; onClose: () => void; onDone: (saved?: Appointment) => Promise<void> }) {
  const [text, setText] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hold = closing === 'hold';
  const max = hold ? 1000 : 500;
  const problem = tried ? validateClosingText(text, max) : null;
  async function confirm() {
    setTried(true);
    if (validateClosingText(text, max)) {
      document.getElementById(`${PREFIX}-closing-text`)?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`/appointments/${appointment.id}/${closing}`, { method: 'POST', body: { version: appointment.version, text: text.trim() } });
      await onDone();
    } catch (e) {
      setBusy(false);
      setError(e instanceof ApiError ? e.message : 'Action impossible');
    }
  }
  return (
    <Modal title={hold ? 'Marquer le rendez-vous comme tenu' : 'Annuler le rendez-vous'} onClose={onClose}>
      <p className="m-0 mb-3">{appointmentTypeLabel(appointment.type)} avec <strong>{appointment.companyName}</strong>, le <strong>{dateLong(appointment.startsAt)}</strong>, {timeRange(appointment)}. Cette action est définitive et enregistrée dans l’audit.</p>
      <div className="field">
        <label htmlFor={`${PREFIX}-closing-text`}>{hold ? 'Compte rendu' : 'Motif de l’annulation'}</label>
        <textarea
          id={`${PREFIX}-closing-text`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={max}
          rows={4}
          required
          aria-required="true"
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? `${PREFIX}-closing-text-error` : undefined}
          placeholder={hold ? 'Ce qui s’est dit ou décidé' : 'Pourquoi le rendez-vous n’a plus lieu'}
        />
        {problem && <p id={`${PREFIX}-closing-text-error`} className="field-error">{problem}</p>}
      </div>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="row end">
        <button type="button" className="secondary" onClick={onClose}>Retour</button>
        <button type="button" className={hold ? undefined : 'danger'} disabled={busy} onClick={() => void confirm()}>{hold ? 'Marquer comme tenu' : 'Annuler le rendez-vous'}</button>
      </div>
    </Modal>
  );
}
