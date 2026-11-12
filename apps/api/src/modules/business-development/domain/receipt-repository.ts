import { Receipt } from './receipt';

/**
 * Port de persistance des décharges. La visibilité d'une décharge suit celle de l'entreprise de son offre : le contrôle de portée
 * se fait dans les cas d'usage, à partir de l'offre.
 */
export interface ReceiptRepository {
  /** Crée ou met à jour ; une modification sur une version périmée est un conflit (verrou optimiste). */
  save(receipt: Receipt): Promise<void>;
  findById(id: string): Promise<Receipt | null>;
  /** Décharges d'une offre, la plus récente d'abord, annulées comprises (l'historique reste lisible). */
  listByOffer(offerId: string): Promise<Receipt[]>;
}

export const RECEIPT_REPOSITORY = Symbol('ReceiptRepository');
