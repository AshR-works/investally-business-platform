import { AggregateRoot, DomainError } from '../../../shared-kernel';
import { assertActive, CatalogueStatus, keyOf, optionalText, requiredText } from './catalogue-fields';

/** Salle avec postes de travail (salle de marchés) ou salle de cours (places assises, cours magistral). */
export type RoomKind = 'WORKSTATIONS' | 'CLASSROOM';

export interface RoomProps {
  id: string;
  name: string;
  kind: RoomKind;
  /** Postes (ou places) apprenants installés. */
  learnerSeats: number;
  /** Postes (ou places) hors service (panne) : ils ne comptent pas dans la capacité utile. */
  unavailableSeats: number;
  /** Postes formateur. */
  trainerSeats: number;
  equipment: string | null;
  status: CatalogueStatus;
  createdAt: Date;
  version: number;
}

const wholeBetween = (raw: number, min: number, max: number, message: string): number => {
  if (!Number.isInteger(raw) || raw < min || raw > max) throw new DomainError('VALIDATION', message);
  return raw;
};
const learnerSeatsOf = (raw: number) => wholeBetween(raw, 1, 1000, 'Les postes apprenants doivent être un nombre entier entre 1 et 1000');
const trainerSeatsOf = (raw: number) => wholeBetween(raw, 0, 10, 'Les postes formateur doivent être un nombre entier entre 0 et 10');

function unavailableOf(raw: number, learnerSeats: number): number {
  const value = wholeBetween(raw, 0, 1000, 'Les postes hors service doivent être un nombre entier positif ou nul');
  if (value > learnerSeats) throw new DomainError('VALIDATION', 'Les postes hors service ne peuvent pas dépasser les postes apprenants');
  return value;
}

/**
 * Salle de formation : nom unique, postes apprenants (dont certains peuvent être en panne), postes formateur, équipements. La capacité
 * utile (postes apprenants − postes hors service) limitera les inscriptions. Désactivée, jamais supprimée.
 */
export class Room extends AggregateRoot {
  private constructor(private props: RoomProps) {
    super();
  }

  static create(input: {
    id: string; name: string; kind?: RoomKind; learnerSeats: number; unavailableSeats?: number; trainerSeats?: number; equipment?: string | null; now: Date;
  }): Room {
    const learnerSeats = learnerSeatsOf(input.learnerSeats);
    return new Room({
      id: input.id,
      name: requiredText(input.name, 'Le nom de la salle', 100),
      kind: input.kind ?? 'WORKSTATIONS',
      learnerSeats,
      unavailableSeats: unavailableOf(input.unavailableSeats ?? 0, learnerSeats),
      trainerSeats: trainerSeatsOf(input.trainerSeats ?? 1),
      equipment: optionalText(input.equipment, 'Les équipements', 1000),
      status: 'ACTIVE',
      createdAt: input.now,
      version: 1,
    });
  }

  static rehydrate(props: RoomProps): Room {
    return new Room({ ...props });
  }

  update(changes: { name?: string; kind?: RoomKind; learnerSeats?: number; unavailableSeats?: number; trainerSeats?: number; equipment?: string | null }): void {
    assertActive(this.props.status, 'La salle');
    const next = { ...this.props };
    if (changes.name !== undefined) next.name = requiredText(changes.name, 'Le nom de la salle', 100);
    if (changes.kind !== undefined) next.kind = changes.kind;
    if (changes.learnerSeats !== undefined) next.learnerSeats = learnerSeatsOf(changes.learnerSeats);
    if (changes.unavailableSeats !== undefined) next.unavailableSeats = changes.unavailableSeats;
    if (changes.trainerSeats !== undefined) next.trainerSeats = trainerSeatsOf(changes.trainerSeats);
    next.unavailableSeats = unavailableOf(next.unavailableSeats, next.learnerSeats);
    if (changes.equipment !== undefined) next.equipment = optionalText(changes.equipment, 'Les équipements', 1000);
    this.props = next;
  }

  /** Désactive la salle : elle n'est plus proposée pour de nouvelles sessions. */
  archive(): void {
    if (this.props.status === 'ARCHIVED') throw new DomainError('INVARIANT_VIOLATION', 'La salle est déjà désactivée');
    this.props = { ...this.props, status: 'ARCHIVED' };
  }

  reactivate(): void {
    if (this.props.status === 'ACTIVE') throw new DomainError('INVARIANT_VIOLATION', 'La salle est déjà active');
    this.props = { ...this.props, status: 'ACTIVE' };
  }

  get id(): string { return this.props.id; }
  get name(): string { return this.props.name; }
  get nameKey(): string { return keyOf(this.props.name); }
  get kind(): RoomKind { return this.props.kind; }
  get learnerSeats(): number { return this.props.learnerSeats; }
  get unavailableSeats(): number { return this.props.unavailableSeats; }
  get trainerSeats(): number { return this.props.trainerSeats; }
  /** Places réellement utilisables par les apprenants. */
  get usableSeats(): number { return this.props.learnerSeats - this.props.unavailableSeats; }
  get equipment(): string | null { return this.props.equipment; }
  get status(): CatalogueStatus { return this.props.status; }
  get createdAt(): Date { return this.props.createdAt; }
  get version(): number { return this.props.version; }
}
