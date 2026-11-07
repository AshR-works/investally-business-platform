import { AggregateRoot, DomainError } from '../../../shared-kernel';
import { optionalText } from './catalogue-fields';
import { Rhythm, RHYTHMS } from './rhythms';
import { endDateFor, IsoDate, isWorkingDay, parseIsoDate } from './session-dates';

/** Planifiée → Ouverte (aux inscriptions) → Clôturée (S5.3) ; Annulée depuis Planifiée ou Ouverte. « En cours » se déduit des dates. */
export type SessionStatus = 'PLANNED' | 'OPEN' | 'CLOSED' | 'CANCELLED';
export type RhythmCode = Rhythm['code'];

export interface TrainingSessionProps {
  id: string;
  trainingId: string;
  rhythm: RhythmCode;
  startDate: IsoDate;
  endDate: IsoDate;
  roomId: string;
  trainerId: string;
  capacity: number;
  status: SessionStatus;
  cancelReason: string | null;
  createdAt: Date;
  version: number;
}

export function rhythmOf(code: string): Rhythm {
  const rhythm = RHYTHMS.find((r) => r.code === code);
  if (!rhythm) throw new DomainError('VALIDATION', 'Le rythme est inconnu (jour ou soir)');
  return rhythm;
}

function capacityOf(raw: number): number {
  if (!Number.isInteger(raw) || raw < 1 || raw > 1000) throw new DomainError('VALIDATION', 'La capacité doit être un nombre entier entre 1 et 1000');
  return raw;
}

/** Une date de début valide est un jour de cours (lundi–vendredi), pas dans le passé. */
function startOf(raw: unknown, today: IsoDate): IsoDate {
  const start = parseIsoDate(raw, 'La date de début');
  if (start < today) throw new DomainError('VALIDATION', 'La date de début ne peut pas être dans le passé');
  if (!isWorkingDay(start)) throw new DomainError('VALIDATION', 'La date de début doit être un jour de cours (du lundi au vendredi)');
  return start;
}

/**
 * Session de formation : un certificat, un rythme (durée et horaires), une salle, un formateur, une capacité. La date de début est saisie,
 * la date de fin se déduit du rythme. Les contrôles qui regardent d'autres objets (salle libre, formateur libre, capacité de la salle,
 * salle à postes pour un module pratique) sont faits par les cas d'usage. Jamais supprimée : annulée avec un motif.
 */
export class TrainingSession extends AggregateRoot {
  private constructor(private props: TrainingSessionProps) {
    super();
  }

  static create(input: {
    id: string; trainingId: string; rhythm: string; startDate: string; roomId: string; trainerId: string; capacity: number; today: IsoDate; now: Date;
  }): TrainingSession {
    const rhythm = rhythmOf(input.rhythm);
    if (!rhythm.open) throw new DomainError('INVARIANT_VIOLATION', `Le rythme « ${rhythm.label} » n'est pas encore ouvert aux nouvelles sessions`);
    const startDate = startOf(input.startDate, input.today);
    return new TrainingSession({
      id: input.id,
      trainingId: input.trainingId,
      rhythm: rhythm.code,
      startDate,
      endDate: endDateFor(startDate, rhythm),
      roomId: input.roomId,
      trainerId: input.trainerId,
      capacity: capacityOf(input.capacity),
      status: 'PLANNED',
      cancelReason: null,
      createdAt: input.now,
      version: 1,
    });
  }

  static rehydrate(props: TrainingSessionProps): TrainingSession {
    return new TrainingSession({ ...props });
  }

  /** Une session planifiée ou ouverte se modifie ; annulée ou clôturée, plus. */
  private assertEditable(): void {
    if (this.props.status === 'CANCELLED') throw new DomainError('INVARIANT_VIOLATION', 'La session est annulée : elle ne se modifie plus');
    if (this.props.status === 'CLOSED') throw new DomainError('INVARIANT_VIOLATION', 'La session est clôturée : elle ne se modifie plus');
  }

  /** Commencée : la date de début est atteinte (les dates ne changent plus, ni la salle ni le formateur). */
  hasStarted(today: IsoDate): boolean {
    return this.props.startDate <= today;
  }

  /** Modifie la salle, le formateur ou la capacité. Une session commencée ne change plus de salle ni de formateur (CU-I-22). */
  update(changes: { roomId?: string; trainerId?: string; capacity?: number }, today: IsoDate): void {
    this.assertEditable();
    const next = { ...this.props };
    if (changes.roomId !== undefined || changes.trainerId !== undefined) {
      if (this.hasStarted(today)) throw new DomainError('INVARIANT_VIOLATION', 'La session a commencé : la salle et le formateur ne changent plus');
      if (changes.roomId !== undefined) next.roomId = changes.roomId;
      if (changes.trainerId !== undefined) next.trainerId = changes.trainerId;
    }
    if (changes.capacity !== undefined) next.capacity = capacityOf(changes.capacity);
    this.props = next;
  }

  /** Reporte la session : nouvelle date de début (la fin suit le rythme), motif obligatoire. Les inscrits sont conservés (D-SESS-3 B). */
  postpone(startDate: string, reason: string, today: IsoDate): void {
    this.assertEditable();
    if (this.hasStarted(today)) throw new DomainError('INVARIANT_VIOLATION', 'La session a commencé : elle ne peut plus être reportée');
    const motive = optionalText(reason, 'Le motif', 500);
    if (!motive) throw new DomainError('VALIDATION', 'Le motif du report est obligatoire');
    const start = startOf(startDate, today);
    if (start === this.props.startDate) throw new DomainError('VALIDATION', "La nouvelle date de début est identique à l'actuelle");
    this.props = { ...this.props, startDate: start, endDate: endDateFor(start, rhythmOf(this.props.rhythm)) };
  }

  /** Ouvre les inscriptions (la salle, le formateur et la capacité sont toujours renseignés dès la création). */
  open(): void {
    if (this.props.status === 'OPEN') throw new DomainError('INVARIANT_VIOLATION', 'La session est déjà ouverte aux inscriptions');
    if (this.props.status !== 'PLANNED') throw new DomainError('INVARIANT_VIOLATION', 'Seule une session planifiée peut être ouverte');
    this.props = { ...this.props, status: 'OPEN' };
  }

  /** Annule la session, motif obligatoire. Aucune inscription n'est supprimée (elles passeront « à replacer », S5.2b). */
  cancel(reason: string): void {
    if (this.props.status === 'CANCELLED') throw new DomainError('INVARIANT_VIOLATION', 'La session est déjà annulée');
    if (this.props.status === 'CLOSED') throw new DomainError('INVARIANT_VIOLATION', "Une session clôturée ne s'annule pas");
    const motive = optionalText(reason, 'Le motif', 500);
    if (!motive) throw new DomainError('VALIDATION', "Le motif de l'annulation est obligatoire");
    this.props = { ...this.props, status: 'CANCELLED', cancelReason: motive };
  }

  get id(): string { return this.props.id; }
  get trainingId(): string { return this.props.trainingId; }
  get rhythm(): RhythmCode { return this.props.rhythm; }
  get startDate(): IsoDate { return this.props.startDate; }
  get endDate(): IsoDate { return this.props.endDate; }
  get roomId(): string { return this.props.roomId; }
  get trainerId(): string { return this.props.trainerId; }
  get capacity(): number { return this.props.capacity; }
  get status(): SessionStatus { return this.props.status; }
  get cancelReason(): string | null { return this.props.cancelReason; }
  get createdAt(): Date { return this.props.createdAt; }
  get version(): number { return this.props.version; }
}
