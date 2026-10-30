import { COMPANY_STATUS } from './status';

/** Champs sur lesquels l'API sait trier les entreprises. */
export type CompanySortField = 'createdAt' | 'name' | 'country' | 'sector' | 'status';
export type SortDirection = 'asc' | 'desc';
export interface CompanySort {
  field: CompanySortField;
  direction: SortDirection;
}

/** Tri par défaut : les plus récentes d'abord (celui de l'API quand rien n'est demandé). */
export const DEFAULT_SORT: CompanySort = { field: 'createdAt', direction: 'desc' };

/** Filtres du tableau ; chaîne vide = pas de filtre. */
export interface CompanyFilters {
  search: string;
  status: string;
  country: string;
  sector: string;
}
export const NO_FILTERS: CompanyFilters = { search: '', status: '', country: '', sector: '' };

export const hasActiveFilters = (f: CompanyFilters): boolean => Boolean(f.search || f.status || f.country || f.sector);

/** Clic sur un en-tête : nouveau champ → croissant ; même champ → inverse ; troisième clic sur « Créée le » repart du tri par défaut. */
export function nextSort(current: CompanySort, field: CompanySortField): CompanySort {
  if (current.field !== field) return { field, direction: field === 'createdAt' ? 'desc' : 'asc' };
  return { field, direction: current.direction === 'asc' ? 'desc' : 'asc' };
}

/** Paramètres de la liste pour l'API. Les filtres vides ne sont pas envoyés ; le tri par défaut non plus. */
export function listParams(filters: CompanyFilters, sort: CompanySort, page: number, pageSize: number): URLSearchParams {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (filters.search) params.set('search', filters.search);
  if (filters.status) params.set('status', filters.status);
  if (filters.country) params.set('country', filters.country);
  if (filters.sector) params.set('sector', filters.sector);
  if (sort.field !== DEFAULT_SORT.field || sort.direction !== DEFAULT_SORT.direction) {
    params.set('sort', sort.field);
    params.set('direction', sort.direction);
  }
  return params;
}

/** Paramètres de la synthèse : mêmes filtres que la liste, SAUF le statut (les compteurs par statut doivent rester lisibles). */
export function overviewParams(filters: CompanyFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.country) params.set('country', filters.country);
  if (filters.sector) params.set('sector', filters.sector);
  return params;
}

/** Synthèse renvoyée par l'API. */
export interface CompanyOverview {
  statusCounts: Record<string, number>;
  countries: string[];
  sectors: string[];
}

/** Boutons de filtre par statut : « Toutes » + chaque statut, avec son effectif quand la synthèse est connue. */
export function statusOptions(counts: Record<string, number> | null): { value: string; label: string; count?: number }[] {
  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : undefined;
  return [
    { value: '', label: 'Toutes', count: total },
    ...Object.entries(COMPANY_STATUS).map(([value, style]) => ({ value, label: style.label, count: counts ? (counts[value] ?? 0) : undefined })),
  ];
}

/** Colonnes affichables. `locked` : toujours visible (le nom sert de lien vers la fiche). */
export const COMPANY_COLUMNS = [
  { id: 'name', label: 'Entreprise', locked: true },
  { id: 'sector', label: 'Secteur', locked: false },
  { id: 'country', label: 'Pays', locked: false },
  { id: 'email', label: 'E-mail', locked: false },
  { id: 'phone', label: 'Téléphone', locked: false },
  { id: 'status', label: 'Statut', locked: false },
  { id: 'created', label: 'Créée le', locked: false },
] as const;
export type CompanyColumnId = (typeof COMPANY_COLUMNS)[number]['id'];

/** Colonnes visibles par défaut (e-mail et téléphone sont proposés mais masqués). */
export const DEFAULT_COLUMNS: CompanyColumnId[] = ['name', 'sector', 'country', 'status', 'created'];

const KNOWN: readonly string[] = COMPANY_COLUMNS.map((c) => c.id);

/** Relit les colonnes mémorisées : toute valeur douteuse retombe sur le défaut ; la colonne verrouillée est toujours présente. */
export function parseStoredColumns(raw: string | null): CompanyColumnId[] {
  if (!raw) return DEFAULT_COLUMNS;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_COLUMNS;
    const chosen = new Set(parsed.filter((id): id is CompanyColumnId => typeof id === 'string' && KNOWN.includes(id)));
    for (const column of COMPANY_COLUMNS) if (column.locked) chosen.add(column.id);
    return COMPANY_COLUMNS.filter((c) => chosen.has(c.id)).map((c) => c.id);
  } catch {
    return DEFAULT_COLUMNS;
  }
}

/** Active ou masque une colonne ; une colonne verrouillée ne se masque pas. L'ordre reste celui du tableau. */
export function toggleColumn(visible: readonly CompanyColumnId[], id: CompanyColumnId): CompanyColumnId[] {
  if (COMPANY_COLUMNS.find((c) => c.id === id)?.locked) return [...visible];
  const next = new Set(visible);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return COMPANY_COLUMNS.filter((c) => next.has(c.id)).map((c) => c.id);
}

export const COLUMNS_STORAGE_KEY = 'investally.companies.columns';

export function loadColumns(): CompanyColumnId[] {
  try {
    return parseStoredColumns(localStorage.getItem(COLUMNS_STORAGE_KEY));
  } catch {
    return DEFAULT_COLUMNS;
  }
}

export function saveColumns(columns: readonly CompanyColumnId[]): void {
  try {
    localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(columns));
  } catch {
    // Stockage indisponible (navigation privée, politique du navigateur) : le choix vaut pour la session seulement.
  }
}
