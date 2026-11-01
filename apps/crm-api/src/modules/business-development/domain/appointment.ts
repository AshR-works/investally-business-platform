import { AggregateRoot, DomainError } from '../../../shared-kernel';

/** Nature du rendez-vous : avec le DAF, avec le décideur, ou visite de l'entreprise chez Investally. */
export enum AppointmentType {
  FinanceDirector = 'FINANCE_DIRECTOR',
  DecisionMaker = 'DECISION_MAKER',
  Visit = 'VISIT',
}

/** À venir, tenu (avec son compte rendu) ou annulé (avec son motif). Tenu et annulé sont définitifs ; un report garde « à venir ». */
export enum AppointmentStatus {
  Planned = 'PLANNED',
  Held = 'HELD',
  Cancelled = 'CANCELLED',
}

/** Durée proposée, minimale et maximale d'un rendez-vous, en minutes : valeurs proposées, à confirmer. */
export const DEFAULT_APPOINTMENT_MINUTES = 60;
export const MIN_APPOINTMENT_MINUTES = 15;
export const MAX_APPOINTMENT_MINUTES = 480;

export interface AppointmentProps {
  id: string;
  type: AppointmentType;
  companyId: string;
  contactId: string | null;
  offerId: string | null;
  /** Organisateur : l'utilisateur dont l'agenda porte le rendez-vous (sert à repérer les conflits d'horaire). */
  organizerUserId: string;
  startsAt: Date;
  durationMinutes: number;
  location: string | null;
  note: string | null;
  status: AppointmentStatus;
  /** Compte rendu (tenu) ou motif d'annulation (annulé) ; absent tant que le rendez-vous est à venir. */
  outcomeNote: string | null;
  closedAt: Date | null;
  postponements: number;
  lastPostponeReason: string | null;
  createdAt: Date;
  version: number;
}

const TYPES: readonly string[] = Object.values(AppointmentType);

const typeOf = (raw: string | undefined): AppointmentType => {
  if (!TYPES.includes(raw ?? '')) throw new DomainError('VALIDATION', 'Le type de rendez-vous est inconnu');
  return raw as AppointmentType;
};

function instant(raw: Date | string | undefined, label: string): Date {
  const value = raw instanceof Date ? raw : new Date(raw ?? '');
  if (Number.isNaN(value.getTime())) throw new DomainError('VALIDATION', `${label} doit être une date et une heure valides`);
  return value;
}

function minutesOf(raw: number | undefined): number {
  const value = raw ?? DEFAULT_APPOINTMENT_MINUTES;
  if (!Number.isInteger(value) || value < MIN_APPOINTMENT_MINUTES || value > MAX_APPOINTMENT_MINUTES) {
    throw new DomainError('VALIDATION', `La durée doit être comprise entre ${MIN_APPOINTMENT_MINUTES} et ${MAX_APPOINTMENT_MINUTES} minutes`);
  }
  return value;
}

const optionalText = (raw: string | null | undefined, label: string, max: number): string | null => {
  const value = (raw ?? '').trim();
  if (value.length > max) throw new DomainError('VALIDATION', `${label} ne peut dépasser ${max} caractères`);
  return value === '' ? null : value;
};

/** Texte obligatoire (compte rendu, motif) : trois caractères au moins, la limite donnée au plus. */
function required(raw: string | undefined, label: string, max: number): string {
  const text = (raw ?? '').trim();
  if (text.length < 3) throw new DomainError('VALIDATION', `${label} est obligatoire`);
  if (text.length > max) throw new DomainError('VALIDATION', `${label} ne peut dépasser ${max} caractères`);
  return text;
}

const futureOnly = (startsAt: Date, now: Date): void => {
  if (startsAt.getTime() <= now.getTime()) throw new DomainError('VALIDATION', 'Le rendez-vous ne peut pas être placé dans le passé');
};

/**
 * Rendez-vous ou visite d'une entreprise, dans l'agenda de son organisateur. Sa visibilité suit celle de l'entreprise. Un rendez-vous
 * à venir peut être modifié (lieu, durée, contact, note), reporté (avec motif), tenu (avec compte rendu, une fois l'heure venue) ou
 * annulé (avec motif) ; tenu et annulé sont définitifs.
 */
export class Appointment extends AggregateRoot {
  private constructor(private props: AppointmentProps) {
    super();
  }

  /** Planifie un rendez-vous ; l'heure de début ne peut pas être dans le passé. */
  static plan(input: {
    id: string; type: string; companyId: string; contactId?: string | null; offerId?: string | null; organizerUserId: string;
    startsAt: Date | string; durationMinutes?: number; location?: string | null; note?: string | null; now: Date;
  }): Appointment {
    if (!input.companyId) throw new DomainError('VALIDATION', 'Un rendez-vous porte sur une entreprise');
    if (!input.organizerUserId) throw new DomainError('VALIDATION', 'Un rendez-vous a un organisateur');
    const startsAt = instant(input.startsAt, "L'heure de début");
    futureOnly(startsAt, input.now);
    return new Appointment({
      id: input.id, type: typeOf(input.type), companyId: input.companyId, contactId: input.contactId ?? null, offerId: input.offerId ?? null,
      organizerUserId: input.organizerUserId, startsAt, durationMinutes: minutesOf(input.durationMinutes),
      location: optionalText(input.location, 'Le lieu', 200), note: optionalText(input.note, 'La note', 500),
      status: AppointmentStatus.Planned, outcomeNote: null, closedAt: null, postponements: 0, lastPostponeReason: null, createdAt: input.now, version: 1,
    });
  }

