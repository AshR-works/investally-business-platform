import { Inject, Injectable } from '@nestjs/common';
import { ActorContext, CLOCK, Clock, DomainError, ID_GENERATOR, IdGenerator, Page, UNIT_OF_WORK, UnitOfWork } from '../../../shared-kernel';
import { AUDIT_RECORDER, AuditAction, AuditRecorder } from '../../audit';
import { decideFor, visibilityFor } from '../../iam';
import type { AccessContext } from '../../iam';
import { Employee, EmployeeStatus } from '../domain/employee';
import { EMPLOYEE_REPOSITORY, EmployeeRepository } from '../domain/employee-repository';
import { USER_DIRECTORY, UserDirectory } from '../domain/user-directory';
import { DirectoryEntry, EmployeeView, HierarchyGap, toDirectoryEntry, toEmployeeView } from './employee-view';

const NOT_FOUND = 'Employé introuvable';
const MAX_PAGE_SIZE = 100;
const MAX_ORG = 1000;
const MAX_DEPTH = 100;

const normalizePage = (query: { page: number; pageSize: number }) => ({
  page: Math.max(1, Math.floor(query.page)),
  pageSize: Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(query.pageSize))),
});

/** L'employé visible de l'appelant pour cette permission (portée : son compte lié) ; sinon « introuvable », même réponse qu'un identifiant inexistant. */
async function employeeInScope(employees: EmployeeRepository, id: string, access: AccessContext, permission: string): Promise<Employee> {
  const employee = await employees.findById(id);
  if (!employee || !decideFor(access, permission, employee.userId).allowed) throw new DomainError('NOT_FOUND', NOT_FOUND);
  return employee;
}

/** Les noms du responsable (RH) et du compte lié, pour la vue détaillée. */
async function namesOf(employees: EmployeeRepository, users: UserDirectory, e: Employee): Promise<{ manager: string | null; user: string | null }> {
  const manager = e.managerEmployeeId ? await employees.findById(e.managerEmployeeId) : null;
  const user = e.userId ? await users.find(e.userId) : null;
  return { manager: manager?.fullName ?? null, user: user?.displayName ?? null };
}

/** Le responsable doit exister, être actif, et ne pas créer de boucle dans la hiérarchie (l'employé n'est pas l'un de ses propres supérieurs). */
async function assertManager(employees: EmployeeRepository, employeeId: string, managerId: string | null): Promise<void> {
  if (!managerId) return;
  if (managerId === employeeId) throw new DomainError('VALIDATION', 'Un employé ne peut pas être son propre responsable');
  let current: Employee | null = await employees.findById(managerId);
  if (!current) throw new DomainError('NOT_FOUND', 'Responsable introuvable');
  if (current.isArchived) throw new DomainError('VALIDATION', 'Le responsable est archivé : choisissez un responsable en poste');
  for (let depth = 0; current; depth += 1) {
    if (current.id === employeeId) throw new DomainError('VALIDATION', 'Ce responsable créerait une boucle dans la hiérarchie');
    if (depth > MAX_DEPTH) throw new DomainError('INVARIANT_VIOLATION', 'La hiérarchie est trop profonde');
    current = current.managerEmployeeId ? await employees.findById(current.managerEmployeeId) : null;
  }
}

/** Le compte lié existe et n'est lié à aucun autre employé. */
async function assertUser(employees: EmployeeRepository, users: UserDirectory, userId: string | null, excludeId?: string): Promise<void> {
  if (!userId) return;
  if (!(await users.find(userId))) throw new DomainError('NOT_FOUND', 'Compte utilisateur introuvable');
  const other = await employees.findByUserId(userId, excludeId);
  if (other) throw new DomainError('CONFLICT', `Ce compte est déjà lié à un autre employé (« ${other.fullName} »)`);
}

/** Matricule et e-mail professionnel ne servent qu'à un seul employé : conflit lisible. */
async function assertUnique(employees: EmployeeRepository, employee: Employee, excludeId?: string): Promise<void> {
  if (employee.matricule) {
    const other = await employees.findByMatricule(employee.matricule, excludeId);
    if (other) throw new DomainError('CONFLICT', `Le matricule ${employee.matricule} est déjà attribué à « ${other.fullName} »`);
  }
  if (employee.workEmail) {
    const other = await employees.findByWorkEmail(employee.workEmail, excludeId);
    if (other) throw new DomainError('CONFLICT', `Un employé (« ${other.fullName} ») porte déjà cette adresse e-mail professionnelle`);
  }
}

