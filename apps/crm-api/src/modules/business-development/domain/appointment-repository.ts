import { Page } from '../../../shared-kernel';
import { Appointment, AppointmentStatus, AppointmentType } from './appointment';

/** Un rendez-vous avec son entreprise, son contact et son offre (pour les listes). */
export interface AppointmentListItem {
  appointment: Appointment;
  companyName: string;
  contactName: string | null;
  offerReference: string | null;
}

export interface AppointmentListQuery {
  page: number;
  pageSize: number;
  /** Fenêtre de l'agenda : début inclus, fin exclue. */
  from: Date;
  to: Date;
  /** Types à inclure (liste vide = aucun) : les visites ne sont visibles que de qui peut les lire. */
  types: readonly AppointmentType[];
  status?: AppointmentStatus;
  companyId?: string;
  offerId?: string;
  ownerIds?: readonly string[];
}

/**
 * Port de persistance des rendez-vous. La visibilité d'un rendez-vous suit celle de son entreprise : `ownerIds` restreint aux
 * rendez-vous dont l'entreprise appartient à l'un de ces propriétaires (liste vide = aucun) ; absent = pas de restriction.
 */
export interface AppointmentRepository {
  /** Crée ou met à jour ; une modification sur une version périmée est un conflit (verrou optimiste). */
  save(appointment: Appointment): Promise<void>;
  findById(id: string): Promise<Appointment | null>;
  /** Rendez-vous À VENIR de l'organisateur qui chevauchent le créneau (hors `excludeId`) : sert à avertir d'un conflit d'horaire. */
  findConflicts(query: { organizerUserId: string; startsAt: Date; endsAt: Date; excludeId?: string }): Promise<AppointmentListItem[]>;
  /** Tri : début, puis création. */
  list(query: AppointmentListQuery): Promise<Page<AppointmentListItem>>;
}

export const APPOINTMENT_REPOSITORY = Symbol('AppointmentRepository');
