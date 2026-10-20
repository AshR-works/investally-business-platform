import { Company } from '../domain/company';

/** Modèle de lecture exposé par l'Application (pas l'entité). */
export interface CompanyView {
  id: string;
  name: string;
  status: string;
  sector: string | null;
  country: string | null;
  createdAt: string;
}

export function toCompanyView(company: Company): CompanyView {
  return {
    id: company.id,
    name: company.name.value,
    status: company.status,
    sector: company.sector,
    country: company.country,
    createdAt: company.createdAt.toISOString(),
  };
}
