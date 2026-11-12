import { DomainEvent } from '../../../../shared-kernel';

/**
 * Événement de domaine : un agrément vient d'être reçu pour une opportunité (« agrément accordé », flux F1). Il est destiné au module
 * Investudy, qui ouvrira les inscriptions ; aucun consommateur n'existe encore, l'événement est seulement enregistré sur l'agrégat.
 */
export class ApprovalReceived implements DomainEvent {
  readonly name = 'bd.approval.received';
  readonly aggregateType = 'Approval';

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly companyId: string,
    readonly opportunityId: string,
  ) {}
}
