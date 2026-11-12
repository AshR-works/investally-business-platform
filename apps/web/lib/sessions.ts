import type { Room, RoomKind } from './catalogue';

/** Sessions de formation (S5.2a) : types de lecture, états, règles de saisie (identiques à celles du serveur) et corps des requêtes. */

export type SessionStatus = 'PLANNED' | 'OPEN' | 'CLOSED' | 'CANCELLED';
export type SessionPhase = 'UPCOMING' | 'IN_PROGRESS' | 'ENDED';

export interface Session {
  id: string;
  trainingId: string;
  trainingTitle: string;
  programName: string;
  rhythm: { code: 'DAY' | 'EVENING'; label: string; weeks: number; totalHours: number };
  /** Dates « AAAA-MM-JJ », sans heure. */
  startDate: string;
  endDate: string;
  roomId: string;
  roomName: string;
  roomKind: RoomKind;
  roomUsableSeats: number;
  trainerId: string;
  trainerName: string;
  capacity: number;
  /** Places occupées : inscriptions en attente ou confirmées. */
  enrolled: number;
  status: SessionStatus;
  phase: SessionPhase;
  cancelReason: string | null;
  needsWorkstations: boolean;
  version: number;
  createdAt: string;
}

export const SESSION_STATUS: Record<SessionStatus, { label: string; tone: 'ok' | 'warn' | 'bad' | 'info' | 'neutral' }> = {
  PLANNED: { label: 'Planifiée', tone: 'info' },
  OPEN: { label: 'Ouverte aux inscriptions', tone: 'ok' },
  CLOSED: { label: 'Clôturée', tone: 'neutral' },
  CANCELLED: { label: 'Annulée', tone: 'bad' },
};

export const SESSION_PHASE_LABEL: Record<SessionPhase, string> = { UPCOMING: 'À venir', IN_PROGRESS: 'En cours', ENDED: 'Terminée' };

export const SESSION_STATUS_OPTIONS = [
  { value: '', label: 'Toutes' },
  { value: 'PLANNED', label: 'Planifiées' },
  { value: 'OPEN', label: 'Ouvertes' },
  { value: 'CANCELLED', label: 'Annulées' },
] as const;

export const SESSION_PERMISSIONS = { read: 'training.session.read', create: 'training.session.create', update: 'training.session.update', cancel: 'training.session.cancel' } as const;

const DAY_MS = 86_400_000;
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const toIso = (date: Date) => date.toISOString().slice(0, 10);

/** Aujourd'hui, au jour près, dans le fuseau du navigateur (le serveur, qui compte en UTC, a le dernier mot). */
export function todayIso(now: Date = new Date()): string {
  return toIso(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}

/** Date du calendrier « AAAA-MM-JJ » (un jour qui existe vraiment). */
export function isIsoDate(raw: string): boolean {
  const match = ISO.exec(raw.trim());
  if (!match) return false;
  return toIso(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))) === raw.trim();
}

/** Jour de cours possible : du lundi au vendredi. */
export function isWorkingDay(iso: string): boolean {
  const day = utc(iso).getUTCDay();
  return day >= 1 && day <= 5;
}

/** Dernier jour de la session : `weeks × 5` jours de cours (lundi–vendredi) à partir du début, inclus. */
export function endDateFor(start: string, weeks: number): string {
  let remaining = weeks * 5 - 1;
  let cursor = utc(start);
  while (remaining > 0) {
    cursor = new Date(cursor.getTime() + DAY_MS);
    const day = cursor.getUTCDay();
    if (day >= 1 && day <= 5) remaining -= 1;
  }
  return toIso(cursor);
}

const FR_DATE = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
/** « lun. 16 nov. 2026 » : une date du serveur lue sans décalage de fuseau. */
export const dateText = (iso: string): string => (isIsoDate(iso) ? FR_DATE.format(utc(iso)) : iso);

/** Période d'une session en une phrase. */
export const periodText = (session: Pick<Session, 'startDate' | 'endDate'>): string => `du ${dateText(session.startDate)} au ${dateText(session.endDate)}`;

export const capacityText = (session: Pick<Session, 'capacity' | 'roomUsableSeats'>): string =>
  `${session.capacity} place${session.capacity > 1 ? 's' : ''} sur ${session.roomUsableSeats} utiles`;

// ───────────────────────────── Formulaires ─────────────────────────────

export interface PlanForm {
  trainingId: string;
  rhythm: string;
  startDate: string;
  roomId: string;
  trainerId: string;
  capacity: string;
}
export const EMPTY_PLAN_FORM = (): PlanForm => ({ trainingId: '', rhythm: 'DAY', startDate: '', roomId: '', trainerId: '', capacity: '' });

export interface PlanContext {
  /** Salles actives proposées (pour le plafond de capacité et le type de salle). */
  rooms: readonly Pick<Room, 'id' | 'name' | 'kind' | 'usableSeats'>[];
  /** Le certificat choisi contient-il un module pratique sur poste de travail ? `null` : on ne sait pas (le serveur tranchera). */
  needsWorkstations: boolean | null;
  today: string;
}

