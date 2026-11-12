import { Inject, Injectable } from '@nestjs/common';
import { ActorContext, CLOCK, Clock, DomainError, ID_GENERATOR, IdGenerator, Page, UNIT_OF_WORK, UnitOfWork } from '../../../shared-kernel';
import { AUDIT_RECORDER, AuditAction, AuditRecorder } from '../../audit';
import { Scope, decideFor } from '../../iam';
import type { AccessContext } from '../../iam';
import { Contract, ContractType } from '../domain/contract';
import { CONTRACT_REPOSITORY, CONTRACT_TYPE_REPOSITORY, ContractRepository, ContractTypeRepository } from '../domain/contract-repositories';
import { Employee } from '../domain/employee';
import { EMPLOYEE_REPOSITORY, EmployeeRepository } from '../domain/employee-repository';
import { isIsoDate } from '../domain/leave-calendar';
import { ContractTypeView, ContractView, DeadlineView, toContractTypeView, toContractView } from './contract-view';

const NOT_FOUND = 'Contrat introuvable';
const MAX_PAGE_SIZE = 100;
export const MAX_DEADLINE_DAYS = 365;
export const DEFAULT_DEADLINE_DAYS = 60;

/** Portée accordée pour une permission (aucun objet précis), `null` si elle n'est pas accordée. */
function scopeOf(access: AccessContext, permission: string): Scope | null {
  const decision = decideFor(access, permission, undefined);
  return decision.allowed ? decision.scope : null;
}

/** Qui voit un contrat : la RH, la Direction et le Super administrateur (lecture en portée Tous), et l'employé lui-même (portée Propre). Hors de ces cas : « introuvable ». */
function canView(access: AccessContext, employee: Employee): boolean {
  const read = scopeOf(access, 'hr.contract.read');
  if (read === Scope.All) return true;
  return read !== null && employee.userId !== null && employee.userId === access.actorId;
}

/** Qui gère les contrats (créer, ajuster, terminer, paramétrer les types) : la portée Tous de `hr.contract.manage` (RH, Super administrateur). */
const canManage = (access: AccessContext): boolean => scopeOf(access, 'hr.contract.manage') === Scope.All;

function assertManage(access: AccessContext): void {
  if (!canManage(access)) throw new DomainError('FORBIDDEN', "Vous n'avez pas le droit de gérer les contrats");
}

