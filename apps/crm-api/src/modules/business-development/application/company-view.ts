import { Company } from '../domain/company';

/** Modèle de lecture exposé par l'Application (pas l'entité). */
export interface CompanyView {
  id: string;
  name: string;
  status: string;
  ownerUserId: string | null;
  sector: string | null;
  country: string | null;
  createdAt: string;
}

/** Transforme une entreprise du domaine en représentation publique (aucun objet interne n'est exposé). */
export function toCompanyView(company: Company): CompanyView {
  return {
    id: company.id,
    name: company.name.value,
    status: company.status,
    ownerUserId: company.ownerUserId,
    sector: company.sector,
    country: company.country,
    createdAt: company.createdAt.toISOString(),
  };
}
