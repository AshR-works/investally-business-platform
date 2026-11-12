import { Receipt } from '../domain/receipt';

/** Modèle de lecture d'une décharge (jamais l'entité). */
export interface ReceiptView {
  id: string;
  offerId: string;
  offerReference: string;
  receivedOn: string;
  receivedBy: string;
  status: string;
  cancelledReason: string | null;
  cancelledAt: string | null;
  createdAt: string;
  /** Verrou optimiste : à renvoyer tel quel pour annuler la décharge. */
  version: number;
}

export function toReceiptView(receipt: Receipt, offerReference: string): ReceiptView {
  return {
    id: receipt.id,
    offerId: receipt.offerId,
    offerReference,
    receivedOn: receipt.receivedOn,
    receivedBy: receipt.receivedBy,
    status: receipt.status,
    cancelledReason: receipt.cancelledReason,
    cancelledAt: receipt.cancelledAt?.toISOString() ?? null,
    createdAt: receipt.createdAt.toISOString(),
    version: receipt.version,
  };
}
