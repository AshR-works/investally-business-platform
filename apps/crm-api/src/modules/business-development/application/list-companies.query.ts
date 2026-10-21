import { Inject, Injectable } from '@nestjs/common';
import { Page } from '../../../shared-kernel';
import type { Visibility } from '../../iam';
import { COMPANY_REPOSITORY, CompanyRepository } from '../domain/company-repository';
import { CompanyView, toCompanyView } from './company-view';

/**
 * Paramètres de la liste : pagination, recherche et visibilité (calculée depuis les droits de l'appelant, jamais
 * depuis la requête).
 */
export interface ListCompaniesQuery {
  page: number;
  pageSize: number;
  search?: string;
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
      ownerIds: query.visibility.unrestricted ? undefined : query.visibility.ownerIds,
    });
    return { ...result, items: result.items.map(toCompanyView) };
  }
}
