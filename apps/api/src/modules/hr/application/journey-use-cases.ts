import { Inject, Injectable } from '@nestjs/common';
import { ActorContext, CLOCK, Clock, DomainError, ID_GENERATOR, IdGenerator, Page, UNIT_OF_WORK, UnitOfWork } from '../../../shared-kernel';
import { AUDIT_RECORDER, AuditAction, AuditRecorder } from '../../audit';
import { Scope, decideFor } from '../../iam';
import type { AccessContext } from '../../iam';
import { Employee } from '../domain/employee';
import { EMPLOYEE_REPOSITORY, EmployeeRepository } from '../domain/employee-repository';
import { JOURNEY_KINDS, Journey, JourneyKind, JourneyStatus } from '../domain/journey';
import { JOURNEY_REPOSITORY, JOURNEY_TEMPLATE_REPOSITORY, JourneyRepository, JourneyTemplateRepository } from '../domain/journey-repositories';
import { isIsoDate } from '../domain/leave-calendar';
import { USER_DIRECTORY, UserDirectory } from '../domain/user-directory';
import { JourneyTemplateView, JourneyView, toJourneyView, toTemplateView } from './journey-view';

const NOT_FOUND = 'Parcours introuvable';
const MAX_PAGE_SIZE = 100;

/** Portée accordée pour une permission (aucun objet précis), `null` si elle n'est pas accordée. */
function scopeOf(access: AccessContext, permission: string): Scope | null {
  const decision = decideFor(access, permission, undefined);
  return decision.allowed ? decision.scope : null;
}

/** Qui voit un parcours : la RH, la Direction et le Super administrateur (lecture en portée Tous), et l'employé concerné (portée Propre). Sinon : « introuvable ». */
function canView(access: AccessContext, employee: Employee): boolean {
  const read = scopeOf(access, 'hr.journey.read');
  if (read === Scope.All) return true;
  return read !== null && employee.userId !== null && employee.userId === access.actorId;
}

const canManage = (access: AccessContext): boolean => scopeOf(access, 'hr.journey.manage') === Scope.All;

function assertManage(access: AccessContext): void {
  if (!canManage(access)) throw new DomainError('FORBIDDEN', "Vous n'avez pas le droit de gérer les parcours");
}

function assertKind(kind: string): JourneyKind {
  if (!JOURNEY_KINDS.includes(kind as JourneyKind)) throw new DomainError('VALIDATION', 'Nature de parcours inconnue (ONBOARDING ou OFFBOARDING)');
  return kind as JourneyKind;
}

const todayOf = (clock: Clock): string => clock.now().toISOString().slice(0, 10);

/** Compose les vues : noms des employés et des auteurs des tâches cochées, chargés en une fois. */
class Views {
  private constructor(private readonly employees: Map<string, Employee>, private readonly users: Map<string, string>, private readonly today: string) {}

  static async load(employees: EmployeeRepository, directory: UserDirectory, journeys: readonly Journey[], today: string): Promise<Views> {
    const found = new Map((await employees.findByIds([...new Set(journeys.map((j) => j.employeeId))])).map((e) => [e.id, e]));
    const userIds = [...new Set(journeys.flatMap((j) => j.tasks.flatMap((t) => (t.doneByUserId ? [t.doneByUserId] : []))))];
    const users = new Map((userIds.length ? await directory.findMany(userIds) : []).map((u) => [u.id, u.displayName]));
    return new Views(found, users, today);
  }

  view(journey: Journey): JourneyView {
    return toJourneyView(journey, { employee: this.employees.get(journey.employeeId)?.fullName ?? '—', users: this.users }, this.today);
  }
}

// ─────────────────────────────── Modèles ───────────────────────────────

/** Les modèles de parcours : réservés à ceux qui voient tous les parcours (RH, Direction, Super administrateur). */
@Injectable()
export class ListJourneyTemplatesHandler {
  constructor(@Inject(JOURNEY_TEMPLATE_REPOSITORY) private readonly templates: JourneyTemplateRepository) {}

  async execute(query: { access: AccessContext }): Promise<JourneyTemplateView[]> {
    if (scopeOf(query.access, 'hr.journey.read') !== Scope.All) throw new DomainError('FORBIDDEN', "Les modèles de parcours sont réservés à ceux qui voient tous les parcours");
    return (await this.templates.all()).map(toTemplateView).sort((a, b) => a.kind.localeCompare(b.kind));
  }
}

