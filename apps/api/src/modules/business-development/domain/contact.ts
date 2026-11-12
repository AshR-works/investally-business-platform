import { AggregateRoot, DomainError } from '../../../shared-kernel';
import { normalizeEmail, normalizePhone } from './contact-info';

/** Fonction de l'interlocuteur dans l'entreprise (liste proposée à la direction produit, à confirmer). */
export enum ContactRole {
  FinanceDirector = 'FINANCE_DIRECTOR',
  DecisionMaker = 'DECISION_MAKER',
  Other = 'OTHER',
}

const ROLES: readonly string[] = Object.values(ContactRole);

export interface ContactProps {
  id: string;
  companyId: string;
  lastName: string;
  firstName: string;
  role: ContactRole;
  email: string | null;
  phone: string | null;
  createdAt: Date;
  version: number;
}

const name = (raw: string | undefined, label: string): string => {
  const value = (raw ?? '').trim().replace(/\s+/g, ' ');
  if (!value) throw new DomainError('VALIDATION', `${label} est obligatoire`);
  if (value.length > 100) throw new DomainError('VALIDATION', `${label} ne peut dépasser 100 caractères`);
  return value;
};

const role = (raw: string | undefined): ContactRole => {
  const value = raw ?? ContactRole.Other;
  if (!ROLES.includes(value)) throw new DomainError('VALIDATION', 'La fonction du contact est inconnue');
  return value as ContactRole;
};

/** Clé de comparaison du nom pour la détection de doublons : prénom et nom, sans casse ni espaces superflus. */
export const contactNameKey = (lastName: string, firstName: string): string => `${lastName} ${firstName}`.toLocaleLowerCase('fr');

/** Contact : interlocuteur d'une entreprise (DAF, décideur…). Sa visibilité suit celle de son entreprise. */
export class Contact extends AggregateRoot {
  private constructor(private props: ContactProps) {
    super();
  }

  static register(input: {
    id: string; companyId: string; lastName: string; firstName: string; role?: string; email?: string | null; phone?: string | null; now: Date;
  }): Contact {
    if (!input.companyId) throw new DomainError('VALIDATION', 'Un contact appartient à une entreprise');
    return new Contact({
      id: input.id,
      companyId: input.companyId,
      lastName: name(input.lastName, 'Le nom'),
      firstName: name(input.firstName, 'Le prénom'),
      role: role(input.role),
      email: normalizeEmail(input.email),
      phone: normalizePhone(input.phone, { required: false }),
      createdAt: input.now,
      version: 1,
    });
  }

  /** Reconstitution depuis la persistance. */
  static rehydrate(props: ContactProps): Contact {
    return new Contact(props);
  }

  /** Modifie les champs donnés (absent = inchangé, chaîne vide = champ facultatif effacé) ; tout ou rien en cas d'erreur. */
  update(changes: { lastName?: string; firstName?: string; role?: string; email?: string | null; phone?: string | null }): void {
    const next = { ...this.props };
    if (changes.lastName !== undefined) next.lastName = name(changes.lastName, 'Le nom');
    if (changes.firstName !== undefined) next.firstName = name(changes.firstName, 'Le prénom');
    if (changes.role !== undefined) next.role = role(changes.role);
    if (changes.email !== undefined) next.email = normalizeEmail(changes.email);
    if (changes.phone !== undefined) next.phone = normalizePhone(changes.phone, { required: false });
    this.props = next;
  }

  get id(): string { return this.props.id; }
  get companyId(): string { return this.props.companyId; }
  get lastName(): string { return this.props.lastName; }
  get firstName(): string { return this.props.firstName; }
  get role(): ContactRole { return this.props.role; }
  get email(): string | null { return this.props.email; }
  get phone(): string | null { return this.props.phone; }
  get createdAt(): Date { return this.props.createdAt; }
  get version(): number { return this.props.version; }
  get nameKey(): string { return contactNameKey(this.props.lastName, this.props.firstName); }
  get emailKey(): string | null { return this.props.email; }
}
