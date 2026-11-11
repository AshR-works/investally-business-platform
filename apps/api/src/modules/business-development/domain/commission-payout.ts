import { AggregateRoot, DomainError } from '../../../shared-kernel';
import { CommissionType } from './commission';

/**
 * À verser : l'agrément a été honoré, la commission est due ; en attente : la Finance a suspendu le déblocage (motif) ; fonds débloqués :
 * la Finance autorise le versement ; versée : le chargé de compte a versé et déposé son justificatif ; annulée : motif obligatoire,
 * jamais après le versement. Versée et annulée sont définitives (décision D41 : une commission due est figée).
 */
export enum PayoutStatus {
  Due = 'DUE',
  OnHold = 'ON_HOLD',
  Released = 'RELEASED',
  Paid = 'PAID',
  Cancelled = 'CANCELLED',
}

export interface PayoutProps {
  id: string;
  companyId: string;
  facilitatorId: string;
  /** Un seul versement par agrément honoré. */
  approvalId: string;
  /** Définition de la commission du facilitateur AU MOMENT où elle est devenue due : figée, une modification ultérieure ne la touche pas. */
  commissionType: CommissionType;
  commissionValue: string;
  commissionCurrency: string | null;
  /** Montant à verser (texte décimal) ; absent quand la commission est un pourcentage et que l'agrément ne porte pas de montant. */
  amount: string | null;
  currency: string;
  status: PayoutStatus;
  holdReason: string | null;
  cancelledReason: string | null;
  /** Date du versement « AAAA-MM-JJ ». */
  paidOn: string | null;
  createdAt: Date;
  version: number;
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Motif obligatoire : trois caractères au moins, 500 au plus. */
function reasonOf(raw: string | undefined, label: string): string {
  const text = (raw ?? '').trim();
  if (text.length < 3) throw new DomainError('VALIDATION', `${label} est obligatoire`);
  if (text.length > 500) throw new DomainError('VALIDATION', `${label} ne peut dépasser 500 caractères`);
  return text;
}

/** Montant décimal positif, deux décimales au plus, jamais passé par un nombre flottant. */
function amountOf(raw: string | number): string {
  const text = String(raw).trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(text) || Number(text) <= 0) throw new DomainError('VALIDATION', 'Le montant doit être un nombre positif (deux décimales au plus)');
  return Number(text).toFixed(2);
}

const cents = (decimal: string): bigint => BigInt(decimal.replace('.', ''));
const decimalOf = (value: bigint): string => `${value / 100n}.${String(value % 100n).padStart(2, '0')}`;

/** Commission d'un pourcentage sur un montant, arrondie au centime le plus proche (calcul en entiers). */
export function percentOf(amount: string, percent: string): string {
  const product = cents(Number(amount).toFixed(2)) * cents(Number(percent).toFixed(2));
  return decimalOf((product + 5000n) / 10000n);
}

/**
 * Versement d'une commission de facilitateur (flux F3). Naît quand l'agrément d'une entreprise qui a un facilitateur avec commission est
 * honoré. Le montant est figé dès l'origine : montant fixe tel quel, ou pourcentage du montant de l'agrément ; un pourcentage sans montant
 * d'agrément laisse le montant « à fixer » (une seule fois, par le Responsable commercial, avant tout déblocage).
 */
export class CommissionPayout extends AggregateRoot {
  private constructor(private props: PayoutProps) {
    super();
  }

  static due(input: {
    id: string; companyId: string; facilitatorId: string; approvalId: string;
    commission: { type: CommissionType; value: string; currency: string | null };
    approvalAmount: string | null; approvalCurrency: string; now: Date;
  }): CommissionPayout {
    const fixed = input.commission.type === CommissionType.Fixed;
    const amount = fixed ? amountOf(input.commission.value) : input.approvalAmount ? percentOf(input.approvalAmount, input.commission.value) : null;
    const currency = fixed ? input.commission.currency ?? input.approvalCurrency : input.approvalCurrency;
    if (amount !== null && Number(amount) <= 0) throw new DomainError('INVARIANT_VIOLATION', 'La commission calculée est nulle : aucun versement à créer');
    return new CommissionPayout({
      id: input.id, companyId: input.companyId, facilitatorId: input.facilitatorId, approvalId: input.approvalId,
      commissionType: input.commission.type, commissionValue: input.commission.value, commissionCurrency: input.commission.currency,
      amount, currency, status: PayoutStatus.Due, holdReason: null, cancelledReason: null, paidOn: null, createdAt: input.now, version: 1,
    });
  }

  static rehydrate(props: PayoutProps): CommissionPayout {
    return new CommissionPayout(props);
  }