  static rehydrate(props: AppointmentProps): Appointment {
    return new Appointment(props);
  }

  private assertPlanned(action: string): void {
    if (this.props.status !== AppointmentStatus.Planned) {
      throw new DomainError('INVARIANT_VIOLATION', `Un rendez-vous ${this.props.status === AppointmentStatus.Held ? 'tenu' : 'annulé'} ne peut plus être ${action}`);
    }
  }

  /** Modifie la durée, le lieu, la note ou le contact d'un rendez-vous À VENIR (le changement d'horaire passe par le report). Tout ou rien. */
  edit(changes: { durationMinutes?: number; location?: string | null; note?: string | null; contactId?: string | null }): void {
    this.assertPlanned('modifié');
    const next = { ...this.props };
    if (changes.durationMinutes !== undefined) next.durationMinutes = minutesOf(changes.durationMinutes);
    if (changes.location !== undefined) next.location = optionalText(changes.location, 'Le lieu', 200);
    if (changes.note !== undefined) next.note = optionalText(changes.note, 'La note', 500);
    if (changes.contactId !== undefined) next.contactId = changes.contactId;
    this.props = next;
  }

  /** Reporte le rendez-vous à une autre heure (dans le futur) ; le motif est obligatoire et le rendez-vous reste « à venir ». */
  postpone(startsAt: Date | string, reason: string | undefined, now: Date): void {
    const lastPostponeReason = required(reason, 'Le motif du report', 500);
    this.assertPlanned('reporté');
    const next = instant(startsAt, "La nouvelle heure de début");
    futureOnly(next, now);
    if (next.getTime() === this.props.startsAt.getTime()) throw new DomainError('VALIDATION', "La nouvelle heure est identique à l'heure actuelle");
    this.props = { ...this.props, startsAt: next, postponements: this.props.postponements + 1, lastPostponeReason };
  }

  /** Marque le rendez-vous tenu avec son compte rendu (obligatoire) ; impossible avant son heure de début. */
  hold(report: string | undefined, now: Date): void {
    const outcomeNote = required(report, 'Le compte rendu', 1000);
    this.assertPlanned('tenu');
    if (this.props.startsAt.getTime() > now.getTime()) throw new DomainError('INVARIANT_VIOLATION', "Un rendez-vous ne peut pas être marqué tenu avant son heure de début");
    this.props = { ...this.props, status: AppointmentStatus.Held, outcomeNote, closedAt: now };
  }

  /** Annule le rendez-vous avec un motif (obligatoire). */
  cancel(reason: string | undefined, now: Date): void {
    const outcomeNote = required(reason, "Le motif de l'annulation", 500);
    this.assertPlanned('annulé');
    this.props = { ...this.props, status: AppointmentStatus.Cancelled, outcomeNote, closedAt: now };
  }

  /** Fin du rendez-vous. */
  get endsAt(): Date { return new Date(this.props.startsAt.getTime() + this.props.durationMinutes * 60000); }

  /** Vrai si les deux créneaux se chevauchent (fin exclusive : deux rendez-vous bout à bout ne se chevauchent pas). */
  overlaps(other: { startsAt: Date; endsAt: Date }): boolean {
    return this.props.startsAt.getTime() < other.endsAt.getTime() && other.startsAt.getTime() < this.endsAt.getTime();
  }

  /** Vrai si le rendez-vous est à venir et son heure de début est passée : un compte rendu est attendu (calculé, jamais stocké). */
  isReportDue(now: Date): boolean {
    return this.props.status === AppointmentStatus.Planned && this.props.startsAt.getTime() <= now.getTime();
  }

  get id(): string { return this.props.id; }
  get type(): AppointmentType { return this.props.type; }
  get companyId(): string { return this.props.companyId; }
  get contactId(): string | null { return this.props.contactId; }
  get offerId(): string | null { return this.props.offerId; }
  get organizerUserId(): string { return this.props.organizerUserId; }
  get startsAt(): Date { return this.props.startsAt; }
  get durationMinutes(): number { return this.props.durationMinutes; }
  get location(): string | null { return this.props.location; }
  get note(): string | null { return this.props.note; }
  get status(): AppointmentStatus { return this.props.status; }
  get outcomeNote(): string | null { return this.props.outcomeNote; }
  get closedAt(): Date | null { return this.props.closedAt; }
  get postponements(): number { return this.props.postponements; }
  get lastPostponeReason(): string | null { return this.props.lastPostponeReason; }
  get createdAt(): Date { return this.props.createdAt; }
  get version(): number { return this.props.version; }
}
