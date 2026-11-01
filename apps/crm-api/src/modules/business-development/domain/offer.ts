import { AggregateRoot, DomainError } from '../../../shared-kernel';
import { DEFAULT_CURRENCY } from './commission';

/**
 * États d'une offre (proposition de l'équipe, à confirmer) : brouillon → déposée → décharge reçue → acceptée ou refusée ;
 * retirée possible tant que le client n'a pas répondu. Acceptée, refusée et retirée sont définitives.
 */
export enum OfferStatus {
  Draft = 'DRAFT',
  Submitted = 'SUBMITTED',
  ReceiptReceived = 'RECEIPT_RECEIVED',
  Accepted = 'ACCEPTED',
  Refused = 'REFUSED',
  Withdrawn = 'WITHDRAWN',
}

export interface OfferProps {
  id: string;
  reference: string;
  companyId: string;
  subject: string;
  /** Montant en texte décimal (deux décimales) : jamais de nombre flottant. */
  amount: string;
  currency: string;
  status: OfferStatus;
  note: string | null;
  submittedAt: Date | null;
  decidedAt: Date | null;
  withdrawnReason: string | null;
  createdAt: Date;
  version: number;
}

const subjectOf = (raw: string | undefined): string => {
  const value = (raw ?? '').trim().replace(/\s+/g, ' ');
  if (!value) throw new DomainError('VALIDATION', "L'objet de l'offre est obligatoire");
  if (value.length > 200) throw new DomainError('VALIDATION', "L'objet de l'offre ne peut dépasser 200 caractères");
  return value;
};

const amountOf = (raw: string | number | undefined): string => {
  const text = String(raw ?? '').trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(text) || Number(text) <= 0) {
    throw new DomainError('VALIDATION', 'Le montant doit être un nombre positif (deux décimales au plus)');
  }
  return Number(text).toFixed(2);
};

const currencyOf = (raw: string | undefined): string => {
  const typed = (raw ?? '').trim().toUpperCase();
  const currency = typed === '' || typed === 'FCFA' ? DEFAULT_CURRENCY : typed;
  if (!/^[A-Z]{3}$/.test(currency)) throw new DomainError('VALIDATION', 'La devise doit comporter trois lettres (ex. XAF, EUR)');
  return currency;
};

const noteOf = (raw: string | null | undefined): string | null => {
  const value = (raw ?? '').trim();
  if (value.length > 1000) throw new DomainError('VALIDATION', 'La note ne peut dépasser 1000 caractères');
  return value === '' ? null : value;
};

const LABEL: Record<OfferStatus, string> = {
  [OfferStatus.Draft]: 'brouillon',
  [OfferStatus.Submitted]: 'déposée',
  [OfferStatus.ReceiptReceived]: 'décharge reçue',
  [OfferStatus.Accepted]: 'acceptée',
  [OfferStatus.Refused]: 'refusée',
  [OfferStatus.Withdrawn]: 'retirée',
};

/** Offre faite à une entreprise : sa visibilité suit celle de l'entreprise. Les transitions d'état sont toutes ici. */
export class Offer extends AggregateRoot {
  private constructor(private props: OfferProps) {
    super();
  }

  static create(input: {
    id: string; reference: string; companyId: string; subject: string; amount: string | number; currency?: string; note?: string | null; now: Date;
  }): Offer {
    if (!input.companyId) throw new DomainError('VALIDATION', 'Une offre est faite à une entreprise');
    return new Offer({
      id: input.id,
      reference: input.reference,
      companyId: input.companyId,
      subject: subjectOf(input.subject),
      amount: amountOf(input.amount),
      currency: currencyOf(input.currency),
      status: OfferStatus.Draft,
      note: noteOf(input.note),
      submittedAt: null,
      decidedAt: null,
      withdrawnReason: null,
      createdAt: input.now,
      version: 1,
    });
  }

  static rehydrate(props: OfferProps): Offer {
    return new Offer(props);
  }

  /** Modifie les champs donnés ; seulement tant que l'offre est un brouillon (déposée, elle ne change plus). Tout ou rien. */
  edit(changes: { subject?: string; amount?: string | number; currency?: string; note?: string | null }): void {
    if (this.props.status !== OfferStatus.Draft) {
      throw new DomainError('INVARIANT_VIOLATION', `Une offre ${LABEL[this.props.status]} ne peut plus être modifiée`);
    }
    const next = { ...this.props };
    if (changes.subject !== undefined) next.subject = subjectOf(changes.subject);
    if (changes.amount !== undefined) next.amount = amountOf(changes.amount);
    if (changes.currency !== undefined) next.currency = currencyOf(changes.currency);
    if (changes.note !== undefined) next.note = noteOf(changes.note);
    this.props = next;
  }

  private move(from: readonly OfferStatus[], to: OfferStatus, action: string): void {
    if (!from.includes(this.props.status)) {
      throw new DomainError('INVARIANT_VIOLATION', `Une offre ${LABEL[this.props.status]} ne peut pas être ${action}`);
    }
    this.props = { ...this.props, status: to };
  }

  /** Dépôt chez l'entreprise : brouillon → déposée. */
  submit(now: Date): void {
    this.move([OfferStatus.Draft], OfferStatus.Submitted, 'déposée');
    this.props = { ...this.props, submittedAt: now };
  }

  /** La décharge signée est enregistrée : déposée → décharge reçue (branchée avec le lot des décharges). */
  receiptReceived(): void {
    this.move([OfferStatus.Submitted], OfferStatus.ReceiptReceived, 'marquée « décharge reçue »');
  }

  /** Le client accepte. */
  accept(now: Date): void {
    this.move([OfferStatus.Submitted, OfferStatus.ReceiptReceived], OfferStatus.Accepted, 'acceptée');
    this.props = { ...this.props, decidedAt: now };
  }

  /** Le client refuse. */
  refuse(now: Date): void {
    this.move([OfferStatus.Submitted, OfferStatus.ReceiptReceived], OfferStatus.Refused, 'refusée');
    this.props = { ...this.props, decidedAt: now };
  }

  /** Retrait avec motif obligatoire, tant que le client n'a pas répondu. */
  withdraw(reason: string | undefined, now: Date): void {
    const text = (reason ?? '').trim();
    if (text.length < 3) throw new DomainError('VALIDATION', 'Le motif du retrait est obligatoire');
    if (text.length > 500) throw new DomainError('VALIDATION', 'Le motif du retrait ne peut dépasser 500 caractères');
    this.move([OfferStatus.Draft, OfferStatus.Submitted, OfferStatus.ReceiptReceived], OfferStatus.Withdrawn, 'retirée');
    this.props = { ...this.props, withdrawnReason: text, decidedAt: now };
  }

  get id(): string { return this.props.id; }
  get reference(): string { return this.props.reference; }
  get companyId(): string { return this.props.companyId; }
  get subject(): string { return this.props.subject; }
  get amount(): string { return this.props.amount; }
  get currency(): string { return this.props.currency; }
  get status(): OfferStatus { return this.props.status; }
  get note(): string | null { return this.props.note; }
  get submittedAt(): Date | null { return this.props.submittedAt; }
  get decidedAt(): Date | null { return this.props.decidedAt; }
  get withdrawnReason(): string | null { return this.props.withdrawnReason; }
  get createdAt(): Date { return this.props.createdAt; }
  get version(): number { return this.props.version; }
  /** Les relances et la décharge n'ont de sens que pour une offre en cours. */
  get isOpen(): boolean {
    return this.props.status === OfferStatus.Submitted || this.props.status === OfferStatus.ReceiptReceived;
  }
}
