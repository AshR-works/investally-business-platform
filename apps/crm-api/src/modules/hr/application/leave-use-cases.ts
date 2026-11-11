import { Inject, Injectable } from '@nestjs/common';
import { ActorContext, CLOCK, Clock, DomainError, ID_GENERATOR, IdGenerator, Page, UNIT_OF_WORK, UnitOfWork } from '../../../shared-kernel';
import { AUDIT_RECORDER, AuditAction, AuditRecorder } from '../../audit';
import { Scope, decideFor } from '../../iam';
import type { AccessContext } from '../../iam';
import { Employee } from '../domain/employee';
import { EMPLOYEE_REPOSITORY, EmployeeRepository } from '../domain/employee-repository';
import { CalendarRules, LeaveBalance, annualEntitlement, computeBalance, dayOrdinal, isIsoDate, leaveDays, periodsOverlap } from '../domain/leave-calendar';
import { LeaveType, validateAdjustment, validateHoliday, validateLeaveSettings } from '../domain/leave-config';
import {
  LEAVE_ADJUSTMENT_REPOSITORY, LEAVE_CONFIG_REPOSITORY, LEAVE_REQUEST_REPOSITORY, LeaveAdjustmentRepository, LeaveConfigRepository, LeaveRequestRepository,
} from '../domain/leave-repositories';
import { LeaveRequest, LeaveStatus } from '../domain/leave-request';
import {
  AdjustmentView, CalendarEntry, HolidayView, LeaveBalanceView, LeaveRequestView, LeaveSettingsView, LeaveTypeView, TeamCalendarView,
  toAdjustmentView, toHolidayView, toLeaveRequestView, toLeaveSettingsView, toLeaveTypeView,
} from './leave-view';

const NOT_FOUND = 'Demande introuvable';
const MAX_PAGE_SIZE = 100;
const MAX_EMPLOYEES = 1000;
const MAX_CALENDAR_DAYS = 93;

const normalizePage = (query: { page: number; pageSize: number }) => ({
  page: Math.max(1, Math.floor(query.page)),
  pageSize: Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(query.pageSize))),
});

/** Portée accordée pour une permission (aucun objet précis), `null` si elle n'est pas accordée. */
function scopeOf(access: AccessContext, permission: string): Scope | null {
  const decision = decideFor(access, permission, undefined);
  return decision.allowed ? decision.scope : null;
}

const todayOf = (clock: Clock): string => clock.now().toISOString().slice(0, 10);

/**
 * Qui voit les absences d'un employé : la RH et la Direction (lecture en portée Tous), l'employé lui-même, et son RESPONSABLE de l'organigramme (RH, D58) s'il a
 * le droit de valider. Hors de ces cas, la demande est « introuvable ».
 */
function canView(access: AccessContext, employee: Employee, actorEmployee: Employee | null): boolean {
  const read = scopeOf(access, 'hr.leave.read');
  if (read === Scope.All) return true;
  if (read !== null && employee.userId === access.actorId) return true;
  return scopeOf(access, 'hr.leave.approve') !== null && actorEmployee !== null && employee.managerEmployeeId === actorEmployee.id;
}

/** Qui valide ou refuse : jamais sa propre demande ; la RH (portée Tous) toute demande ; sinon le responsable direct de l'organigramme. */
function canApprove(access: AccessContext, employee: Employee, actorEmployee: Employee | null): boolean {
  if (employee.userId === access.actorId) return false;
  const approve = scopeOf(access, 'hr.leave.approve');
  if (approve === null) return false;
  if (approve === Scope.All) return true;
  return actorEmployee !== null && employee.managerEmployeeId === actorEmployee.id;
}

const canManage = (access: AccessContext): boolean => scopeOf(access, 'hr.leave.manage') === Scope.All;

/** Les noms (employés, types) nécessaires aux vues, chargés en une fois. */
class Names {
  private constructor(private readonly employees: Map<string, Employee>, private readonly types: Map<string, LeaveType>) {}

  static async load(repo: EmployeeRepository, config: LeaveConfigRepository, requests: readonly LeaveRequest[]): Promise<Names> {
    const employees = new Map((await repo.findByIds([...new Set(requests.map((r) => r.employeeId))])).map((e) => [e.id, e]));
    const types = new Map((await config.types(true)).map((t) => [t.id, t]));
    return new Names(employees, types);
  }

