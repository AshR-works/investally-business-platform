import type { Tone } from '../components/data/badge';
import type { Appointment } from './types';
import { addDays } from './followups';
import { isRealDate } from './receipts';

/** Types de rendez-vous (codes de l'API → libellés). */
export const APPOINTMENT_TYPES = [
  { value: 'FINANCE_DIRECTOR', label: 'Rendez-vous DAF' },
  { value: 'DECISION_MAKER', label: 'Rendez-vous décideur' },
  { value: 'VISIT', label: 'Visite chez Investally' },
] as const;

export const appointmentTypeLabel = (value: string): string => APPOINTMENT_TYPES.find((t) => t.value === value)?.label ?? value;

/** États d'un rendez-vous, avec le libellé et la teinte (le sens reste porté par le texte). */
export const APPOINTMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  PLANNED: { label: 'À venir', tone: 'info' },
  HELD: { label: 'Tenu', tone: 'ok' },
  CANCELLED: { label: 'Annulé', tone: 'neutral' },
};

/** Durée proposée, minimale et maximale, en minutes (valeurs proposées, à confirmer ; les mêmes que le serveur). */
export const DEFAULT_APPOINTMENT_MINUTES = 60;
export const MIN_APPOINTMENT_MINUTES = 15;
export const MAX_APPOINTMENT_MINUTES = 480;

/** Droits de l'utilisateur sur l'agenda, tels que le profil les annonce (le serveur re-contrôle tout). */
export interface AgendaRights {
  create: boolean;
  update: boolean;
  cancel: boolean;
  visitCreate: boolean;
  visitUpdate: boolean;
}

/** Ce que l'utilisateur saisit pour planifier ou modifier un rendez-vous (date et heure en heure locale). */
export interface AppointmentForm {
  type: string;
  companyId: string;
  contactId: string;
  offerId: string;
  opportunityId: string;
  date: string;
  time: string;
  durationMinutes: string;
  location: string;
  note: string;
}

export type AppointmentField = keyof AppointmentForm;
export type AppointmentErrors = Partial<Record<AppointmentField, string>>;

const pad = (n: number) => String(n).padStart(2, '0');