/** Remplace les tâches d'un modèle (RH) : version lue, audit avant / après. Les parcours déjà lancés ne changent pas. */
@Injectable()
export class UpdateJourneyTemplateUseCase {
  constructor(
    @Inject(JOURNEY_TEMPLATE_REPOSITORY) private readonly templates: JourneyTemplateRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  execute(command: { kind: string; version: number; tasks: { title?: string; owner?: string; dueOffsetDays?: number }[]; access: AccessContext; actor: ActorContext }): Promise<JourneyTemplateView> {
    return this.unitOfWork.run(async () => {
      assertManage(command.access);
      const kind = assertKind(command.kind);
      const template = await this.templates.get(kind);
      if (!template) throw new DomainError('NOT_FOUND', 'Modèle introuvable');
      if (template.version !== command.version) throw new DomainError('CONFLICT', 'Le modèle a été modifié par un autre utilisateur : rechargez-le');
      const before = toTemplateView(template);
      template.replaceTasks(command.tasks);
      await this.templates.save(template);
      const after = toTemplateView((await this.templates.get(kind)) ?? template);
      await this.audit.record({ actor: command.actor, module: 'hr', entityType: 'JourneyTemplate', entityId: template.id, action: AuditAction.Update, oldValue: { ...before }, newValue: { ...after } });
      return after;
    });
  }
}

// ─────────────────────────────── Parcours ───────────────────────────────

/**
 * Lancer un parcours (RH), à la main : l'employé doit être en poste ; un seul parcours en cours par employé et par nature (verrou de la fiche) ; les tâches sont copiées
 * du modèle. Date de référence : par défaut la date d'entrée (intégration) ou aujourd'hui (départ). Audit.
 */
@Injectable()
export class LaunchJourneyUseCase {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(JOURNEY_REPOSITORY) private readonly journeys: JourneyRepository,
    @Inject(JOURNEY_TEMPLATE_REPOSITORY) private readonly templates: JourneyTemplateRepository,
    @Inject(USER_DIRECTORY) private readonly directory: UserDirectory,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  execute(command: { employeeId: string; kind: string; referenceDate?: string; access: AccessContext; actor: ActorContext }): Promise<JourneyView> {
    return this.unitOfWork.run(async () => {
      assertManage(command.access);
      const kind = assertKind(command.kind);
      const employee = await this.employees.findById(command.employeeId);
      if (!employee) throw new DomainError('NOT_FOUND', 'Employé introuvable');
      if (employee.isArchived) throw new DomainError('CONFLICT', "L'employé est archivé : aucun parcours ne peut être lancé");
      const template = await this.templates.get(kind);
      if (!template) throw new DomainError('NOT_FOUND', 'Modèle introuvable');
      const today = todayOf(this.clock);
      const referenceDate = command.referenceDate ?? (kind === 'ONBOARDING' ? employee.hiredOn : today);
      if (!isIsoDate(referenceDate)) throw new DomainError('VALIDATION', 'La date de référence doit être une date valide (AAAA-MM-JJ)');
      await this.journeys.lockEmployee(employee.id);
      if (await this.journeys.activeOf(employee.id, kind)) throw new DomainError('CONFLICT', 'Un parcours de cette nature est déjà en cours pour cet employé');
      const journey = Journey.launch({
        id: this.ids.next(), employeeId: employee.id, kind, referenceDate, launchedByUserId: command.actor.userId ?? '', template: template.tasks, newId: () => this.ids.next(), now: this.clock.now(),
      });
      await this.journeys.save(journey);
      const view = (await Views.load(this.employees, this.directory, [journey], today)).view(journey);
      await this.audit.record({ actor: command.actor, module: 'hr', entityType: 'Journey', entityId: journey.id, action: AuditAction.Create, newValue: { ...view } });
      return view;
    });
  }
}

type Change = (journey: Journey) => Promise<void> | void;

/** Gabarit commun des changements d'un parcours (cocher, décocher, annuler) : droit de gestion, version lue, audit avant / après. */
abstract class JourneyChange {
  constructor(
    protected readonly employees: EmployeeRepository,
    protected readonly journeys: JourneyRepository,
    protected readonly directory: UserDirectory,
    protected readonly audit: AuditRecorder,
    protected readonly unitOfWork: UnitOfWork,
    protected readonly clock: Clock,
  ) {}

  protected run(command: { id: string; version: number; access: AccessContext; actor: ActorContext }, change: Change): Promise<JourneyView> {
    return this.unitOfWork.run(async () => {
      assertManage(command.access);
      const journey = await this.journeys.findById(command.id);
      if (!journey) throw new DomainError('NOT_FOUND', NOT_FOUND);
      if (journey.version !== command.version) throw new DomainError('CONFLICT', 'Le parcours a été modifié par un autre utilisateur : rechargez-le');
      const today = todayOf(this.clock);
      const before = (await Views.load(this.employees, this.directory, [journey], today)).view(journey);
      await change(journey);
      await this.journeys.save(journey);
      const saved = (await this.journeys.findById(journey.id)) ?? journey;
      const after = (await Views.load(this.employees, this.directory, [saved], today)).view(saved);
      await this.audit.record({ actor: command.actor, module: 'hr', entityType: 'Journey', entityId: journey.id, action: AuditAction.Update, oldValue: { ...before }, newValue: { ...after } });
      return after;
    });
  }
}

/** Cocher une tâche : la date et l'auteur sont gardés ; la dernière tâche cochée termine le parcours. */
@Injectable()
export class CompleteJourneyTaskUseCase extends JourneyChange {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY) employees: EmployeeRepository,
    @Inject(JOURNEY_REPOSITORY) journeys: JourneyRepository,
    @Inject(USER_DIRECTORY) directory: UserDirectory,
    @Inject(AUDIT_RECORDER) audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) unitOfWork: UnitOfWork,
    @Inject(CLOCK) clock: Clock,
  ) {
    super(employees, journeys, directory, audit, unitOfWork, clock);
  }

  execute(command: { id: string; taskId: string; version: number; access: AccessContext; actor: ActorContext }): Promise<JourneyView> {
    return this.run(command, (journey) => journey.complete(command.taskId, command.actor.userId ?? '', this.clock.now()));
  }
}

