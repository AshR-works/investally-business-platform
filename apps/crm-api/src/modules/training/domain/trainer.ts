import { AggregateRoot, DomainError, normalizeEmail, normalizePhone } from '../../../shared-kernel';
import { assertActive, CatalogueStatus, optionalText, requiredText } from './catalogue-fields';

export interface TrainerProps {
  id: string;
  lastName: string;
  firstName: string;
  specialties: string | null;
  email: string | null;
  phone: string | null;
  /** Compte utilisateur lié (formateur interne) : référence SANS clé étrangère. Absent = formateur externe. */
  userId: string | null;
  status: CatalogueStatus;
  createdAt: Date;
  version: number;
}

/** Formateur interne (compte lié) ou externe (sans compte). E-mail unique ; téléphone selon la règle commune. */
export class Trainer extends AggregateRoot {
  private constructor(private props: TrainerProps) {
    super();
  }

  static create(input: {
    id: string; lastName: string; firstName: string; specialties?: string | null; email?: string | null; phone?: string | null;
    userId?: string | null; now: Date;
  }): Trainer {
    return new Trainer({
      id: input.id,
      lastName: requiredText(input.lastName, 'Le nom', 100),
      firstName: requiredText(input.firstName, 'Le prénom', 100),
      specialties: optionalText(input.specialties, 'Les spécialités', 500),
      email: normalizeEmail(input.email),
      phone: normalizePhone(input.phone, { required: false }),
      userId: input.userId || null,
      status: 'ACTIVE',
      createdAt: input.now,
      version: 1,
    });
  }

  static rehydrate(props: TrainerProps): Trainer {
    return new Trainer({ ...props });
  }

  /** Champ absent = inchangé ; vide = effacé (spécialités, e-mail, téléphone) ; `userId` `null` = compte délié. */
  update(changes: { lastName?: string; firstName?: string; specialties?: string | null; email?: string | null; phone?: string | null; userId?: string | null }): void {
    assertActive(this.props.status, 'Le formateur');
    const next = { ...this.props };
    if (changes.lastName !== undefined) next.lastName = requiredText(changes.lastName, 'Le nom', 100);
    if (changes.firstName !== undefined) next.firstName = requiredText(changes.firstName, 'Le prénom', 100);
    if (changes.specialties !== undefined) next.specialties = optionalText(changes.specialties, 'Les spécialités', 500);
    if (changes.email !== undefined) next.email = normalizeEmail(changes.email);
    if (changes.phone !== undefined) next.phone = normalizePhone(changes.phone, { required: false });
    if (changes.userId !== undefined) next.userId = changes.userId || null;
    this.props = next;
  }

  archive(): void {
    if (this.props.status === 'ARCHIVED') throw new DomainError('INVARIANT_VIOLATION', 'Le formateur est déjà désactivé');
    this.props = { ...this.props, status: 'ARCHIVED' };
  }

  reactivate(): void {
    if (this.props.status === 'ACTIVE') throw new DomainError('INVARIANT_VIOLATION', 'Le formateur est déjà actif');
    this.props = { ...this.props, status: 'ACTIVE' };
  }

  get id(): string { return this.props.id; }
  get lastName(): string { return this.props.lastName; }
  get firstName(): string { return this.props.firstName; }
  get specialties(): string | null { return this.props.specialties; }
  get email(): string | null { return this.props.email; }
  get phone(): string | null { return this.props.phone; }
  get userId(): string | null { return this.props.userId; }
  get status(): CatalogueStatus { return this.props.status; }
  get createdAt(): Date { return this.props.createdAt; }
  get version(): number { return this.props.version; }
}
