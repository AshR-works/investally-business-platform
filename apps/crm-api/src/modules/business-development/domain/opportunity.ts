import { AggregateRoot, DomainError } from '../../../shared-kernel';
import { DEFAULT_CURRENCY } from './commission';

/**
 * Étapes du pipeline, dans l'ordre (noms et ordre du prototype, à confirmer) : on avance d'une étape à la fois, sans retour en arrière.
 * L'accord de principe est soumis à la règle du rendez-vous décideur tenu (flux F1) ou à une dérogation.
 */
export enum OpportunityStage {
  Qualification = 'QUALIFICATION',
  Proposal = 'PROPOSAL',
  Negotiation = 'NEGOTIATION',
  AgreementInPrinciple = 'AGREEMENT_IN_PRINCIPLE',
  Accreditation = 'ACCREDITATION',
}

export const STAGE_ORDER: readonly OpportunityStage[] = [
  OpportunityStage.Qualification,
  OpportunityStage.Proposal,
  OpportunityStage.Negotiation,
  OpportunityStage.AgreementInPrinciple,
  OpportunityStage.Accreditation,
];

/** Ouverte, gagnée ou perdue. Gagnée et perdue sont définitives : une opportunité clôturée est immuable. */
export enum OpportunityStatus {
  Open = 'OPEN',
  Won = 'WON',
  Lost = 'LOST',
}

/** D'où vient l'opportunité (liste fermée proposée, à confirmer). */
export enum OpportunitySource {
  Prospecting = 'PROSPECTING',
  Referral = 'REFERRAL',
  Event = 'EVENT',
  Inbound = 'INBOUND',
  Other = 'OTHER',
}

/** Motifs de perte (liste fermée proposée, à confirmer) ; « autre » exige une précision. */
export enum LossReason {
  Price = 'PRICE',
  Competitor = 'COMPETITOR',
  NoBudget = 'NO_BUDGET',
  NoResponse = 'NO_RESPONSE',
  NotInterested = 'NOT_INTERESTED',
  Other = 'OTHER',
}

export interface OpportunityProps {
  id: string;
  companyId: string;
  title: string;
  /** Montant estimé en texte décimal (deux décimales) : jamais de nombre flottant. */
  amount: string;
  currency: string;
  source: OpportunitySource;
  stage: OpportunityStage;
  status: OpportunityStatus;
  lossReason: LossReason | null;
  closingNote: string | null;
  closedAt: Date | null;
  /** Dérogation à la règle du rendez-vous décideur : sa justification et sa date, ensemble ou pas du tout. */
  waiverReason: string | null;
  waivedAt: Date | null;
  stageChangedAt: Date;
  createdAt: Date;
  /** Dernière modification (lecture seule : posée par la base). */
  updatedAt: Date;
  version: number;
}

const enumOf = <T extends string>(values: readonly string[], raw: string | undefined, message: string): T => {
  if (!values.includes(raw ?? '')) throw new DomainError('VALIDATION', message);
  return raw as T;
};

const titleOf = (raw: string | undefined): string => {
  const value = (raw ?? '').trim().replace(/\s+/g, ' ');
  if (!value) throw new DomainError('VALIDATION', "L'intitulé de l'opportunité est obligatoire");
  if (value.length > 200) throw new DomainError('VALIDATION', "L'intitulé de l'opportunité ne peut dépasser 200 caractères");
  return value;
};

const amountOf = (raw: string | number | undefined): string => {
  const text = String(raw ?? '').trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(text) || Number(text) <= 0) {
    throw new DomainError('VALIDATION', 'Le montant estimé doit être un nombre positif (deux décimales au plus)');
  }
  return Number(text).toFixed(2);
};

const currencyOf = (raw: string | undefined): string => {
  const typed = (raw ?? '').trim().toUpperCase();
  const currency = typed === '' || typed === 'FCFA' ? DEFAULT_CURRENCY : typed;
  if (!/^[A-Z]{3}$/.test(currency)) throw new DomainError('VALIDATION', 'La devise doit comporter trois lettres (ex. XAF, EUR)');
  return currency;
};

/** Texte obligatoire (justification, précision) : trois caractères au moins, la limite donnée au plus. */
function required(raw: string | undefined, label: string, max: number): string {
  const text = (raw ?? '').trim();
  if (text.length < 3) throw new DomainError('VALIDATION', `${label} est obligatoire`);
  if (text.length > max) throw new DomainError('VALIDATION', `${label} ne peut dépasser ${max} caractères`);
  return text;
}

const IMMUTABLE = 'Une opportunité clôturée est immuable';

/**
 * Opportunité commerciale d'une entreprise (plusieurs en même temps possibles) : sa visibilité suit celle de l'entreprise.
 * Toutes les règles du pipeline sont ici : étapes dans l'ordre, rendez-vous décideur ou dérogation avant l'accord de principe,
 * clôture perdue (avec motif) ou gagnée (au plus tôt à l'accord de principe), immuabilité après clôture.
 */
export class Opportunity extends AggregateRoot {
  private constructor(private props: OpportunityProps) {
    super();
  }

  /** Crée une opportunité : elle commence à « Qualification ». */
  static create(input: {
    id: string; companyId: string; title: string; amount: string | number; currency?: string; source: string; now: Date;
  }): Opportunity {
    if (!input.companyId) throw new DomainError('VALIDATION', 'Une opportunité concerne une entreprise');
    return new Opportunity({
      id: input.id,
      companyId: input.companyId,
      title: titleOf(input.title),
      amount: amountOf(input.amount),
      currency: currencyOf(input.currency),
      source: enumOf<OpportunitySource>(Object.values(OpportunitySource), input.source, "La source de l'opportunité est inconnue"),
      stage: OpportunityStage.Qualification,
      status: OpportunityStatus.Open,
      lossReason: null, closingNote: null, closedAt: null, waiverReason: null, waivedAt: null,
      stageChangedAt: input.now, createdAt: input.now, updatedAt: input.now, version: 1,
    });
  }