  view(request: LeaveRequest): LeaveRequestView {
    return toLeaveRequestView(request, { employee: this.employees.get(request.employeeId)?.fullName ?? '—', type: this.types.get(request.leaveTypeId)?.label ?? '—' });
  }
}

/** Règles de calendrier pour une période : le samedi selon les règles, les jours fériés saisis par la RH. */
async function rulesFor(config: LeaveConfigRepository, from: string, to: string): Promise<CalendarRules> {
  const [settings, holidays] = await Promise.all([config.settings(), config.holidays(from, to)]);
  return { countsSaturday: settings.countsSaturday, holidays: new Set(holidays.map((h) => h.day)) };
}

/** Solde d'un employé pour une année (acquis, ajustements, pris, en attente). `excludeId` retire une demande du décompte (celle qu'on décide). */
async function balanceOf(deps: { config: LeaveConfigRepository; requests: LeaveRequestRepository; adjustments: LeaveAdjustmentRepository }, employee: Employee, year: number, excludeId?: string): Promise<LeaveBalance> {
  const settings = await deps.config.settings();
  const [adjustments, days] = await Promise.all([deps.adjustments.total(employee.id, year), deps.requests.sumDays(employee.id, year, excludeId)]);
  return computeBalance({ year, entitlement: annualEntitlement(employee.hiredOn, employee.leftOn, year, settings.accrualDaysPerMonth), adjustments, taken: days.approved, pending: days.pending });
}

// ─────────────────────────────── Demandes ───────────────────────────────

export interface RequestLeaveCommand {
  /** Absent : l'employé de l'appelant (compte lié). La RH peut en désigner un autre (saisie pour lui, validée d'emblée). */
  employeeId?: string;
  leaveTypeId: string;
  start: string;
  end: string;
  startHalf?: boolean;
  endHalf?: boolean;
  note?: string | null;
  access: AccessContext;
  actor: ActorContext;
}

/**
 * Demander une absence. Contrôles : droit de création, employé en poste, type actif, demi-journées autorisées, au moins un jour décompté, plafond du type,
 * pas dans le passé (sauf la RH), pas avant l'entrée, aucun chevauchement (à la demi-journée), solde suffisant pour un type qui décompte. Deux demandes
 * simultanées du même employé se suivent (verrou de sa fiche). Une demande saisie par la RH pour un autre est validée d'emblée.
 */
