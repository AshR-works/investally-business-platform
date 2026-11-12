'use client';

import Link from 'next/link';
import type { CompanyContext } from '../lib/company-context';
import { Icon } from './icon';

/**
 * Bandeau de contexte d'une liste ouverte depuis une entreprise (D52) : fil d'Ariane « Entreprises › Banque X › Offres », pastille de filtre
 * **retirable** annoncée aux lecteurs d'écran, ou l'explication d'une entreprise introuvable. N'affiche rien sans `?companyId=`.
 */
export function CompanyContextBar({ ctx, section }: { ctx: CompanyContext; section: string }) {
  if (!ctx.companyId) return null;

  if (ctx.problem) {
    return (
      <div role="alert" className="error mb-4">
        <p className="m-0">{ctx.problem}</p>
        <button type="button" className="secondary mt-2" onClick={ctx.clear}>Voir toutes les entreprises</button>
      </div>
    );
  }

  return (
    <div className="mb-4 flex flex-col gap-2">
      <nav aria-label="Fil d’Ariane">
        <ol className="m-0 flex list-none flex-wrap items-center gap-2 p-0 text-[length:var(--text-sm)] text-ink-2">
          <li><Link href="/companies" className="text-ink-2">Entreprises</Link></li>
          <li aria-hidden="true">›</li>
          <li>{ctx.name ? <Link href={`/companies/${ctx.companyId}`} className="text-ink-2">{ctx.name}</Link> : '…'}</li>
          <li aria-hidden="true">›</li>
          <li aria-current="page" className="font-semibold text-ink">{section}</li>
        </ol>
      </nav>
      <div role="status" className="inline-flex w-fit max-w-full items-center gap-2 rounded-full border border-line-strong bg-surface px-3 py-1 text-[length:var(--text-sm)]">
        <span className="truncate">Entreprise : <strong>{ctx.name ?? '…'}</strong></span>
        <button
          type="button"
          onClick={ctx.clear}
          aria-label={`Retirer le filtre sur l’entreprise${ctx.name ? ` ${ctx.name}` : ''}`}
          className="grid size-6 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-ink-2 hover:bg-surface-2 hover:text-ink"
        >
          <Icon name="close" className="size-4" />
        </button>
      </div>
    </div>
  );
}
