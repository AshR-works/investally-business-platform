export enum CompanyStatus {
  Target = 'TARGET',
  Contacted = 'CONTACTED',
  Qualified = 'QUALIFIED',
  Client = 'CLIENT',
  Archived = 'ARCHIVED',
}

/**
 * Transitions MANUELLES du statut (CU-C-05) : un cran à la fois, vers l'avant ou en retour. « Cliente » est posée par
 * l'agrément (flux C5, pas encore construit) et « Archivée » par l'archivage (CU-C-06) : jamais à la main ici.
 */
export const MANUAL_STATUS_TRANSITIONS: Readonly<Record<CompanyStatus, readonly CompanyStatus[]>> = {
  [CompanyStatus.Target]: [CompanyStatus.Contacted],
  [CompanyStatus.Contacted]: [CompanyStatus.Target, CompanyStatus.Qualified],
  [CompanyStatus.Qualified]: [CompanyStatus.Contacted],
  [CompanyStatus.Client]: [],
  [CompanyStatus.Archived]: [],
};
