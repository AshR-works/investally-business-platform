import { Page } from '../../../shared-kernel';
import { Facilitator } from './facilitator';

/** Port de persistance des facilitateurs. */
export interface FacilitatorRepository {
  save(facilitator: Facilitator): Promise<void>;
  findById(id: string): Promise<Facilitator | null>;
  /** `ownerIds` : restreint aux facilitateurs de ces propriétaires (liste vide = aucun) ; absent = pas de restriction. */
  list(query: { page: number; pageSize: number; search?: string; ownerIds?: readonly string[] }): Promise<Page<Facilitator>>;
}

export const FACILITATOR_REPOSITORY = Symbol('FacilitatorRepository');
