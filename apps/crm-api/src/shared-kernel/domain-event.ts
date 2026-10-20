export interface DomainEvent {
  readonly name: string;
  readonly occurredAt: Date;
  readonly aggregateType: string;
  readonly aggregateId: string;
}
