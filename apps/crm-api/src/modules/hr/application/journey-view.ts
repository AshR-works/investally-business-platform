import { JOURNEY_KIND_LABEL, Journey, JourneyTemplate, TASK_OWNER_LABEL } from '../domain/journey';

export interface JourneyTemplateView {
  kind: string;
  kindLabel: string;
  tasks: { title: string; owner: string; ownerLabel: string; dueOffsetDays: number }[];
  /** Verrou optimiste : à renvoyer tel quel pour modifier le modèle. */
  version: number;
}

export const toTemplateView = (t: JourneyTemplate): JourneyTemplateView => ({
  kind: t.kind,
  kindLabel: JOURNEY_KIND_LABEL[t.kind],
  tasks: t.tasks.map((x) => ({ title: x.title, owner: x.owner, ownerLabel: TASK_OWNER_LABEL[x.owner], dueOffsetDays: x.dueOffsetDays })),
  version: t.version,
});

export interface JourneyTaskView {
  id: string;
  title: string;
  owner: string;
  ownerLabel: string;
  dueOn: string;
  done: boolean;
  doneAt: string | null;
  doneByUserId: string | null;
  doneByName: string | null;
  /** Non cochée et échéance dépassée (aujourd'hui exclu). */
  overdue: boolean;
}

/** Parcours tel que l'API l'expose : aucune donnée sensible, jamais de motif libre. */
export interface JourneyView {
  id: string;
  employeeId: string;
  employeeName: string;
  kind: string;
  kindLabel: string;
  referenceDate: string;
  /** `ACTIVE`, `COMPLETED` ou `CANCELLED`. */
  status: string;
  createdAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  progress: { done: number; total: number };
  overdueCount: number;
  tasks: JourneyTaskView[];
  /** Verrou optimiste : à renvoyer tel quel pour cocher, décocher ou annuler. */
  version: number;
}

export function toJourneyView(journey: Journey, names: { employee: string; users: ReadonlyMap<string, string> }, today: string): JourneyView {
  const tasks: JourneyTaskView[] = journey.tasks.map((t) => ({
    id: t.id,
    title: t.title,
    owner: t.owner,
    ownerLabel: TASK_OWNER_LABEL[t.owner],
    dueOn: t.dueOn,
    done: t.doneAt !== null,
    doneAt: t.doneAt ? t.doneAt.toISOString() : null,
    doneByUserId: t.doneByUserId,
    doneByName: t.doneByUserId ? names.users.get(t.doneByUserId) ?? null : null,
    overdue: t.doneAt === null && journey.isActive && t.dueOn < today,
  }));
  return {
    id: journey.id,
    employeeId: journey.employeeId,
    employeeName: names.employee,
    kind: journey.kind,
    kindLabel: JOURNEY_KIND_LABEL[journey.kind],
    referenceDate: journey.referenceDate,
    status: journey.status,
    createdAt: journey.createdAt.toISOString(),
    completedAt: journey.completedAt ? journey.completedAt.toISOString() : null,
    cancelledAt: journey.cancelledAt ? journey.cancelledAt.toISOString() : null,
    progress: { done: tasks.filter((t) => t.done).length, total: tasks.length },
    overdueCount: tasks.filter((t) => t.overdue).length,
    tasks,
    version: journey.version,
  };
}
