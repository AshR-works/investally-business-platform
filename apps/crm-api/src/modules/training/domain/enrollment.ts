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

/** Nature d'un payeur tiers (apprenant sans entreprise) : les trois types des agréments, plus la famille ou un proche. */
export type PayerType = 'EMPLOYER' | 'ORGANISM' | 'LANDLORD' | 'FAMILY';
export const PAYER_TYPES: readonly PayerType[] = ['EMPLOYER', 'ORGANISM', 'LANDLORD', 'FAMILY'];

/** Qui règle les frais d'un apprenant sans entreprise : lui-même, ou un tiers désigné (nom et nature). Les apprenants d'une entreprise n'en ont pas : l'agrément en tient lieu. */
export type EnrollmentPayer = { kind: 'SELF' } | { kind: 'THIRD_PARTY'; name: string; type: PayerType };

/** Valide et normalise un payeur saisi : un tiers a un nom (200 caractères au plus) et une nature connue ; « lui-même » n'a ni nom ni nature. */
export function normalizePayer(input: { kind?: string; name?: string | null; type?: string | null } | null | undefined): EnrollmentPayer {
  if (!input || (input.kind !== 'SELF' && input.kind !== 'THIRD_PARTY')) throw new DomainError('VALIDATION', "Indiquez qui règle les frais : l'apprenant lui-même ou un tiers");
  if (input.kind === 'SELF') {
    if (input.name || input.type) throw new DomainError('VALIDATION', "Quand l'apprenant règle lui-même, aucun nom ni type de payeur ne s'ajoute");
    return { kind: 'SELF' };
  }
  const name = optionalText(input.name, 'Le nom du payeur', 200);
  if (!name) throw new DomainError('VALIDATION', 'Le nom du payeur tiers est obligatoire');
  if (!PAYER_TYPES.includes(input.type as PayerType)) throw new DomainError('VALIDATION', 'La nature du payeur tiers est obligatoire (employeur, organisme, bailleur, famille ou proche)');
  return { kind: 'THIRD_PARTY', name, type: input.type as PayerType };
}

export interface EnrollmentProps {
  id: string;
  sessionId: string;
  learnerId: string;
  /** Entreprise de l'apprenant, recopiée : la portée d'une inscription est celle de son entreprise. Absente pour un étudiant ou un particulier. */
  companyId: string | null;
  /** Agrément qui couvre l'inscription ; absent pour un apprenant sans entreprise, dont le payeur est désigné. */
  approvalId: string | null;
  /** Qui règle les frais d'un apprenant sans entreprise ; absent quand un agrément couvre l'inscription. */
  payer: EnrollmentPayer | null;
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

  /**
   * Deux formes, jamais mélangées : sous l'**agrément** d'une entreprise (entreprise, agrément, aucun payeur), ou **sans entreprise** (ni entreprise ni agrément,
   * un payeur désigné et le montant dû, qui est le prix complet du certificat).
   */
  static create(input: {
    id: string; sessionId: string; learnerId: string; companyId: string | null; approvalId: string | null; payer?: EnrollmentPayer | null; chargedAmount: string | null; comment?: string | null; now: Date;
  }): Enrollment {
    const payer = input.payer ?? null;
    if (input.approvalId !== null && input.companyId !== null) {
      if (payer) throw new DomainError('VALIDATION', "Une inscription sous agrément n'a pas de payeur désigné : l'agrément en tient lieu");
    } else if (input.approvalId === null && input.companyId === null) {
      if (!payer) throw new DomainError('VALIDATION', "Indiquez qui règle les frais : l'apprenant lui-même ou un tiers");
      if (input.chargedAmount === null) throw new DomainError('INVARIANT_VIOLATION', 'Le montant dû est obligatoire pour un apprenant sans entreprise');
    } else {
      throw new DomainError('INVARIANT_VIOLATION', 'Une inscription a soit une entreprise et un agrément, soit un payeur désigné');
    }
    return new Enrollment({
      id: input.id,
      sessionId: input.sessionId,
      learnerId: input.learnerId,
      companyId: input.companyId,
      approvalId: input.approvalId,
      payer,
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
  get companyId(): string | null { return this.props.companyId; }
  get approvalId(): string | null { return this.props.approvalId; }
  /** Qui règle les frais (apprenant sans entreprise) ; absent quand un agrément couvre l'inscription. */
  get payer(): EnrollmentPayer | null { return this.props.payer; }
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
