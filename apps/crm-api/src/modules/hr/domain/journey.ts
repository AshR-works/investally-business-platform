import { AggregateRoot, DomainError } from '../../../shared-kernel';
import { isIsoDate } from './leave-calendar';

/**
 * Parcours d'intégration et de départ (RH-3b, D67). Un **modèle** par nature (modifiable par la RH) donne la liste des tâches : titre court, responsable (liste fermée,
 * une étiquette et non un droit d'accès) et échéance **relative** à une date de référence. Un parcours est **lancé à la main** pour un employé : les tâches sont alors
 * **copiées** (modifier le modèle ne change pas les parcours en cours). Chaque tâche cochée garde sa **date et son auteur**. Aucune donnée sensible.
 */
export const JOURNEY_KINDS = ['ONBOARDING', 'OFFBOARDING'] as const;
export type JourneyKind = (typeof JOURNEY_KINDS)[number];
export const JOURNEY_KIND_LABEL: Record<JourneyKind, string> = { ONBOARDING: 'Intégration', OFFBOARDING: 'Départ' };

export const TASK_OWNERS = ['HR', 'MANAGER', 'EMPLOYEE', 'IT'] as const;
export type JourneyTaskOwner = (typeof TASK_OWNERS)[number];
export const TASK_OWNER_LABEL: Record<JourneyTaskOwner, string> = { HR: 'Ressources humaines', MANAGER: 'Responsable', EMPLOYEE: 'Employé', IT: 'Informatique' };

export type JourneyStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export const MAX_TEMPLATE_TASKS = 30;
export const MAX_OFFSET_DAYS = 365;

