import { PresenceDeclaration } from '../domain/presence';

export interface PresenceView {
  id: string;
  employeeId: string;
  employeeName: string;
  day: string;
  mode: string;
  /** Vrai si la saisie a été faite par quelqu'un d'autre que l'employé (la RH, pour lui). */
  enteredByOther: boolean;
  updatedAt: string;
}

export function toPresenceView(declaration: PresenceDeclaration, employee: { name: string; userId: string | null }): PresenceView {
  return {
    id: declaration.id, employeeId: declaration.employeeId, employeeName: employee.name, day: declaration.day, mode: declaration.mode,
    enteredByOther: employee.userId === null || declaration.declaredByUserId !== employee.userId, updatedAt: declaration.updatedAt.toISOString(),
  };
}

export interface PresenceBoardRow {
  employeeId: string;
  employeeName: string;
  department: string;
  /** Déclarations de la période (au plus une par jour). */
  entries: { day: string; mode: string }[];
  /** Jours de la période couverts en entier par une absence validée (le détail de l'absence reste dans le calendrier des absences). */
  leaveDays: string[];
}

export interface PresenceBoardView {
  from: string;
  to: string;
  department: string | null;
  /** La fiche employé du demandeur (celle sur laquelle il peut déclarer), absente si son compte n'est lié à aucune fiche. */
  viewerEmployeeId: string | null;
  /** Vrai si le demandeur peut déclarer pour n'importe quel employé (la RH). */
  canDeclareForAll: boolean;
  rows: PresenceBoardRow[];
}
