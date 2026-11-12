import { AggregateRoot, DomainError } from '../../../shared-kernel';
import { assertActive, CatalogueStatus, keyOf, optionalText, requiredText } from './catalogue-fields';

export interface ProgramProps {
  id: string;
  name: string;
  description: string | null;
  audience: string | null;
  status: CatalogueStatus;
  createdAt: Date;
  version: number;
}

/** Programme : regroupement de formations (référentiel partagé, sans propriétaire). Archivé, jamais supprimé. */
export class Program extends AggregateRoot {
  private constructor(private props: ProgramProps) {
    super();
  }

  static create(input: { id: string; name: string; description?: string | null; audience?: string | null; now: Date }): Program {
    return new Program({
      id: input.id,
      name: requiredText(input.name, 'Le nom du programme', 150),
      description: optionalText(input.description, 'La description', 2000),
      audience: optionalText(input.audience, 'Le public visé', 500),
      status: 'ACTIVE',
      createdAt: input.now,
      version: 1,
    });
  }

  static rehydrate(props: ProgramProps): Program {
    return new Program({ ...props });
  }

  /** Champ absent = inchangé ; texte vide = effacé (description, public visé). */
  update(changes: { name?: string; description?: string | null; audience?: string | null }): void {
    assertActive(this.props.status, 'Le programme');
    const next = { ...this.props };
    if (changes.name !== undefined) next.name = requiredText(changes.name, 'Le nom du programme', 150);
    if (changes.description !== undefined) next.description = optionalText(changes.description, 'La description', 2000);
    if (changes.audience !== undefined) next.audience = optionalText(changes.audience, 'Le public visé', 500);
    this.props = next;
  }

  archive(): void {
    if (this.props.status === 'ARCHIVED') throw new DomainError('INVARIANT_VIOLATION', 'Le programme est déjà archivé');
    this.props = { ...this.props, status: 'ARCHIVED' };
  }

  reactivate(): void {
    if (this.props.status === 'ACTIVE') throw new DomainError('INVARIANT_VIOLATION', 'Le programme est déjà actif');
    this.props = { ...this.props, status: 'ACTIVE' };
  }

  get id(): string { return this.props.id; }
  get name(): string { return this.props.name; }
  get nameKey(): string { return keyOf(this.props.name); }
  get description(): string | null { return this.props.description; }
  get audience(): string | null { return this.props.audience; }
  get status(): CatalogueStatus { return this.props.status; }
  get createdAt(): Date { return this.props.createdAt; }
  get version(): number { return this.props.version; }
}
