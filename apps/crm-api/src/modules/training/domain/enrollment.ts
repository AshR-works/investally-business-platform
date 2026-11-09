import { AggregateRoot, DomainError } from '../../../shared-kernel';
import { optionalText } from './catalogue-fields';

/**
 * En attente de confirmation → Confirmée (par le Responsable Investudy) ; Annulée (motif) ; À replacer (la session est annulée).
 * Une inscription en attente ou confirmée occupe une place de la session et consomme l'agrément (D-INS-3 A, D-INS-2 A).
 */
export type EnrollmentStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'TO_REPLACE';

/** États qui occupent une place et consomment l'agrément. */
export const SEAT_STATUSES: readonly EnrollmentStatus[] = ['PENDING', 'CONFIRMED'];
/** États « vivants » : l'apprenant est encore rattaché à la session (une seule inscription vivante par session et par apprenant). */
export const LIVE_STATUSES: readonly EnrollmentStatus[] = ['PENDING', 'CONFIRMED', 'TO_REPLACE'];

export interface EnrollmentProps {
  id: string;
  sessionId: string;
  learnerId: string;
  /** Entreprise de l'apprenant, recopiée : la portée d'une inscription est celle de son entreprise. */
  companyId: string;
  approvalId: string;
  /** Prix complet du certificat au moment de l'inscription (texte décimal), quand l'agrément couvre une somme ; sinon absent. */
  chargedAmount: string | null;
  status: EnrollmentStatus;
  comment: string | null;
  cancelReason: string | null;
  confirmedAt: Date | null;
  /** Inscription qui a pris la suite de celle-ci (replacement sur une autre session). */
  replacedById: string | null;
  createdAt: Date;
  version: number;
}

export class Enrollment extends AggregateRoot {
  private constructor(private props: EnrollmentProps) {
    super();
  }

  static create(input: { id: string; sessionId: string; learnerId: string; companyId: string; approvalId: string; chargedAmount: string | null; comment?: string | null; now: Date }): Enrollment {
    return new Enrollment({
      id: input.id,
      sessionId: input.sessionId,
      learnerId: input.learnerId,
      companyId: input.companyId,
      approvalId: input.approvalId,
      chargedAmount: input.chargedAmount,
      status: 'PENDING',
      comment: optionalText(input.comment, 'Le commentaire', 500),
      cancelReason: null,
      confirmedAt: null,
      replacedById: null,
      createdAt: input.now,
      version: 1,
    });
  }

  static rehydrate(props: EnrollmentProps): Enrollment {
    return new Enrollment({ ...props });
  }

  /** Confirmation par le Responsable Investudy : seule une inscription en attente se confirme. */
  confirm(now: Date): void {
    if (this.props.status === 'CONFIRMED') throw new DomainError('INVARIANT_VIOLATION', "L'inscription est déjà confirmée");
    if (this.props.status !== 'PENDING') throw new DomainError('INVARIANT_VIOLATION', `Seule une inscription en attente se confirme (celle-ci est ${this.props.status === 'CANCELLED' ? 'annulée' : 'à replacer'})`);
    this.props = { ...this.props, status: 'CONFIRMED', confirmedAt: now };
  }

  /** Annulation motivée : libère la place et l'agrément. `replacedById` : l'inscription qui prend la suite (replacement). */
  cancel(reason: string, replacedById: string | null = null): void {
    if (this.props.status === 'CANCELLED') throw new DomainError('INVARIANT_VIOLATION', "L'inscription est déjà annulée");
    const motive = optionalText(reason, 'Le motif', 500);
    if (!motive) throw new DomainError('VALIDATION', "Le motif de l'annulation est obligatoire");
    this.props = { ...this.props, status: 'CANCELLED', cancelReason: motive, replacedById, confirmedAt: null };
  }

  /** Après un replacement : lie l'inscription annulée à celle qui a pris sa suite. */
  linkReplacement(replacedById: string): void {
    if (this.props.status !== 'CANCELLED') throw new DomainError('INVARIANT_VIOLATION', "Seule une inscription annulée peut être liée à son remplacement");
    this.props = { ...this.props, replacedById };
  }

  /** La session est annulée : l'inscription (en attente ou confirmée) reste, à replacer sur une autre session. */
  markToReplace(): void {
    if (!SEAT_STATUSES.includes(this.props.status)) throw new DomainError('INVARIANT_VIOLATION', "Seule une inscription en attente ou confirmée peut être mise « à replacer »");
    this.props = { ...this.props, status: 'TO_REPLACE', confirmedAt: null };
  }

  get id(): string { return this.props.id; }
  get sessionId(): string { return this.props.sessionId; }
  get learnerId(): string { return this.props.learnerId; }
  get companyId(): string { return this.props.companyId; }
  get approvalId(): string { return this.props.approvalId; }
  get chargedAmount(): string | null { return this.props.chargedAmount; }
  get status(): EnrollmentStatus { return this.props.status; }
  get comment(): string | null { return this.props.comment; }
  get cancelReason(): string | null { return this.props.cancelReason; }
  get confirmedAt(): Date | null { return this.props.confirmedAt; }
  get replacedById(): string | null { return this.props.replacedById; }
  get createdAt(): Date { return this.props.createdAt; }
  get version(): number { return this.props.version; }
  /** Occupe une place de la session et consomme l'agrément. */
  get occupiesSeat(): boolean { return SEAT_STATUSES.includes(this.props.status); }
}
