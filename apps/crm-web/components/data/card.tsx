import type { ReactNode } from 'react';

/** Surface de contenu (tableau, formulaire, bloc) : fond blanc, bord fin, coins arrondis (jetons du design). */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`overflow-hidden rounded-panel border border-line-strong bg-surface shadow-[var(--shadow-1)] ${className}`}>{children}</section>;
}
