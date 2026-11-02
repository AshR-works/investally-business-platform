import { AggregateRoot, DomainError } from '../../../shared-kernel';
import { normalizeEmail, normalizePhone } from './contact-info';

/** D'où vient l'ambassadeur : un client (personne d'une entreprise cliente) ou un apprenant d'Investudy devenu relais commercial. */
export enum AmbassadorOrigin {
  Client = 'CLIENT',
  Learner = 'LEARNER',
}

const ORIGINS: readonly string[] = Object.values(AmbassadorOrigin);

export interface AmbassadorProps {
  id: string;
  /** Le chargé de compte qui a décidé de le créer : il détermine la portée des droits (Propre, Équipe, Tous). */
  ownerUserId: string;
  lastName: string;
  firstName: string;
  origin: AmbassadorOrigin;
  /** Entreprise d'origine : obligatoire pour un client, facultative pour un apprenant. */
  companyId: string | null;
  email: string | null;
  phone: string | null;
  /** Date depuis laquelle la personne est ambassadeur, « AAAA-MM-JJ » (pas dans le futur). */
  appointedOn: string;
  note: string | null;
  createdAt: Date;
  version: number;
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Date « AAAA-MM-JJ » réelle (le 31 février n'existe pas), sinon refusée. */
function isoDate(raw: string | undefined): string {
  const text = (raw ?? '').trim();
  const m = DATE.exec(text);
  const valid = m !== null && new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!)).toISOString().slice(0, 10) === text;
  if (!valid) throw new DomainError('VALIDATION', 'La date de début doit être une date valide (AAAA-MM-JJ)');
  return text;
}

const name = (raw: string | undefined, label: string): string => {
  const value = (raw ?? '').trim().replace(/\s+/g, ' ');
  if (!value) throw new DomainError('VALIDATION', `${label} est obligatoire`);
  if (value.length > 100) throw new DomainError('VALIDATION', `${label} ne peut dépasser 100 caractères`);
  return value;
};

const originOf = (raw: string | undefined): AmbassadorOrigin => {
  if (!ORIGINS.includes(raw ?? '')) throw new DomainError('VALIDATION', "L'origine de l'ambassadeur est inconnue (client ou apprenant)");
  return raw as AmbassadorOrigin;
};

const noteOf = (raw: string | null | undefined): string | null => {
  const value = (raw ?? '').trim();
  if (value.length > 500) throw new DomainError('VALIDATION', 'La note ne peut dépasser 500 caractères');
  return value === '' ? null : value;
};

/** Un client est toujours rattaché à son entreprise ; un apprenant peut ne l'être à aucune. */
function assertCompany(origin: AmbassadorOrigin, companyId: string | null): void {
  if (origin === AmbassadorOrigin.Client && !companyId) {
    throw new DomainError('VALIDATION', "Un ambassadeur d'origine « client » est rattaché à son entreprise");
  }
}

/**
 * Ambassadeur : client ou apprenant converti en relais commercial. Il n'est **jamais créé automatiquement** : c'est une décision
 * manuelle du chargé de compte (même quand une certification le suggérera, plus tard). Sa visibilité suit celle de son
 * créateur (le chargé de compte, puis son Responsable commercial).
 */
export class Ambassador extends AggregateRoot {
  private constructor(private props: AmbassadorProps) {
    super();
  }

  static register(input: {
    id: string; ownerUserId: string; lastName: string; firstName: string; origin: string; companyId?: string | null;
    email?: string | null; phone?: string | null; appointedOn: string; note?: string | null; now: Date;
  }): Ambassador {
    if (!input.ownerUserId) throw new DomainError('VALIDATION', 'Un ambassadeur a un responsable');
    const origin = originOf(input.origin);
    const companyId = input.companyId || null;
    assertCompany(origin, companyId);
    const appointedOn = isoDate(input.appointedOn);
    if (appointedOn > input.now.toISOString().slice(0, 10)) throw new DomainError('VALIDATION', 'La date de début ne peut pas être dans le futur');
    return new Ambassador({
      id: input.id, ownerUserId: input.ownerUserId, lastName: name(input.lastName, 'Le nom'), firstName: name(input.firstName, 'Le prénom'),
      origin, companyId, email: normalizeEmail(input.email), phone: normalizePhone(input.phone, { required: false }),
      appointedOn, note: noteOf(input.note), createdAt: input.now, version: 1,
    });
  }

  /** Reconstitution depuis la persistance. */
  static rehydrate(props: AmbassadorProps): Ambassador {
    return new Ambassador(props);
  }

  /**
   * Modifie la fiche (absent = inchangé, chaîne vide = champ facultatif effacé ; `companyId: null` retire l'entreprise). Tout ou rien en
   * cas d'erreur. L'origine ne change pas : un client reste un client, un apprenant un apprenant.
   */
  update(changes: {
    lastName?: string; firstName?: string; companyId?: string | null; email?: string | null; phone?: string | null;
    appointedOn?: string; note?: string | null;
  }, now: Date): void {
    const next = { ...this.props };
    if (changes.lastName !== undefined) next.lastName = name(changes.lastName, 'Le nom');
    if (changes.firstName !== undefined) next.firstName = name(changes.firstName, 'Le prénom');
    if (changes.companyId !== undefined) next.companyId = changes.companyId || null;
    if (changes.email !== undefined) next.email = normalizeEmail(changes.email);
    if (changes.phone !== undefined) next.phone = normalizePhone(changes.phone, { required: false });
    if (changes.appointedOn !== undefined) {
      next.appointedOn = isoDate(changes.appointedOn);
      if (next.appointedOn > now.toISOString().slice(0, 10)) throw new DomainError('VALIDATION', 'La date de début ne peut pas être dans le futur');
    }
    if (changes.note !== undefined) next.note = noteOf(changes.note);
    assertCompany(next.origin, next.companyId);
    this.props = next;
  }

  get id(): string { return this.props.id; }
  get ownerUserId(): string { return this.props.ownerUserId; }
  get lastName(): string { return this.props.lastName; }
  get firstName(): string { return this.props.firstName; }
  get origin(): AmbassadorOrigin { return this.props.origin; }
  get companyId(): string | null { return this.props.companyId; }
  get email(): string | null { return this.props.email; }
  get phone(): string | null { return this.props.phone; }
  get appointedOn(): string { return this.props.appointedOn; }
  get note(): string | null { return this.props.note; }
  get createdAt(): Date { return this.props.createdAt; }
  get version(): number { return this.props.version; }
  /** Clé d'unicité de l'e-mail (déjà en minuscules). */
  get emailKey(): string | null { return this.props.email; }
}
