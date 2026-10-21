'use client';

import Link from 'next/link';
import { GlobalSearch } from '../../components/global-search';
import { Icon } from '../../components/icon';
import { PageHeading } from '../../components/page-heading';
import { useAuth } from '../../lib/auth-context';
import { availableModules, upcomingModules } from '../../lib/modules';

/**
 * Vue d'ensemble : point d'entrée de l'application (EXD-05). Recherche globale, puis les modules disponibles pour le
 * profil et, grisés, ceux qui arrivent (CAD-H1-3). Aucun chiffre ni donnée fictive : un indicateur n'apparaît que
 * lorsqu'il a une source réelle.
 */
export default function HubPage() {
  const { profile } = useAuth();
  const available = availableModules(profile);
  const upcoming = upcomingModules();

  return (
    <>
      <div className="mb-6">
        <p className="m-0 text-xs font-semibold uppercase tracking-[0.14em] text-ink-2">Vue d’ensemble</p>
        <PageHeading title="Vue d’ensemble">{`Bonjour ${profile?.displayName ?? ""}`.trim()}</PageHeading>
        <p className="m-0 max-w-prose text-ink-2">Recherchez une entreprise ou un utilisateur, ou ouvrez un module.</p>
      </div>

      <GlobalSearch />

      <section aria-labelledby="modules-disponibles" className="mt-10">
        <h2 id="modules-disponibles" className="mb-3 text-lg">Vos modules</h2>
        {available.length === 0 ? (
          <p className="text-ink-2">Votre profil n’a accès à aucun module pour le moment.</p>
        ) : (
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4 p-0">
            {available.map((m) => (
              <li key={m.id}>
                <Link href={m.href!} className="flex h-full items-start gap-4 rounded-panel border border-line-strong bg-surface p-5 text-ink no-underline shadow-[var(--shadow-1)] hover:bg-surface-2">
                  <span className="grid size-11 shrink-0 place-items-center rounded-control bg-brand-soft text-brand-strong"><Icon name={m.icon} /></span>
                  <span>
                    <span className="block font-semibold">{m.label}</span>
                    <span className="block text-xs text-ink-2">{m.description}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="modules-a-venir" className="mt-10">
        <h2 id="modules-a-venir" className="mb-3 text-lg">À venir</h2>
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4 p-0">
          {upcoming.map((m) => (
            <li key={m.id} className="flex items-start gap-4 rounded-panel border border-dashed border-line-strong bg-transparent p-5 text-ink-2">
              <span className="grid size-11 shrink-0 place-items-center rounded-control bg-surface-2 text-ink-2"><Icon name={m.icon} /></span>
              <span>
                <span className="block font-semibold">{m.label}</span>
                <span className="block text-xs">{m.description}</span>
                <span className="mt-2 inline-block rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-ink-2">Bientôt disponible</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