@Injectable()
export class RequestLeaveUseCase {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(LEAVE_REQUEST_REPOSITORY) private readonly requests: LeaveRequestRepository,
    @Inject(LEAVE_CONFIG_REPOSITORY) private readonly config: LeaveConfigRepository,
    @Inject(LEAVE_ADJUSTMENT_REPOSITORY) private readonly adjustments: LeaveAdjustmentRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(command: RequestLeaveCommand): Promise<LeaveRequestView> {
    return this.unitOfWork.run(async () => {
      const create = scopeOf(command.access, 'hr.leave.create');
      if (create === null) throw new DomainError('FORBIDDEN', "Vous n'avez pas le droit de demander une absence");
      const mine = await this.employees.findByUserId(command.access.actorId);
      const employee = command.employeeId ? await this.employees.findById(command.employeeId) : mine;
      if (!command.employeeId && !employee) throw new DomainError('VALIDATION', "Aucune fiche employé n'est liée à votre compte : demandez à la RH de la relier");
      if (!employee || !(create === Scope.All || employee.userId === command.access.actorId)) throw new DomainError('NOT_FOUND', 'Employé introuvable');
      if (employee.isArchived) throw new DomainError('CONFLICT', "L'employé est archivé : aucune absence ne peut lui être saisie");

      const type = await this.config.findType(command.leaveTypeId);
      if (!type || !type.active) throw new DomainError('VALIDATION', "Type d'absence inconnu ou désactivé");
      const settings = await this.config.settings();
      const startHalf = command.startHalf === true;
      const endHalf = command.endHalf === true;
      if (!settings.allowHalfDays && (startHalf || endHalf)) throw new DomainError('VALIDATION', 'Les demi-journées ne sont pas autorisées');

      const period = { start: command.start, end: command.end, startHalf, endHalf };
      const days = leaveDays(period, await rulesFor(this.config, command.start, command.end));
      if (days <= 0) throw new DomainError('VALIDATION', 'Aucun jour décompté : la période ne contient que des jours non ouvrés (week-end ou jour férié)');
      if (type.maxDaysPerRequest !== null && days > type.maxDaysPerRequest) throw new DomainError('VALIDATION', `Ce type d'absence est limité à ${type.maxDaysPerRequest} jour(s) par demande`);
      if (command.start < todayOf(this.clock) && !canManage(command.access)) throw new DomainError('VALIDATION', 'Une demande dans le passé est réservée à la RH');
      if (command.start < employee.hiredOn) throw new DomainError('VALIDATION', "La période ne peut pas commencer avant la date d'entrée de l'employé");

      await this.requests.lockEmployee(employee.id);
      const overlapping = await this.requests.findActiveOverlapping(employee.id, command.start, command.end);
      if (overlapping.some((other) => periodsOverlap(period, other.period))) throw new DomainError('CONFLICT', 'Une demande couvre déjà cette période (au moins une demi-journée en commun)');
      if (type.deductsBalance && !settings.allowNegativeBalance) {
        const { available } = await balanceOf({ config: this.config, requests: this.requests, adjustments: this.adjustments }, employee, Number(command.start.slice(0, 4)));
        if (days > available) throw new DomainError('INVARIANT_VIOLATION', `Solde insuffisant : ${available} jour(s) disponible(s), ${days} demandé(s)`);
      }

      // Saisie par la RH pour un autre : validée d'emblée. Un type sans validation l'est aussi. Sa propre demande attend toujours une autre personne si le type l'exige.
      const forSomeoneElse = employee.userId !== command.access.actorId;
      const approvedBy = (forSomeoneElse && create === Scope.All) || !type.requiresApproval ? command.access.actorId : null;
      const request = LeaveRequest.create({
        id: this.ids.next(), employeeId: employee.id, leaveTypeId: type.id, ...period, days, note: command.note, requestedByUserId: command.access.actorId, now: this.clock.now(), approvedBy,
      });
      await this.requests.save(request);
      const view = toLeaveRequestView(request, { employee: employee.fullName, type: type.label });
      await this.audit.record({ actor: command.actor, module: 'hr', entityType: 'LeaveRequest', entityId: request.id, action: AuditAction.Create, newValue: { ...view } });
      return view;
    });
  }
}

export interface DecideLeaveCommand {
  id: string;
  decision: 'APPROVE' | 'REJECT';
  /** Obligatoire pour un refus. */
  note?: string | null;
  version: number;
  access: AccessContext;
  actor: ActorContext;
}

/** Valider ou refuser une demande en attente : jamais la sienne, par le responsable direct (organigramme) ou la RH ; refus motivé ; solde et chevauchement revérifiés à la validation. */
@Injectable()
export class DecideLeaveUseCase {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(LEAVE_REQUEST_REPOSITORY) private readonly requests: LeaveRequestRepository,
    @Inject(LEAVE_CONFIG_REPOSITORY) private readonly config: LeaveConfigRepository,
    @Inject(LEAVE_ADJUSTMENT_REPOSITORY) private readonly adjustments: LeaveAdjustmentRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: DecideLeaveCommand): Promise<LeaveRequestView> {
    return this.unitOfWork.run(async () => {
      const request = await this.requests.findById(command.id);
      const employee = request ? await this.employees.findById(request.employeeId) : null;
      const mine = await this.employees.findByUserId(command.access.actorId);
      if (!request || !employee || !canView(command.access, employee, mine)) throw new DomainError('NOT_FOUND', NOT_FOUND);
      if (!canApprove(command.access, employee, mine)) throw new DomainError('FORBIDDEN', 'Vous ne pouvez pas valider ou refuser cette demande');
      if (request.version !== command.version) throw new DomainError('CONFLICT', 'La demande a été modifiée par un autre utilisateur : rechargez-la');
      const before = toLeaveRequestView(request, { employee: employee.fullName, type: (await this.config.findType(request.leaveTypeId))?.label ?? '—' });
      const now = this.clock.now();

      if (command.decision === 'REJECT') {
        request.reject({ by: command.access.actorId, note: command.note ?? '', now });
      } else {
        if (request.status !== LeaveStatus.Pending) throw new DomainError('CONFLICT', 'Seule une demande en attente peut être validée');
        await this.requests.lockEmployee(employee.id);
        // La situation a pu changer depuis la demande : on revérifie le chevauchement et le solde, sans compter cette demande deux fois.
        const overlapping = await this.requests.findActiveOverlapping(employee.id, request.start, request.end, request.id);
        if (overlapping.some((other) => periodsOverlap(request.period, other.period))) throw new DomainError('INVARIANT_VIOLATION', "Une autre demande couvre maintenant cette période : la validation créerait un chevauchement");
        const type = await this.config.findType(request.leaveTypeId);
        const settings = await this.config.settings();
        if (type?.deductsBalance && !settings.allowNegativeBalance) {
          const { available } = await balanceOf({ config: this.config, requests: this.requests, adjustments: this.adjustments }, employee, request.year, request.id);
          if (request.days > available) throw new DomainError('INVARIANT_VIOLATION', `Solde insuffisant : ${available} jour(s) disponible(s), ${request.days} demandé(s)`);
        }
        request.approve({ by: command.access.actorId, now });
      }
      await this.requests.save(request);
      const after = toLeaveRequestView((await this.requests.findById(request.id)) ?? request, { employee: employee.fullName, type: before.leaveTypeLabel });
      await this.audit.record({ actor: command.actor, module: 'hr', entityType: 'LeaveRequest', entityId: request.id, action: AuditAction.Update, oldValue: { ...before }, newValue: { ...after } });
      return after;
    });
  }
}

