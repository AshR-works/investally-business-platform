import { Inject, Injectable } from '@nestjs/common';
import { Page } from '../../../shared-kernel';
import type { Visibility } from '../../iam';
import { COMPANY_REPOSITORY, CompanyRepository, CompanySortField } from '../domain/company-repository';
import { CompanyStatus } from '../domain/company-status';
import { OPPORTUNITY_TOTALS, OpportunityTotals } from '../domain/opportunity-totals';
import { OWNER_DIRECTORY, OwnerDirectory } from '../domain/owner-directory';

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
  /** Ce que l'appelant a le droit de voir des opportunités : sans lecture, la valeur n'est pas calculée. */
  opportunityVisibility: Visibility;
}

const MAX_PAGE_SIZE = 100;

/** Requête de lecture : liste paginée des entreprises visibles par l'appelant. */
@Injectable()
export class ListCompaniesHandler {
  constructor(
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
    @Inject(OWNER_DIRECTORY) private readonly owners: OwnerDirectory,
    @Inject(OPPORTUNITY_TOTALS) private readonly totals: OpportunityTotals,
  ) {}

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
    const names = await this.owners.names(result.items.flatMap((c) => (c.ownerUserId ? [c.ownerUserId] : [])));
    // La valeur des opportunités suit la portée de lecture des opportunités : hors de cette portée, la colonne reste vide.
    const sees = (ownerId: string | null) => query.opportunityVisibility.unrestricted || (ownerId !== null && query.opportunityVisibility.ownerIds.includes(ownerId));
    const visible = result.items.filter((c) => sees(c.ownerUserId)).map((c) => c.id);
    const open = await this.totals.openByCompany(visible);
    return {
      ...result,
      items: result.items.map((company) => {
        const view = toCompanyView(company, undefined, company.ownerUserId ? (names.get(company.ownerUserId) ?? null) : null);
        return sees(company.ownerUserId) ? { ...view, openOpportunities: open.get(company.id) ?? { count: 0, totals: [] } } : view;
      }),
    };
  }
}
