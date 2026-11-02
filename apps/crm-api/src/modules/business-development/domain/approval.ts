import { AggregateRoot, DomainError } from '../../../shared-kernel';
import { ApprovalReceived } from './events/approval-received';
import { DEFAULT_CURRENCY } from './commission';

/**
 * Reçu : l'entreprise a signé la promesse de paiement ; honoré : le paiement a été constaté ; expiré (la validité est passée) ou
 * annulé (saisie erronée, renoncement) : toujours avec un motif. Honoré, expiré et annulé sont définitifs.
 */
export enum ApprovalStatus {
  Received = 'RECEIVED',
  Honored = 'HONORED',
  Expired = 'EXPIRED',
  Cancelled = 'CANCELLED',
}

/** États dans lesquels un agrément compte comme « actif » : il couvre l'opportunité et n'en tolère pas un second. */
export const ACTIVE_APPROVAL_STATUSES: readonly ApprovalStatus[] = [ApprovalStatus.Received, ApprovalStatus.Honored];

export interface ApprovalProps {
  id: string;
  companyId: string;
  opportunityId: string;
  /** Somme globale couverte (texte décimal à deux décimales) ; absente si l'agrément ne couvre qu'un nombre de places. */
  amount: string | null;
  currency: string;
  /** Nombre de places couvertes ; absent si l'agrément ne couvre qu'une somme. Au moins l'un des deux est renseigné (D1). */
  places: number | null;
  /** Date de signature ou de réception de l'agrément, « AAAA-MM-JJ ». */
  receivedOn: string;
  /** Fin de validité, « AAAA-MM-JJ » (facultative, D3). */
  validUntil: string | null;
  status: ApprovalStatus;
  /** Motif de l'expiration ou de l'annulation ; absent pour un agrément reçu ou honoré. */
  closedReason: string | null;
  closedAt: Date | null;
  createdAt: Date;
  version: number;
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Date « AAAA-MM-JJ » réelle (le 31 février n'existe pas), sinon refusée. */
function isoDate(raw: string | null | undefined, label: string): string {
  const text = (raw ?? '').trim();
  const m = DATE.exec(text);
  const valid = m !== null && new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!)).toISOString().slice(0, 10) === text;
  if (!valid) throw new DomainError('VALIDATION', `${label} doit être une date valide (AAAA-MM-JJ)`);
  return text;
}

const amountOf = (raw: string | number | null | undefined): string | null => {
  if (raw === null || raw === undefined || String(raw).trim() === '') return null;
  const text = String(raw).trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(text) || Number(text) <= 0) {
    throw new DomainError('VALIDATION', 'Le montant de l\'agrément doit être un nombre positif (deux décimales au plus)');
  }
  return Number(text).toFixed(2);
};

const placesOf = (raw: number | null | undefined): number | null => {
  if (raw === null || raw === undefined) return null;
  if (!Number.isInteger(raw) || raw < 1 || raw > 100000) throw new DomainError('VALIDATION', 'Le nombre de places doit être un entier positif');
  return raw;
};

const currencyOf = (raw: string | undefined): string => {
  const typed = (raw ?? '').trim().toUpperCase();
  const currency = typed === '' || typed === 'FCFA' ? DEFAULT_CURRENCY : typed;
  if (!/^[A-Z]{3}$/.test(currency)) throw new DomainError('VALIDATION', 'La devise doit comporter trois lettres (ex. XAF, EUR)');
  return currency;
};

/** Motif obligatoire (expiration, annulation) : trois caractères au moins, 500 au plus. */
function reasonOf(raw: string | undefined, label: string): string {
  const text = (raw ?? '').trim();
  if (text.length < 3) throw new DomainError('VALIDATION', `${label} est obligatoire`);
  if (text.length > 500) throw new DomainError('VALIDATION', `${label} ne peut dépasser 500 caractères`);
  return text;
}

/**
 * Agrément : promesse de paiement signée par l'entreprise cliente (payeur : le client seulement, D2) pour une opportunité qui a
 * franchi l'accord de principe. Il couvre une somme, un nombre de places, ou les deux (D1) ; sa validité est facultative et son
 * expiration manuelle (D3). Le document signé est rattaché à l'agrément (module Documents). Le paiement effectif n'est pas suivi
 * ici mais par la finance (D5). Sa visibilité suit celle de l'entreprise.
 */