export interface CancelLeaveCommand {
  id: string;
  reason?: string | null;
  version: number;
  access: AccessContext;
  actor: ActorContext;
}

/**
 * Annuler une demande. L'employé annule la sienne tant qu'elle est en attente, ou validée mais pas commencée (un motif est exigé pour une demande validée) ;
 * la RH annule n'importe quelle demande en cours ou validée.
 */
@Injectable()
export class CancelLeaveUseCase {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(LEAVE_REQUEST_REPOSITORY) private readonly requests: LeaveRequestRepository,
    @Inject(LEAVE_CONFIG_REPOSITORY) private readonly config: LeaveConfigRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: CancelLeaveCommand): Promise<LeaveRequestView> {
    return this.unitOfWork.run(async () => {
      const request = await this.requests.findById(command.id);
      const employee = request ? await this.employees.findById(request.employeeId) : null;
      const mine = await this.employees.findByUserId(command.access.actorId);
      if (!request || !employee || !canView(command.access, employee, mine)) throw new DomainError('NOT_FOUND', NOT_FOUND);
      const own = employee.userId === command.access.actorId && scopeOf(command.access, 'hr.leave.create') !== null;
      const today = todayOf(this.clock);
      const ownCanCancel = own && (request.status === LeaveStatus.Pending || (request.status === LeaveStatus.Approved && request.start > today));
      if (!ownCanCancel && !canManage(command.access)) {
        throw new DomainError('FORBIDDEN', own ? "Une demande validée ne s'annule plus une fois commencée : contactez la RH" : 'Vous ne pouvez pas annuler cette demande');
      }
      if (request.version !== command.version) throw new DomainError('CONFLICT', 'La demande a été modifiée par un autre utilisateur : rechargez-la');
      const typeLabel = (await this.config.findType(request.leaveTypeId))?.label ?? '—';
      const before = toLeaveRequestView(request, { employee: employee.fullName, type: typeLabel });
      request.cancel({ reason: command.reason, now: this.clock.now() });
      await this.requests.save(request);
      const after = toLeaveRequestView((await this.requests.findById(request.id)) ?? request, { employee: employee.fullName, type: typeLabel });
      await this.audit.record({ actor: command.actor, module: 'hr', entityType: 'LeaveRequest', entityId: request.id, action: AuditAction.Update, oldValue: { ...before }, newValue: { ...after } });
      return after;
    });
  }
}

