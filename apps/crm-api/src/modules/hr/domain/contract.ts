import { AggregateRoot, DomainError } from '../../../shared-kernel';
import { isIsoDate } from './leave-calendar';

/**
 * Contrats du personnel (RH-3, D67). **Aucun salaire, aucun document, aucune donnée sensible** : un type, des dates, une période d'essai et, à la fin, un motif choisi dans une
 * **liste fermée** (jamais un texte libre : on ne stocke pas ici de motif disciplinaire). Les types sont paramétrables par la RH ; aucune règle légale (durée maximale d'un CDD,
 * plafond d'une période d'essai) n'est codée : elles relèvent du droit applicable et du règlement intérieur, à valider avec la RH.
 */
export type ContractStatus = 'ACTIVE' | 'ENDED';

/** Motifs de fin : une liste fermée, volontairement neutre. */
export const END_REASONS = ['FIXED_TERM_END', 'PROBATION_END', 'RESIGNATION', 'MISSION_END', 'OTHER'] as const;
export type ContractEndReason = (typeof END_REASONS)[number];
export const END_REASON_LABEL: Record<ContractEndReason, string> = {
  FIXED_TERM_END: 'Fin du contrat à durée déterminée',
  PROBATION_END: 'Fin de la période d’essai',
  RESIGNATION: 'Démission',
  MISSION_END: 'Fin de mission',
  OTHER: 'Autre',
};

const CODE = /^[A-Z][A-Z0-9_]{1,29}$/;

function label(raw: string | undefined): string {
  const value = (raw ?? '').trim().replace(/\s+/g, ' ');
  if (!value) throw new DomainError('VALIDATION', 'Le libellé du type de contrat est obligatoire');
  if (value.length > 100) throw new DomainError('VALIDATION', 'Le libellé ne peut dépasser 100 caractères');
  return value;
}

function order(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 10_000) throw new DomainError('VALIDATION', 'L’ordre d’affichage est un entier entre 0 et 10 000');
  return value;
}

export interface ContractTypeProps {
  id: string;
  code: string;
  label: string;
  /** Vrai : le contrat a une date de fin obligatoire (CDD, stage, prestation). Faux : il n'en a jamais (CDI). */
  fixedTerm: boolean;
  active: boolean;
  sortOrder: number;
  version: number;
  createdAt: Date;
}

/** Type de contrat paramétrable : jamais supprimé (il se désactive) ; le code et la nature (à durée déterminée ou non) ne changent pas. */
export class ContractType {
  private constructor(private props: ContractTypeProps) {}

  static create(input: { id: string; code: string; label: string; fixedTerm: boolean; sortOrder?: number; now: Date }): ContractType {
    const code = (input.code ?? '').trim().toUpperCase();
    if (!CODE.test(code)) throw new DomainError('VALIDATION', 'Le code comporte des lettres majuscules, des chiffres et _ (2 à 30 caractères, commence par une lettre)');
    return new ContractType({ id: input.id, code, label: label(input.label), fixedTerm: input.fixedTerm === true, active: true, sortOrder: order(input.sortOrder ?? 100), version: 1, createdAt: input.now });
  }

  static rehydrate(props: ContractTypeProps): ContractType {
    return new ContractType(props);
  }

  update(changes: { label?: string; active?: boolean; sortOrder?: number }): void {
    const next = { ...this.props };
    if (changes.label !== undefined) next.label = label(changes.label);
    if (changes.active !== undefined) next.active = changes.active;
    if (changes.sortOrder !== undefined) next.sortOrder = order(changes.sortOrder);
    this.props = next;
  }

  get id(): string { return this.props.id; }
  get code(): string { return this.props.code; }
  get label(): string { return this.props.label; }
  get fixedTerm(): boolean { return this.props.fixedTerm; }
  get active(): boolean { return this.props.active; }
  get sortOrder(): number { return this.props.sortOrder; }
  get version(): number { return this.props.version; }
  get createdAt(): Date { return this.props.createdAt; }
}

const dateOf = (raw: string | null | undefined, name: string): string => {
  const value = (raw ?? '').trim();
  if (!isIsoDate(value)) throw new DomainError('VALIDATION', `${name} doit être une date valide (AAAA-MM-JJ)`);
  return value;
};

export interface ContractDates {
  start: string;
  end: string | null;
  probationEnd: string | null;
}

/**
 * Règles des dates : un contrat à durée déterminée a une fin (jamais avant le début) ; un contrat à durée indéterminée n'en a pas ; la fin de la période d'essai tombe
 * dans le contrat (au plus tôt le jour du début, au plus tard le jour de la fin).
 */
