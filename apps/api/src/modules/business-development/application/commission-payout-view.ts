import { CommissionPayout } from '../domain/commission-payout';

/** Modèle de lecture d'un versement de commission (jamais l'entité). */
export interface PayoutView {
  id: string;
  companyId: string;
  companyName: string;
  facilitatorId: string;
  facilitatorName: string;
  approvalId: string;
  /** Définition de la commission au moment où elle est devenue due (figée). */
  commissionType: string;
  commissionValue: string;
  commissionCurrency: string | null;
  /** Montant à verser ; `null` tant qu'il reste à fixer (pourcentage d'un agrément sans montant). */
  amount: string | null;
  currency: string;
  status: string;
  holdReason: string | null;
  cancelledReason: string | null;
  paidOn: string | null;
  createdAt: string;
  /** Verrou optimiste : à renvoyer tel quel pour débloquer, mettre en attente, verser, annuler ou fixer le montant. */
  version: number;
}

export function toPayoutView(payout: CommissionPayout, context: { companyName: string; facilitatorName: string }): PayoutView {
  return {
    id: payout.id,
    companyId: payout.companyId,
    companyName: context.companyName,
    facilitatorId: payout.facilitatorId,
    facilitatorName: context.facilitatorName,
    approvalId: payout.approvalId,
    commissionType: payout.commissionType,
    commissionValue: payout.commissionValue,
    commissionCurrency: payout.commissionCurrency,
    amount: payout.amount,
    currency: payout.currency,
    status: payout.status,
    holdReason: payout.holdReason,
    cancelledReason: payout.cancelledReason,
    paidOn: payout.paidOn,
    createdAt: payout.createdAt.toISOString(),
    version: payout.version,
  };
}