/** Lire une demande : l'employé, son responsable, la RH et la Direction ; hors de ces cas, « introuvable ». */
@Injectable()
export class GetLeaveRequestHandler {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(LEAVE_REQUEST_REPOSITORY) private readonly requests: LeaveRequestRepository,
    @Inject(LEAVE_CONFIG_REPOSITORY) private readonly config: LeaveConfigRepository,
  ) {}

  async execute(query: { id: string; access: AccessContext }): Promise<LeaveRequestView> {
    const request = await this.requests.findById(query.id);
    const employee = request ? await this.employees.findById(request.employeeId) : null;
    const mine = await this.employees.findByUserId(query.access.actorId);
    if (!request || !employee || !canView(query.access, employee, mine)) throw new DomainError('NOT_FOUND', NOT_FOUND);
    return (await Names.load(this.employees, this.config, [request])).view(request);
  }
}

export interface ListLeaveRequestsQuery {
  /** `mine` (défaut) : les miennes ; `team` : celles de mes collaborateurs directs (organigramme) ; `all` : toutes (RH, Direction). */
  view?: 'mine' | 'team' | 'all';
  status?: LeaveStatus;
  year?: number;
  page: number;
  pageSize: number;
  access: AccessContext;
}

/** Lister des demandes : les miennes, celles de mon équipe directe (pour valider), ou toutes (portée Tous). Le périmètre est calculé côté serveur, jamais choisi par l'appelant. */
@Injectable()
export class ListLeaveRequestsHandler {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(LEAVE_REQUEST_REPOSITORY) private readonly requests: LeaveRequestRepository,
    @Inject(LEAVE_CONFIG_REPOSITORY) private readonly config: LeaveConfigRepository,
  ) {}

  async execute(query: ListLeaveRequestsQuery): Promise<Page<LeaveRequestView>> {
    const view = query.view ?? 'mine';
    const { page, pageSize } = normalizePage(query);
    const mine = await this.employees.findByUserId(query.access.actorId);
    let employeeIds: readonly string[] | undefined;
    if (view === 'all') {
      if (scopeOf(query.access, 'hr.leave.read') !== Scope.All) throw new DomainError('FORBIDDEN', "Vous n'avez pas le droit de voir toutes les demandes");
    } else if (view === 'team') {
      if (scopeOf(query.access, 'hr.leave.approve') === null) throw new DomainError('FORBIDDEN', "Vous n'avez pas le droit de valider des demandes");
      employeeIds = mine ? (await this.employees.allActive(MAX_EMPLOYEES)).filter((e) => e.managerEmployeeId === mine.id).map((e) => e.id) : [];
    } else {
      if (scopeOf(query.access, 'hr.leave.read') === null) throw new DomainError('FORBIDDEN', "Vous n'avez pas le droit de voir des demandes");
      employeeIds = mine ? [mine.id] : [];
    }
    const result = await this.requests.list({ page, pageSize, employeeIds, status: query.status, year: query.year });
    const names = await Names.load(this.employees, this.config, result.items);
    return { ...result, items: result.items.map((r) => names.view(r)) };
  }
}

// ─────────────────────────────── Soldes et calendrier ───────────────────────────────

/** Solde d'un employé pour une année : le sien, celui d'un collaborateur direct, ou n'importe lequel (RH, Direction) ; sinon « introuvable ». */
@Injectable()
export class GetLeaveBalanceHandler {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(LEAVE_REQUEST_REPOSITORY) private readonly requests: LeaveRequestRepository,
    @Inject(LEAVE_CONFIG_REPOSITORY) private readonly config: LeaveConfigRepository,
    @Inject(LEAVE_ADJUSTMENT_REPOSITORY) private readonly adjustments: LeaveAdjustmentRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(query: { employeeId?: string; year?: number; access: AccessContext }): Promise<LeaveBalanceView> {
    const mine = await this.employees.findByUserId(query.access.actorId);
    const employee = query.employeeId ? await this.employees.findById(query.employeeId) : mine;
    if (!employee || !canView(query.access, employee, mine)) throw new DomainError('NOT_FOUND', 'Employé introuvable');
    const year = query.year ?? Number(todayOf(this.clock).slice(0, 4));
    if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new DomainError('VALIDATION', "L'année doit être comprise entre 2000 et 2100");
    return { employeeId: employee.id, employeeName: employee.fullName, ...(await balanceOf({ config: this.config, requests: this.requests, adjustments: this.adjustments }, employee, year)) };
  }
}

