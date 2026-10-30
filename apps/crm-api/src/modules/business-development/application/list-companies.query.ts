import { Inject, Injectable } from '@nestjs/common';
import { Page } from '../../../shared-kernel';
import type { Visibility } from '../../iam';
import { COMPANY_REPOSITORY, CompanyRepository, CompanySortField } from '../domain/company-repository';
import { CompanyStatus } from '../domain/company-status';

// Vocabulaire de la liste, ré-exporté pour la couche de présentation (qui n'importe jamais le domaine).
export { COMPANY_SORT_FIELDS } from '../domain/company-repository';
export type { CompanySortField } from '../domain/company-repository';
export { CompanyStatus };
import { CompanyView, toCompanyView } from './company-view';

/**
 * Paramètres de la liste : pagination, recherche et visibilité (calculée depuis les droits de l'appelant, jamais
 * depuis la requête).
 */
export interface ListCompaniesQuery {
  page: number;
  pageSize: number;
  search?: string;
  status?: CompanyStatus;
  country?: string;
  sector?: string;
  sort?: CompanySortField;
  direction?: 'asc' | 'desc';
  /** Ce que l'appelant a le droit de voir (calculé depuis ses droits, jamais depuis la requête). */
  visibility: Visibility;
}

const MAX_PAGE_SIZE = 100;

/** Requête de lecture : liste paginée des entreprises visibles par l'appelant. */
@Injectable()
export class ListCompaniesHandler {
  constructor(@Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository) {}

  /**
   * Borne la page et la taille de page, puis ne renvoie que les entreprises de la portée de l'appelant (propriétaires
   * autorisés).
   */
  async execute(query: ListCompaniesQuery): Promise<Page<CompanyView>> {
    const page = Math.max(1, Math.floor(query.page));
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(query.pageSize)));
    const result = await this.companies.list({
      page,
      pageSize,
      search: query.search?.trim() || undefined,
      status: query.status,
      country: query.country?.trim() || undefined,
      sector: query.sector?.trim() || undefined,
      sort: query.sort,
      direction: query.direction,
      ownerIds: query.visibility.unrestricted ? undefined : query.visibility.ownerIds,
    });
    return { ...result, items: result.items.map((company) => toCompanyView(company)) };
  }
}
