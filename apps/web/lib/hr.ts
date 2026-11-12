import { phoneProblem } from './phone';
import { isRealDate, todayIso } from './receipts';

/** Employé tel que l'API le fournit à ceux qui ont `hr.employee.read` sur sa fiche : identité PROFESSIONNELLE seulement (D57). */
export interface Employee {
  id: string;
  matricule: string | null;
  lastName: string;
  firstName: string;
  jobTitle: string;
  department: string;
  managerEmployeeId: string | null;
  managerName: string | null;
  userId: string | null;
  userName: string | null;
  workEmail: string | null;
  workPhone: string | null;
  hiredOn: string;
  leftOn: string | null;
  /** `ACTIVE` ou `ARCHIVED` (sortie du personnel, réversible). */
  status: string;
  archivedAt: string | null;
  archiveReason: string | null;
  createdAt: string;
  version: number;
}

/** Entrée de l'annuaire restreint (employés actifs) : lisible de tout utilisateur. */
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

/** Écart entre l'organigramme RH et la hiérarchie des comptes : signalé, jamais corrigé (D58). */
export interface HierarchyGap {
  employeeId: string;
  employeeName: string;
  hrManagerName: string;
  accountManagerName: string | null;
}

export interface LinkableUser {
  id: string;
  displayName: string;
}

export const fullName = (p: { firstName: string; lastName: string }): string => `${p.firstName} ${p.lastName}`;
export const isArchived = (e: Pick<Employee, 'status'>): boolean => e.status === 'ARCHIVED';

/** Filtre par état : les employés en poste d'abord (la liste courante), puis les sortis, puis tous. */
export const EMPLOYEE_STATE_FILTERS = [
  { value: 'ACTIVE', label: 'En poste' },
  { value: 'ARCHIVED', label: 'Sortis' },
  { value: '', label: 'Tous' },
] as const;

/** Actions de ligne : un employé en poste se modifie et sort du personnel (archivage), un sorti est gelé et ne peut que revenir (réversible, jamais supprimé). */
export function employeeActions(e: Pick<Employee, 'status'>, rights: { update: boolean; archive: boolean }): ('edit' | 'archive' | 'reactivate')[] {
  const actions: ('edit' | 'archive' | 'reactivate')[] = [];
  if (isArchived(e)) {
    if (rights.archive) actions.push('reactivate');
  } else {
    if (rights.update) actions.push('edit');
    if (rights.archive) actions.push('archive');
  }
  return actions;
}

// ───────────────────────────── Saisie d'une fiche ─────────────────────────────

export interface EmployeeForm {
  matricule: string;
  lastName: string;
  firstName: string;
  jobTitle: string;
  department: string;
  managerEmployeeId: string;
  userId: string;
  workEmail: string;
  workPhone: string;
  hiredOn: string;
}

export type EmployeeField = keyof EmployeeForm;
export type EmployeeErrors = Partial<Record<EmployeeField, string>>;

export const EMPTY_EMPLOYEE_FORM = (now: Date = new Date()): EmployeeForm => ({
  matricule: '', lastName: '', firstName: '', jobTitle: '', department: '', managerEmployeeId: '', userId: '', workEmail: '', workPhone: '', hiredOn: todayIso(now),
});

export const formFromEmployee = (e: Employee): EmployeeForm => ({
  matricule: e.matricule ?? '', lastName: e.lastName, firstName: e.firstName, jobTitle: e.jobTitle, department: e.department, managerEmployeeId: e.managerEmployeeId ?? '',
  userId: e.userId ?? '', workEmail: e.workEmail ?? '', workPhone: e.workPhone ?? '', hiredOn: e.hiredOn,
});

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Même règle que le serveur : lettres, chiffres et . - / _, 30 caractères au plus, premier caractère alphanumérique (la casse est ramenée en majuscules). */
const MATRICULE = /^[A-Z0-9][A-Z0-9._/-]{0,29}$/;

/**
 * Contrôles de saisie rapides, champ par champ, dans l'ordre de la fenêtre (le serveur refait tous les contrôles et reste seul juge de la hiérarchie,
 * du compte lié et des unicités) : identité, poste et service obligatoires, matricule libre mais borné, e-mail et téléphone professionnels valides,
 * date d'entrée réelle.
 */
export function validateEmployeeFields(form: EmployeeForm): EmployeeErrors {
  const errors: EmployeeErrors = {};
  const matricule = form.matricule.trim().toUpperCase();
  if (matricule && !MATRICULE.test(matricule)) errors.matricule = 'Le matricule comporte des lettres, des chiffres et . - / _ (30 caractères au plus).';
  const required: [EmployeeField, string, number][] = [['lastName', 'Le nom', 100], ['firstName', 'Le prénom', 100], ['jobTitle', 'Le poste', 150], ['department', 'Le service', 100]];
  for (const [field, label, max] of required) {
    const value = form[field].trim();
    if (!value) errors[field] = `${label} est obligatoire.`;
    else if (value.length > max) errors[field] = `${label} ne peut dépasser ${max} caractères.`;
  }
  if (form.workEmail.trim() && !EMAIL.test(form.workEmail.trim())) errors.workEmail = 'L’adresse e-mail n’est pas valide.';
  if (form.workPhone.trim()) {
    const problem = phoneProblem(form.workPhone);
    if (problem) errors.workPhone = problem;
  }
  const hired = form.hiredOn.trim();
  if (!hired) errors.hiredOn = 'La date d’entrée est obligatoire.';
  else if (!isRealDate(hired)) errors.hiredOn = 'La date d’entrée n’est pas valide.';
  return errors;
}

