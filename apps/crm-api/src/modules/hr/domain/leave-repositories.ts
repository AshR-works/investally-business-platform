import { Page } from '../../../shared-kernel';
import { LeaveAdjustment, LeaveSettings, LeaveType, PublicHoliday } from './leave-config';
import { LeaveRequest, LeaveStatus } from './leave-request';

export interface LeaveRequestListQuery {
  page: number;
  pageSize: number;
  /** Restreint à ces employés (liste vide = aucun) ; absent = pas de restriction (portée Tous). */
  employeeIds?: readonly string[];
  status?: LeaveStatus;
  /** Année de congé (celle de la date de début). */
  year?: number;
}

/** Port de persistance des demandes d'absence. Tri : date de début décroissante. */
export interface LeaveRequestRepository {
  /** Crée ou met à jour ; une version périmée est un conflit. */
  save(request: LeaveRequest): Promise<void>;
  findById(id: string): Promise<LeaveRequest | null>;
  /** Demandes en attente ou validées de l'employé dont la période touche [from, to] (jours inclus). */
  findActiveOverlapping(employeeId: string, from: string, to: string, excludeId?: string): Promise<LeaveRequest[]>;
  /**
   * Jours validés et en attente d'un employé pour une année de congé, pour les seuls types donnés : ceux qui décomptent le solde (congé annuel). Une maladie ou une
   * permission exceptionnelle ne consomme jamais le solde.
   */
  sumDays(employeeId: string, year: number, leaveTypeIds: readonly string[], excludeId?: string): Promise<{ approved: number; pending: number }>;
  list(query: LeaveRequestListQuery): Promise<Page<LeaveRequest>>;
  /** Demandes validées dont la période touche [from, to], de ces employés (absent = tous). */
  approvedBetween(from: string, to: string, employeeIds?: readonly string[]): Promise<LeaveRequest[]>;
  /** Verrouille la fiche de l'employé jusqu'à la fin de la transaction : deux demandes simultanées du même employé se suivent au lieu de se croiser. */
  lockEmployee(employeeId: string): Promise<void>;
}

/** Règles, types d'absence et jours fériés (paramétrés par la RH). */
export interface LeaveConfigRepository {
  settings(): Promise<LeaveSettings>;
  /** Met à jour les règles ; une version périmée est un conflit. */
  saveSettings(settings: LeaveSettings): Promise<void>;
  types(includeInactive: boolean): Promise<LeaveType[]>;
  findType(id: string): Promise<LeaveType | null>;
  findTypeByCode(code: string): Promise<LeaveType | null>;
  /** Crée ou met à jour un type ; une version périmée est un conflit, un code déjà pris aussi. */
  saveType(type: LeaveType): Promise<void>;
  holidays(from: string, to: string): Promise<PublicHoliday[]>;
  findHoliday(id: string): Promise<PublicHoliday | null>;
  findHolidayByDay(day: string): Promise<PublicHoliday | null>;
  addHoliday(holiday: PublicHoliday): Promise<void>;
  removeHoliday(id: string): Promise<void>;
}

/** Ajustements de solde : ajout seul. */
export interface LeaveAdjustmentRepository {
  add(adjustment: LeaveAdjustment): Promise<void>;
  forYear(employeeId: string, year: number): Promise<LeaveAdjustment[]>;
  total(employeeId: string, year: number): Promise<number>;
}

export const LEAVE_REQUEST_REPOSITORY = Symbol('LeaveRequestRepository');
export const LEAVE_CONFIG_REPOSITORY = Symbol('LeaveConfigRepository');
export const LEAVE_ADJUSTMENT_REPOSITORY = Symbol('LeaveAdjustmentRepository');
