import { Inject, Injectable } from '@nestjs/common';
import { ActorContext, CLOCK, Clock, DomainError, ID_GENERATOR, IdGenerator, UNIT_OF_WORK, UnitOfWork } from '../../../shared-kernel';
import { AUDIT_RECORDER, AuditAction, AuditRecorder } from '../../audit';
import { Scope, decideFor } from '../../iam';
import type { AccessContext } from '../../iam';
import { Employee } from '../domain/employee';
import { EMPLOYEE_REPOSITORY, EmployeeRepository } from '../domain/employee-repository';
import { dayOrdinal, isIsoDate, isoOfOrdinal } from '../domain/leave-calendar';
import { LEAVE_REQUEST_REPOSITORY, LeaveRequestRepository } from '../domain/leave-repositories';
import { LeaveStatus } from '../domain/leave-request';
import { HR_WINDOW, PresenceDeclaration, SELF_WINDOW, assertDay, coversWholeDay, parseMode } from '../domain/presence';
import { PRESENCE_REPOSITORY, PresenceRepository } from '../domain/presence-repositories';
import { PresenceBoardView, PresenceView, toPresenceView } from './presence-view';

const MAX_EMPLOYEES = 1000;
const MAX_BOARD_DAYS = 93;

/** Portée accordée pour une permission (aucun objet précis), `null` si elle n'est pas accordée. */
function scopeOf(access: AccessContext, permission: string): Scope | null {
  const decision = decideFor(access, permission, undefined);
  return decision.allowed ? decision.scope : null;
}

const todayOf = (clock: Clock): string => clock.now().toISOString().slice(0, 10);
const nameOf = (employee: Employee) => ({ name: employee.fullName, userId: employee.userId });

/**
 * L'employé visé par une saisie ou une suppression : le sien (compte lié) ou, pour la RH (déclarer en portée Tous), n'importe lequel. Hors de ce périmètre, il est
 * « introuvable » : on ne révèle pas qu'il existe.
 */
async function targetOf(employees: EmployeeRepository, access: AccessContext, declare: Scope, employeeId: string | undefined): Promise<Employee> {
  const mine = await employees.findByUserId(access.actorId);
  const employee = employeeId ? await employees.findById(employeeId) : mine;
  if (!employeeId && !employee) throw new DomainError('VALIDATION', "Aucune fiche employé n'est liée à votre compte : demandez à la RH de la relier");
  if (!employee || !(declare === Scope.All || employee.userId === access.actorId)) throw new DomainError('NOT_FOUND', 'Employé introuvable');
  return employee;
}

/** Le jour est dans la fenêtre de saisie du demandeur (courte pour l'employé, plus large pour la RH) et dans la période d'emploi de la fiche. */
function assertDayAllowed(day: string, today: string, declare: Scope, employee: Employee): void {
  assertDay(day);
  const window = declare === Scope.All ? HR_WINDOW : SELF_WINDOW;
  const offset = dayOrdinal(day) - dayOrdinal(today);
  if (offset < -window.past) throw new DomainError('VALIDATION', `Ce jour est trop ancien : la saisie remonte à ${window.past} jours au plus`);
  if (offset > window.future) throw new DomainError('VALIDATION', `Ce jour est trop lointain : la saisie va jusqu'à ${window.future} jours à l'avance`);
  if (day < employee.hiredOn) throw new DomainError('VALIDATION', "Le jour ne peut pas être avant la date d'entrée de l'employé");
  if (employee.leftOn !== null && day > employee.leftOn) throw new DomainError('VALIDATION', 'Le jour ne peut pas être après la date de départ de l\'employé');
}

export interface DeclarePresenceCommand {
  /** Absent : l'employé de l'appelant (compte lié). La RH peut en désigner un autre. */
  employeeId?: string;
  day: string;
  mode: string;
  access: AccessContext;
  actor: ActorContext;
}

/**
 * Déclarer (ou changer) sa présence d'un jour (RH-4a, D69). Contrôles : droit de déclarer, employé en poste, jour dans la fenêtre de saisie et dans la période d'emploi,
 * aucune absence validée sur la journée entière. Idempotent : redéclarer le même mode ne change rien et n'écrit rien dans le journal.
 */
@Injectable()
export class DeclarePresenceUseCase {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(PRESENCE_REPOSITORY) private readonly presences: PresenceRepository,
    @Inject(LEAVE_REQUEST_REPOSITORY) private readonly leave: LeaveRequestRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(command: DeclarePresenceCommand): Promise<PresenceView> {
    return this.unitOfWork.run(async () => {
      const declare = scopeOf(command.access, 'hr.presence.declare');
      if (declare === null) throw new DomainError('FORBIDDEN', "Vous n'avez pas le droit de déclarer une présence");
      const employee = await targetOf(this.employees, command.access, declare, command.employeeId);
      if (employee.isArchived) throw new DomainError('CONFLICT', "L'employé est archivé : aucune présence ne peut lui être saisie");
      const mode = parseMode(command.mode);
      assertDayAllowed(command.day, todayOf(this.clock), declare, employee);

      const leaves = await this.leave.findActiveOverlapping(employee.id, command.day, command.day);
      if (leaves.some((l) => l.status === LeaveStatus.Approved && coversWholeDay(l.period, command.day))) throw new DomainError('CONFLICT', 'Une absence validée couvre ce jour : aucune présence à déclarer');

      const existing = await this.presences.find(employee.id, command.day);
      const now = this.clock.now();
      if (existing) {
        if (existing.mode === mode) return toPresenceView(existing, nameOf(employee));
        const before = toPresenceView(existing, nameOf(employee));
        existing.change({ mode, by: command.access.actorId, now });
        await this.presences.save(existing);
        const after = toPresenceView(existing, nameOf(employee));
        await this.audit.record({ actor: command.actor, module: 'hr', entityType: 'PresenceDeclaration', entityId: existing.id, action: AuditAction.Update, oldValue: { ...before }, newValue: { ...after } });
        return after;
      }
      const created = PresenceDeclaration.declare({ id: this.ids.next(), employeeId: employee.id, day: command.day, mode, declaredByUserId: command.access.actorId, now });
      await this.presences.save(created);
      const view = toPresenceView(created, nameOf(employee));
      await this.audit.record({ actor: command.actor, module: 'hr', entityType: 'PresenceDeclaration', entityId: created.id, action: AuditAction.Create, newValue: { ...view } });
      return view;
    });
  }
}

