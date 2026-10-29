import { AggregateRoot, DomainError } from '../../../shared-kernel';
import { CompanyName } from './company-name';
import { CompanyStatus } from './company-status';
import { normalizeEmail, normalizePhone } from './contact-info';
import { Facilitation } from './facilitation';
import { CompanyRegistered } from './events/company-registered';

/** État interne d'une entreprise (identité, nom, statut, propriétaire, horodatages). */
export interface CompanyProps {
  id: string;
  name: CompanyName;
  status: CompanyStatus;
  /** Propriétaire : détermine la portée des droits (Propre, Équipe, Tous). Absent pour les entreprises antérieures à S3.3. */
  ownerUserId: string | null;
  sector: string | null;
  country: string | null;
  email: string | null;
  phone: string | null;
  /** Facilitateur par qui l'entreprise a été approchée (au plus un). */
  facilitation: Facilitation | null;
  createdAt: Date;
  version: number;
}

/** Entreprise cible : racine d'agrégat du pipeline commercial. */
export class Company extends AggregateRoot {
  private constructor(private props: CompanyProps) {
    super();
  }

  static register(input: {
    id: string;
    name: string;
    ownerUserId: string;
    sector?: string | null;
    country?: string | null;
    email?: string | null;
    phone?: string | null;
    facilitation?: Facilitation | null;
    now: Date;
  }): Company {
    if (!input.ownerUserId) throw new DomainError('VALIDATION', "Une entreprise doit avoir un propriétaire");
    const company = new Company({
      id: input.id,
      name: CompanyName.of(input.name),
      status: CompanyStatus.Target,
      ownerUserId: input.ownerUserId,
      sector: input.sector?.trim() || null,
      country: input.country?.trim() || null,
      email: normalizeEmail(input.email),
      phone: normalizePhone(input.phone, { required: false }),
      facilitation: input.facilitation ?? null,
      createdAt: input.now,
      version: 1,
    });
    company.record(new CompanyRegistered(input.id, input.now, company.props.name.value));
    return company;
  }

  /** Reconstitution depuis la persistance : aucun événement émis. */
  static rehydrate(props: CompanyProps): Company {
    return new Company(props);
  }

  /**
   * Modifie les informations de la fiche. Un champ absent (`undefined`) reste inchangé ; une chaîne vide efface un champ
   * facultatif ; `facilitation: null` retire le lien avec le facilitateur. Une entreprise archivée ne se modifie plus.
   */
  update(changes: {
    name?: string;
    sector?: string | null;
    country?: string | null;
    email?: string | null;
    phone?: string | null;
    facilitation?: Facilitation | null;
  }): void {
    if (this.props.status === CompanyStatus.Archived) {
      throw new DomainError('INVARIANT_VIOLATION', "L'entreprise est archivée : elle n'est plus modifiable");
    }
    const next = { ...this.props };
    if (changes.name !== undefined) next.name = CompanyName.of(changes.name);
    if (changes.sector !== undefined) next.sector = changes.sector?.trim() || null;
    if (changes.country !== undefined) next.country = changes.country?.trim() || null;
    if (changes.email !== undefined) next.email = normalizeEmail(changes.email);
    if (changes.phone !== undefined) next.phone = normalizePhone(changes.phone, { required: false });
    if (changes.facilitation !== undefined) next.facilitation = changes.facilitation;
    this.props = next; // tout ou rien : une validation qui échoue ne laisse aucune modification partielle
  }

  /** Archive l'entreprise ; refuse de l'archiver deux fois (règle métier). */
  archive(): void {
    if (this.props.status === CompanyStatus.Archived) {
      throw new DomainError('INVARIANT_VIOLATION', 'L\'entreprise est déjà archivée');
    }
    this.props.status = CompanyStatus.Archived;
  }

  get id(): string { return this.props.id; }
  get name(): CompanyName { return this.props.name; }
  get status(): CompanyStatus { return this.props.status; }
  get ownerUserId(): string | null { return this.props.ownerUserId; }
  get sector(): string | null { return this.props.sector; }
  get country(): string | null { return this.props.country; }
  get email(): string | null { return this.props.email; }
  get phone(): string | null { return this.props.phone; }
  get facilitation(): Facilitation | null { return this.props.facilitation; }
  get createdAt(): Date { return this.props.createdAt; }
  get version(): number { return this.props.version; }
}
