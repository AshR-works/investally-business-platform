'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, ApiError } from './api';

/** L'entreprise qui sert de contexte à une liste (D52) : lue dans l'adresse (`?companyId=`), jamais dans un état caché. */
export interface CompanyContext {
  /** Identifiant dans l'adresse, ou chaîne vide. */
  companyId: string;
  /** Nom de l'entreprise une fois lu. */
  name: string | null;
  /** Pourquoi le contexte est inutilisable (entreprise introuvable ou hors de la portée de l'utilisateur) ; absent sinon. */
  problem: string | null;
  /** Retire le filtre de l'adresse (le reste de la requête est conservé). */
  clear: () => void;
}

const UNKNOWN = 'Cette entreprise est introuvable ou hors de votre périmètre.';

/**
 * Lit le filtre d'entreprise de l'adresse et le résout en nom. Une entreprise hors de la portée de l'utilisateur répond « introuvable » côté serveur :
 * la page l'explique au lieu d'afficher une liste vide qui ne dirait pas pourquoi.
 */
export function useCompanyContext(): CompanyContext {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const companyId = search.get('companyId') ?? '';
  const [name, setName] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    setName(null);
    setProblem(null);
    if (!companyId) return;
    let live = true;
    api<{ name: string }>(`/companies/${encodeURIComponent(companyId)}`)
      .then((company) => live && setName(company.name))
      .catch((e) => live && setProblem(e instanceof ApiError && e.status !== 404 && e.status !== 400 ? 'Le nom de l’entreprise est indisponible.' : UNKNOWN));
    return () => {
      live = false;
    };
  }, [companyId]);

  const clear = () => {
    const params = new URLSearchParams(search.toString());
    params.delete('companyId');
    const rest = params.toString();
    router.replace(rest ? `${pathname}?${rest}` : pathname);
  };
  return { companyId, name, problem, clear };
}

/** Adresse d'une liste filtrée par entreprise : `/offers?companyId=…`. */
export const listFor = (path: string, companyId: string): string => `${path}?companyId=${encodeURIComponent(companyId)}`;
