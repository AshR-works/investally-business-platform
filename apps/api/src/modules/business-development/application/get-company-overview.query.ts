import { Inject, Injectable } from '@nestjs/common';
import type { Visibility } from '../../iam';
import { COMPANY_OVERVIEW_READER, CompanyOverview, CompanyOverviewReader } from '../domain/company-overview-reader';

export interface GetCompanyOverviewQuery {
  search?: string;
  country?: string;
  sector?: string;
  /** Calculée depuis les droits de l'appelant, jamais depuis la requête. */
  visibility: Visibility;
}

/** Requête de lecture : compteurs par statut et valeurs de filtre, dans la seule portée de l'appelant. */
@Injectable()
export class GetCompanyOverviewHandler {
  constructor(@Inject(COMPANY_OVERVIEW_READER) private readonly reader: CompanyOverviewReader) {}

  execute(query: GetCompanyOverviewQuery): Promise<CompanyOverview> {
    return this.reader.overview({
      ownerIds: query.visibility.unrestricted ? undefined : query.visibility.ownerIds,
      search: query.search?.trim() || undefined,
      country: query.country?.trim() || undefined,
      sector: query.sector?.trim() || undefined,
    });
  }
}
