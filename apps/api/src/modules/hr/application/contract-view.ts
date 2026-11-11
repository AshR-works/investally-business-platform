import { Contract, ContractType, END_REASON_LABEL } from '../domain/contract';

/** Type de contrat tel que l'API l'expose. */
export interface ContractTypeView {
  id: string;
  code: string;
  label: string;
  fixedTerm: boolean;
  active: boolean;
  sortOrder: number;
  version: number;
}

export const toContractTypeView = (t: ContractType): ContractTypeView => ({ id: t.id, code: t.code, label: t.label, fixedTerm: t.fixedTerm, active: t.active, sortOrder: t.sortOrder, version: t.version });

/** Contrat tel que l'API l'expose : jamais de salaire, de pièce ni de motif libre. */
export interface ContractView {
  id: string;
  employeeId: string;
  employeeName: string;
  contractTypeId: string;
  contractTypeLabel: string;
  fixedTerm: boolean;
  start: string;
  end: string | null;
  probationEnd: string | null;
  /** `ACTIVE` ou `ENDED`. */
  status: string;
  endedOn: string | null;
  /** Motif de fin choisi dans la liste fermée. */
  endReason: string | null;
  endReasonLabel: string | null;
  createdAt: string;
  /** Verrou optimiste : à renvoyer tel quel pour ajuster ou terminer. */
  version: number;
}

export function toContractView(contract: Contract, names: { employee: string; type: ContractType | undefined }): ContractView {
  return {
    id: contract.id,
    employeeId: contract.employeeId,
    employeeName: names.employee,
    contractTypeId: contract.contractTypeId,
    contractTypeLabel: names.type?.label ?? '—',
    fixedTerm: names.type?.fixedTerm ?? contract.end !== null,
    start: contract.start,
    end: contract.end,
    probationEnd: contract.probationEnd,
    status: contract.status,
    endedOn: contract.endedOn,
    endReason: contract.endReason,
    endReasonLabel: contract.endReason ? END_REASON_LABEL[contract.endReason] : null,
    createdAt: contract.createdAt.toISOString(),
    version: contract.version,
  };
}

/** Une échéance à venir : fin de contrat ou fin de période d'essai, avec les jours restants. */
export interface DeadlineView {
  contractId: string;
  employeeId: string;
  employeeName: string;
  contractTypeLabel: string;
  /** `CONTRACT_END` ou `PROBATION_END`. */
  kind: string;
  date: string;
  daysLeft: number;
}
