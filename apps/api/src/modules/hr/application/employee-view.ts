import { Employee } from '../domain/employee';

/** Modèle de lecture détaillé d'un employé (jamais l'entité). Réservé à ceux qui ont `hr.employee.read` sur cette fiche. */
export interface EmployeeView {
  id: string;
  matricule: string | null;
  lastName: string;
  firstName: string;
  jobTitle: string;
  department: string;
  managerEmployeeId: string | null;
  managerName: string | null;
  /** Compte lié (0 ou 1) et son nom. */
  userId: string | null;
  userName: string | null;
  workEmail: string | null;
  workPhone: string | null;
  hiredOn: string;
  leftOn: string | null;
  /** `ACTIVE` ou `ARCHIVED` (réversible). */
  status: string;
  archivedAt: string | null;
  archiveReason: string | null;
  createdAt: string;
  /** Verrou optimiste : à renvoyer tel quel pour modifier, archiver ou réactiver. */
  version: number;
}

export function toEmployeeView(e: Employee, names: { manager: string | null; user: string | null }): EmployeeView {
  return {
    id: e.id,
    matricule: e.matricule,
    lastName: e.lastName,
    firstName: e.firstName,
    jobTitle: e.jobTitle,
    department: e.department,
    managerEmployeeId: e.managerEmployeeId,
    managerName: names.manager,
    userId: e.userId,
    userName: names.user,
    workEmail: e.workEmail,
    workPhone: e.workPhone,
    hiredOn: e.hiredOn,
    leftOn: e.leftOn,
    status: e.status,
    archivedAt: e.archivedAt?.toISOString() ?? null,
    archiveReason: e.archiveReason,
    createdAt: e.createdAt.toISOString(),
    version: e.version,
  };
}

/** Entrée de l'annuaire restreint : identité et contacts PROFESSIONNELS seulement, employés actifs seulement (lisible de tout utilisateur authentifié, D57). */
export interface DirectoryEntry {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  department: string;
  managerEmployeeId: string | null;
  workEmail: string | null;
  workPhone: string | null;
}

export const toDirectoryEntry = (e: Employee): DirectoryEntry => ({
  id: e.id, firstName: e.firstName, lastName: e.lastName, jobTitle: e.jobTitle, department: e.department,
  managerEmployeeId: e.managerEmployeeId, workEmail: e.workEmail, workPhone: e.workPhone,
});

/** Un écart entre l'organigramme RH et la hiérarchie des comptes (qui pilote la portée « Équipe ») : signalé, jamais corrigé (D58). */
export interface HierarchyGap {
  employeeId: string;
  employeeName: string;
  /** Responsable selon la RH. */
  hrManagerName: string;
  /** Responsable selon le compte ; `null` si le compte n'a pas de responsable. */
  accountManagerName: string | null;
}
