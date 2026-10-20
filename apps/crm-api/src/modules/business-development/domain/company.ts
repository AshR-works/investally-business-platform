import { AggregateRoot, DomainError } from '../../../shared-kernel';
import { CompanyName } from './company-name';
import { CompanyStatus } from './company-status';
import { CompanyRegistered } from './events/company-registered';

export interface CompanyProps {
  id: string;
  name: CompanyName;
  status: CompanyStatus;
  sector: string | null;
  country: string | null;
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
    sector?: string | null;
    country?: string | null;
    now: Date;
  }): Company {
    const company = new Company({
      id: input.id,
      name: CompanyName.of(input.name),
      status: CompanyStatus.Target,
      sector: input.sector?.trim() || null,
      country: input.country?.trim() || null,
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

  archive(): void {
    if (this.props.status === CompanyStatus.Archived) {
      throw new DomainError('INVARIANT_VIOLATION', 'L\'entreprise est déjà archivée');
    }
    this.props.status = CompanyStatus.Archived;
  }

  get id(): string { return this.props.id; }
  get name(): CompanyName { return this.props.name; }
  get status(): CompanyStatus { return this.props.status; }
  get sector(): string | null { return this.props.sector; }
  get country(): string | null { return this.props.country; }
  get createdAt(): Date { return this.props.createdAt; }
  get version(): number { return this.props.version; }
}