export interface RegisterEmployeeCommand {
  matricule?: string | null;
  lastName: string;
  firstName: string;
  jobTitle: string;
  department: string;
  managerEmployeeId?: string | null;
  userId?: string | null;
  workEmail?: string | null;
  workPhone?: string | null;
  hiredOn: string;
  access: AccessContext;
  actor: ActorContext;
}

/** Créer un employé : droit de création (RH), responsable en poste, compte libre, matricule et e-mail uniques ; audit. */
@Injectable()
export class RegisterEmployeeUseCase {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(USER_DIRECTORY) private readonly users: UserDirectory,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(command: RegisterEmployeeCommand): Promise<EmployeeView> {
    return this.unitOfWork.run(async () => {
      if (!decideFor(command.access, 'hr.employee.create', null).allowed) throw new DomainError('FORBIDDEN', "Vous n'avez pas le droit de créer un employé");
      const employee = Employee.register({ ...command, id: this.ids.next(), now: this.clock.now() });
      await assertManager(this.employees, employee.id, employee.managerEmployeeId);
      await assertUser(this.employees, this.users, employee.userId);
      await assertUnique(this.employees, employee);
      await this.employees.save(employee);
      const view = toEmployeeView(employee, await namesOf(this.employees, this.users, employee));
      await this.audit.record({ actor: command.actor, module: 'hr', entityType: 'Employee', entityId: employee.id, action: AuditAction.Create, newValue: { ...view } });
      return view;
    });
  }
}

export interface UpdateEmployeeCommand {
  id: string;
  version: number;
  matricule?: string | null;
  lastName?: string;
  firstName?: string;
  jobTitle?: string;
  department?: string;
  managerEmployeeId?: string | null;
  userId?: string | null;
  workEmail?: string | null;
  workPhone?: string | null;
  hiredOn?: string;
  access: AccessContext;
  actor: ActorContext;
}

/** Modifier un employé actif : droit et portée, version lue, responsable sans boucle, compte libre, unicités ; audit avant et après. */
@Injectable()
export class UpdateEmployeeUseCase {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(USER_DIRECTORY) private readonly users: UserDirectory,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: UpdateEmployeeCommand): Promise<EmployeeView> {
    return this.unitOfWork.run(async () => {
      const employee = await employeeInScope(this.employees, command.id, command.access, 'hr.employee.update');
      if (employee.version !== command.version) throw new DomainError('CONFLICT', "L'employé a été modifié par un autre utilisateur : rechargez-le avant de le modifier");
      const before = toEmployeeView(employee, await namesOf(this.employees, this.users, employee));
      // Les contrôles qui dépendent d'autres employés ou comptes se font AVANT de modifier la fiche : une saisie refusée ne laisse rien derrière elle.
      if (command.managerEmployeeId !== undefined) await assertManager(this.employees, employee.id, command.managerEmployeeId || null);
      if (command.userId !== undefined) await assertUser(this.employees, this.users, command.userId || null, employee.id);
      employee.update(command);
      await assertUnique(this.employees, employee, employee.id);
      await this.employees.save(employee);
      const saved = (await this.employees.findById(employee.id)) ?? employee;
      const after = toEmployeeView(saved, await namesOf(this.employees, this.users, saved));
      await this.audit.record({ actor: command.actor, module: 'hr', entityType: 'Employee', entityId: employee.id, action: AuditAction.Update, oldValue: { ...before }, newValue: { ...after } });
      return after;
    });
  }
}

export interface SetEmployeeStatusCommand {
  id: string;
  version: number;
  /** `ARCHIVED` archive (sortie du personnel), `ACTIVE` réactive. */
  status: string;
  /** Date de sortie « AAAA-MM-JJ » (défaut : aujourd'hui) ; ignorée à la réactivation. */
  leftOn?: string | null;
  /** Motif de la sortie (facultatif) ; ignoré à la réactivation. */
  reason?: string | null;
  access: AccessContext;
  actor: ActorContext;
}

