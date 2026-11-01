import { Offer } from '../domain/offer';

/** Modèle de lecture d'une offre (jamais l'entité). */
export interface OfferView {
  id: string;
  reference: string;
  companyId: string;
  companyName: string;
  subject: string;
  amount: string;
  currency: string;
  status: string;
  note: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  withdrawnReason: string | null;
  createdAt: string;
  /** Échéance de la prochaine relance à faire (présente dans les listes seulement) ; `null` si aucune. */
  nextFollowupOn?: string | null;
  /** Verrou optimiste : à renvoyer tel quel pour modifier l'offre ou changer son état. */
  version: number;
}

export function toOfferView(offer: Offer, companyName: string): OfferView {
  return {
    id: offer.id,
    reference: offer.reference,
    companyId: offer.companyId,
    companyName,
    subject: offer.subject,
    amount: offer.amount,
    currency: offer.currency,
    status: offer.status,
    note: offer.note,
    submittedAt: offer.submittedAt?.toISOString() ?? null,
    decidedAt: offer.decidedAt?.toISOString() ?? null,
    withdrawnReason: offer.withdrawnReason,
    createdAt: offer.createdAt.toISOString(),
    version: offer.version,
  };
}
