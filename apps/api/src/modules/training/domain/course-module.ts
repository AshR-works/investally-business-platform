import { AggregateRoot, DomainError } from '../../../shared-kernel';
import { assertActive, CatalogueStatus, keyOf, optionalText, requiredText } from './catalogue-fields';

export interface CourseModuleProps {
  id: string;
  title: string;
  description: string | null;
  /** Pratique sur poste de travail : ce module ne se donne pas dans une salle de cours. */
  requiresWorkstations: boolean;
  status: CatalogueStatus;
  createdAt: Date;
  version: number;
}

/** Module : chapitre partagé entre plusieurs certificats (titre unique). Ni durée ni prix : ils viennent du certificat et du rythme de la session. */
export class CourseModule extends AggregateRoot {
  private constructor(private props: CourseModuleProps) {
    super();
  }

  static create(input: { id: string; title: string; description?: string | null; requiresWorkstations?: boolean; now: Date }): CourseModule {
    return new CourseModule({
      id: input.id,
      title: requiredText(input.title, 'Le titre du module', 150),
      description: optionalText(input.description, 'La description', 1000),
      requiresWorkstations: input.requiresWorkstations ?? false,
      status: 'ACTIVE',
      createdAt: input.now,
      version: 1,
    });
  }

  static rehydrate(props: CourseModuleProps): CourseModule {
    return new CourseModule({ ...props });
  }

  update(changes: { title?: string; description?: string | null; requiresWorkstations?: boolean }): void {
    assertActive(this.props.status, 'Le module');
    const next = { ...this.props };
    if (changes.title !== undefined) next.title = requiredText(changes.title, 'Le titre du module', 150);
    if (changes.description !== undefined) next.description = optionalText(changes.description, 'La description', 1000);
    if (changes.requiresWorkstations !== undefined) next.requiresWorkstations = changes.requiresWorkstations;
    this.props = next;
  }

  archive(): void {
    if (this.props.status === 'ARCHIVED') throw new DomainError('INVARIANT_VIOLATION', 'Le module est déjà archivé');
    this.props = { ...this.props, status: 'ARCHIVED' };
  }

  reactivate(): void {
    if (this.props.status === 'ACTIVE') throw new DomainError('INVARIANT_VIOLATION', 'Le module est déjà actif');
    this.props = { ...this.props, status: 'ACTIVE' };
  }

  get id(): string { return this.props.id; }
  get title(): string { return this.props.title; }
  get titleKey(): string { return keyOf(this.props.title); }
  get description(): string | null { return this.props.description; }
  get requiresWorkstations(): boolean { return this.props.requiresWorkstations; }
  get status(): CatalogueStatus { return this.props.status; }
  get createdAt(): Date { return this.props.createdAt; }
  get version(): number { return this.props.version; }
}