/**
 * Archiver (sortie du personnel) ou réactiver un employé : **jamais de suppression**. Droit d'archivage et portée, version lue, audit avant et après.
 * Un employé qui a des collaborateurs en poste ne s'archive pas : on les réaffecte d'abord.
 */
@Injectable()
export class SetEmployeeStatusUseCase {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(USER_DIRECTORY) private readonly users: UserDirectory,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: SetEmployeeStatusCommand): Promise<EmployeeView> {
    if (command.status !== EmployeeStatus.Archived && command.status !== EmployeeStatus.Active) throw new DomainError('VALIDATION', "L'état demandé est inconnu (archivé ou actif)");
    return this.unitOfWork.run(async () => {
      const employee = await employeeInScope(this.employees, command.id, command.access, 'hr.employee.archive');
      if (employee.version !== command.version) throw new DomainError('CONFLICT', "L'employé a été modifié par un autre utilisateur : rechargez-le avant de continuer");
      const before = toEmployeeView(employee, await namesOf(this.employees, this.users, employee));
      if (command.status === EmployeeStatus.Archived) {
        const team = (await this.employees.allActive(MAX_ORG)).filter((e) => e.managerEmployeeId === employee.id);
        if (team.length > 0) throw new DomainError('INVARIANT_VIOLATION', `${team.length} collaborateur${team.length > 1 ? 's' : ''} en poste ${team.length > 1 ? 'ont' : 'a'} cet employé pour responsable : réaffectez-les d'abord`);
        employee.archive({ leftOn: command.leftOn, reason: command.reason, now: this.clock.now() });
      } else {
        employee.reactivate();
      }
      await this.employees.save(employee);
      const saved = (await this.employees.findById(employee.id)) ?? employee;
      const after = toEmployeeView(saved, await namesOf(this.employees, this.users, saved));
      await this.audit.record({ actor: command.actor, module: 'hr', entityType: 'Employee', entityId: employee.id, action: AuditAction.Update, oldValue: { ...before }, newValue: { ...after } });
      return after;
    });
  }
}

/** Lecture détaillée d'un employé : hors portée = « introuvable ». **La lecture est tracée** (action VIEW) : une fiche du personnel est une donnée sensible. */
@Injectable()
export class GetEmployeeHandler {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(USER_DIRECTORY) private readonly users: UserDirectory,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(query: { id: string; access: AccessContext; actor: ActorContext }): Promise<EmployeeView> {
    return this.unitOfWork.run(async () => {
      const employee = await employeeInScope(this.employees, query.id, query.access, 'hr.employee.read');
      const view = toEmployeeView(employee, await namesOf(this.employees, this.users, employee));
      await this.audit.record({ actor: query.actor, module: 'hr', entityType: 'Employee', entityId: employee.id, action: AuditAction.View });
      return view;
    });
  }
}

export interface ListEmployeesQuery {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  department?: string;
  access: AccessContext;
}

/** Liste paginée des employés visibles : tous (RH, Direction), son équipe ou soi-même, selon la portée de `hr.employee.read`. */
@Injectable()
export class ListEmployeesHandler {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(USER_DIRECTORY) private readonly users: UserDirectory,
  ) {}

  async execute(query: ListEmployeesQuery): Promise<Page<EmployeeView>> {
    const visibility = visibilityFor(query.access, 'hr.employee.read');
    const status = query.status && Object.values(EmployeeStatus).includes(query.status as EmployeeStatus) ? (query.status as EmployeeStatus) : undefined;
    const result = await this.employees.list({
      ...normalizePage(query), search: query.search?.trim() || undefined, status, department: query.department?.trim() || undefined,
      userIds: visibility.unrestricted ? undefined : visibility.ownerIds,
    });
    const managers = new Map((await this.employees.findByIds([...new Set(result.items.flatMap((e) => (e.managerEmployeeId ? [e.managerEmployeeId] : [])))])).map((m) => [m.id, m.fullName]));
    const accounts = new Map((await this.users.findMany([...new Set(result.items.flatMap((e) => (e.userId ? [e.userId] : [])))])).map((u) => [u.id, u.displayName]));
    return {
      ...result,
      items: result.items.map((e) => toEmployeeView(e, { manager: e.managerEmployeeId ? (managers.get(e.managerEmployeeId) ?? null) : null, user: e.userId ? (accounts.get(e.userId) ?? null) : null })),
    };
  }
}

