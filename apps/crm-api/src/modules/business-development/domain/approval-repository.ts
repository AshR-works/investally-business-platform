import { Page } from '../../../shared-kernel';
import { Approval, ApprovalStatus } from './approval';

/** Un agrément avec le nom de son entreprise et l'intitulé de son opportunité (pour les listes). */
export interface ApprovalListItem {
  approval: Approval;
  companyName: string;
  opportunityTitle: string;
}

export interface ApprovalListQuery {
  page: number;
  pageSize: number;
  companyId?: string;
  opportunityId?: string;
  status?: ApprovalStatus;
  ownerIds?: readonly string[];
}

/**
 * Port de persistance des agréments. La visibilité d'un agrément suit celle de son entreprise : `ownerIds` restreint aux agréments
 * dont l'entreprise appartient à l'un de ces propriétaires (liste vide = aucun) ; absent = pas de restriction.
 */
export interface ApprovalRepository {
  /** Crée ou met à jour ; une version périmée est un conflit ; un second agrément actif pour la même opportunité aussi. */
  save(approval: Approval): Promise<void>;
  findById(id: string): Promise<Approval | null>;
  /** L'agrément actif (reçu ou honoré) de l'opportunité, s'il existe. */
  findActiveByOpportunity(opportunityId: string): Promise<Approval | null>;
  /** Tri : le plus récent d'abord. */
  list(query: ApprovalListQuery): Promise<Page<ApprovalListItem>>;
}

export const APPROVAL_REPOSITORY = Symbol('ApprovalRepository');
