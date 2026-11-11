import { Appointment } from '../domain/appointment';
import { AppointmentListItem } from '../domain/appointment-repository';

/** Un autre rendez-vous de l'organisateur qui chevauche celui-ci (avertissement, jamais un blocage). */
export interface AppointmentConflict {
  id: string;
  type: string;
  startsAt: string;
  endsAt: string;
  companyName: string;
}

/** Modèle de lecture d'un rendez-vous (jamais l'entité). `reportDue` est calculé à la lecture, jamais stocké. */
export interface AppointmentView {
  id: string;
  type: string;
  companyId: string;
  companyName: string;
  contactId: string | null;
  contactName: string | null;
  offerId: string | null;
  offerReference: string | null;
  opportunityId: string | null;
  opportunityTitle: string | null;
  organizerUserId: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  location: string | null;
  note: string | null;
  status: string;
  outcomeNote: string | null;
  closedAt: string | null;
  postponements: number;
  lastPostponeReason: string | null;
  /** Vrai si le rendez-vous est à venir mais son heure est passée : un compte rendu est attendu. */
  reportDue: boolean;
  createdAt: string;
  /** Verrou optimiste : à renvoyer tel quel pour modifier, reporter, tenir ou annuler le rendez-vous. */
  version: number;
  /** Autres rendez-vous du même organisateur sur le même créneau, présents seulement à la planification, à la modification ou au report. */
  conflicts?: AppointmentConflict[];
}

export interface AppointmentContext {
  companyName: string;
  contactName: string | null;
  offerReference: string | null;
  opportunityTitle: string | null;
}

export function toAppointmentView(appointment: Appointment, context: AppointmentContext, now: Date): AppointmentView {
  return {
    id: appointment.id,
    type: appointment.type,
    companyId: appointment.companyId,
    companyName: context.companyName,
    contactId: appointment.contactId,
    contactName: context.contactName,
    offerId: appointment.offerId,
    offerReference: context.offerReference,
    opportunityId: appointment.opportunityId,
    opportunityTitle: context.opportunityTitle,
    organizerUserId: appointment.organizerUserId,
    startsAt: appointment.startsAt.toISOString(),
    endsAt: appointment.endsAt.toISOString(),
    durationMinutes: appointment.durationMinutes,
    location: appointment.location,
    note: appointment.note,
    status: appointment.status,
    outcomeNote: appointment.outcomeNote,
    closedAt: appointment.closedAt?.toISOString() ?? null,
    postponements: appointment.postponements,
    lastPostponeReason: appointment.lastPostponeReason,
    reportDue: appointment.isReportDue(now),
    createdAt: appointment.createdAt.toISOString(),
    version: appointment.version,
  };
}

export const toConflict = (item: AppointmentListItem): AppointmentConflict => ({
  id: item.appointment.id,
  type: item.appointment.type,
  startsAt: item.appointment.startsAt.toISOString(),
  endsAt: item.appointment.endsAt.toISOString(),
  companyName: item.companyName,
});
