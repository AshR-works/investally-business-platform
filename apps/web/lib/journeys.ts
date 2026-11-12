/**
 * Parcours d'intégration et de départ (RH-3b, D68) : modèles modifiables, parcours lancés à la main, tâches cochées avec date et auteur. Aucun texte libre autre que le
 * titre court d'une tâche. Les règles de saisie reprennent celles du serveur ; le serveur reste juge.
 */
export type JourneyKind = 'ONBOARDING' | 'OFFBOARDING';
export type JourneyStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type TaskOwner = 'HR' | 'MANAGER' | 'EMPLOYEE' | 'IT';

export const KIND_LABEL: Record<JourneyKind, string> = { ONBOARDING: 'Intégration', OFFBOARDING: 'Départ' };
export const OWNER_OPTIONS: { code: TaskOwner; label: string }[] = [
  { code: 'HR', label: 'Ressources humaines' },
  { code: 'MANAGER', label: 'Responsable' },
  { code: 'EMPLOYEE', label: 'Employé' },
  { code: 'IT', label: 'Informatique' },
];
export const ownerLabel = (owner: string): string => OWNER_OPTIONS.find((o) => o.code === owner)?.label ?? owner;

export interface JourneyTask {
  id: string;
  title: string;
  owner: TaskOwner;
  ownerLabel: string;
  dueOn: string;
  done: boolean;
  doneAt: string | null;
  doneByUserId: string | null;
  doneByName: string | null;
  overdue: boolean;
}

export interface Journey {
  id: string;
  employeeId: string;
  employeeName: string;
  kind: JourneyKind;
  kindLabel: string;
  referenceDate: string;
  status: JourneyStatus;
  createdAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  progress: { done: number; total: number };
  overdueCount: number;
  tasks: JourneyTask[];
  version: number;
}

export interface TemplateTask {
  title: string;
  owner: TaskOwner;
  dueOffsetDays: number;
}

export interface JourneyTemplate {
  kind: JourneyKind;
  kindLabel: string;
  tasks: (TemplateTask & { ownerLabel: string })[];
  version: number;
}

export const JOURNEY_STATE_FILTERS = [
  { value: '', label: 'Tous' },
  { value: 'ACTIVE', label: 'En cours' },
  { value: 'COMPLETED', label: 'Terminés' },
  { value: 'CANCELLED', label: 'Annulés' },
] as const;

export const KIND_FILTERS = [
  { value: '', label: 'Toutes les natures' },
  { value: 'ONBOARDING', label: 'Intégration' },
  { value: 'OFFBOARDING', label: 'Départ' },
] as const;

/** Les écrans des parcours que le profil peut ouvrir (onglets). */
export const JOURNEY_PAGES = [
  { id: 'journeys', label: 'Parcours', href: '/hr/journeys', permission: 'hr.journey.read', allScope: false },
  { id: 'templates', label: 'Modèles', href: '/hr/journeys/templates', permission: 'hr.journey.manage', allScope: true },
] as const;

export const MAX_TEMPLATE_TASKS = 30;
export const MAX_OFFSET_DAYS = 365;

export const statusLabel = (status: JourneyStatus): string => (status === 'ACTIVE' ? 'En cours' : status === 'COMPLETED' ? 'Terminé' : 'Annulé');
export const statusTone = (status: JourneyStatus): 'info' | 'ok' | 'neutral' => (status === 'ACTIVE' ? 'info' : status === 'COMPLETED' ? 'ok' : 'neutral');

/** « 3 sur 6 » : l'avancement d'un parcours. */
export const progressText = (p: { done: number; total: number }): string => `${p.done} sur ${p.total}`;

/** Part des tâches faites, en pourcentage entier (0 si aucune tâche). */
export const progressPercent = (p: { done: number; total: number }): number => (p.total === 0 ? 0 : Math.round((p.done / p.total) * 100));

/** Échéance relative, en clair : « le jour même », « 3 jours avant », « 7 jours après ». */
export function offsetText(days: number, kind: JourneyKind): string {
  const reference = kind === 'ONBOARDING' ? 'l’entrée' : 'le départ';
  if (days === 0) return `Le jour de ${reference}`;
  const n = Math.abs(days);
  return `${n} jour${n > 1 ? 's' : ''} ${days < 0 ? 'avant' : 'après'} ${reference}`;
}

/** Action possible sur une tâche : cocher une tâche d'un parcours en cours, décocher une tâche cochée (sauf parcours annulé) ; seulement pour qui gère les parcours. */
export function taskAction(journey: Pick<Journey, 'status'>, task: Pick<JourneyTask, 'done'>, canManage: boolean): 'check' | 'reopen' | null {
  if (!canManage || journey.status === 'CANCELLED') return null;
  if (task.done) return 'reopen';
  return journey.status === 'ACTIVE' ? 'check' : null;
}

