import { Page } from '../../../shared-kernel';
import { Contract, ContractStatus, ContractType } from './contract';

export interface ContractListQuery {
  page: number;
  pageSize: number;
  /** Restreint à ces employés (liste vide = aucun) ; absent = pas de restriction (portée Tous). */
  employeeIds?: readonly string[];
  status?: ContractStatus;
}

/** Port de persistance des contrats. Tri : date de début décroissante. */
export interface ContractRepository {
  /** Crée ou met à jour ; une version périmée est un conflit ; un second contrat en cours pour le même employé aussi. */
  save(contract: Contract): Promise<void>;
  findById(id: string): Promise<Contract | null>;
  /** Tous les contrats d'un employé (en cours et terminés), du plus récent au plus ancien. */
  ofEmployee(employeeId: string): Promise<Contract[]>;
  list(query: ContractListQuery): Promise<Page<Contract>>;
  /** Contrats en cours dont la fin prévue ou la fin de la période d'essai tombe dans [from, to] (jours inclus). */
  deadlines(from: string, to: string): Promise<Contract[]>;
  /** Verrouille la fiche de l'employé jusqu'à la fin de la transaction : deux créations simultanées pour le même employé se suivent au lieu de se croiser. */
  lockEmployee(employeeId: string): Promise<void>;
}

/** Types de contrat (paramétrés par la RH). */
export interface ContractTypeRepository {
  types(includeInactive: boolean): Promise<ContractType[]>;
  findType(id: string): Promise<ContractType | null>;
  findTypeByCode(code: string): Promise<ContractType | null>;
  findTypes(ids: readonly string[]): Promise<ContractType[]>;
  /** Crée ou met à jour un type ; une version périmée est un conflit, un code déjà pris aussi. */
  saveType(type: ContractType): Promise<void>;
}

export const CONTRACT_REPOSITORY = Symbol('ContractRepository');
export const CONTRACT_TYPE_REPOSITORY = Symbol('ContractTypeRepository');