/**
 * Calendrier d'équipe : les absences VALIDÉES des employés en poste d'un service sur une période de trois mois au plus. La RH et la Direction choisissent le service
 * (ou voient tout) ; les autres voient celui de leur fiche. Un collègue voit seulement « absent » : le type n'est donné qu'à l'employé, son responsable, la RH et la Direction.
 */
@Injectable()
export class GetTeamCalendarHandler {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(LEAVE_REQUEST_REPOSITORY) private readonly requests: LeaveRequestRepository,
    @Inject(LEAVE_CONFIG_REPOSITORY) private readonly config: LeaveConfigRepository,
  ) {}

  async execute(query: { from: string; to: string; department?: string; access: AccessContext }): Promise<TeamCalendarView> {
    if (scopeOf(query.access, 'hr.leave.read') === null) throw new DomainError('FORBIDDEN', "Vous n'avez pas le droit de voir le calendrier");
    if (!isIsoDate(query.from) || !isIsoDate(query.to) || query.to < query.from) throw new DomainError('VALIDATION', 'La période doit être deux dates valides (AAAA-MM-JJ), la fin après le début');
    if (dayOrdinal(query.to) - dayOrdinal(query.from) + 1 > MAX_CALENDAR_DAYS) throw new DomainError('VALIDATION', `La période ne peut pas dépasser ${MAX_CALENDAR_DAYS} jours`);
    const mine = await this.employees.findByUserId(query.access.actorId);
    const wide = scopeOf(query.access, 'hr.leave.read') === Scope.All;
    // Hors portée Tous, on ne voit que le service de sa propre fiche (aucune fiche = personne).
    const department = wide ? query.department?.trim() || null : mine?.department ?? null;
    const visible = !wide && !mine ? [] : (await this.employees.allActive(MAX_EMPLOYEES)).filter((e) => department === null || e.department.toLowerCase() === department.toLowerCase());
    const byId = new Map(visible.map((e) => [e.id, e]));
    const [approved, types, holidays] = await Promise.all([
      this.requests.approvedBetween(query.from, query.to, visible.map((e) => e.id)),
      this.config.types(true),
      this.config.holidays(query.from, query.to),
    ]);
    const labels = new Map(types.map((t) => [t.id, t.label]));
    const entries: CalendarEntry[] = approved.flatMap((request) => {
      const employee = byId.get(request.employeeId);
      if (!employee) return [];
      return [{
        requestId: request.id, employeeId: employee.id, employeeName: employee.fullName, department: employee.department, start: request.start, end: request.end,
        startHalf: request.startHalf, endHalf: request.endHalf, leaveTypeLabel: canView(query.access, employee, mine) ? labels.get(request.leaveTypeId) ?? null : null,
      }];
    });
    entries.sort((a, b) => a.start.localeCompare(b.start) || a.employeeName.localeCompare(b.employeeName, 'fr'));
    return { from: query.from, to: query.to, department, entries, holidays: holidays.map(toHolidayView) };
  }
}

// ─────────────────────────────── Paramétrage (RH) ───────────────────────────────

const requireManage = (access: AccessContext): void => {
  if (!canManage(access)) throw new DomainError('FORBIDDEN', "Vous n'avez pas le droit de paramétrer les absences");
};

/** Types d'absence : lisibles de ceux qui peuvent demander (les actifs) ; la RH voit aussi les désactivés. */
@Injectable()
export class ListLeaveTypesHandler {
  constructor(@Inject(LEAVE_CONFIG_REPOSITORY) private readonly config: LeaveConfigRepository) {}

  async execute(query: { includeInactive?: boolean; access: AccessContext }): Promise<LeaveTypeView[]> {
    if (scopeOf(query.access, 'hr.leave.read') === null) throw new DomainError('FORBIDDEN', "Vous n'avez pas le droit de voir les types d'absence");
    const includeInactive = query.includeInactive === true && canManage(query.access);
    return (await this.config.types(includeInactive)).sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, 'fr')).map(toLeaveTypeView);
  }
}

