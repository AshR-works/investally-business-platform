'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import { useAuth } from '../lib/auth-context';
import { blockingModule } from '../lib/modules';
import { PageHeading } from './page-heading';

/**
 * Page générique d'un écran hors de la version publiée. Le serveur refuse de toute façon ses données (404) : cette page dit simplement à la personne
 * que la fonction arrive plus tard, au lieu de lui montrer un écran vide ou une erreur.
 */
export function ComingSoon({ label }: { label?: string }) {
  return (
    <section aria-labelledby="bientot" className="mx-auto max-w-prose py-10 text-center">
      {label && <p className="m-0 text-xs font-semibold uppercase tracking-[0.14em] text-ink-2">{label}</p>}
      <PageHeading title={label ? `${label} — prochainement` : 'Prochainement'}>Prévu pour les prochaines mises à jour</PageHeading>
      <p id="bientot" className="mx-auto mb-6 max-w-prose text-ink-2">
        Cette fonction n’est pas encore disponible dans cette version de la plateforme. Elle arrive dans une prochaine mise à jour.
      </p>
      <Link href="/">Retour à la vue d’ensemble</Link>
    </section>
  );
}

/** Remplace la page par la page générique quand son module n'est pas publié ; ne touche pas aux pages sans module (compte, vue d'ensemble). */
export function ReleaseGate({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const pathname = usePathname();
  const blocking = blockingModule(profile, pathname);
  if (blocking) return <ComingSoon label={blocking.label} />;
  return <>{children}</>;
}