  static rehydrate(props: OpportunityProps): Opportunity {
    return new Opportunity(props);
  }

  private assertOpen(): void {
    if (this.props.status !== OpportunityStatus.Open) throw new DomainError('INVARIANT_VIOLATION', IMMUTABLE);
  }

  /** Modifie l'intitulé, le montant, la devise ou la source d'une opportunité OUVERTE. Tout ou rien. */
  edit(changes: { title?: string; amount?: string | number; currency?: string; source?: string }): void {
    this.assertOpen();
    const next = { ...this.props };
    if (changes.title !== undefined) next.title = titleOf(changes.title);
    if (changes.amount !== undefined) next.amount = amountOf(changes.amount);
    if (changes.currency !== undefined) next.currency = currencyOf(changes.currency);
    if (changes.source !== undefined) next.source = enumOf<OpportunitySource>(Object.values(OpportunitySource), changes.source, "La source de l'opportunité est inconnue");
    this.props = next;
  }

  /** L'étape qui suit l'étape actuelle ; `null` à la dernière. */
  get nextStage(): OpportunityStage | null {
    return STAGE_ORDER[STAGE_ORDER.indexOf(this.props.stage) + 1] ?? null;
  }

  /**
   * Passe à l'étape suivante, jamais plus loin ni en arrière. L'accord de principe exige un rendez-vous décideur tenu
   * (`decisionMakerMeetingHeld`) ou une dérogation accordée.
   */
  advance(context: { decisionMakerMeetingHeld: boolean }, now: Date): void {
    this.assertOpen();
    const next = this.nextStage;
    if (!next) throw new DomainError('INVARIANT_VIOLATION', "L'opportunité est à la dernière étape");
    if (next === OpportunityStage.AgreementInPrinciple && !context.decisionMakerMeetingHeld && !this.props.waivedAt) {
      throw new DomainError('INVARIANT_VIOLATION', "Aucun rendez-vous décideur tenu : l'accord de principe exige un rendez-vous tenu avec le décideur, ou une dérogation du Responsable commercial");
    }
    this.props = { ...this.props, stage: next, stageChangedAt: now };
  }

  /** Accorde la dérogation à la règle du rendez-vous décideur (justification obligatoire) ; une seule fois, avant l'accord de principe. */
  grantWaiver(reason: string | undefined, now: Date): void {
    const waiverReason = required(reason, 'La justification de la dérogation', 500);
    this.assertOpen();
    if (this.props.waivedAt) throw new DomainError('INVARIANT_VIOLATION', 'Une dérogation a déjà été accordée');
    if (STAGE_ORDER.indexOf(this.props.stage) >= STAGE_ORDER.indexOf(OpportunityStage.AgreementInPrinciple)) {
      throw new DomainError('INVARIANT_VIOLATION', "L'accord de principe est déjà obtenu : aucune dérogation n'est nécessaire");
    }
    this.props = { ...this.props, waiverReason, waivedAt: now };
  }

  /** Clôture « perdue » avec un motif de la liste fermée ; « autre » exige une précision. */
  closeLost(reason: string | undefined, note: string | null | undefined, now: Date): void {
    const lossReason = enumOf<LossReason>(Object.values(LossReason), reason, 'Le motif de perte est obligatoire (choisissez dans la liste)');
    const typed = (note ?? '').trim();
    if (typed.length > 500) throw new DomainError('VALIDATION', 'La précision ne peut dépasser 500 caractères');
    if (lossReason === LossReason.Other && typed.length < 3) throw new DomainError('VALIDATION', 'Précisez le motif « autre »');
    this.assertOpen();
    this.props = { ...this.props, status: OpportunityStatus.Lost, lossReason, closingNote: typed === '' ? null : typed, closedAt: now };
  }

  /** Clôture « gagnée » : au plus tôt une fois l'accord de principe obtenu. */
  closeWon(now: Date): void {
    this.assertOpen();
    if (STAGE_ORDER.indexOf(this.props.stage) < STAGE_ORDER.indexOf(OpportunityStage.AgreementInPrinciple)) {
      throw new DomainError('INVARIANT_VIOLATION', "Une opportunité ne peut être gagnée qu'après l'accord de principe");
    }
    this.props = { ...this.props, status: OpportunityStatus.Won, closedAt: now };
  }

  get id(): string { return this.props.id; }
  get companyId(): string { return this.props.companyId; }
  get title(): string { return this.props.title; }
  get amount(): string { return this.props.amount; }
  get currency(): string { return this.props.currency; }
  get source(): OpportunitySource { return this.props.source; }
  get stage(): OpportunityStage { return this.props.stage; }
  get status(): OpportunityStatus { return this.props.status; }
  get lossReason(): LossReason | null { return this.props.lossReason; }
  get closingNote(): string | null { return this.props.closingNote; }
  get closedAt(): Date | null { return this.props.closedAt; }
  get waiverReason(): string | null { return this.props.waiverReason; }
  get waivedAt(): Date | null { return this.props.waivedAt; }
  get stageChangedAt(): Date { return this.props.stageChangedAt; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
  get version(): number { return this.props.version; }
  get isOpen(): boolean { return this.props.status === OpportunityStatus.Open; }
}
