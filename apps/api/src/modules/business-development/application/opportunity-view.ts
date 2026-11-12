import { Opportunity } from '../domain/opportunity';

/** Modèle de lecture d'une opportunité (jamais l'entité). */
export interface OpportunityView {
  id: string;
  companyId: string;
  companyName: string;
  title: string;
  amount: string;
  currency: string;
  source: string;
  stage: string;
  /** Étape suivante, `null` à la dernière ou si l'opportunité est clôturée. */
  nextStage: string | null;
  status: string;
  lossReason: string | null;
  closingNote: string | null;
  closedAt: string | null;
  waiverReason: string | null;
  waivedAt: string | null;
  stageChangedAt: string;
  /** Dernière modification de l'opportunité. */
  lastActivityAt: string;
  createdAt: string;
  /** Verrou optimiste : à renvoyer tel quel pour modifier, avancer, déroger ou clore l'opportunité. */
  version: number;
}

export function toOpportunityView(opportunity: Opportunity, companyName: string): OpportunityView {
  return {
    id: opportunity.id,
    companyId: opportunity.companyId,
    companyName,
    title: opportunity.title,
    amount: opportunity.amount,
    currency: opportunity.currency,
    source: opportunity.source,
    stage: opportunity.stage,
    nextStage: opportunity.isOpen ? opportunity.nextStage : null,
    status: opportunity.status,
    lossReason: opportunity.lossReason,
    closingNote: opportunity.closingNote,
    closedAt: opportunity.closedAt?.toISOString() ?? null,
    waiverReason: opportunity.waiverReason,
    waivedAt: opportunity.waivedAt?.toISOString() ?? null,
    stageChangedAt: opportunity.stageChangedAt.toISOString(),
    lastActivityAt: opportunity.updatedAt.toISOString(),
    createdAt: opportunity.createdAt.toISOString(),
    version: opportunity.version,
  };
}