/**
 * Corps de la création (un champ facultatif vide est omis) ou de la modification (la version lue ; un champ vidé est envoyé vide pour être effacé,
 * un responsable ou un compte retiré part en `null`). Jamais de salaire ni de donnée personnelle : ces champs n'existent pas.
 */
export function buildEmployeeBody(form: EmployeeForm, options: { version?: number } = {}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    matricule: form.matricule.trim(),
    lastName: form.lastName.trim(),
    firstName: form.firstName.trim(),
    jobTitle: form.jobTitle.trim(),
    department: form.department.trim(),
    workEmail: form.workEmail.trim(),
    workPhone: form.workPhone.trim(),
    hiredOn: form.hiredOn.trim(),
  };
  if (options.version === undefined) {
    for (const key of ['matricule', 'workEmail', 'workPhone'] as const) if (!form[key].trim()) delete body[key];
    if (form.managerEmployeeId) body.managerEmployeeId = form.managerEmployeeId;
    if (form.userId) body.userId = form.userId;
  } else {
    body.version = options.version;
    body.managerEmployeeId = form.managerEmployeeId || null;
    body.userId = form.userId || null;
  }
  return body;
}

/** Sortie du personnel : la date ne précède pas l'entrée ; le motif est facultatif, 500 caractères au plus. */
export function validateLeave(input: { leftOn: string; reason: string }, hiredOn: string): { leftOn?: string; reason?: string } {
  const errors: { leftOn?: string; reason?: string } = {};
  const date = input.leftOn.trim();
  if (!date) errors.leftOn = 'La date de sortie est obligatoire.';
  else if (!isRealDate(date)) errors.leftOn = 'La date de sortie n’est pas valide.';
  else if (date < hiredOn) errors.leftOn = 'La date de sortie ne peut pas précéder la date d’entrée.';
  if (input.reason.trim().length > 500) errors.reason = 'Le motif ne peut dépasser 500 caractères.';
  return errors;
}

// ───────────────────────────── Annuaire et organigramme ─────────────────────────────

/** Un nœud de l'organigramme : une personne et ses collaborateurs directs. */
export interface OrgNode {
  entry: DirectoryEntry;
  reports: OrgNode[];
}

const byName = (a: DirectoryEntry, b: DirectoryEntry) => a.lastName.localeCompare(b.lastName, 'fr') || a.firstName.localeCompare(b.firstName, 'fr');

/**
 * Arbre de l'organigramme à partir de la liste à plat (actifs seulement). Une personne sans responsable, ou dont le responsable n'est pas dans la liste
 * (archivé, hors périmètre), est une racine : personne n'est perdu. Une boucle (que le serveur refuse) ne fait jamais tourner l'affichage à vide : ses
 * membres sont rattachés comme racines. Collaborateurs et racines sont triés par nom.
 */
export function buildOrgTree(entries: readonly DirectoryEntry[]): OrgNode[] {
  const nodes = new Map(entries.map((e) => [e.id, { entry: e, reports: [] as OrgNode[] }]));
  const roots: OrgNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.entry.managerEmployeeId ? nodes.get(node.entry.managerEmployeeId) : undefined;
    if (parent && !isAncestor(nodes, node.entry.id, parent.entry.id)) parent.reports.push(node);
    else roots.push(node);
  }
  const sort = (list: OrgNode[]) => {
    list.sort((a, b) => byName(a.entry, b.entry));
    for (const n of list) sort(n.reports);
  };
  sort(roots);
  return roots;
}

/** Vrai si `candidate` descend de `id` en remontant ses responsables (le rattacher à `id` ferait une boucle). */
function isAncestor(nodes: Map<string, OrgNode>, id: string, candidate: string): boolean {
  const seen = new Set<string>();
  let current: string | null = candidate;
  while (current && !seen.has(current)) {
    if (current === id) return true;
    seen.add(current);
    current = nodes.get(current)?.entry.managerEmployeeId ?? null;
  }
  return false;
}

/** Nombre de personnes dans un arbre. */
export const countNodes = (nodes: readonly OrgNode[]): number => nodes.reduce((n, node) => n + 1 + countNodes(node.reports), 0);

/** Services distincts, triés, pour le filtre de l'annuaire. */
export const departmentsOf = (entries: readonly { department: string }[]): string[] =>
  [...new Set(entries.map((e) => e.department))].sort((a, b) => a.localeCompare(b, 'fr'));