/** Annuaire restreint : employés ACTIFS, identité et contacts professionnels seulement ; lisible de tout utilisateur authentifié (`hr.directory.read`, D57). */
@Injectable()
export class ListDirectoryHandler {
  constructor(@Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository) {}

  async execute(query: { page: number; pageSize: number; search?: string; department?: string }): Promise<Page<DirectoryEntry>> {
    const result = await this.employees.listActive({ ...normalizePage(query), search: query.search?.trim() || undefined, department: query.department?.trim() || undefined });
    return { ...result, items: result.items.map(toDirectoryEntry) };
  }
}

/** Organigramme : tous les employés actifs (identité et contacts professionnels, responsable), à plat ; l'écran en fait un arbre. Même droit que l'annuaire. */
@Injectable()
export class GetOrgChartHandler {
  constructor(@Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository) {}

  async execute(): Promise<DirectoryEntry[]> {
    return (await this.employees.allActive(MAX_ORG)).map(toDirectoryEntry);
  }
}

/** Comptes auxquels on peut encore lier une fiche (nom seulement, jamais d'e-mail) : pour choisir dans la fenêtre de l'employé. Droit de modification. */
@Injectable()
export class ListLinkableUsersHandler {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(USER_DIRECTORY) private readonly users: UserDirectory,
  ) {}

  async execute(query: { access: AccessContext }): Promise<{ id: string; displayName: string }[]> {
    if (!decideFor(query.access, 'hr.employee.update', null).allowed) throw new DomainError('FORBIDDEN', "Vous n'avez pas le droit de lier un compte");
    const linked = new Set(await this.employees.linkedUserIds());
    return (await this.users.assignable()).filter((u) => !linked.has(u.id)).map((u) => ({ id: u.id, displayName: u.displayName }));
  }
}

/**
 * Écarts entre l'organigramme RH et la hiérarchie des comptes (`users.manager_id`, qui pilote la portée « Équipe » de tout le CRM). Un employé est
 * signalé quand lui et son responsable RH ont un compte et que le responsable de son compte n'est pas le compte de son responsable RH. **Signalé, jamais
 * corrigé** (D58). Réservé à la portée Tous de `hr.employee.read`.
 */
@Injectable()
export class ListHierarchyGapsHandler {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(USER_DIRECTORY) private readonly users: UserDirectory,
  ) {}

  async execute(query: { access: AccessContext }): Promise<HierarchyGap[]> {
    if (!visibilityFor(query.access, 'hr.employee.read').unrestricted) throw new DomainError('FORBIDDEN', 'Cette vue est réservée à la RH et à la Direction');
    const active = await this.employees.allActive(MAX_ORG);
    const byId = new Map(active.map((e) => [e.id, e]));
    const linked = active.filter((e) => e.userId && e.managerEmployeeId && byId.get(e.managerEmployeeId)?.userId);
    const accounts = new Map((await this.users.findMany([...new Set(active.flatMap((e) => (e.userId ? [e.userId] : [])))])).map((u) => [u.id, u]));
    const byUserId = new Map(active.flatMap((e) => (e.userId ? [[e.userId, e] as const] : [])));
    const gaps: HierarchyGap[] = [];
    for (const e of linked) {
      const hrManager = byId.get(e.managerEmployeeId!)!;
      const account = accounts.get(e.userId!);
      if (!account || account.managerUserId === hrManager.userId) continue;
      const accountManagerEmployee = account.managerUserId ? byUserId.get(account.managerUserId) : undefined;
      const accountManagerName = account.managerUserId ? (accountManagerEmployee?.fullName ?? accounts.get(account.managerUserId)?.displayName ?? (await this.users.find(account.managerUserId))?.displayName ?? null) : null;
      gaps.push({ employeeId: e.id, employeeName: e.fullName, hrManagerName: hrManager.fullName, accountManagerName });
    }
    return gaps.sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  }
}