/** Créer un type d'absence (RH) : code unique, audité. */
@Injectable()
export class CreateLeaveTypeUseCase {
  constructor(
    @Inject(LEAVE_CONFIG_REPOSITORY) private readonly config: LeaveConfigRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(command: { code: string; label: string; deductsBalance?: boolean; requiresApproval?: boolean; maxDaysPerRequest?: number | null; sortOrder?: number; access: AccessContext; actor: ActorContext }): Promise<LeaveTypeView> {
    return this.unitOfWork.run(async () => {
      requireManage(command.access);
      const type = LeaveType.create({ ...command, id: this.ids.next(), now: this.clock.now() });
      if (await this.config.findTypeByCode(type.code)) throw new DomainError('CONFLICT', `Le code ${type.code} existe déjà`);
      await this.config.saveType(type);
      const view = toLeaveTypeView(type);
      await this.audit.record({ actor: command.actor, module: 'hr', entityType: 'LeaveType', entityId: type.id, action: AuditAction.Create, newValue: { ...view } });
      return view;
    });
  }
}

/** Modifier ou désactiver un type d'absence (RH) : version contrôlée, audité avant/après. */
@Injectable()
export class UpdateLeaveTypeUseCase {
  constructor(
    @Inject(LEAVE_CONFIG_REPOSITORY) private readonly config: LeaveConfigRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: { id: string; version: number; label?: string; deductsBalance?: boolean; requiresApproval?: boolean; maxDaysPerRequest?: number | null; active?: boolean; sortOrder?: number; access: AccessContext; actor: ActorContext }): Promise<LeaveTypeView> {
    return this.unitOfWork.run(async () => {
      requireManage(command.access);
      const type = await this.config.findType(command.id);
      if (!type) throw new DomainError('NOT_FOUND', "Type d'absence introuvable");
      if (type.version !== command.version) throw new DomainError('CONFLICT', "Le type d'absence a été modifié par un autre utilisateur : rechargez-le");
      const before = toLeaveTypeView(type);
      type.update(command);
      await this.config.saveType(type);
      const after = toLeaveTypeView((await this.config.findType(type.id)) ?? type);
      await this.audit.record({ actor: command.actor, module: 'hr', entityType: 'LeaveType', entityId: type.id, action: AuditAction.Update, oldValue: { ...before }, newValue: { ...after } });
      return after;
    });
  }
}

/** Règles de congés : lisibles de ceux qui peuvent demander (le formulaire en a besoin), modifiables par la RH. */
@Injectable()
export class GetLeaveSettingsHandler {
  constructor(@Inject(LEAVE_CONFIG_REPOSITORY) private readonly config: LeaveConfigRepository) {}

  async execute(query: { access: AccessContext }): Promise<LeaveSettingsView> {
    if (scopeOf(query.access, 'hr.leave.read') === null) throw new DomainError('FORBIDDEN', "Vous n'avez pas le droit de voir les règles de congés");
    return toLeaveSettingsView(await this.config.settings());
  }
}

@Injectable()
export class UpdateLeaveSettingsUseCase {
  constructor(
    @Inject(LEAVE_CONFIG_REPOSITORY) private readonly config: LeaveConfigRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: { version: number; accrualDaysPerMonth: number; countsSaturday: boolean; allowHalfDays: boolean; allowNegativeBalance: boolean; access: AccessContext; actor: ActorContext }): Promise<LeaveSettingsView> {
    return this.unitOfWork.run(async () => {
      requireManage(command.access);
      validateLeaveSettings(command);
      const current = await this.config.settings();
      if (current.version !== command.version) throw new DomainError('CONFLICT', 'Les règles de congés ont été modifiées par un autre utilisateur : rechargez-les');
      const next = { accrualDaysPerMonth: command.accrualDaysPerMonth, countsSaturday: command.countsSaturday, allowHalfDays: command.allowHalfDays, allowNegativeBalance: command.allowNegativeBalance, version: current.version };
      await this.config.saveSettings(next);
      const after = toLeaveSettingsView(await this.config.settings());
      await this.audit.record({ actor: command.actor, module: 'hr', entityType: 'LeaveSettings', entityId: '1', action: AuditAction.Update, oldValue: { ...toLeaveSettingsView(current) }, newValue: { ...after } });
      return after;
    });
  }
}

/** Jours fériés d'une année : lisibles de ceux qui peuvent voir des demandes. */
@Injectable()
export class ListHolidaysHandler {
  constructor(@Inject(LEAVE_CONFIG_REPOSITORY) private readonly config: LeaveConfigRepository) {}