/** Règles de saisie d'une planification, dans l'ordre des champs ; une absence de clé = champ conforme. */
export function validatePlan(form: PlanForm, ctx: PlanContext): Partial<Record<keyof PlanForm, string>> {
  const errors: Partial<Record<keyof PlanForm, string>> = {};
  if (!form.trainingId) errors.trainingId = 'Choisissez le certificat';
  if (!form.rhythm) errors.rhythm = 'Choisissez le rythme';
  const start = form.startDate.trim();
  if (!start) errors.startDate = 'La date de début est obligatoire';
  else if (!isIsoDate(start)) errors.startDate = 'La date de début doit être une date valide';
  else if (start < ctx.today) errors.startDate = 'La date de début ne peut pas être dans le passé';
  else if (!isWorkingDay(start)) errors.startDate = 'La date de début doit être un jour de cours (du lundi au vendredi)';
  const room = ctx.rooms.find((r) => r.id === form.roomId);
  if (!form.roomId) errors.roomId = 'Choisissez la salle';
  else if (room && ctx.needsWorkstations === true && room.kind !== 'WORKSTATIONS') errors.roomId = 'Ce certificat a un module pratique : choisissez une salle avec postes de travail';
  if (!form.trainerId) errors.trainerId = 'Choisissez le formateur';
  const raw = form.capacity.trim();
  const capacity = Number(raw);
  if (!raw) errors.capacity = 'La capacité est obligatoire';
  else if (!Number.isInteger(capacity) || capacity < 1 || capacity > 1000) errors.capacity = 'La capacité doit être un nombre entier entre 1 et 1000';
  else if (room && capacity > room.usableSeats) errors.capacity = `La capacité dépasse les places utiles de la salle (${room.usableSeats})`;
  return errors;
}

export const planBody = (form: PlanForm) => ({
  trainingId: form.trainingId, rhythm: form.rhythm, startDate: form.startDate.trim(), roomId: form.roomId, trainerId: form.trainerId, capacity: Number(form.capacity),
});

export interface EditForm { roomId: string; trainerId: string; capacity: string }
export const formFromSession = (s: Session): EditForm => ({ roomId: s.roomId, trainerId: s.trainerId, capacity: String(s.capacity) });

/** Règles de saisie d'une modification : mêmes plafonds qu'à la planification. */
export function validateEdit(form: EditForm, rooms: PlanContext['rooms'], needsWorkstations: boolean): Partial<Record<keyof EditForm, string>> {
  const errors: Partial<Record<keyof EditForm, string>> = {};
  const room = rooms.find((r) => r.id === form.roomId);
  if (!form.roomId) errors.roomId = 'Choisissez la salle';
  else if (room && needsWorkstations && room.kind !== 'WORKSTATIONS') errors.roomId = 'Ce certificat a un module pratique : choisissez une salle avec postes de travail';
  if (!form.trainerId) errors.trainerId = 'Choisissez le formateur';
  const raw = form.capacity.trim();
  const capacity = Number(raw);
  if (!raw) errors.capacity = 'La capacité est obligatoire';
  else if (!Number.isInteger(capacity) || capacity < 1 || capacity > 1000) errors.capacity = 'La capacité doit être un nombre entier entre 1 et 1000';
  else if (room && capacity > room.usableSeats) errors.capacity = `La capacité dépasse les places utiles de la salle (${room.usableSeats})`;
  return errors;
}

/** Corps de modification : seuls les champs changés partent (le serveur ne recontrôle que ce qui bouge). */
export function editBody(form: EditForm, session: Session) {
  const body: Record<string, unknown> = { version: session.version };
  if (form.roomId !== session.roomId) body.roomId = form.roomId;
  if (form.trainerId !== session.trainerId) body.trainerId = form.trainerId;
  if (Number(form.capacity) !== session.capacity) body.capacity = Number(form.capacity);
  return body;
}

export interface PostponeForm { startDate: string; reason: string }

export function validatePostpone(form: PostponeForm, session: Pick<Session, 'startDate'>, today: string): Partial<Record<keyof PostponeForm, string>> {
  const errors: Partial<Record<keyof PostponeForm, string>> = {};
  const start = form.startDate.trim();
  if (!start) errors.startDate = 'La nouvelle date de début est obligatoire';
  else if (!isIsoDate(start)) errors.startDate = 'La date de début doit être une date valide';
  else if (start < today) errors.startDate = 'La date de début ne peut pas être dans le passé';
  else if (!isWorkingDay(start)) errors.startDate = 'La date de début doit être un jour de cours (du lundi au vendredi)';
  else if (start === session.startDate) errors.startDate = 'La nouvelle date est identique à la date actuelle';
  const reason = form.reason.trim();
  if (!reason) errors.reason = 'Le motif du report est obligatoire';
  else if (reason.length > 500) errors.reason = 'Le motif ne peut dépasser 500 caractères';
  return errors;
}

export function validateCancel(reason: string): string | undefined {
  const text = reason.trim();
  if (!text) return "Le motif de l'annulation est obligatoire";
  if (text.length > 500) return 'Le motif ne peut dépasser 500 caractères';
  return undefined;
}

/** Une session commencée (début atteint) ne change plus de salle ni de formateur ; ni report. */
export const hasStarted = (session: Pick<Session, 'startDate'>, today: string): boolean => session.startDate <= today;

export interface SessionActions { edit: boolean; open: boolean; postpone: boolean; cancel: boolean }

/** Actions possibles sur une ligne selon l'état de la session, ses dates et les droits de l'utilisateur. */
export function sessionActions(session: Pick<Session, 'status' | 'startDate'>, can: { update: boolean; cancel: boolean }, today: string): SessionActions {
  const live = session.status === 'PLANNED' || session.status === 'OPEN';
  return {
    edit: can.update && live,
    open: can.update && session.status === 'PLANNED',
    postpone: can.update && live && !hasStarted(session, today),
    cancel: can.cancel && live,
  };
}
