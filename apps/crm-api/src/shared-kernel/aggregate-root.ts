import { DomainEvent } from './domain-event';

export abstract class AggregateRoot {
  private events: DomainEvent[] = [];

  /** Retient un événement de domaine à publier après l'enregistrement. */
  protected record(event: DomainEvent): void {
    this.events.push(event);
  }

  /** Retourne puis vide les événements en attente. */
  pullEvents(): DomainEvent[] {
    const pending = this.events;
    this.events = [];
    return pending;
  }
}
