import { Page } from '../../../shared-kernel';
import { Opportunity, OpportunityStage, OpportunityStatus } from './opportunity';

/** Une opportunité avec le nom de son entreprise (pour les listes). */
export interface OpportunityListItem {
  opportunity: Opportunity;
  companyName: string;
}

export interface OpportunityListQuery {
  page: number;
  pageSize: number;
  search?: string;
  companyId?: string;
  status?: OpportunityStatus;
  stage?: OpportunityStage;
  ownerIds?: readonly string[];
}

/**
 * Port de persistance des opportunités. La visibilité d'une opportunité suit celle de son entreprise : `ownerIds` restreint aux
 * opportunités dont l'entreprise appartient à l'un de ces propriétaires (liste vide = aucune) ; absent = pas de restriction.
 */
export interface OpportunityRepository {
  /** Crée ou met à jour ; une modification sur une version périmée est un conflit (verrou optimiste). */
  save(opportunity: Opportunity): Promise<void>;
  findById(id: string): Promise<Opportunity | null>;
  /** Tri : dernière activité d'abord, puis identifiant. */
  list(query: OpportunityListQuery): Promise<Page<OpportunityListItem>>;
}

export const OPPORTUNITY_REPOSITORY = Symbol('OpportunityRepository');

/**
 * Lecture des rendez-vous décideur tenus (règle de l'accord de principe, flux F1). Pour une opportunité, comptent les rendez-vous
 * qui lui sont liés ET ceux qui ne sont liés à aucune opportunité de l'entreprise ; un rendez-vous lié à une AUTRE opportunité ne
 * compte pas (D93).
 */
export interface DecisionMakerMeetings {
  hasHeld(companyId: string, opportunityId: string): Promise<boolean>;
}

export const DECISION_MAKER_MEETINGS = Symbol('DecisionMakerMeetings');
