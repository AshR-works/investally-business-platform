import { AggregateRoot, DomainError, normalizeEmail, normalizePhone } from '../../../shared-kernel';
import { keyOf, requiredText } from './catalogue-fields';

export interface LearnerProps {
  id: string;
  companyId: string;
  /** Contact de la même entreprise auquel l'apprenant correspond (facultatif : un apprenant n'est pas forcément un contact). */
  contactId: string | null;
  lastName: string;
  firstName: string;
  email: string | null;
  phone: string | null;
  /** Suppression logique : l'apprenant disparaît des listes, ses inscriptions passées restent lisibles. */
  deletedAt: Date | null;
  createdAt: Date;
  version: number;
}

/**
 * Apprenant : une personne inscrite à une formation pour le compte d'une entreprise (D47, D-SESS-4 B : distinct d'un contact, avec un lien
 * facultatif). L'entreprise d'un apprenant ne change pas. Supprimé logiquement, jamais effacé.
 */
export class Learner extends AggregateRoot {
  private constructor(private props: LearnerProps) {
    super();
  }

  static create(input: {
    id: string; companyId: string; lastName: string; firstName: string; email?: string | null; phone?: string | null; contactId?: string | null; now: Date;
  }): Learner {
    return new Learner({
      id: input.id,
      companyId: input.companyId,
      contactId: input.contactId || null,
      lastName: requiredText(input.lastName, 'Le nom', 100),
      firstName: requiredText(input.firstName, 'Le prénom', 100),
      email: normalizeEmail(input.email),
      phone: normalizePhone(input.phone, { required: false }),
      deletedAt: null,
      createdAt: input.now,
      version: 1,
    });
  }

  static rehydrate(props: LearnerProps): Learner {
    return new Learner({ ...props });
  }

  /** Champ absent = inchangé ; vide = effacé (e-mail, téléphone) ; `contactId` `null` = lien retiré. */
  update(changes: { lastName?: string; firstName?: string; email?: string | null; phone?: string | null; contactId?: string | null }): void {
    this.assertLive();
    const next = { ...this.props };
    if (changes.lastName !== undefined) next.lastName = requiredText(changes.lastName, 'Le nom', 100);
    if (changes.firstName !== undefined) next.firstName = requiredText(changes.firstName, 'Le prénom', 100);
    if (changes.email !== undefined) next.email = normalizeEmail(changes.email);
    if (changes.phone !== undefined) next.phone = normalizePhone(changes.phone, { required: false });
    if (changes.contactId !== undefined) next.contactId = changes.contactId || null;
    this.props = next;
  }

  markDeleted(now: Date): void {
    this.assertLive();
    this.props = { ...this.props, deletedAt: now };
  }

  private assertLive(): void {
    if (this.props.deletedAt) throw new DomainError('INVARIANT_VIOLATION', "L'apprenant est supprimé : il ne se modifie plus");
  }

  get id(): string { return this.props.id; }
  get companyId(): string { return this.props.companyId; }
  get contactId(): string | null { return this.props.contactId; }
  get lastName(): string { return this.props.lastName; }
  get firstName(): string { return this.props.firstName; }
  get fullName(): string { return `${this.props.firstName} ${this.props.lastName}`; }
  /** Nom normalisé (sans casse) pour détecter un doublon probable dans l'entreprise. */
  get nameKey(): string { return keyOf(`${this.props.firstName} ${this.props.lastName}`); }
  get email(): string | null { return this.props.email; }
  get emailKey(): string | null { return this.props.email; }
  get phone(): string | null { return this.props.phone; }
  get deleted(): boolean { return this.props.deletedAt !== null; }
  get deletedAt(): Date | null { return this.props.deletedAt; }
  get createdAt(): Date { return this.props.createdAt; }
  get version(): number { return this.props.version; }
}
