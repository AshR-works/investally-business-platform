import { Page } from '../../../shared-kernel';
import { Company } from './company';
import { CompanyName } from './company-name';
import { CompanyStatus } from './company-status';

/** Colonnes sur lesquelles la liste peut être triée. */
export const COMPANY_SORT_FIELDS = ['createdAt', 'name', 'country', 'sector', 'status'] as const;
export type CompanySortField = (typeof COMPANY_SORT_FIELDS)[number];

/** Paramètres de la liste : pagination, recherche, filtres (statut, pays, secteur), tri et portée. */
export interface CompanyListQuery {
  page: number;
  pageSize: number;
  search?: string;
  status?: CompanyStatus;
  country?: string;
  sector?: string;
  sort?: CompanySortField;
  direction?: 'asc' | 'desc';
  ownerIds?: readonly string[];
}

/**
 * Port de persistance des entreprises : enregistrer, retrouver, tester l'unicité du nom et lister selon les
 * propriétaires autorisés.
 */
export interface CompanyRepository {
  save(company: Company): Promise<void>;
  findById(id: string): Promise<Company | null>;
  existsByName(name: CompanyName): Promise<boolean>;
  /** `ownerIds` : restreint aux entreprises de ces propriétaires (liste vide = aucune) ; absent = pas de restriction (portée Tous). */
  list(query: CompanyListQuery): Promise<Page<Company>>;
}

export const COMPANY_REPOSITORY = Symbol('CompanyRepository');
