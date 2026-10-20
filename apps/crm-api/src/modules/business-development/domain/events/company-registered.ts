import { DomainEvent } from '../../../../shared-kernel';

export class CompanyRegistered implements DomainEvent {
  readonly name = 'bd.company.registered';
  readonly aggregateType = 'Company';

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
    readonly companyName: string,
  ) {}
}
