import { Inject, Injectable } from '@nestjs/common';
import { Page } from '../../../shared-kernel';
import { COMPANY_REPOSITORY, CompanyRepository } from '../domain/company-repository';
import { CompanyView, toCompanyView } from './company-view';

export interface ListCompaniesQuery {
  page: number;
  pageSize: number;
  search?: string;
}

const MAX_PAGE_SIZE = 100;

@Injectable()
export class ListCompaniesHandler {
  constructor(@Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository) {}

  async execute(query: ListCompaniesQuery): Promise<Page<CompanyView>> {
    const page = Math.max(1, Math.floor(query.page));
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(query.pageSize)));
    const result = await this.companies.list({ page, pageSize, search: query.search?.trim() || undefined });
    return { ...result, items: result.items.map(toCompanyView) };
  }
}
