/** Synthèse de la liste des entreprises : effectifs par statut et valeurs disponibles pour les filtres. */
export interface CompanyOverview {
  /** Nombre d'entreprises par statut (statuts absents = 0), selon la recherche, le pays et le secteur demandés. */
  statusCounts: Record<string, number>;
  /** Pays renseignés dans la portée de l'appelant (pour proposer le filtre), triés. */
  countries: string[];
  /** Secteurs renseignés dans la portée de l'appelant, triés. */
  sectors: string[];
}

/** Port de lecture de la synthèse : compteurs par statut et valeurs de filtre, toujours bornés à la portée de l'appelant. */
export interface CompanyOverviewReader {
  /** `ownerIds` : mêmes règles que la liste (liste vide = aucune ; absent = portée Tous). */
  overview(query: { ownerIds?: readonly string[]; search?: string; country?: string; sector?: string }): Promise<CompanyOverview>;
}

export const COMPANY_OVERVIEW_READER = Symbol('CompanyOverviewReader');