  async execute(query: { year: number; access: AccessContext }): Promise<HolidayView[]> {
    if (scopeOf(query.access, 'hr.leave.read') === null) throw new DomainError('FORBIDDEN', "Vous n'avez pas le droit de voir les jours fériés");
    if (!Number.isInteger(query.year) || query.year < 2000 || query.year > 2100) throw new DomainError('VALIDATION', "L'année doit être comprise entre 2000 et 2100");
    return (await this.config.holidays(`${query.year}-01-01`, `${query.year}-12-31`)).map(toHolidayView);
  }
}

/** Saisir un jour férié (RH) : un seul par date, audité. Il ne modifie pas les demandes déjà posées (leurs jours sont figés). */
@Injectable()
export class AddHolidayUseCase {
  constructor(
    @Inject(LEAVE_CONFIG_REPOSITORY) private readonly config: LeaveConfigRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(command: { day: string; label: string; access: AccessContext; actor: ActorContext }): Promise<HolidayView> {
    return this.unitOfWork.run(async () => {
      requireManage(command.access);
      const valid = validateHoliday(command);
      if (await this.config.findHolidayByDay(valid.day)) throw new DomainError('CONFLICT', 'Un jour férié existe déjà à cette date');
      const holiday = { id: this.ids.next(), ...valid };
      await this.config.addHoliday(holiday);
      const view = toHolidayView(holiday);
      await this.audit.record({ actor: command.actor, module: 'hr', entityType: 'PublicHoliday', entityId: holiday.id, action: AuditAction.Create, newValue: { ...view } });
      return view;
    });
  }
}

/** Retirer un jour férié (RH) : audité ; les demandes déjà posées gardent leurs jours. */
@Injectable()
export class RemoveHolidayUseCase {
  constructor(
    @Inject(LEAVE_CONFIG_REPOSITORY) private readonly config: LeaveConfigRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: { id: string; access: AccessContext; actor: ActorContext }): Promise<void> {
    await this.unitOfWork.run(async () => {
      requireManage(command.access);
      const holiday = await this.config.findHoliday(command.id);
      if (!holiday) throw new DomainError('NOT_FOUND', 'Jour férié introuvable');
      await this.config.removeHoliday(holiday.id);
      await this.audit.record({ actor: command.actor, module: 'hr', entityType: 'PublicHoliday', entityId: holiday.id, action: AuditAction.Delete, oldValue: { ...toHolidayView(holiday) } });
    });
  }
}

/** Ajuster le solde d'un employé pour une année (report, correction) : RH seulement, motif obligatoire, ajout seul, audité. */
@Injectable()
export class AdjustBalanceUseCase {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(LEAVE_ADJUSTMENT_REPOSITORY) private readonly adjustments: LeaveAdjustmentRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(command: { employeeId: string; year: number; days: number; reason: string; access: AccessContext; actor: ActorContext }): Promise<AdjustmentView> {
    return this.unitOfWork.run(async () => {
      requireManage(command.access);
      const valid = validateAdjustment(command);
      const employee = await this.employees.findById(command.employeeId);
      if (!employee) throw new DomainError('NOT_FOUND', 'Employé introuvable');
      const adjustment = { id: this.ids.next(), employeeId: employee.id, ...valid, createdByUserId: command.access.actorId, createdAt: this.clock.now() };
      await this.adjustments.add(adjustment);
      const view = toAdjustmentView(adjustment);
      await this.audit.record({ actor: command.actor, module: 'hr', entityType: 'LeaveAdjustment', entityId: adjustment.id, action: AuditAction.Create, newValue: { ...view } });
      return view;
    });
  }
}

/** Ajustements d'un employé pour une année : RH seulement (le détail du solde, lui, est lisible de l'employé). */
@Injectable()
export class ListAdjustmentsHandler {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(LEAVE_ADJUSTMENT_REPOSITORY) private readonly adjustments: LeaveAdjustmentRepository,
  ) {}

  async execute(query: { employeeId: string; year: number; access: AccessContext }): Promise<AdjustmentView[]> {
    requireManage(query.access);
    if (!(await this.employees.findById(query.employeeId))) throw new DomainError('NOT_FOUND', 'Employé introuvable');
    return (await this.adjustments.forYear(query.employeeId, query.year)).map(toAdjustmentView);
  }
}