/** Jour local « AAAA-MM-JJ » d'un instant. */
export const localDay = (iso: string | Date): string => {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Heure locale « hh:mm » d'un instant. */
export const localTime = (iso: string | Date): string => {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Instant (ISO) d'un jour et d'une heure LOCAUX saisis ; `null` si l'un ou l'autre est illisible. */
export function toInstant(date: string, time: string): string | null {
  if (!isRealDate(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const instant = new Date(`${date}T${time}:00`);
  return Number.isNaN(instant.getTime()) ? null : instant.toISOString();
}

/** Premier instant (ISO) d'un jour local. */
export const startOfLocalDay = (day: string): string => new Date(`${day}T00:00:00`).toISOString();

export const EMPTY_APPOINTMENT_FORM = (defaults: Partial<AppointmentForm> = {}, now: Date = new Date()): AppointmentForm => {
  const next = new Date(now.getTime() + 86400000);
  return {
    type: 'FINANCE_DIRECTOR', companyId: '', contactId: '', offerId: '', opportunityId: '', date: localDay(next), time: '09:00',
    durationMinutes: String(DEFAULT_APPOINTMENT_MINUTES), location: '', note: '', ...defaults,
  };
};

export function formFromAppointment(a: Appointment): AppointmentForm {
  return {
    type: a.type, companyId: a.companyId, contactId: a.contactId ?? '', offerId: a.offerId ?? '', opportunityId: a.opportunityId ?? '', date: localDay(a.startsAt), time: localTime(a.startsAt),
    durationMinutes: String(a.durationMinutes), location: a.location ?? '', note: a.note ?? '',
  };
}

/**
 * Contrôles de saisie rapides, champ par champ (le serveur refait tous les contrôles) : type connu, entreprise choisie, date et
 * heure réelles et dans le futur (à la planification seulement), durée entière de 15 minutes à 8 heures, lieu de 200 caractères
 * et note de 500 au plus.
 */
export function validateAppointmentFields(form: AppointmentForm, context: { now: Date; editing: boolean }): AppointmentErrors {
  const errors: AppointmentErrors = {};
  if (!APPOINTMENT_TYPES.some((t) => t.value === form.type)) errors.type = 'Choisissez le type de rendez-vous.';
  if (!context.editing && !form.companyId) errors.companyId = 'Choisissez l’entreprise.';
  if (!context.editing) {
    if (!form.date.trim()) errors.date = 'La date est obligatoire.';
    else if (!isRealDate(form.date)) errors.date = 'La date n’est pas valide.';
    if (!form.time.trim()) errors.time = 'L’heure est obligatoire.';
    else if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.time)) errors.time = 'L’heure n’est pas valide.';
    const instant = errors.date || errors.time ? null : toInstant(form.date, form.time);
    if (instant && new Date(instant).getTime() <= context.now.getTime()) errors.time = 'Le rendez-vous ne peut pas être placé dans le passé.';
  }
  const minutes = Number(form.durationMinutes);
  if (form.durationMinutes.trim() === '' || !Number.isInteger(minutes) || minutes < MIN_APPOINTMENT_MINUTES || minutes > MAX_APPOINTMENT_MINUTES) {
    errors.durationMinutes = `La durée doit être comprise entre ${MIN_APPOINTMENT_MINUTES} et ${MAX_APPOINTMENT_MINUTES} minutes.`;
  }
  if (form.location.length > 200) errors.location = 'Le lieu ne peut dépasser 200 caractères.';
  if (form.note.length > 500) errors.note = 'La note ne peut dépasser 500 caractères.';
  return errors;
}

/**
 * Corps de la planification (type, entreprise, heure ; contact, offre, lieu et note seulement s'ils sont renseignés) ou de la
 * modification (la version lue, jamais le type, l'entreprise ni l'heure : un changement d'heure est un report).
 */
export function buildAppointmentBody(form: AppointmentForm, options: { version?: number } = {}): Record<string, unknown> {
  const body: Record<string, unknown> = { durationMinutes: Number(form.durationMinutes), location: form.location.trim(), note: form.note.trim() };
  if (options.version === undefined) {
    body.type = form.type;
    body.companyId = form.companyId;
    body.startsAt = toInstant(form.date, form.time);
    if (form.contactId) body.contactId = form.contactId;
    if (form.offerId) body.offerId = form.offerId;
    if (form.opportunityId) body.opportunityId = form.opportunityId;
    if (!form.location.trim()) delete body.location;
    if (!form.note.trim()) delete body.note;
  } else {
    body.version = options.version;
    body.contactId = form.contactId || null;
  }
  return body;
}

export type AppointmentAction = 'edit' | 'postpone' | 'hold' | 'cancel';
export const APPOINTMENT_ACTION_LABEL: Record<AppointmentAction, string> = {
  edit: 'Modifier', postpone: 'Reporter', hold: 'Marquer comme tenu', cancel: 'Annuler le rendez-vous',
};

/**
 * Actions proposées : seulement sur un rendez-vous À VENIR, selon les droits de l'utilisateur pour ce type (une visite relève du droit
 * « visite », son annulation de la modification), et « tenu » seulement une fois l'heure de début venue (le serveur re-contrôle tout).
 */
export function appointmentActions(appointment: Pick<Appointment, 'status' | 'type' | 'startsAt'>, rights: AgendaRights, now: Date = new Date()): AppointmentAction[] {
  if (appointment.status !== 'PLANNED') return [];
  const visit = appointment.type === 'VISIT';
  const update = visit ? rights.visitUpdate : rights.update;
  const cancel = visit ? rights.visitUpdate : rights.cancel;
  const actions: AppointmentAction[] = [];
  if (update) actions.push('edit', 'postpone');
  if (update && new Date(appointment.startsAt).getTime() <= now.getTime()) actions.push('hold');
  if (cancel) actions.push('cancel');
  return actions;
}

/** Vrai si l'utilisateur peut planifier ce type de rendez-vous. */
export const canPlan = (type: string, rights: AgendaRights): boolean => (type === 'VISIT' ? rights.visitCreate : rights.create);

/** Types que l'utilisateur peut planifier. */
export const plannableTypes = (rights: AgendaRights) => APPOINTMENT_TYPES.filter((t) => canPlan(t.value, rights));

/** Heure de début et durée d'un rendez-vous, lisibles (« 09:00 – 10:00 »). */
export const timeRange = (a: Pick<Appointment, 'startsAt' | 'endsAt'>): string => `${localTime(a.startsAt)} – ${localTime(a.endsAt)}`;

// ───────────────────────────── Vues de l'agenda ─────────────────────────────

export type AgendaMode = 'day' | 'week' | 'month';
export const AGENDA_MODES: readonly { value: AgendaMode; label: string }[] = [
  { value: 'day', label: 'Jour' },
  { value: 'week', label: 'Semaine' },
  { value: 'month', label: 'Mois' },
];

/** Jour de la semaine (0 = lundi … 6 = dimanche) d'un jour « AAAA-MM-JJ ». */
const weekdayIndex = (day: string): number => (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
const firstOfMonth = (day: string): string => `${day.slice(0, 7)}-01`;
const lastOfMonth = (day: string): string => addDays(firstOfMonth(shiftMonth(day, 1)), -1);

/** Le premier du mois qui suit ou précède `day` de `months` mois. */
function shiftMonth(day: string, months: number): string {
  const [y, m] = [Number(day.slice(0, 4)), Number(day.slice(5, 7))];
  const total = y * 12 + (m - 1) + months;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}-01`;
}

/** Lundi de la semaine qui contient `day`. */
export const mondayOf = (day: string): string => addDays(day, -weekdayIndex(day));

export interface AgendaWindow {
  /** Jours affichés, dans l'ordre (la grille d'un mois commence un lundi et finit un dimanche). */
  days: string[];
  /** Fenêtre à demander au serveur : début inclus, fin exclue, en instants (minuit LOCAL). */
  from: string;
  to: string;
}

/** Fenêtre d'une vue autour d'un jour : un jour, la semaine du lundi au dimanche, ou la grille du mois (4 à 6 semaines). */
export function agendaWindow(mode: AgendaMode, anchor: string): AgendaWindow {
  let first = anchor;
  let last = anchor;
  if (mode === 'week') {
    first = mondayOf(anchor);
    last = addDays(first, 6);
  } else if (mode === 'month') {
    first = mondayOf(firstOfMonth(anchor));
    last = addDays(mondayOf(lastOfMonth(anchor)), 6);
  }
  const days: string[] = [];
  for (let d = first; d <= last; d = addDays(d, 1)) days.push(d);
  return { days, from: startOfLocalDay(first), to: startOfLocalDay(addDays(last, 1)) };
}

/** Jour d'ancrage de la vue précédente (`-1`) ou suivante (`1`) : un jour, une semaine, ou un mois (même jour, borné au mois). */
export function shiftAnchor(mode: AgendaMode, anchor: string, direction: -1 | 1): string {
  if (mode === 'day') return addDays(anchor, direction);
  if (mode === 'week') return addDays(anchor, 7 * direction);
  const target = shiftMonth(anchor, direction);
  const last = Number(lastOfMonth(target).slice(8, 10));
  return `${target.slice(0, 8)}${pad(Math.min(Number(anchor.slice(8, 10)), last))}`;
}

const longDay = (day: string, options: Intl.DateTimeFormatOptions) => new Date(`${day}T12:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC', ...options });

/** Titre de la vue : « lundi 9 novembre 2026 », « Semaine du 9 au 15 novembre 2026 », « novembre 2026 ». */
export function agendaTitle(mode: AgendaMode, anchor: string): string {
  if (mode === 'day') return longDay(anchor, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  if (mode === 'month') return longDay(anchor, { month: 'long', year: 'numeric' });
  const first = mondayOf(anchor);
  const last = addDays(first, 6);
  const sameMonth = first.slice(0, 7) === last.slice(0, 7);
  return `Semaine du ${longDay(first, sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'long' })} au ${longDay(last, { day: 'numeric', month: 'long', year: 'numeric' })}`;
}

/** Libellé d'un jour pour un titre de section (« lundi 9 novembre »). */
export const dayHeading = (day: string): string => longDay(day, { weekday: 'long', day: 'numeric', month: 'long' });

/** Rendez-vous regroupés par jour LOCAL, chaque jour trié par heure (l'ordre du serveur est conservé). */
export function groupByDay(items: readonly Appointment[]): Map<string, Appointment[]> {
  const groups = new Map<string, Appointment[]>();
  for (const item of items) {
    const day = localDay(item.startsAt);
    groups.set(day, [...(groups.get(day) ?? []), item]);
  }
  return groups;
}

/** Paramètres de la requête d'agenda : la fenêtre, le type éventuel et la taille de page maximale. */
export function agendaParams(window: Pick<AgendaWindow, 'from' | 'to'>, type: string): URLSearchParams {
  const params = new URLSearchParams({ from: window.from, to: window.to, pageSize: '200' });
  if (type) params.set('type', type);
  return params;
}
