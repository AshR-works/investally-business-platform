import { Page } from '../../../shared-kernel';
import { Employee, EmployeeStatus } from './employee';

export interface EmployeeListQuery {
  page: number;
  pageSize: number;
  search?: string;
  status?: EmployeeStatus;
  department?: string;
  /** Restreint aux employés dont le compte est l'un de ces utilisateurs (portée Propre ou Équipe ; liste vide = aucun) ; absent = pas de restriction (portée Tous). */
  userIds?: readonly string[];
}

/** Port de persistance des employés. Tri : nom, prénom. */
export interface EmployeeRepository {
  /** Crée ou met à jour ; une version périmée est un conflit ; un matricule, un e-mail ou un compte déjà pris aussi. */
  save(employee: Employee): Promise<void>;
  findById(id: string): Promise<Employee | null>;
  findByIds(ids: readonly string[]): Promise<Employee[]>;
  findByMatricule(matricule: string, excludeId?: string): Promise<Employee | null>;
  findByWorkEmail(emailKey: string, excludeId?: string): Promise<Employee | null>;
  findByUserId(userId: string, excludeId?: string): Promise<Employee | null>;
  /** Identifiants des comptes déjà liés à un employé (actif ou archivé : l'unicité vaut pour tous). */
  linkedUserIds(): Promise<string[]>;
  list(query: EmployeeListQuery): Promise<Page<Employee>>;
  /** Tous les employés actifs (annuaire et organigramme), triés par nom ; borné par `limit`. */
  listActive(query: { search?: string; department?: string; page?: number; pageSize?: number }): Promise<Page<Employee>>;
  /** Tous les employés actifs sans pagination (organigramme, écarts), au plus `limit`. */
  allActive(limit: number): Promise<Employee[]>;
}

export const EMPLOYEE_REPOSITORY = Symbol('EmployeeRepository');
