import { AggregateRoot, DomainError } from '../../../shared-kernel';
import { assertActive, CatalogueStatus, keyOf, optionalText, requiredText } from './catalogue-fields';

/** Tarifs d'un certificat dans une même devise : prix complet et/ou prix de chaque module (le prix complet n'est pas la somme des modules). */
export interface Pricing {
  currency: string;
  full: string | null;
  perModule: string | null;
}

export const DEFAULT_CURRENCY = 'XAF';
export const MAX_MODULES_PER_TRAINING = 20;

export interface TrainingProps {
  id: string;
  programId: string;
  title: string;
  objectives: string | null;
  prerequisites: string | null;
  pricing: Pricing | null;
  /** Modules du certificat, dans l'ordre de présentation. */
  moduleIds: string[];
  status: CatalogueStatus;
  createdAt: Date;
  version: number;
}

/** Montant positif à deux décimales au plus (texte décimal) ; absent = `null`. */
function amountOf(raw: string | number | null | undefined, label: string): string | null {
  if (raw === null || raw === undefined || String(raw).trim() === '') return null;
  const text = String(raw).trim().replace(',', '.');
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(text) || Number(text) <= 0) {
    throw new DomainError('VALIDATION', `${label} doit être un montant positif, avec deux décimales au plus`);
  }
  return Number(text).toFixed(2);
}

/** Aucun montant = aucun tarif ; une devise sans montant est refusée ; devise absente = XAF (D46, à confirmer). */
function pricingOf(full: string | null, perModule: string | null, currency: string | null | undefined): Pricing | null {
  if (full === null && perModule === null) {
    if (currency) throw new DomainError('VALIDATION', 'Une devise sans montant n’a pas de sens : renseignez un prix');
    return null;
  }
  const code = (currency ?? DEFAULT_CURRENCY).trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) throw new DomainError('VALIDATION', 'La devise doit comporter trois lettres (ex. XAF)');
  return { currency: code, full, perModule };
}

function modulesOf(ids: readonly string[]): string[] {
  if (ids.length > MAX_MODULES_PER_TRAINING) throw new DomainError('VALIDATION', `Un certificat compte ${MAX_MODULES_PER_TRAINING} modules au plus`);
  if (new Set(ids).size !== ids.length) throw new DomainError('VALIDATION', 'Un module ne peut figurer qu’une fois dans un certificat');
  return [...ids];
}

/** Certificat : formation vendable et planifiable. Un seul programme (non modifiable) ; titre unique dans son programme ; modules ordonnés. */
export class Training extends AggregateRoot {
  private constructor(private props: TrainingProps) {
    super();
  }

  static create(input: {
    id: string; programId: string; title: string; objectives?: string | null; prerequisites?: string | null;
    priceAmount?: string | number | null; modulePriceAmount?: string | number | null; priceCurrency?: string | null; moduleIds?: readonly string[]; now: Date;
  }): Training {
    return new Training({
      id: input.id,
      programId: input.programId,
      title: requiredText(input.title, 'Le titre du certificat', 150),
      objectives: optionalText(input.objectives, 'Les objectifs', 2000),
      prerequisites: optionalText(input.prerequisites, 'Les prérequis', 1000),
      pricing: pricingOf(amountOf(input.priceAmount, 'Le prix complet'), amountOf(input.modulePriceAmount, 'Le prix par module'), input.priceCurrency),
      moduleIds: modulesOf(input.moduleIds ?? []),
      status: 'ACTIVE',
      createdAt: input.now,
      version: 1,
    });
  }

  static rehydrate(props: TrainingProps): Training {
    return new Training({ ...props, moduleIds: [...props.moduleIds] });
  }

  /**
   * Champ absent = inchangé ; texte vide = effacé ; un prix `null` = retiré ; `moduleIds` = nouvelle liste ordonnée complète.
   * Le programme ne change pas.
   */
  update(changes: {
    title?: string; objectives?: string | null; prerequisites?: string | null; priceAmount?: string | number | null; modulePriceAmount?: string | number | null;
    priceCurrency?: string | null; moduleIds?: readonly string[];
  }): void {
    assertActive(this.props.status, 'Le certificat');
    const next = { ...this.props };
    if (changes.title !== undefined) next.title = requiredText(changes.title, 'Le titre du certificat', 150);
    if (changes.objectives !== undefined) next.objectives = optionalText(changes.objectives, 'Les objectifs', 2000);
    if (changes.prerequisites !== undefined) next.prerequisites = optionalText(changes.prerequisites, 'Les prérequis', 1000);
    if (changes.priceAmount !== undefined || changes.modulePriceAmount !== undefined || changes.priceCurrency !== undefined) {
      const current = this.props.pricing;
      const full = changes.priceAmount !== undefined ? amountOf(changes.priceAmount, 'Le prix complet') : current?.full ?? null;
      const perModule = changes.modulePriceAmount !== undefined ? amountOf(changes.modulePriceAmount, 'Le prix par module') : current?.perModule ?? null;
      // Retirer le dernier prix retire aussi la devise ; seule une devise donnée EXPRESSÉMENT sans montant est refusée.
      const currency = changes.priceCurrency !== undefined ? changes.priceCurrency : full === null && perModule === null ? null : current?.currency;
      next.pricing = pricingOf(full, perModule, currency);
    }
    if (changes.moduleIds !== undefined) next.moduleIds = modulesOf(changes.moduleIds);
    this.props = next;
  }

  archive(): void {
    if (this.props.status === 'ARCHIVED') throw new DomainError('INVARIANT_VIOLATION', 'Le certificat est déjà archivé');
    this.props = { ...this.props, status: 'ARCHIVED' };
  }

  reactivate(): void {
    if (this.props.status === 'ACTIVE') throw new DomainError('INVARIANT_VIOLATION', 'Le certificat est déjà actif');
    this.props = { ...this.props, status: 'ACTIVE' };
  }

  get id(): string { return this.props.id; }
  get programId(): string { return this.props.programId; }
  get title(): string { return this.props.title; }
  get titleKey(): string { return keyOf(this.props.title); }
  get objectives(): string | null { return this.props.objectives; }
  get prerequisites(): string | null { return this.props.prerequisites; }
  get pricing(): Pricing | null { return this.props.pricing; }
  get moduleIds(): readonly string[] { return this.props.moduleIds; }
  get status(): CatalogueStatus { return this.props.status; }
  get createdAt(): Date { return this.props.createdAt; }
  get version(): number { return this.props.version; }
}
