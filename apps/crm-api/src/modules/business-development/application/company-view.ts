import { Company } from '../domain/company';
import { FacilitatorView } from './facilitator-view';

export interface CommissionView {
  type: string;
  value: string;
  currency: string | null;
}

/** Facilitation telle qu'exposée : le facilitateur et la commission ne sont renseignés que si l'appelant y a droit. */
export interface FacilitationView {
  facilitatorId: string;
  contactMethod: string;
  isCompanyEmployee: boolean;
  /** `null` si l'appelant n'a pas le droit de voir ce facilitateur (l'existence du lien reste visible). */
  facilitator: FacilitatorView | null;
  /** Absente si l'appelant n'a pas la permission « Commissions » : on ne laisse même pas voir qu'il y en a une. */
  commission?: CommissionView | null;
}

/** Modèle de lecture exposé par l'Application (pas l'entité). */
export interface CompanyView {
  id: string;
  name: string;
  status: string;
  ownerUserId: string | null;
  sector: string | null;
  country: string | null;
  email: string | null;
  phone: string | null;
  createdAt: string;
  /** Numéro de version (verrou optimiste) : à renvoyer tel quel pour modifier l'entreprise. */
  version: number;
  /** Présente seulement dans le détail d'une entreprise et dans la réponse de création. */
  facilitation?: FacilitationView | null;
}

/** Ce que l'appelant a le droit de voir dans la facilitation. */
export interface FacilitationVisibility {
  facilitator: FacilitatorView | null;
  canReadCommission: boolean;
}

/** Transforme une entreprise du domaine en représentation publique (aucun objet interne n'est exposé). */
export function toCompanyView(company: Company, facilitation?: FacilitationVisibility): CompanyView {
  const view: CompanyView = {
    id: company.id,
    name: company.name.value,
    status: company.status,
    ownerUserId: company.ownerUserId,
    sector: company.sector,
    country: company.country,
    email: company.email,
    phone: company.phone,
    createdAt: company.createdAt.toISOString(),
    version: company.version,
  };
  if (facilitation) {
    const link = company.facilitation;
    view.facilitation = link
      ? {
          facilitatorId: link.facilitatorId,
          contactMethod: link.contactMethod,
          isCompanyEmployee: link.isCompanyEmployee,
          facilitator: facilitation.facilitator,
          ...(facilitation.canReadCommission
            ? { commission: link.commission ? { type: link.commission.type, value: link.commission.value, currency: link.commission.currency } : null }
            : {}),
        }
      : null;
  }
  return view;
}