export function validateContractDates(input: { start: string; end?: string | null; probationEnd?: string | null }, fixedTerm: boolean): ContractDates {
  const start = dateOf(input.start, 'La date de début');
  const end = input.end ? dateOf(input.end, 'La date de fin') : null;
  const probationEnd = input.probationEnd ? dateOf(input.probationEnd, 'La fin de la période d’essai') : null;
  if (fixedTerm && end === null) throw new DomainError('VALIDATION', 'Ce type de contrat est à durée déterminée : la date de fin est obligatoire');
  if (!fixedTerm && end !== null) throw new DomainError('VALIDATION', 'Ce type de contrat est à durée indéterminée : il n’a pas de date de fin');
  if (end !== null && end < start) throw new DomainError('VALIDATION', 'La date de fin ne peut pas précéder la date de début');
  if (probationEnd !== null) {
    if (probationEnd < start) throw new DomainError('VALIDATION', 'La fin de la période d’essai ne peut pas précéder la date de début');
    if (end !== null && probationEnd > end) throw new DomainError('VALIDATION', 'La fin de la période d’essai ne peut pas dépasser la date de fin du contrat');
  }
  return { start, end, probationEnd };
}

export interface ContractProps extends ContractDates {
  id: string;
  employeeId: string;
  contractTypeId: string;
  status: ContractStatus;
  endedOn: string | null;
  endReason: ContractEndReason | null;
  version: number;
  createdAt: Date;
}

export class Contract extends AggregateRoot {
  private constructor(private props: ContractProps) {
    super();
  }

  static create(input: { id: string; employeeId: string; contractTypeId: string; fixedTerm: boolean; start: string; end?: string | null; probationEnd?: string | null; now: Date }): Contract {
    const dates = validateContractDates(input, input.fixedTerm);
    return new Contract({ id: input.id, employeeId: input.employeeId, contractTypeId: input.contractTypeId, ...dates, status: 'ACTIVE', endedOn: null, endReason: null, version: 1, createdAt: input.now });
  }

  static rehydrate(props: ContractProps): Contract {
    return new Contract({ ...props });
  }

  /** Prolonge ou ajuste un contrat en cours : la fin (contrat à durée déterminée seulement) et la fin de la période d'essai ; le début ne change jamais. */
  adjust(changes: { end?: string | null; probationEnd?: string | null }, fixedTerm: boolean): void {
    if (this.props.status !== 'ACTIVE') throw new DomainError('CONFLICT', 'Un contrat terminé ne se modifie plus');
    const next = validateContractDates(
      { start: this.props.start, end: changes.end === undefined ? this.props.end : changes.end, probationEnd: changes.probationEnd === undefined ? this.props.probationEnd : changes.probationEnd },
      fixedTerm,
    );
    this.props = { ...this.props, ...next };
  }

  /** Met fin au contrat : une date (jamais avant le début, ni après la fin prévue d'un contrat à durée déterminée) et un motif de la liste fermée. */
  finish(input: { endedOn: string; reason: string }): void {
    if (this.props.status !== 'ACTIVE') throw new DomainError('CONFLICT', 'Le contrat est déjà terminé');
    const endedOn = dateOf(input.endedOn, 'La date de fin effective');
    if (!END_REASONS.includes(input.reason as ContractEndReason)) throw new DomainError('VALIDATION', 'Choisissez un motif de fin dans la liste');
    if (endedOn < this.props.start) throw new DomainError('VALIDATION', 'La date de fin effective ne peut pas précéder le début du contrat');
    if (this.props.end !== null && endedOn > this.props.end) throw new DomainError('VALIDATION', 'La date de fin effective ne peut pas dépasser la fin prévue du contrat : prolongez-le d’abord');
    this.props = { ...this.props, status: 'ENDED', endedOn, endReason: input.reason as ContractEndReason };
  }

  get id(): string { return this.props.id; }
  get employeeId(): string { return this.props.employeeId; }
  get contractTypeId(): string { return this.props.contractTypeId; }
  get start(): string { return this.props.start; }
  get end(): string | null { return this.props.end; }
  get probationEnd(): string | null { return this.props.probationEnd; }
  get status(): ContractStatus { return this.props.status; }
  get endedOn(): string | null { return this.props.endedOn; }
  get endReason(): ContractEndReason | null { return this.props.endReason; }
  get version(): number { return this.props.version; }
  get createdAt(): Date { return this.props.createdAt; }
  /** Dernier jour du contrat : la fin effective, sinon la fin prévue, sinon aucune (durée indéterminée en cours). */
  get lastDay(): string | null { return this.props.endedOn ?? this.props.end; }
  get isActive(): boolean { return this.props.status === 'ACTIVE'; }
}