/** Annuler : seulement un parcours en cours, pour qui gère les parcours. */
export const canCancel = (journey: Pick<Journey, 'status'>, canManage: boolean): boolean => canManage && journey.status === 'ACTIVE';

// ─────────────────────────────── Lancer un parcours ───────────────────────────────

export interface LaunchForm {
  employeeId: string;
  kind: JourneyKind | '';
  referenceDate: string;
}
export type LaunchErrors = Partial<Record<keyof LaunchForm, string>>;

export const EMPTY_LAUNCH_FORM: LaunchForm = { employeeId: '', kind: '', referenceDate: '' };

export function validateLaunch(form: LaunchForm): LaunchErrors {
  const errors: LaunchErrors = {};
  if (!form.employeeId) errors.employeeId = 'Choisissez l’employé.';
  if (form.kind !== 'ONBOARDING' && form.kind !== 'OFFBOARDING') errors.kind = 'Choisissez la nature du parcours.';
  if (form.referenceDate) {
    const date = new Date(`${form.referenceDate}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.referenceDate) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== form.referenceDate) errors.referenceDate = 'Indiquez une date valide.';
  }
  return errors;
}

export const launchBody = (form: LaunchForm): Record<string, unknown> => ({ employeeId: form.employeeId, kind: form.kind, ...(form.referenceDate ? { referenceDate: form.referenceDate } : {}) });

// ─────────────────────────────── Modifier un modèle ───────────────────────────────

/** Une ligne du formulaire d'un modèle : `key` donne une identité stable à la ligne (réordonner ne mélange pas les champs). */
export interface TemplateRow {
  key: string;
  title: string;
  owner: TaskOwner;
  offset: string;
}
export type RowErrors = { title?: string; offset?: string };

let counter = 0;
export const newRowKey = (): string => `row-${++counter}`;

export const rowsOf = (template: Pick<JourneyTemplate, 'tasks'>): TemplateRow[] =>
  template.tasks.map((t) => ({ key: newRowKey(), title: t.title, owner: t.owner, offset: String(t.dueOffsetDays) }));

export const emptyRow = (): TemplateRow => ({ key: newRowKey(), title: '', owner: 'HR', offset: '0' });

/** Déplace la ligne `index` d'un cran (haut : -1, bas : +1) ; hors limites, la liste est rendue telle quelle. */
export function moveRow<T>(rows: readonly T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (index < 0 || index >= rows.length || target < 0 || target >= rows.length) return [...rows];
  const next = [...rows];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** Erreurs par ligne (indexées) et erreur d'ensemble : 1 à 30 lignes, titre de 150 caractères au plus, titres distincts, échéance entière dans ±365 jours. */
export function validateRows(rows: readonly TemplateRow[]): { rows: RowErrors[]; list?: string } {
  const out: RowErrors[] = rows.map(() => ({}));
  let list: string | undefined;
  if (rows.length === 0) list = 'Un modèle comporte au moins une tâche.';
  else if (rows.length > MAX_TEMPLATE_TASKS) list = `Un modèle comporte ${MAX_TEMPLATE_TASKS} tâches au plus.`;
  const seen = new Map<string, number>();
  rows.forEach((row, i) => {
    const title = row.title.trim().replace(/\s+/g, ' ');
    if (!title) out[i].title = 'Le titre est obligatoire.';
    else if (title.length > 150) out[i].title = 'Le titre ne peut dépasser 150 caractères.';
    else {
      const key = title.toLocaleLowerCase('fr');
      if (seen.has(key)) out[i].title = 'Ce titre figure déjà dans la liste.';
      seen.set(key, i);
    }
    const n = Number(row.offset);
    if (!/^-?\d+$/.test(row.offset.trim()) || !Number.isInteger(n) || Math.abs(n) > MAX_OFFSET_DAYS) out[i].offset = `Un nombre entier de jours entre -${MAX_OFFSET_DAYS} et ${MAX_OFFSET_DAYS}.`;
  });
  return { rows: out, list };
}

export const rowsValid = (rows: readonly TemplateRow[]): boolean => {
  const v = validateRows(rows);
  return !v.list && v.rows.every((r) => !r.title && !r.offset);
};

export const templateBody = (rows: readonly TemplateRow[], version: number): Record<string, unknown> => ({
  version,
  tasks: rows.map((r) => ({ title: r.title.trim().replace(/\s+/g, ' '), owner: r.owner, dueOffsetDays: Number(r.offset) })),
});