/** Décocher une tâche cochée par erreur ; un parcours terminé redevient en cours, sauf si un autre parcours de la même nature l'est déjà. */
@Injectable()
export class ReopenJourneyTaskUseCase extends JourneyChange {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY) employees: EmployeeRepository,
    @Inject(JOURNEY_REPOSITORY) journeys: JourneyRepository,
    @Inject(USER_DIRECTORY) directory: UserDirectory,
    @Inject(AUDIT_RECORDER) audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) unitOfWork: UnitOfWork,
    @Inject(CLOCK) clock: Clock,
  ) {
    super(employees, journeys, directory, audit, unitOfWork, clock);
  }

  execute(command: { id: string; taskId: string; version: number; access: AccessContext; actor: ActorContext }): Promise<JourneyView> {
    return this.run(command, async (journey) => {
      if (journey.status === 'COMPLETED') {
        await this.journeys.lockEmployee(journey.employeeId);
        const other = await this.journeys.activeOf(journey.employeeId, journey.kind);
        if (other && other.id !== journey.id) throw new DomainError('CONFLICT', 'Un autre parcours de cette nature est déjà en cours pour cet employé');
      }
      journey.reopen(command.taskId);
    });
  }
}

/** Annuler un parcours en cours (RH) : il est conservé avec ses tâches. */
@Injectable()
export class CancelJourneyUseCase extends JourneyChange {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY) employees: EmployeeRepository,
    @Inject(JOURNEY_REPOSITORY) journeys: JourneyRepository,
    @Inject(USER_DIRECTORY) directory: UserDirectory,
    @Inject(AUDIT_RECORDER) audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) unitOfWork: UnitOfWork,
    @Inject(CLOCK) clock: Clock,
  ) {
    super(employees, journeys, directory, audit, unitOfWork, clock);
  }

  execute(command: { id: string; version: number; access: AccessContext; actor: ActorContext }): Promise<JourneyView> {
    return this.run(command, (journey) => journey.cancel(this.clock.now()));
  }
}

/** Un parcours : la RH, la Direction et le Super administrateur, ou l'employé concerné ; sinon « introuvable ». */
@Injectable()
export class GetJourneyHandler {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(JOURNEY_REPOSITORY) private readonly journeys: JourneyRepository,
    @Inject(USER_DIRECTORY) private readonly directory: UserDirectory,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(query: { id: string; access: AccessContext }): Promise<JourneyView> {
    const journey = await this.journeys.findById(query.id);
    const employee = journey ? await this.employees.findById(journey.employeeId) : null;
    if (!journey || !employee || !canView(query.access, employee)) throw new DomainError('NOT_FOUND', NOT_FOUND);
    return (await Views.load(this.employees, this.directory, [journey], todayOf(this.clock))).view(journey);
  }
}

/** Liste paginée : « mes parcours » (portée Propre) ou, avec la portée Tous, tous les parcours ou ceux d'un employé. Un employé hors portée est « introuvable ». */
@Injectable()
export class ListJourneysHandler {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(JOURNEY_REPOSITORY) private readonly journeys: JourneyRepository,
    @Inject(USER_DIRECTORY) private readonly directory: UserDirectory,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(query: { employeeId?: string; kind?: string; status?: JourneyStatus; page: number; pageSize: number; access: AccessContext }): Promise<Page<JourneyView>> {
    const read = scopeOf(query.access, 'hr.journey.read');
    if (read === null) throw new DomainError('FORBIDDEN', "Vous n'avez pas le droit de voir des parcours");
    const kind = query.kind ? assertKind(query.kind) : undefined;
    const page = Math.max(1, Math.floor(query.page));
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(query.pageSize)));
    let employeeIds: readonly string[] | undefined;
    if (query.employeeId) {
      const employee = await this.employees.findById(query.employeeId);
      if (!employee || !canView(query.access, employee)) throw new DomainError('NOT_FOUND', 'Employé introuvable');
      employeeIds = [employee.id];
    } else if (read !== Scope.All) {
      const mine = await this.employees.findByUserId(query.access.actorId);
      employeeIds = mine ? [mine.id] : [];
    }
    const result = await this.journeys.list({ page, pageSize, employeeIds, kind, status: query.status });
    const views = await Views.load(this.employees, this.directory, result.items, todayOf(this.clock));
    return { ...result, items: result.items.map((j) => views.view(j)) };
  }
}