export interface RemovePresenceCommand {
  employeeId?: string;
  day: string;
  access: AccessContext;
  actor: ActorContext;
}

/** Retirer sa déclaration d'un jour (même droit et même fenêtre que pour la saisir). Une déclaration inexistante est « introuvable ». */
@Injectable()
export class RemovePresenceUseCase {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(PRESENCE_REPOSITORY) private readonly presences: PresenceRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: RemovePresenceCommand): Promise<void> {
    await this.unitOfWork.run(async () => {
      const declare = scopeOf(command.access, 'hr.presence.declare');
      if (declare === null) throw new DomainError('FORBIDDEN', "Vous n'avez pas le droit de modifier une présence");
      const employee = await targetOf(this.employees, command.access, declare, command.employeeId);
      assertDayAllowed(command.day, todayOf(this.clock), declare, employee);
      const existing = await this.presences.find(employee.id, command.day);
      if (!existing) throw new DomainError('NOT_FOUND', 'Aucune présence déclarée ce jour-là');
      const before = toPresenceView(existing, nameOf(employee));
      await this.presences.remove(employee.id, command.day);
      await this.audit.record({ actor: command.actor, module: 'hr', entityType: 'PresenceDeclaration', entityId: existing.id, action: AuditAction.Delete, oldValue: { ...before } });
    });
  }
}

/**
 * Tableau des présences d'une période : un employé par ligne, ses déclarations et ses jours d'absence validée. La RH et la Direction (lecture en portée Tous)
 * voient tout le personnel en poste (filtrable par service) ; les autres voient leur propre ligne et celles de leurs subordonnés directs (organigramme, D58).
 */
@Injectable()
export class GetPresenceBoardHandler {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(PRESENCE_REPOSITORY) private readonly presences: PresenceRepository,
    @Inject(LEAVE_REQUEST_REPOSITORY) private readonly leave: LeaveRequestRepository,
  ) {}

  async execute(query: { from: string; to: string; department?: string; access: AccessContext }): Promise<PresenceBoardView> {
    const read = scopeOf(query.access, 'hr.presence.read');
    if (read === null) throw new DomainError('FORBIDDEN', "Vous n'avez pas le droit de voir les présences");
    if (!isIsoDate(query.from) || !isIsoDate(query.to) || query.to < query.from) throw new DomainError('VALIDATION', 'La période doit être deux dates valides (AAAA-MM-JJ), la fin après le début');
    if (dayOrdinal(query.to) - dayOrdinal(query.from) + 1 > MAX_BOARD_DAYS) throw new DomainError('VALIDATION', `La période ne peut pas dépasser ${MAX_BOARD_DAYS} jours`);

    const mine = await this.employees.findByUserId(query.access.actorId);
    const wide = read === Scope.All;
    const department = query.department?.trim() || null;
    const active = wide || mine ? await this.employees.allActive(MAX_EMPLOYEES) : [];
    const visible = active
      .filter((e) => wide || e.id === mine!.id || e.managerEmployeeId === mine!.id)
      .filter((e) => department === null || e.department.toLowerCase() === department.toLowerCase());
    const ids = visible.map((e) => e.id);
    const [declared, leaves] = await Promise.all([this.presences.between(query.from, query.to, ids), this.leave.approvedBetween(query.from, query.to, ids)]);

    const first = dayOrdinal(query.from);
    const last = dayOrdinal(query.to);
    const rows = visible.map((employee) => {
      const leaveDays = new Set<string>();
      for (const l of leaves.filter((r) => r.employeeId === employee.id)) {
        for (let ordinal = Math.max(first, dayOrdinal(l.start)); ordinal <= Math.min(last, dayOrdinal(l.end)); ordinal += 1) {
          const day = isoOfOrdinal(ordinal);
          if (coversWholeDay(l.period, day)) leaveDays.add(day);
        }
      }
      return {
        employeeId: employee.id, employeeName: employee.fullName, department: employee.department,
        entries: declared.filter((d) => d.employeeId === employee.id).map((d) => ({ day: d.day, mode: d.mode })), leaveDays: [...leaveDays].sort(),
      };
    });
    rows.sort((a, b) => a.employeeName.localeCompare(b.employeeName, 'fr') || a.employeeId.localeCompare(b.employeeId));
    return { from: query.from, to: query.to, department, viewerEmployeeId: mine?.id ?? null, canDeclareForAll: scopeOf(query.access, 'hr.presence.declare') === Scope.All, rows };
  }
}
