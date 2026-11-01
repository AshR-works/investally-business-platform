import { Page } from '../../../shared-kernel';
import { Offer, OfferStatus } from './offer';

/** Une offre et le nom de son entreprise (pour les listes). */
export interface OfferListItem {
  offer: Offer;
  companyName: string;
  /** Échéance de la prochaine relance à faire (« AAAA-MM-JJ »), `null` si aucune. */
  nextFollowupOn: string | null;
}

/**
 * Port de persistance des offres. La visibilité d'une offre suit celle de son entreprise : `ownerIds` restreint aux offres
 * dont l'entreprise appartient à l'un de ces propriétaires (liste vide = aucune) ; absent = pas de restriction.
 */
export interface OfferRepository {
  /** Crée ou met à jour ; une modification sur une version périmée est un conflit (verrou optimiste). */
  save(offer: Offer): Promise<void>;
  findById(id: string): Promise<Offer | null>;
  /** Prochaine référence « OFF-2026-0001 » : compteur par année, sans trou ni doublon (transactionnel). */
  nextReference(year: number): Promise<string>;
  list(query: { page: number; pageSize: number; search?: string; companyId?: string; status?: OfferStatus; ownerIds?: readonly string[] }): Promise<Page<OfferListItem>>;
}

export const OFFER_REPOSITORY = Symbol('OfferRepository');
