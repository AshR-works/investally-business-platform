import Link from 'next/link';
import type { ReactNode } from 'react';
import { PageHeading } from '../page-heading';

/**
 * En-tête de page du design : fil d'Ariane (retour à la Vue d'ensemble), domaine, titre (qui renseigne aussi le titre du
 * document), description et actions principales à droite.
 */
export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="mb-6">
      <nav aria-label="Fil d’Ariane">
        <ol className="m-0 flex list-none items-center gap-3 p-0 text-xs text-ink-2">
          <li>
            <Link href="/" className="border-r border-line-strong pr-3 font-semibold text-brand-strong no-underline hover:underline">← Vue d’ensemble</Link>
          </li>
          <li aria-current="page">{title}</li>
        </ol>
      </nav>
      {eyebrow && <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-ink-2">{eyebrow}</p>}
      <div className={`flex flex-wrap items-end gap-6 ${eyebrow ? '' : 'mt-4'}`}>
        <div className="min-w-0 flex-1">
          <PageHeading className="m-0 text-[length:var(--text-2xl)]">{title}</PageHeading>
          {description && <p className="m-0 mt-1 max-w-prose text-ink-2">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