const addDays = (iso: string, days: number): string => new Date(new Date(`${iso}T00:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);

function title(raw: string | undefined): string {
  const value = (raw ?? '').trim().replace(/\s+/g, ' ');
  if (!value) throw new DomainError('VALIDATION', 'Le titre de la tâche est obligatoire');
  if (value.length > 150) throw new DomainError('VALIDATION', 'Le titre de la tâche ne peut dépasser 150 caractères');
  return value;
}

export interface TemplateTask {
  title: string;
  owner: JourneyTaskOwner;
  /** Jours par rapport à la date de référence ; négatif = avant. */
  dueOffsetDays: number;
}

/** Valide et normalise la liste des tâches d'un modèle (1 à 30 tâches, titres distincts, responsable connu, échéance dans ±365 jours). L'ordre donné est conservé. */
export function validateTemplateTasks(input: readonly { title?: string; owner?: string; dueOffsetDays?: number }[]): TemplateTask[] {
  if (!Array.isArray(input) || input.length === 0) throw new DomainError('VALIDATION', 'Un modèle comporte au moins une tâche');
  if (input.length > MAX_TEMPLATE_TASKS) throw new DomainError('VALIDATION', `Un modèle comporte ${MAX_TEMPLATE_TASKS} tâches au plus`);
  const seen = new Set<string>();
  return input.map((raw) => {
    const t = title(raw.title);
    if (!TASK_OWNERS.includes(raw.owner as JourneyTaskOwner)) throw new DomainError('VALIDATION', 'Choisissez le responsable de la tâche dans la liste');
    const offset = raw.dueOffsetDays;
    if (!Number.isInteger(offset) || Math.abs(offset as number) > MAX_OFFSET_DAYS) throw new DomainError('VALIDATION', `L’échéance est un nombre entier de jours entre -${MAX_OFFSET_DAYS} et ${MAX_OFFSET_DAYS}`);
    const key = t.toLocaleLowerCase('fr');
    if (seen.has(key)) throw new DomainError('VALIDATION', `La tâche « ${t} » figure deux fois`);
    seen.add(key);
    return { title: t, owner: raw.owner as JourneyTaskOwner, dueOffsetDays: offset as number };
  });
}

/** Modèle de parcours : une nature, une liste ordonnée de tâches. */
export class JourneyTemplate {
  private constructor(private props: { id: string; kind: JourneyKind; tasks: TemplateTask[]; version: number }) {}

  static rehydrate(props: { id: string; kind: JourneyKind; tasks: TemplateTask[]; version: number }): JourneyTemplate {
    return new JourneyTemplate({ ...props, tasks: [...props.tasks] });
  }

  /** Remplace la liste des tâches (le modèle n'est jamais supprimé ni vide). */
  replaceTasks(input: readonly { title?: string; owner?: string; dueOffsetDays?: number }[]): void {
    this.props = { ...this.props, tasks: validateTemplateTasks(input) };
  }

  get id(): string { return this.props.id; }
  get kind(): JourneyKind { return this.props.kind; }
  get tasks(): readonly TemplateTask[] { return this.props.tasks; }
  get version(): number { return this.props.version; }
}

export interface JourneyTaskProps {
  id: string;
  title: string;
  owner: JourneyTaskOwner;
  dueOn: string;
  doneAt: Date | null;
  doneByUserId: string | null;
}

export interface JourneyProps {
  id: string;
  employeeId: string;
  kind: JourneyKind;
  referenceDate: string;
  status: JourneyStatus;
  launchedByUserId: string;
  tasks: JourneyTaskProps[];
  completedAt: Date | null;
  cancelledAt: Date | null;
  version: number;
  createdAt: Date;
}

export class Journey extends AggregateRoot {
  private constructor(private props: JourneyProps) {
    super();
  }

  /** Lance un parcours : copie les tâches du modèle, échéance = date de référence + décalage. */
  static launch(input: { id: string; employeeId: string; kind: JourneyKind; referenceDate: string; launchedByUserId: string; template: readonly TemplateTask[]; newId: () => string; now: Date }): Journey {
    if (!JOURNEY_KINDS.includes(input.kind)) throw new DomainError('VALIDATION', 'Nature de parcours inconnue');
    if (!isIsoDate(input.referenceDate)) throw new DomainError('VALIDATION', 'La date de référence doit être une date valide (AAAA-MM-JJ)');
    if (input.template.length === 0) throw new DomainError('CONFLICT', 'Le modèle ne comporte aucune tâche');
    const tasks = input.template.map((t) => ({ id: input.newId(), title: t.title, owner: t.owner, dueOn: addDays(input.referenceDate, t.dueOffsetDays), doneAt: null, doneByUserId: null }));
    return new Journey({
      id: input.id, employeeId: input.employeeId, kind: input.kind, referenceDate: input.referenceDate, status: 'ACTIVE', launchedByUserId: input.launchedByUserId,
      tasks, completedAt: null, cancelledAt: null, version: 1, createdAt: input.now,
    });
  }

  static rehydrate(props: JourneyProps): Journey {
    return new Journey({ ...props, tasks: props.tasks.map((t) => ({ ...t })) });
  }

  private task(taskId: string): JourneyTaskProps {
    const task = this.props.tasks.find((t) => t.id === taskId);
    if (!task) throw new DomainError('NOT_FOUND', 'Tâche introuvable');
    return task;
  }

  /** Coche une tâche (date et auteur gardés). Quand la dernière est cochée, le parcours est terminé. */
  complete(taskId: string, by: string, now: Date): void {
    if (this.props.status !== 'ACTIVE') throw new DomainError('CONFLICT', this.props.status === 'CANCELLED' ? 'Le parcours est annulé' : 'Le parcours est terminé : rouvrez une tâche pour le reprendre');
    const task = this.task(taskId);
    if (task.doneAt) throw new DomainError('CONFLICT', 'La tâche est déjà cochée');
    task.doneAt = now;
    task.doneByUserId = by;
    if (this.props.tasks.every((t) => t.doneAt)) this.props = { ...this.props, status: 'COMPLETED', completedAt: now };
  }

  /** Décoche une tâche cochée par erreur ; un parcours terminé redevient en cours (l'appelant vérifie qu'aucun autre n'est en cours). */
  reopen(taskId: string): void {
    if (this.props.status === 'CANCELLED') throw new DomainError('CONFLICT', 'Le parcours est annulé');
    const task = this.task(taskId);
    if (!task.doneAt) throw new DomainError('CONFLICT', 'La tâche n’est pas cochée');
    task.doneAt = null;
    task.doneByUserId = null;
    if (this.props.status === 'COMPLETED') this.props = { ...this.props, status: 'ACTIVE', completedAt: null };
  }

  /** Annule un parcours en cours ; il est conservé avec ses tâches. */
  cancel(now: Date): void {
    if (this.props.status !== 'ACTIVE') throw new DomainError('CONFLICT', 'Seul un parcours en cours peut être annulé');
    this.props = { ...this.props, status: 'CANCELLED', cancelledAt: now };
  }

  get id(): string { return this.props.id; }
  get employeeId(): string { return this.props.employeeId; }
  get kind(): JourneyKind { return this.props.kind; }
  get referenceDate(): string { return this.props.referenceDate; }
  get status(): JourneyStatus { return this.props.status; }
  get launchedByUserId(): string { return this.props.launchedByUserId; }
  get tasks(): readonly JourneyTaskProps[] { return this.props.tasks; }
  get completedAt(): Date | null { return this.props.completedAt; }
  get cancelledAt(): Date | null { return this.props.cancelledAt; }
  get version(): number { return this.props.version; }
  get createdAt(): Date { return this.props.createdAt; }
  get isActive(): boolean { return this.props.status === 'ACTIVE'; }
}
