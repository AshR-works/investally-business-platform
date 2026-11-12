import { AggregateRoot, DomainError } from '../../../shared-kernel';

/** Canal de la relance. */
export enum FollowupChannel {
  Call = 'CALL',
  Email = 'EMAIL',
  Whatsapp = 'WHATSAPP',
  Meeting = 'MEETING',
  Other = 'OTHER',
}

/** À faire, terminée (avec son résultat) ou annulée (avec son motif). Terminée et annulée sont définitives. */
export enum FollowupStatus {
  Planned = 'PLANNED',
  Done = 'DONE',
  Cancelled = 'CANCELLED',
}

/** Au plus trois relances par offre (terminées ou à faire ; les annulées ne comptent pas) : valeur proposée, à confirmer. */
export const MAX_FOLLOWUPS_PER_OFFER = 3;

export interface FollowupProps {
  id: string;
  offerId: string;
  /** Échéance, « AAAA-MM-JJ ». */
  dueOn: string;
  channel: FollowupChannel;
  note: string | null;
  status: FollowupStatus;
  /** Résultat (terminée) ou motif d'annulation (annulée) ; absent tant que la relance est à faire. */
  resultNote: string | null;
  closedAt: Date | null;
  createdAt: Date;
  version: number;
}

const CHANNELS: readonly string[] = Object.values(FollowupChannel);
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const today = (now: Date): string => now.toISOString().slice(0, 10);

function isoDate(raw: string | undefined): string {
  const text = (raw ?? '').trim();
  const m = DATE.exec(text);
  const valid = m !== null && new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!)).toISOString().slice(0, 10) === text;
  if (!valid) throw new DomainError('VALIDATION', "L'échéance doit être une date valide (AAAA-MM-JJ)");
  return text;
}

const channelOf = (raw: string | undefined): FollowupChannel => {
  if (!CHANNELS.includes(raw ?? '')) throw new DomainError('VALIDATION', 'Le canal de la relance est inconnu');
  return raw as FollowupChannel;
};

const noteOf = (raw: string | null | undefined): string | null => {
  const value = (raw ?? '').trim();
  if (value.length > 500) throw new DomainError('VALIDATION', 'La note ne peut dépasser 500 caractères');
  return value === '' ? null : value;
};

/** Texte obligatoire (résultat, motif) : trois caractères au moins, la limite donnée au plus. */
function required(raw: string | undefined, label: string, max: number): string {
  const text = (raw ?? '').trim();
  if (text.length < 3) throw new DomainError('VALIDATION', `${label} est obligatoire`);
  if (text.length > max) throw new DomainError('VALIDATION', `${label} ne peut dépasser ${max} caractères`);
  return text;
}

/**
 * Relance d'une offre en cours : à faire à une échéance, par un canal. La liste « À faire » s'appuie sur l'échéance ; une relance
 * dont l'échéance est passée est « en retard » (calculé, jamais stocké). Sa visibilité suit celle de l'entreprise de l'offre.
 */
export class Followup extends AggregateRoot {
  private constructor(private props: FollowupProps) {
    super();
  }

  /** Planifie une relance ; l'échéance ne peut pas être dans le passé. */
  static plan(input: { id: string; offerId: string; dueOn: string; channel: string; note?: string | null; now: Date }): Followup {
    if (!input.offerId) throw new DomainError('VALIDATION', 'Une relance porte sur une offre');
    const dueOn = isoDate(input.dueOn);
    if (dueOn < today(input.now)) throw new DomainError('VALIDATION', "L'échéance ne peut pas être dans le passé");
    return new Followup({
      id: input.id, offerId: input.offerId, dueOn, channel: channelOf(input.channel), note: noteOf(input.note),
      status: FollowupStatus.Planned, resultNote: null, closedAt: null, createdAt: input.now, version: 1,
    });
  }

  static rehydrate(props: FollowupProps): Followup {
    return new Followup(props);
  }

  private assertPlanned(action: string): void {
    if (this.props.status !== FollowupStatus.Planned) {
      throw new DomainError('INVARIANT_VIOLATION', `Une relance ${this.props.status === FollowupStatus.Done ? 'terminée' : 'annulée'} ne peut plus être ${action}`);
    }
  }

  /**
   * Modifie l'échéance, le canal ou la note d'une relance À FAIRE. Une échéance déjà passée peut rester telle quelle (relance en
   * retard) ; une NOUVELLE échéance ne peut pas être dans le passé. Tout ou rien.
   */
  edit(changes: { dueOn?: string; channel?: string; note?: string | null }, now: Date): void {
    this.assertPlanned('modifiée');
    const next = { ...this.props };
    if (changes.dueOn !== undefined && changes.dueOn !== this.props.dueOn) {
      next.dueOn = isoDate(changes.dueOn);
      if (next.dueOn < today(now)) throw new DomainError('VALIDATION', "L'échéance ne peut pas être dans le passé");
    }
    if (changes.channel !== undefined) next.channel = channelOf(changes.channel);
    if (changes.note !== undefined) next.note = noteOf(changes.note);
    this.props = next;
  }

  /** Termine la relance avec son résultat (obligatoire : ce qui s'est dit ou décidé). */
  complete(result: string | undefined, now: Date): void {
    const resultNote = required(result, 'Le résultat de la relance', 1000);
    this.assertPlanned('terminée');
    this.props = { ...this.props, status: FollowupStatus.Done, resultNote, closedAt: now };
  }

  /** Annule la relance avec un motif (obligatoire) ; l'annulation automatique, quand l'offre n'est plus en cours, y a aussi son motif. */
  cancel(reason: string | undefined, now: Date): void {
    const resultNote = required(reason, "Le motif de l'annulation", 500);
    this.assertPlanned('annulée');
    this.props = { ...this.props, status: FollowupStatus.Cancelled, resultNote, closedAt: now };
  }

  /** Vrai si la relance est à faire et son échéance dépassée. */
  isOverdue(now: Date): boolean {
    return this.props.status === FollowupStatus.Planned && this.props.dueOn < today(now);
  }

  get id(): string { return this.props.id; }
  get offerId(): string { return this.props.offerId; }
  get dueOn(): string { return this.props.dueOn; }
  get channel(): FollowupChannel { return this.props.channel; }
  get note(): string | null { return this.props.note; }
  get status(): FollowupStatus { return this.props.status; }
  get resultNote(): string | null { return this.props.resultNote; }
  get closedAt(): Date | null { return this.props.closedAt; }
  get createdAt(): Date { return this.props.createdAt; }
  get version(): number { return this.props.version; }
}
