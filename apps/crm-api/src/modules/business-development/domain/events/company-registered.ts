import { DomainEvent } from '../../../../shared-kernel';

/** Événement de domaine : une entreprise vient d'être enregistrée (sera publié vers d'autres contextes plus tard). */
export class CompanyRegistered implements DomainEvent {
  readonly name = 'bd.company.registered';
  readonly aggregateType = 'Company';

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly companyName: string,
  ) {}
}