export class Approval extends AggregateRoot {
  private constructor(private props: ApprovalProps) {
    super();
  }

  /** Enregistre un agrément reçu. La date de réception n'est pas dans le futur ; la validité ne la précède pas. */
  static register(input: {
    id: string; companyId: string; opportunityId: string; amount?: string | number | null; places?: number | null; currency?: string;
    receivedOn: string; validUntil?: string | null; now: Date;
  }): Approval {
    if (!input.companyId) throw new DomainError('VALIDATION', 'Un agrément concerne une entreprise');
    if (!input.opportunityId) throw new DomainError('VALIDATION', 'Un agrément concerne une opportunité');
    const amount = amountOf(input.amount);
    const places = placesOf(input.places);
    if (amount === null && places === null) throw new DomainError('VALIDATION', 'Indiquez le montant couvert, le nombre de places, ou les deux');
    const receivedOn = isoDate(input.receivedOn, 'La date de réception');
    if (receivedOn > input.now.toISOString().slice(0, 10)) throw new DomainError('VALIDATION', 'La date de réception ne peut pas être dans le futur');
    const validUntil = input.validUntil && input.validUntil.trim() !== '' ? isoDate(input.validUntil, 'La date de fin de validité') : null;
    if (validUntil !== null && validUntil < receivedOn) throw new DomainError('VALIDATION', 'La fin de validité ne peut pas précéder la réception');
    const approval = new Approval({
      id: input.id, companyId: input.companyId, opportunityId: input.opportunityId, amount, currency: currencyOf(input.currency), places,
      receivedOn, validUntil, status: ApprovalStatus.Received, closedReason: null, closedAt: null, createdAt: input.now, version: 1,
    });
    approval.record(new ApprovalReceived(input.id, input.now, input.companyId, input.opportunityId));
    return approval;
  }

  static rehydrate(props: ApprovalProps): Approval {
    return new Approval(props);
  }

  private assertReceived(action: string): void {
    if (this.props.status !== ApprovalStatus.Received) {
      throw new DomainError('INVARIANT_VIOLATION', `Un agrément ${this.label()} ne peut plus être ${action}`);
    }
  }

  private label(): string {
    return { RECEIVED: 'reçu', HONORED: 'honoré', EXPIRED: 'expiré', CANCELLED: 'annulé' }[this.props.status];
  }

  /** Constate que la promesse a été tenue (le paiement a eu lieu). Seul un agrément reçu peut être honoré. */
  honor(now: Date): void {
    this.assertReceived('honoré');
    this.props = { ...this.props, status: ApprovalStatus.Honored, closedAt: now };
  }

  /** Déclare l'agrément expiré (sa validité est passée), avec un motif ; expiration manuelle (D3). */
  expire(reason: string | undefined, now: Date): void {
    const closedReason = reasonOf(reason, "Le motif de l'expiration");
    this.assertReceived('déclaré expiré');
    this.props = { ...this.props, status: ApprovalStatus.Expired, closedReason, closedAt: now };
  }

  /** Annule l'agrément (saisie erronée, renoncement du client) avec un motif ; il ne revient pas. */
  cancel(reason: string | undefined, now: Date): void {
    const closedReason = reasonOf(reason, "Le motif de l'annulation");
    this.assertReceived('annulé');
    this.props = { ...this.props, status: ApprovalStatus.Cancelled, closedReason, closedAt: now };
  }

  /** Vrai si la date de fin de validité est passée (sert à signaler « à expirer » ; l'expiration reste manuelle). */
  isPastValidity(today: string): boolean {
    return this.props.status === ApprovalStatus.Received && this.props.validUntil !== null && this.props.validUntil < today;
  }

  get id(): string { return this.props.id; }
  get companyId(): string { return this.props.companyId; }
  get opportunityId(): string { return this.props.opportunityId; }
  get amount(): string | null { return this.props.amount; }
  get currency(): string { return this.props.currency; }
  get places(): number | null { return this.props.places; }
  get receivedOn(): string { return this.props.receivedOn; }
  get validUntil(): string | null { return this.props.validUntil; }
  get status(): ApprovalStatus { return this.props.status; }
  get closedReason(): string | null { return this.props.closedReason; }
  get closedAt(): Date | null { return this.props.closedAt; }
  get createdAt(): Date { return this.props.createdAt; }
  get version(): number { return this.props.version; }
}
