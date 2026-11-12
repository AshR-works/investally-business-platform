import { Page } from '../../../shared-kernel';
import { Followup, FollowupStatus } from './followup';

/** Une relance avec l'offre et l'entreprise (pour les listes). */
export interface FollowupListItem {
  followup: Followup;
  offerReference: string;
  companyId: string;
  companyName: string;
}

/** Filtre sur l'échéance des relances À FAIRE : en retard (avant aujourd'hui), aujourd'hui, à venir (après aujourd'hui). */
export type FollowupDue = 'overdue' | 'today' | 'upcoming';

/**
 * Port de persistance des relances. La visibilité d'une relance suit celle de l'entreprise de son offre : `ownerIds` restreint aux
 * relances dont l'entreprise appartient à l'un de ces propriétaires (liste vide = aucune) ; absent = pas de restriction.
 */
export interface FollowupRepository {
  /** Crée ou met à jour ; une modification sur une version périmée est un conflit (verrou optimiste). */
  save(followup: Followup): Promise<void>;
  findById(id: string): Promise<Followup | null>;
  /** Relances d'une offre, les plus récentes d'abord (annulées comprises). */
  listByOffer(offerId: string): Promise<Followup[]>;
  /** Nombre de relances de l'offre qui comptent dans la limite (à faire ou terminées ; pas les annulées). */
  countActiveByOffer(offerId: string): Promise<number>;
  /** Relances de l'offre encore à faire (pour les annuler quand l'offre n'est plus en cours). */
  listPlannedByOffer(offerId: string): Promise<Followup[]>;
  /** `today` : « AAAA-MM-JJ » (UTC) pour situer les échéances. Tri : échéance, puis création. */
  list(query: { page: number; pageSize: number; status?: FollowupStatus; due?: FollowupDue; today: string; offerId?: string; companyId?: string; ownerIds?: readonly string[] }): Promise<Page<FollowupListItem>>;
}

export const FOLLOWUP_REPOSITORY = Symbol('FollowupRepository');
