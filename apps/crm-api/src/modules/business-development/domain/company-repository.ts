import { Page } from '../../../shared-kernel';
import { Company } from './company';
import { CompanyName } from './company-name';

export interface CompanyRepository {
  save(company: Company): Promise<void>;
  findById(id: string): Promise<Company | null>;
  existsByName(name: CompanyName): Promise<boolean>;
  list(query: { page: number; pageSize: number; search?: string }): Promise<Page<Company>>;
}

export const COMPANY_REPOSITORY = Symbol('CompanyRepository');
