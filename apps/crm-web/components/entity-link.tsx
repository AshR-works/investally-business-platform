import Link from 'next/link';
import type { ReactNode } from 'react';
import { ENTITY_NOUN, type EntityKind, entityHref } from '../lib/entity-links';

/**
 * Lien vers la fiche d'une entité (D-NAV-3). Le texte visible est le nom ; le nom accessible précise où mène le lien
 * (« Ouvrir la fiche de l'offre OFF-2026-001 ») sans dépendre de la couleur ou du contexte de la ligne.
 */
export function EntityLink({ kind, id, children, label }: { kind: EntityKind; id: string; children: ReactNode; label: string }) {
  return (
    <Link href={entityHref(kind, id)} aria-label={`Ouvrir la fiche de ${ENTITY_NOUN[kind]} ${label}`} className="text-ink no-underline hover:underline">
      {children}
    </Link>
  );
}
