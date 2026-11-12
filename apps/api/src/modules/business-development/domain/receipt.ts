import { AggregateRoot, DomainError } from '../../../shared-kernel';

/** État d'une décharge : valide, ou annulée (avec son motif) ; une offre n'a jamais plus d'une décharge valide. */
export enum ReceiptStatus {
  Valid = 'VALID',
  Cancelled = 'CANCELLED',
}

export interface ReceiptProps {
  id: string;
  offerId: string;
  /** Date de réception de la décharge signée, « AAAA-MM-JJ ». */
  receivedOn: string;
  /** Personne de l'entreprise qui a signé ou remis la décharge. */
  receivedBy: string;
  status: ReceiptStatus;
  cancelledReason: string | null;
  cancelledAt: Date | null;
  createdAt: Date;
  version: number;
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Date « AAAA-MM-JJ » réelle (le 31 février n'existe pas), sinon refusée. */
function isoDate(raw: string | undefined): string {
  const text = (raw ?? '').trim();
  const m = DATE.exec(text);
  const valid = m !== null && new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!)).toISOString().slice(0, 10) === text;
  if (!valid) throw new DomainError('VALIDATION', 'La date de réception doit être une date valide (AAAA-MM-JJ)');
  return text;
}

const personOf = (raw: string | undefined): string => {
  const value = (raw ?? '').trim().replace(/\s+/g, ' ');
  if (!value) throw new DomainError('VALIDATION', 'Le nom de la personne qui a remis la décharge est obligatoire');
  if (value.length > 150) throw new DomainError('VALIDATION', 'Le nom ne peut dépasser 150 caractères');
  return value;
};

/**
 * Décharge signée par l'entreprise pour une offre déposée. Elle prouve que l'offre a bien été reçue ; le fichier signé est un
 * document rattaché à la décharge (module Documents). La visibilité suit celle de l'entreprise de l'offre.
 */
export class Receipt extends AggregateRoot {
  private constructor(private props: ReceiptProps) {
    super();
  }

  /**
   * Enregistre une décharge. La date ne peut pas être dans le futur ni précéder le dépôt de l'offre (on ne signe pas une offre
   * avant de l'avoir reçue).
   */
  static register(input: { id: string; offerId: string; receivedOn: string; receivedBy: string; offerSubmittedAt: Date | null; now: Date }): Receipt {
    if (!input.offerId) throw new DomainError('VALIDATION', 'Une décharge porte sur une offre');
    const receivedOn = isoDate(input.receivedOn);
    if (receivedOn > input.now.toISOString().slice(0, 10)) throw new DomainError('VALIDATION', 'La date de réception ne peut pas être dans le futur');
    if (input.offerSubmittedAt && receivedOn < input.offerSubmittedAt.toISOString().slice(0, 10)) {
      throw new DomainError('VALIDATION', "La date de réception ne peut pas précéder le dépôt de l'offre");
    }
    return new Receipt({
      id: input.id, offerId: input.offerId, receivedOn, receivedBy: personOf(input.receivedBy),
      status: ReceiptStatus.Valid, cancelledReason: null, cancelledAt: null, createdAt: input.now, version: 1,
    });
  }

  static rehydrate(props: ReceiptProps): Receipt {
    return new Receipt(props);
  }

  /** Annule la décharge (saisie erronée, mauvais fichier) avec un motif obligatoire ; une décharge annulée ne revient pas. */
  cancel(reason: string | undefined, now: Date): void {
    const text = (reason ?? '').trim();
    if (text.length < 3) throw new DomainError('VALIDATION', "Le motif de l'annulation est obligatoire");
    if (text.length > 500) throw new DomainError('VALIDATION', "Le motif de l'annulation ne peut dépasser 500 caractères");
    if (this.props.status !== ReceiptStatus.Valid) throw new DomainError('INVARIANT_VIOLATION', 'Cette décharge est déjà annulée');
    this.props = { ...this.props, status: ReceiptStatus.Cancelled, cancelledReason: text, cancelledAt: now };
  }

  get id(): string { return this.props.id; }
  get offerId(): string { return this.props.offerId; }
  get receivedOn(): string { return this.props.receivedOn; }
  get receivedBy(): string { return this.props.receivedBy; }
  get status(): ReceiptStatus { return this.props.status; }
  get cancelledReason(): string | null { return this.props.cancelledReason; }
  get cancelledAt(): Date | null { return this.props.cancelledAt; }
  get createdAt(): Date { return this.props.createdAt; }
  get version(): number { return this.props.version; }
}
