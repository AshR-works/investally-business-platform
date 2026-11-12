/** Montant total d'une devise. */
export interface CurrencyTotal {
  currency: string;
  /** Texte décimal à deux décimales. */
  amount: string;
}

/** Les opportunités OUVERTES d'une entreprise : leur nombre et leur valeur, devise par devise (on n'additionne jamais deux devises). */
export interface OpenOpportunities {
  count: number;
  totals: CurrencyTotal[];
}

/** Port de lecture de la valeur des opportunités ouvertes, par entreprise (colonne « Valeur » du tableau des entreprises). */
export interface OpportunityTotals {
  /** Les entreprises sans opportunité ouverte sont absentes du résultat. */
  openByCompany(companyIds: readonly string[]): Promise<ReadonlyMap<string, OpenOpportunities>>;
}

export const OPPORTUNITY_TOTALS = Symbol('OpportunityTotals');
