import { AggregateRoot, DomainError, normalizeEmail, normalizePhone } from '../../../shared-kernel';
import { keyOf, requiredText } from './catalogue-fields';

/**
 * Nature d'un apprenant (Lot B) : rattaché à une entreprise (cas général), ou **étudiant** / **particulier**, sans entreprise ni contact.
 * Les apprenants n'ont pas accès à la plateforme : ce sont des fiches saisies par les employés.
 */
export type LearnerKind = 'COMPANY' | 'STUDENT' | 'INDIVIDUAL';
export const LEARNER_KINDS: readonly LearnerKind[] = ['COMPANY', 'STUDENT', 'INDIVIDUAL'];

export interface LearnerProps {
  id: string;
  kind: LearnerKind;
  /** Absente pour un étudiant ou un particulier. */
  companyId: string | null;
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
 * facultatif), ou, sans entreprise, un étudiant ou un particulier qui règle lui-même ou dont un tiers règle les frais (Lot B). La nature d'un
 * apprenant et son entreprise ne changent pas. Supprimé logiquement, jamais effacé.
 */
export class Learner extends AggregateRoot {
  private constructor(private props: LearnerProps) {
    super();
  }

  static create(input: {
    id: string; kind?: LearnerKind; companyId?: string | null; lastName: string; firstName: string; email?: string | null; phone?: string | null; contactId?: string | null; now: Date;
  }): Learner {
    const kind = input.kind ?? 'COMPANY';
    if (!LEARNER_KINDS.includes(kind)) throw new DomainError('VALIDATION', "La nature de l'apprenant est inconnue");
    if (kind === 'COMPANY' && !input.companyId) throw new DomainError('VALIDATION', "L'entreprise de l'apprenant est obligatoire");
    if (kind !== 'COMPANY' && input.companyId) throw new DomainError('VALIDATION', "Un étudiant ou un particulier n'a pas d'entreprise");
    if (kind !== 'COMPANY' && input.contactId) throw new DomainError('VALIDATION', "Un étudiant ou un particulier n'a pas de contact d'entreprise");
    return new Learner({
      id: input.id,
      kind,
      companyId: kind === 'COMPANY' ? input.companyId! : null,
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
    if (changes.contactId !== undefined) {
      if (changes.contactId && this.props.kind !== 'COMPANY') throw new DomainError('VALIDATION', "Un étudiant ou un particulier n'a pas de contact d'entreprise");
      next.contactId = changes.contactId || null;
    }
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
  get kind(): LearnerKind { return this.props.kind; }
  /** Étudiant ou particulier : sans entreprise, donc sans agrément ; un payeur est désigné à chaque inscription. */
  get isIndividual(): boolean { return this.props.kind !== 'COMPANY'; }
  get companyId(): string | null { return this.props.companyId; }
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
