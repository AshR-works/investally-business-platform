import { Approval } from '../domain/approval';

/** Modèle de lecture d'un agrément (jamais l'entité). `pastValidity` est calculé à la lecture : la validité est passée mais l'agrément reste « reçu ». */
export interface ApprovalView {
  id: string;
  companyId: string;
  companyName: string;
  opportunityId: string;
  opportunityTitle: string;
  amount: string | null;
  currency: string;
  places: number | null;
  receivedOn: string;
  validUntil: string | null;
  status: string;
  closedReason: string | null;
  closedAt: string | null;
  /** Vrai si la fin de validité est passée alors que l'agrément est toujours « reçu » : l'expiration est à déclarer à la main (D3). */
  pastValidity: boolean;
  createdAt: string;
  /** Verrou optimiste : à renvoyer tel quel pour honorer, déclarer expiré ou annuler l'agrément. */
  version: number;
}

export function toApprovalView(approval: Approval, context: { companyName: string; opportunityTitle: string }, now: Date): ApprovalView {
  return {
    id: approval.id,
    companyId: approval.companyId,
    companyName: context.companyName,
    opportunityId: approval.opportunityId,
    opportunityTitle: context.opportunityTitle,
    amount: approval.amount,
    currency: approval.currency,
    places: approval.places,
    receivedOn: approval.receivedOn,
    validUntil: approval.validUntil,
    status: approval.status,
    closedReason: approval.closedReason,
    closedAt: approval.closedAt?.toISOString() ?? null,
    pastValidity: approval.isPastValidity(now.toISOString().slice(0, 10)),
    createdAt: approval.createdAt.toISOString(),
    version: approval.version,
  };
}
