/** Fait métier passé : nom, date, type et identifiant de l'agrégat concerné. */
export interface DomainEvent {
  readonly name: string;
  readonly occurredAt: Date;
  readonly aggregateType: string;
  readonly aggregateId: string;
}
