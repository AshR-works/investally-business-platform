import { AggregateRoot, DomainError } from '../../../shared-kernel';
import { normalizePhone } from './contact-info';

export interface FacilitatorProps {
  id: string;
  lastName: string;
  firstName: string;
  phone: string;
  comment: string | null;
  /** Créateur : détermine la portée des droits (Propre, Équipe, Tous). */
  ownerUserId: string;
  createdAt: Date;
  version: number;
}

const required = (raw: string | undefined, label: string): string => {
  const value = (raw ?? '').trim().replace(/\s+/g, ' ');
  if (!value) throw new DomainError('VALIDATION', `${label} est obligatoire`);
  if (value.length > 100) throw new DomainError('VALIDATION', `${label} ne peut dépasser 100 caractères`);
  return value;
};

/** Facilitateur : personne qui met en relation avec une entreprise (parfois un employé de celle-ci). Réutilisable. */
export class Facilitator extends AggregateRoot {
  private constructor(private readonly props: FacilitatorProps) {
    super();
  }

  static register(input: {
    id: string; lastName: string; firstName: string; phone: string; comment?: string | null; ownerUserId: string; now: Date;
  }): Facilitator {
    if (!input.ownerUserId) throw new DomainError('VALIDATION', 'Un facilitateur doit avoir un propriétaire');
    const comment = (input.comment ?? '').trim();
    if (comment.length > 2000) throw new DomainError('VALIDATION', 'Le commentaire ne peut dépasser 2000 caractères');
    return new Facilitator({
      id: input.id,
      lastName: required(input.lastName, 'Le nom'),
      firstName: required(input.firstName, 'Le prénom'),
      phone: normalizePhone(input.phone, { required: true })!,
      comment: comment || null,
      ownerUserId: input.ownerUserId,
      createdAt: input.now,
      version: 1,
    });
  }

  /** Reconstitution depuis la persistance. */
  static rehydrate(props: FacilitatorProps): Facilitator {
    return new Facilitator(props);
  }

  get id(): string { return this.props.id; }
  get lastName(): string { return this.props.lastName; }
  get firstName(): string { return this.props.firstName; }
  get phone(): string { return this.props.phone; }
  get comment(): string | null { return this.props.comment; }
  get ownerUserId(): string { return this.props.ownerUserId; }
  get createdAt(): Date { return this.props.createdAt; }
  get version(): number { return this.props.version; }
}
