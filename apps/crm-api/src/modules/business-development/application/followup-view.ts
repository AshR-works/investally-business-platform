import { Followup } from '../domain/followup';

/** Modèle de lecture d'une relance (jamais l'entité). `overdue` est calculé à la lecture, jamais stocké. */
export interface FollowupView {
  id: string;
  offerId: string;
  offerReference: string;
  companyId: string;
  companyName: string;
  dueOn: string;
  channel: string;
  note: string | null;
  status: string;
  resultNote: string | null;
  closedAt: string | null;
  overdue: boolean;
  createdAt: string;
  /** Verrou optimiste : à renvoyer tel quel pour modifier, terminer ou annuler la relance. */
  version: number;
}

export function toFollowupView(followup: Followup, context: { offerReference: string; companyId: string; companyName: string }, now: Date): FollowupView {
  return {
    id: followup.id,
    offerId: followup.offerId,
    offerReference: context.offerReference,
    companyId: context.companyId,
    companyName: context.companyName,
    dueOn: followup.dueOn,
    channel: followup.channel,
    note: followup.note,
    status: followup.status,
    resultNote: followup.resultNote,
    closedAt: followup.closedAt?.toISOString() ?? null,
    overdue: followup.isOverdue(now),
    createdAt: followup.createdAt.toISOString(),
    version: followup.version,
  };
}
