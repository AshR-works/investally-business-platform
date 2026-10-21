'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { HITS_PER_TYPE, MIN_QUERY_LENGTH, searchAll, type SearchHit } from '../lib/search';
import { FOCUS_SEARCH_EVENT } from './app-shell';
import { Icon } from './icon';

/** Délai (ms) entre la dernière frappe et l'appel au serveur. */
const TYPING_DELAY = 250;

/**
 * Recherche globale du hub (EXD-05, CAD-H1-4) : un champ, des résultats groupés par type. Les droits sont appliqués par
 * le serveur ; seuls les types que le profil peut lire sont interrogés. Ctrl/⌘ K ou le bouton de la barre supérieure
 * y placent le focus.
 */
export function GlobalSearch() {
  const { profile } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle');

  // Focus demandé par le raccourci, le bouton de la barre ou l'ancre `#recherche`.
  useEffect(() => {
    const focus = () => inputRef.current?.focus();
    if (location.hash === '#recherche') focus();
    window.addEventListener(FOCUS_SEARCH_EVENT, focus);
    return () => window.removeEventListener(FOCUS_SEARCH_EVENT, focus);
  }, []);

  useEffect(() => {
    if (query.trim().length < MIN_QUERY_LENGTH) {
      setHits([]);
      setState('idle');
      return;
    }
    setState('loading');
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchAll(query, profile, controller.signal)
        .then((found) => {
          if (controller.signal.aborted) return;
          setHits(found);
          setState('done');
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setHits([]);
            setState('done');
          }
        });
    }, TYPING_DELAY);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, profile]);

  const types = Array.from(new Set(hits.map((hit) => hit.type)));
  const status =
    state === 'loading' ? 'Recherche en cours…' : state === 'done' ? (hits.length === 0 ? 'Aucun résultat.' : `${hits.length} résultat${hits.length > 1 ? 's' : ''}.`) : '';

  return (
    <section role="search" aria-label="Recherche globale" className="max-w-2xl">
      <label htmlFor={`${id}-q`} className="sr-only">Recherche globale</label>
      <div className="flex h-14 items-center gap-3 rounded-full border border-field bg-surface px-5 focus-within:shadow-[var(--focus)]">
        <Icon name="search" className="size-5 text-ink-2" />
        <input
          id={`${id}-q`}
          ref={inputRef}
          type="search"
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Tapez un nom, une entreprise, un utilisateur…"
          className="m-0 h-full flex-1 rounded-none border-0 bg-transparent p-0 text-[length:var(--text-md)] shadow-none outline-none"
        />
      </div>
      <p role="status" className="mt-2 min-h-5 text-xs text-ink-2">{status}</p>
      {types.map((type) => (
        <div key={type} className="mt-3">
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-2">{type}</h2>
          <ul className="m-0 list-none overflow-hidden rounded-panel border border-line bg-surface p-0">
            {hits.filter((hit) => hit.type === type).slice(0, HITS_PER_TYPE).map((hit) => (
              <li key={`${hit.type}-${hit.id}`} className="border-b border-line last:border-b-0">
                <Link href={hit.href} className="block px-4 py-3 text-ink no-underline hover:bg-surface-2">
                  <span className="block font-semibold">{hit.title}</span>
                  {hit.subtitle && <span className="block text-xs text-ink-2">{hit.subtitle}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
