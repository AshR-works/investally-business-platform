import { AggregateRoot, DomainError } from '../../../shared-kernel';
import { LeavePeriod, assertPeriod } from './leave-calendar';

/** État d'une demande d'absence : en attente, validée, refusée (motif obligatoire), annulée. */
export enum LeaveStatus {
  Pending = 'PENDING',
  Approved = 'APPROVED',
  Rejected = 'REJECTED',
  Cancelled = 'CANCELLED',
}

export interface LeaveRequestProps extends LeavePeriod {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  /** Jours décomptés, figés à la demande (week-ends et jours fériés déjà déduits). */
  days: number;
  status: LeaveStatus;
  /** Motif libre facultatif : jamais de diagnostic ni de donnée de santé. */
  note: string | null;
  /** Compte qui a saisi la demande (l'employé, ou la RH pour lui). */
  requestedByUserId: string;
  decidedByUserId: string | null;
  decidedAt: Date | null;
  decisionNote: string | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  createdAt: Date;
  version: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function optionalText(raw: string | null | undefined, label: string): string | null {
  const value = (raw ?? '').trim();
  if (value.length > 500) throw new DomainError('VALIDATION', `${label} ne peut dépasser 500 caractères`);
  return value === '' ? null : value;
}

function requiredText(raw: string | null | undefined, label: string): string {
  const value = optionalText(raw, label);
  if (value === null) throw new DomainError('VALIDATION', `${label} est obligatoire`);
  return value;
}

/**
 * Demande d'absence d'un employé. Machine à états : en attente → validée ou refusée (motif obligatoire) ; en attente ou validée → annulée (motif obligatoire
 * si elle était validée). Une demande terminée (refusée, annulée) ne change plus. Les contrôles qui dépendent d'autres données (solde, chevauchement, droits,
 * jours fériés) sont ceux des cas d'usage ; ici seulement la forme et les transitions.
 */
export class LeaveRequest extends AggregateRoot {
  private constructor(private props: LeaveRequestProps) {
    super();
  }

  static create(input: LeavePeriod & {
    id: string; employeeId: string; leaveTypeId: string; days: number; note?: string | null; requestedByUserId: string; now: Date;
    /** Validée d'emblée : la RH qui saisit pour l'employé, ou un type sans validation. */
    approvedBy?: string | null;
  }): LeaveRequest {
    assertPeriod(input);
    if (!UUID.test(input.employeeId) || !UUID.test(input.leaveTypeId)) throw new DomainError('VALIDATION', "L'employé et le type d'absence doivent être des identifiants valides");
    if (!(input.days > 0) || input.days * 2 !== Math.round(input.days * 2)) throw new DomainError('VALIDATION', 'La durée décomptée doit être un nombre positif de jours, par demi-journée');
    const approved = input.approvedBy !== undefined && input.approvedBy !== null;
    return new LeaveRequest({
      id: input.id, employeeId: input.employeeId, leaveTypeId: input.leaveTypeId,
      start: input.start, end: input.end, startHalf: input.startHalf, endHalf: input.endHalf,
      days: input.days, status: approved ? LeaveStatus.Approved : LeaveStatus.Pending, note: optionalText(input.note, 'Le motif'),
      requestedByUserId: input.requestedByUserId, decidedByUserId: approved ? input.approvedBy! : null, decidedAt: approved ? input.now : null,
      decisionNote: null, cancelledAt: null, cancelReason: null, createdAt: input.now, version: 1,
    });
  }

  static rehydrate(props: LeaveRequestProps): LeaveRequest {
    return new LeaveRequest(props);
  }

  /** Valide une demande en attente. */
  approve(input: { by: string; now: Date }): void {
    if (this.props.status !== LeaveStatus.Pending) throw new DomainError('CONFLICT', "Seule une demande en attente peut être validée");
    this.props = { ...this.props, status: LeaveStatus.Approved, decidedByUserId: input.by, decidedAt: input.now };
  }

  /** Refuse une demande en attente ; le motif est obligatoire. */
  reject(input: { by: string; note: string; now: Date }): void {
    if (this.props.status !== LeaveStatus.Pending) throw new DomainError('CONFLICT', 'Seule une demande en attente peut être refusée');
    const note = requiredText(input.note, 'Le motif du refus');
    this.props = { ...this.props, status: LeaveStatus.Rejected, decidedByUserId: input.by, decidedAt: input.now, decisionNote: note };
  }

  /** Annule une demande en attente ou validée ; le motif est obligatoire pour une demande validée. */
  cancel(input: { reason?: string | null; now: Date }): void {
    if (this.props.status !== LeaveStatus.Pending && this.props.status !== LeaveStatus.Approved) throw new DomainError('CONFLICT', 'Cette demande est déjà terminée');
    const reason = this.props.status === LeaveStatus.Approved ? requiredText(input.reason, "Le motif de l'annulation d'une demande validée") : optionalText(input.reason, "Le motif de l'annulation");
    this.props = { ...this.props, status: LeaveStatus.Cancelled, cancelledAt: input.now, cancelReason: reason };
  }

  get id(): string { return this.props.id; }
  get employeeId(): string { return this.props.employeeId; }
  get leaveTypeId(): string { return this.props.leaveTypeId; }
  get start(): string { return this.props.start; }
  get end(): string { return this.props.end; }
  get startHalf(): boolean { return this.props.startHalf; }
  get endHalf(): boolean { return this.props.endHalf; }
  get period(): LeavePeriod { return { start: this.props.start, end: this.props.end, startHalf: this.props.startHalf, endHalf: this.props.endHalf }; }
  get days(): number { return this.props.days; }
  /** Année de congé : celle de la date de début. */
  get year(): number { return Number(this.props.start.slice(0, 4)); }
  get status(): LeaveStatus { return this.props.status; }
  get isActive(): boolean { return this.props.status === LeaveStatus.Pending || this.props.status === LeaveStatus.Approved; }
  get note(): string | null { return this.props.note; }
  get requestedByUserId(): string { return this.props.requestedByUserId; }
  get decidedByUserId(): string | null { return this.props.decidedByUserId; }
  get decidedAt(): Date | null { return this.props.decidedAt; }
  get decisionNote(): string | null { return this.props.decisionNote; }
  get cancelledAt(): Date | null { return this.props.cancelledAt; }
  get cancelReason(): string | null { return this.props.cancelReason; }
  get createdAt(): Date { return this.props.createdAt; }
  get version(): number { return this.props.version; }
}
