import { Page } from '../../../shared-kernel';
import { CommissionPayout, PayoutStatus } from './commission-payout';

/** Un versement avec le nom de son entreprise et de son facilitateur (pour les listes). */
export interface PayoutListItem {
  payout: CommissionPayout;
  companyName: string;
  facilitatorName: string;
}

export interface PayoutListQuery {
  page: number;
  pageSize: number;
  status?: PayoutStatus;
  companyId?: string;
  facilitatorId?: string;
  ownerIds?: readonly string[];
}

/**
 * Port de persistance des versements de commission. La visibilité d'un versement suit celle de son entreprise : `ownerIds` restreint
 * aux versements dont l'entreprise appartient à l'un de ces propriétaires (liste vide = aucun) ; absent = pas de restriction.
 */
export interface CommissionPayoutRepository {
  /** Crée ou met à jour ; une version périmée est un conflit ; un second versement pour le même agrément aussi. */
  save(payout: CommissionPayout): Promise<void>;
  findById(id: string): Promise<CommissionPayout | null>;
  findByApproval(approvalId: string): Promise<CommissionPayout | null>;
  /** Tri : le plus récent d'abord. */
  list(query: PayoutListQuery): Promise<Page<PayoutListItem>>;
}

export const COMMISSION_PAYOUT_REPOSITORY = Symbol('CommissionPayoutRepository');
