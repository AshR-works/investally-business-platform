'use client';

import Link from 'next/link';
import { Badge } from '../../../../components/data/badge';
import { EntityLink } from '../../../../components/entity-link';
import { EntitySheet, SheetState, useEntity } from '../../../../components/entity-sheet';
import { useAuth } from '../../../../lib/auth-context';
import { listFor } from '../../../../lib/company-context';
import { formatDate } from '../../../../lib/format';
import { formatAmount } from '../../../../lib/offers';
import { lossReasonLabel, OPPORTUNITY_STATUS, sourceLabel, stageLabel } from '../../../../lib/opportunities';
import { can } from '../../../../lib/permissions';
import type { Opportunity } from '../../../../lib/types';

/** Fiche d'une opportunité : étape, état, montant, entreprise (lien), clôture ou dérogation. Les changements d'étape se font dans le pipeline. */
export default function OpportunitySheetPage() {
  const { profile } = useAuth();
  const { entity: o, error } = useEntity<Opportunity>('opportunities');
  if (!o) return <SheetState kind="opportunity" error={error} loaded={false} listHref="/opportunities" listLabel="Tout le pipeline" />;
  const status = OPPORTUNITY_STATUS[o.status] ?? { label: o.status, tone: 'neutral' as const };
  return (
    <EntitySheet
      eyebrow="Business Development · Opportunité"
      title={o.title}
      description="Opportunité commerciale. Avancez-la, clôturez-la ou demandez une dérogation depuis le pipeline."
      listHref="/opportunities"
      listLabel="Tout le pipeline"
      facts={[
        { label: 'Étape', value: <Badge tone="neutral">{stageLabel(o.stage)}</Badge> },
        { label: 'État', value: <Badge tone={status.tone}>{status.label}</Badge> },
        { label: 'Entreprise', value: <EntityLink kind="company" id={o.companyId} label={o.companyName}>{o.companyName}</EntityLink> },
        { label: 'Montant estimé', value: formatAmount(o.amount, o.currency) },
        { label: 'Source', value: sourceLabel(o.source) },
        { label: 'Dernière activité', value: formatDate(o.lastActivityAt) },
        { label: 'Créée le', value: formatDate(o.createdAt) },
        ...(o.closedAt ? [{ label: 'Clôturée le', value: formatDate(o.closedAt) }] : []),
        ...(o.lossReason ? [{ label: 'Motif de perte', value: lossReasonLabel(o.lossReason) }] : []),
        ...(o.closingNote ? [{ label: 'Note de clôture', value: o.closingNote }] : []),
        ...(o.waivedAt ? [{ label: 'Dérogation', value: `${formatDate(o.waivedAt)} — ${o.waiverReason ?? ''}` }] : []),
      ]}
    >
      <nav aria-label={`Autour de ${o.companyName}`} className="flex flex-wrap gap-4">
        {can(profile, 'bd.contact.read') && <Link href={listFor('/contacts', o.companyId)}>Contacts de {o.companyName}</Link>}
        {can(profile, 'bd.offer.read') && <Link href={listFor('/offers', o.companyId)}>Offres de {o.companyName}</Link>}
        {can(profile, 'bd.appointment.read') && <Link href={listFor('/agenda', o.companyId)}>Agenda de {o.companyName}</Link>}
      </nav>
    </EntitySheet>
  );
}