const todayOf = (clock: Clock): string => clock.now().toISOString().slice(0, 10);
const addDays = (iso: string, days: number): string => new Date(new Date(`${iso}T00:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);
const daysBetween = (from: string, to: string): number => Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000);

/** Compose les vues : les noms des employés et les types, chargés en une fois. */
class Views {
  private constructor(private readonly employees: Map<string, Employee>, private readonly types: Map<string, ContractType>) {}

  static async load(employees: EmployeeRepository, types: ContractTypeRepository, contracts: readonly Contract[]): Promise<Views> {
    const found = new Map((await employees.findByIds([...new Set(contracts.map((c) => c.employeeId))])).map((e) => [e.id, e]));
    const kinds = new Map((await types.findTypes([...new Set(contracts.map((c) => c.contractTypeId))])).map((t) => [t.id, t]));
    return new Views(found, kinds);
  }

  view(contract: Contract): ContractView {
    return toContractView(contract, { employee: this.employees.get(contract.employeeId)?.fullName ?? '—', type: this.types.get(contract.contractTypeId) });
  }

  name(employeeId: string): string {
    return this.employees.get(employeeId)?.fullName ?? '—';
  }

  typeOf(contract: Contract): ContractType | undefined {
    return this.types.get(contract.contractTypeId);
  }
}

// ─────────────────────────────── Types de contrat ───────────────────────────────

/** Les types de contrat : tout titulaire du droit de lecture les voit (pour comprendre un contrat) ; les types désactivés ne sont visibles que de la RH. */
@Injectable()
export class ListContractTypesHandler {
  constructor(@Inject(CONTRACT_TYPE_REPOSITORY) private readonly types: ContractTypeRepository) {}

  async execute(query: { includeInactive?: boolean; access: AccessContext }): Promise<ContractTypeView[]> {
    if (scopeOf(query.access, 'hr.contract.read') === null) throw new DomainError('FORBIDDEN', "Vous n'avez pas le droit de lire les types de contrat");
    const includeInactive = query.includeInactive === true && canManage(query.access);
    return (await this.types.types(includeInactive)).map(toContractTypeView);
  }
}

@Injectable()
export class CreateContractTypeUseCase {
  constructor(
    @Inject(CONTRACT_TYPE_REPOSITORY) private readonly types: ContractTypeRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  execute(command: { code: string; label: string; fixedTerm: boolean; sortOrder?: number; access: AccessContext; actor: ActorContext }): Promise<ContractTypeView> {
    return this.unitOfWork.run(async () => {
      assertManage(command.access);
      const type = ContractType.create({ id: this.ids.next(), code: command.code, label: command.label, fixedTerm: command.fixedTerm, sortOrder: command.sortOrder, now: this.clock.now() });
      if (await this.types.findTypeByCode(type.code)) throw new DomainError('CONFLICT', `Le code « ${type.code} » est déjà pris`);
      await this.types.saveType(type);
      const view = toContractTypeView(type);
      await this.audit.record({ actor: command.actor, module: 'hr', entityType: 'ContractType', entityId: type.id, action: AuditAction.Create, newValue: { ...view } });
      return view;
    });
  }
}

@Injectable()
export class UpdateContractTypeUseCase {
  constructor(
    @Inject(CONTRACT_TYPE_REPOSITORY) private readonly types: ContractTypeRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  execute(command: { id: string; version: number; label?: string; active?: boolean; sortOrder?: number; access: AccessContext; actor: ActorContext }): Promise<ContractTypeView> {
    return this.unitOfWork.run(async () => {
      assertManage(command.access);
      const type = await this.types.findType(command.id);
      if (!type) throw new DomainError('NOT_FOUND', 'Type de contrat introuvable');
      if (type.version !== command.version) throw new DomainError('CONFLICT', 'Le type de contrat a été modifié par un autre utilisateur : rechargez-le');
      const before = toContractTypeView(type);
      type.update(command);
      await this.types.saveType(type);
      const after = toContractTypeView((await this.types.findType(type.id)) ?? type);
      await this.audit.record({ actor: command.actor, module: 'hr', entityType: 'ContractType', entityId: type.id, action: AuditAction.Update, oldValue: { ...before }, newValue: { ...after } });
      return after;
    });
  }
}

// ─────────────────────────────── Contrats ───────────────────────────────

/**
 * Créer un contrat (RH) : l'employé doit être en poste, le type actif ; le contrat ne commence pas avant l'entrée de l'employé ; **un seul contrat en cours** par employé ;
 * il ne recouvre aucun contrat terminé. Deux créations simultanées pour le même employé se suivent (verrou de sa fiche). Audit.
 */
@Injectable()
export class CreateContractUseCase {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(CONTRACT_REPOSITORY) private readonly contracts: ContractRepository,
    @Inject(CONTRACT_TYPE_REPOSITORY) private readonly types: ContractTypeRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  execute(command: { employeeId: string; contractTypeId: string; start: string; end?: string | null; probationEnd?: string | null; access: AccessContext; actor: ActorContext }): Promise<ContractView> {
    return this.unitOfWork.run(async () => {
      assertManage(command.access);
      const employee = await this.employees.findById(command.employeeId);
      if (!employee) throw new DomainError('NOT_FOUND', 'Employé introuvable');
      if (employee.isArchived) throw new DomainError('CONFLICT', "L'employé est archivé : aucun contrat ne peut lui être ajouté");
      const type = await this.types.findType(command.contractTypeId);
      if (!type || !type.active) throw new DomainError('VALIDATION', 'Type de contrat inconnu ou désactivé');
      const contract = Contract.create({ id: this.ids.next(), employeeId: employee.id, contractTypeId: type.id, fixedTerm: type.fixedTerm, start: command.start, end: command.end, probationEnd: command.probationEnd, now: this.clock.now() });
      if (contract.start < employee.hiredOn) throw new DomainError('VALIDATION', "Le contrat ne peut pas commencer avant la date d'entrée de l'employé");
      await this.contracts.lockEmployee(employee.id);
      const existing = await this.contracts.ofEmployee(employee.id);
      if (existing.some((c) => c.isActive)) throw new DomainError('CONFLICT', 'Un contrat est déjà en cours pour cet employé : terminez-le avant d’en ajouter un autre');
      const overlap = existing.find((c) => c.lastDay !== null && contract.start <= c.lastDay && c.start <= (contract.end ?? '9999-12-31'));
      if (overlap) throw new DomainError('CONFLICT', `Le contrat recouvre un contrat terminé (du ${overlap.start} au ${overlap.lastDay})`);
      await this.contracts.save(contract);
      const view = toContractView(contract, { employee: employee.fullName, type });
      await this.audit.record({ actor: command.actor, module: 'hr', entityType: 'Contract', entityId: contract.id, action: AuditAction.Create, newValue: { ...view } });
      return view;
    });
  }
}

/** Ajuster un contrat en cours (RH) : prolonger la fin d'un contrat à durée déterminée, déplacer la fin de la période d'essai ; version lue ; audit avant/après. */
@Injectable()
export class AdjustContractUseCase {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(CONTRACT_REPOSITORY) private readonly contracts: ContractRepository,
    @Inject(CONTRACT_TYPE_REPOSITORY) private readonly types: ContractTypeRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  execute(command: { id: string; version: number; end?: string | null; probationEnd?: string | null; access: AccessContext; actor: ActorContext }): Promise<ContractView> {
    return this.unitOfWork.run(async () => {
      assertManage(command.access);
      const contract = await this.contracts.findById(command.id);
      if (!contract) throw new DomainError('NOT_FOUND', NOT_FOUND);
      if (contract.version !== command.version) throw new DomainError('CONFLICT', 'Le contrat a été modifié par un autre utilisateur : rechargez-le');
      const views = await Views.load(this.employees, this.types, [contract]);
      const before = views.view(contract);
      contract.adjust({ end: command.end, probationEnd: command.probationEnd }, views.typeOf(contract)?.fixedTerm ?? contract.end !== null);
      await this.contracts.save(contract);
      const after = views.view((await this.contracts.findById(contract.id)) ?? contract);
      await this.audit.record({ actor: command.actor, module: 'hr', entityType: 'Contract', entityId: contract.id, action: AuditAction.Update, oldValue: { ...before }, newValue: { ...after } });
      return after;
    });
  }
}

/** Mettre fin à un contrat (RH) : une date et un motif de la liste fermée ; le contrat est conservé (terminé), jamais supprimé. Audit avant/après. */
@Injectable()
export class EndContractUseCase {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(CONTRACT_REPOSITORY) private readonly contracts: ContractRepository,
    @Inject(CONTRACT_TYPE_REPOSITORY) private readonly types: ContractTypeRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  execute(command: { id: string; version: number; endedOn: string; reason: string; access: AccessContext; actor: ActorContext }): Promise<ContractView> {
    return this.unitOfWork.run(async () => {
      assertManage(command.access);
      const contract = await this.contracts.findById(command.id);
      if (!contract) throw new DomainError('NOT_FOUND', NOT_FOUND);
      if (contract.version !== command.version) throw new DomainError('CONFLICT', 'Le contrat a été modifié par un autre utilisateur : rechargez-le');
      const views = await Views.load(this.employees, this.types, [contract]);
      const before = views.view(contract);
      contract.finish({ endedOn: command.endedOn, reason: command.reason });
      await this.contracts.save(contract);
      const after = views.view((await this.contracts.findById(contract.id)) ?? contract);
      await this.audit.record({ actor: command.actor, module: 'hr', entityType: 'Contract', entityId: contract.id, action: AuditAction.Update, oldValue: { ...before }, newValue: { ...after } });
      return after;
    });
  }
}

/** Un contrat : la RH, la Direction et le Super administrateur, ou l'employé lui-même ; sinon « introuvable » (même réponse qu'un identifiant inexistant). */
@Injectable()
export class GetContractHandler {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(CONTRACT_REPOSITORY) private readonly contracts: ContractRepository,
    @Inject(CONTRACT_TYPE_REPOSITORY) private readonly types: ContractTypeRepository,
  ) {}

  async execute(query: { id: string; access: AccessContext }): Promise<ContractView> {
    const contract = await this.contracts.findById(query.id);
    const employee = contract ? await this.employees.findById(contract.employeeId) : null;
    if (!contract || !employee || !canView(query.access, employee)) throw new DomainError('NOT_FOUND', NOT_FOUND);
    return (await Views.load(this.employees, this.types, [contract])).view(contract);
  }
}

/** Liste paginée : « mes contrats » (portée Propre) ou, avec la portée Tous, tous les contrats ou ceux d'un employé. Un employé hors portée est « introuvable ». */
@Injectable()
export class ListContractsHandler {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(CONTRACT_REPOSITORY) private readonly contracts: ContractRepository,
    @Inject(CONTRACT_TYPE_REPOSITORY) private readonly types: ContractTypeRepository,
  ) {}

  async execute(query: { employeeId?: string; status?: 'ACTIVE' | 'ENDED'; page: number; pageSize: number; access: AccessContext }): Promise<Page<ContractView>> {
    const read = scopeOf(query.access, 'hr.contract.read');
    if (read === null) throw new DomainError('FORBIDDEN', "Vous n'avez pas le droit de voir des contrats");
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
    const result = await this.contracts.list({ page, pageSize, employeeIds, status: query.status });
    const views = await Views.load(this.employees, this.types, result.items);
    return { ...result, items: result.items.map((c) => views.view(c)) };
  }
}

/** Échéances : les contrats en cours dont la fin ou la fin de la période d'essai tombe dans les N prochains jours (60 par défaut, 365 au plus). Portée Tous seulement (RH, Direction). */
@Injectable()
export class ListDeadlinesHandler {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(CONTRACT_REPOSITORY) private readonly contracts: ContractRepository,
    @Inject(CONTRACT_TYPE_REPOSITORY) private readonly types: ContractTypeRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(query: { days?: number; access: AccessContext }): Promise<DeadlineView[]> {
    if (scopeOf(query.access, 'hr.contract.read') !== Scope.All) throw new DomainError('FORBIDDEN', "Les échéances de contrat sont réservées à ceux qui voient tous les contrats");
    const days = query.days ?? DEFAULT_DEADLINE_DAYS;
    if (!Number.isInteger(days) || days < 1 || days > MAX_DEADLINE_DAYS) throw new DomainError('VALIDATION', `La période doit être de 1 à ${MAX_DEADLINE_DAYS} jours`);
    const today = todayOf(this.clock);
    const to = addDays(today, days);
    const found = await this.contracts.deadlines(today, to);
    const views = await Views.load(this.employees, this.types, found);
    const out: DeadlineView[] = [];
    for (const contract of found) {
      const base = { contractId: contract.id, employeeId: contract.employeeId, employeeName: views.name(contract.employeeId), contractTypeLabel: views.view(contract).contractTypeLabel };
      if (contract.end !== null && contract.end >= today && contract.end <= to) out.push({ ...base, kind: 'CONTRACT_END', date: contract.end, daysLeft: daysBetween(today, contract.end) });
      if (contract.probationEnd !== null && contract.probationEnd >= today && contract.probationEnd <= to) out.push({ ...base, kind: 'PROBATION_END', date: contract.probationEnd, daysLeft: daysBetween(today, contract.probationEnd) });
    }
    return out.sort((a, b) => a.date.localeCompare(b.date) || a.employeeName.localeCompare(b.employeeName, 'fr') || a.kind.localeCompare(b.kind));
  }
}

export { isIsoDate };