  private label(): string {
    return { DUE: 'à verser', ON_HOLD: 'en attente', RELEASED: 'aux fonds débloqués', PAID: 'versée', CANCELLED: 'annulée' }[this.props.status];
  }

  /** Renseigne le montant d'un pourcentage dont l'agrément n'avait pas de montant : une seule fois, avant le déblocage. */
  fixAmount(raw: string | number): void {
    if (this.props.amount !== null) throw new DomainError('INVARIANT_VIOLATION', 'Le montant de la commission est figé : annulez-la pour la corriger');
    if (this.props.status !== PayoutStatus.Due && this.props.status !== PayoutStatus.OnHold) {
      throw new DomainError('INVARIANT_VIOLATION', `Une commission ${this.label()} n'a plus de montant à fixer`);
    }
    this.props = { ...this.props, amount: amountOf(raw) };
  }

  /** Autorise le versement (la Finance) : depuis « à verser » ou « en attente », et seulement avec un montant. */
  release(): void {
    if (this.props.status !== PayoutStatus.Due && this.props.status !== PayoutStatus.OnHold) {
      throw new DomainError('INVARIANT_VIOLATION', `Une commission ${this.label()} ne peut plus être débloquée`);
    }
    if (this.props.amount === null) throw new DomainError('INVARIANT_VIOLATION', 'Le montant de la commission est à fixer avant le déblocage des fonds');
    this.props = { ...this.props, status: PayoutStatus.Released, holdReason: null };
  }

  /** Suspend le déblocage (la Finance), avec un motif : le dossier reste ouvert. */
  hold(reason: string | undefined): void {
    const holdReason = reasonOf(reason, 'Le motif de la mise en attente');
    if (this.props.status !== PayoutStatus.Due && this.props.status !== PayoutStatus.OnHold) {
      throw new DomainError('INVARIANT_VIOLATION', `Une commission ${this.label()} ne peut plus être mise en attente`);
    }
    this.props = { ...this.props, status: PayoutStatus.OnHold, holdReason };
  }

  /** Constate le versement : fonds débloqués, justificatif déposé, date réelle et pas dans le futur. */
  pay(paidOn: string, hasProof: boolean, now: Date): void {
    if (this.props.status !== PayoutStatus.Released) {
      throw new DomainError('INVARIANT_VIOLATION', this.props.status === PayoutStatus.Paid ? 'La commission est déjà versée' : 'Les fonds ne sont pas débloqués : la Finance doit les débloquer avant le versement');
    }
    if (!hasProof) throw new DomainError('INVARIANT_VIOLATION', 'Déposez le justificatif (reçu de virement ou ordre de versement) avant de constater le versement');
    const text = (paidOn ?? '').trim();
    const m = DATE.exec(text);
    const real = m !== null && new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!)).toISOString().slice(0, 10) === text;
    if (!real) throw new DomainError('VALIDATION', 'La date de versement doit être une date valide (AAAA-MM-JJ)');
    if (text > now.toISOString().slice(0, 10)) throw new DomainError('VALIDATION', 'La date de versement ne peut pas être dans le futur');
    this.props = { ...this.props, status: PayoutStatus.Paid, paidOn: text };
  }

  /** Annule la commission (erreur, renoncement), avec un motif ; impossible une fois versée. */
  cancel(reason: string | undefined): void {
    const cancelledReason = reasonOf(reason, "Le motif de l'annulation");
    if (this.props.status === PayoutStatus.Paid || this.props.status === PayoutStatus.Cancelled) {
      throw new DomainError('INVARIANT_VIOLATION', `Une commission ${this.label()} ne peut plus être annulée`);
    }
    this.props = { ...this.props, status: PayoutStatus.Cancelled, cancelledReason, holdReason: null };
  }

  get id(): string { return this.props.id; }
  get companyId(): string { return this.props.companyId; }
  get facilitatorId(): string { return this.props.facilitatorId; }
  get approvalId(): string { return this.props.approvalId; }
  get commissionType(): CommissionType { return this.props.commissionType; }
  get commissionValue(): string { return this.props.commissionValue; }
  get commissionCurrency(): string | null { return this.props.commissionCurrency; }
  get amount(): string | null { return this.props.amount; }
  get currency(): string { return this.props.currency; }
  get status(): PayoutStatus { return this.props.status; }
  get holdReason(): string | null { return this.props.holdReason; }
  get cancelledReason(): string | null { return this.props.cancelledReason; }
  get paidOn(): string | null { return this.props.paidOn; }
  get createdAt(): Date { return this.props.createdAt; }
  get version(): number { return this.props.version; }
}
