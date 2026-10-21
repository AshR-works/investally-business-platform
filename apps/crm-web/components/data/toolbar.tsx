'use client';

import { ReactNode, useEffect, useId, useState } from 'react';
import { Icon } from '../icon';

/** Barre d'outils d'un tableau : filtres rapides à gauche, recherche et réglages à droite. */
export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">{children}</div>;
}

/** Option d'un filtre rapide (`count` facultatif : seulement s'il est connu de l'API). */
export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

/**
 * Filtres rapides sous forme de boutons à bascule (un seul actif). Choix assumé : ce sont des FILTRES et non des onglets
 * de contenu, donc des boutons `aria-pressed` dans un groupe nommé plutôt qu'un `tablist`.
 */
export function QuickFilters({ label, value, options, onChange }: { label: string; value: string; options: FilterOption[]; onChange: (value: string) => void }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-1.5 text-[length:var(--text-sm)] font-semibold ${active ? 'border-transparent bg-brand-soft text-brand-strong' : 'border-transparent bg-transparent text-ink-2 hover:bg-surface-2'}`}
          >
            {option.label}
            {option.count !== undefined && <span className="rounded-full bg-surface-2 px-1.5 text-xs text-ink-2">{option.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Champ de recherche à saisie différée : n'appelle `onSearch` qu'après une courte pause (pas à chaque touche) ni au
 * premier rendu. Le libellé est réservé aux lecteurs d'écran, l'icône est décorative.
 */
export function SearchField({ label, placeholder = 'Rechercher', delay = 300, onSearch }: { label: string; placeholder?: string; delay?: number; onSearch: (value: string) => void }) {
  const id = useId();
  const [value, setValue] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => onSearch(value.trim()), delay);
    return () => clearTimeout(timer);
    // `onSearch` change à chaque rendu du parent : seule la saisie doit relancer la minuterie.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, delay]);
  return (
    <div className="ml-auto flex h-10 min-w-48 items-center gap-2 rounded-full border border-field bg-surface px-3 focus-within:shadow-[var(--focus)]">
      <Icon name="search" className="size-4 text-ink-2" />
      <label htmlFor={id} className="sr-only">{label}</label>
      <input
        id={id}
        type="search"
        autoComplete="off"
        maxLength={100}
        value={value}
        placeholder={placeholder}
        onChange={(event) => setValue(event.target.value)}
        className="m-0 h-full w-full min-w-0 rounded-none border-0 bg-transparent p-0 text-[length:var(--text-sm)] shadow-none outline-none"
      />
    </div>
  );
}
