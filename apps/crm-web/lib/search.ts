import { api } from './api';
import { can } from './permissions';
import type { Company, Page, Profile, UserView } from './types';

/** Un résultat de la recherche globale. */
export interface SearchHit {
  type: 'Entreprises' | 'Utilisateurs';
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

/** Nombre minimal de caractères avant d'interroger le serveur. */
export const MIN_QUERY_LENGTH = 2;
/** Résultats demandés par type. */
export const HITS_PER_TYPE = 5;

/**
 * Recherche globale (CAD-H1-4) : interroge en parallèle les listes que le profil a le droit de lire (entreprises,
 * utilisateurs). Les droits et les portées sont appliqués par le serveur ; ici on évite seulement les appels
 * inutiles. Une requête qui échoue ne masque pas les résultats des autres types.
 */
export async function searchAll(query: string, profile: Profile | null, signal?: AbortSignal): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < MIN_QUERY_LENGTH) return [];
  const params = new URLSearchParams({ search: q, pageSize: String(HITS_PER_TYPE) });
  const tasks: Promise<SearchHit[]>[] = [];
  if (can(profile, 'bd.company.read')) {
    tasks.push(
      api<Page<Company>>(`/companies?${params}`, { signal }).then((page) =>
        page.items.map((c) => ({ type: 'Entreprises' as const, id: c.id, title: c.name, subtitle: [c.sector, c.status].filter(Boolean).join(' · '), href: '/companies' })),
      ),
    );
  }
  if (can(profile, 'iam.user.read')) {
    tasks.push(
      api<Page<UserView>>(`/admin/users?${params}`, { signal }).then((page) =>
        page.items.map((u) => ({ type: 'Utilisateurs' as const, id: u.id, title: u.displayName, subtitle: u.email, href: '/admin/users' })),
      ),
    );
  }
  const settled = await Promise.allSettled(tasks);
  if (signal?.aborted) return [];
  return settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
}
