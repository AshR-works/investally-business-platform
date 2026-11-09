'use client';

import Link from 'next/link';
import { Badge } from '../../../../components/data/badge';
import { EntityLink } from '../../../../components/entity-link';
import { EntitySheet, SheetState, useEntity } from '../../../../components/entity-sheet';
import { isArchived, originLabel, sinceLabel } from '../../../../lib/ambassadors';
import { useAuth } from '../../../../lib/auth-context';
import { listFor } from '../../../../lib/company-context';
import { formatDate } from '../../../../lib/format';
import { can } from '../../../../lib/permissions';
import type { Ambassador } from '../../../../lib/types';

/** Fiche d'un ambassadeur : origine, entreprise (lien), ancienneté, état d'archivage et son motif. Archiver et réactiver se font dans la liste. */
export default function AmbassadorSheetPage() {
  const { profile } = useAuth();
  const { entity: a, error } = useEntity<Ambassador>('ambassadors');
  if (!a) return <SheetState kind="ambassador" error={error} loaded={false} listHref="/ambassadors" listLabel="Tous les ambassadeurs" />;
  const archived = isArchived(a);
  return (
    <EntitySheet
      eyebrow="Business Development · Ambassadeur"
      title={`${a.firstName} ${a.lastName}`}
      description="Client ou apprenant devenu relais commercial. Un ambassadeur archivé est gelé jusqu’à sa réactivation ; rien n’est jamais supprimé."
      listHref="/ambassadors"
      listLabel="Tous les ambassadeurs"
      facts={[
        { label: 'État', value: archived ? <Badge tone="neutral">Archivé</Badge> : <Badge tone="ok">Actif</Badge> },
        { label: 'Origine', value: <Badge tone="neutral">{originLabel(a.origin)}</Badge> },
        { label: 'Entreprise', value: a.companyId ? <EntityLink kind="company" id={a.companyId} label={a.companyName ?? ''}>{a.companyName}</EntityLink> : '—' },
        { label: 'Ambassadeur', value: sinceLabel(a.appointedOn) },
        { label: 'E-mail', value: a.email ?? '—' },
        { label: 'Téléphone', value: a.phone ?? '—' },
        { label: 'Créé le', value: formatDate(a.createdAt) },
        ...(archived ? [{ label: 'Archivé le', value: formatDate(a.archivedAt) }] : []),
        ...(archived && a.archiveReason ? [{ label: 'Motif d’archivage', value: a.archiveReason }] : []),
        ...(a.note ? [{ label: 'Note', value: a.note }] : []),
      ]}
    >
      {a.companyId && can(profile, 'bd.ambassador.read') && (
        <nav aria-label={`Autour de ${a.companyName ?? 'l’entreprise'}`} className="flex flex-wrap gap-4">
          <Link href={listFor('/ambassadors', a.companyId)}>Autres ambassadeurs de {a.companyName}</Link>
        </nav>
      )}
    </EntitySheet>
  );
}
