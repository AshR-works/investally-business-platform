'use client';

import Link from 'next/link';
import { Badge } from '../../../../components/data/badge';
import { EntityLink } from '../../../../components/entity-link';
import { EntitySheet, SheetState, useEntity } from '../../../../components/entity-sheet';
import { APPROVAL_STATUS, coverageText, payerText } from '../../../../lib/approvals';
import { useAuth } from '../../../../lib/auth-context';
import { listFor } from '../../../../lib/company-context';
import { formatDate } from '../../../../lib/format';
import { can } from '../../../../lib/permissions';
import type { Approval } from '../../../../lib/types';

const day = (iso: string | null): string => (iso ? formatDate(`${iso}T00:00:00Z`) : '—');

/** Fiche d'un agrément : état, couverture, payeur, validité, opportunité et entreprise (liens). Le cycle de vie se pilote depuis la liste des agréments. */
export default function ApprovalSheetPage() {
  const { profile } = useAuth();
  const { entity: a, error } = useEntity<Approval>('approvals');
  if (!a) return <SheetState kind="approval" error={error} loaded={false} listHref="/approvals" listLabel="Tous les agréments" />;
  const status = APPROVAL_STATUS[a.status] ?? { label: a.status, tone: 'neutral' as const };
  return (
    <EntitySheet
      eyebrow="Business Development · Agrément"
      title={a.opportunityTitle}
      description="Promesse de paiement signée par le client. Elle couvre une somme, un nombre de places, ou les deux, jusqu’à sa fin de validité."
      listHref="/approvals"
      listLabel="Tous les agréments"
      facts={[
        { label: 'État', value: <><Badge tone={status.tone}>{status.label}</Badge>{a.pastValidity && <> <Badge tone="warn">Validité dépassée</Badge></>}</> },
        { label: 'Entreprise', value: <EntityLink kind="company" id={a.companyId} label={a.companyName}>{a.companyName}</EntityLink> },
        { label: 'Opportunité', value: can(profile, 'bd.opportunity.read') ? <EntityLink kind="opportunity" id={a.opportunityId} label={a.opportunityTitle}>{a.opportunityTitle}</EntityLink> : a.opportunityTitle },
        { label: 'Couvre', value: coverageText(a) },
        { label: 'Payeur', value: payerText(a) },
        { label: 'Reçu le', value: day(a.receivedOn) },
        { label: 'Valide jusqu’au', value: day(a.validUntil) },
        { label: 'Créé le', value: formatDate(a.createdAt) },
        ...(a.closedAt ? [{ label: 'Clôturé le', value: formatDate(a.closedAt) }] : []),
        ...(a.closedReason ? [{ label: 'Motif', value: a.closedReason }] : []),
      ]}
    >
      <nav aria-label={`Autour de ${a.companyName}`} className="flex flex-wrap gap-4">
        {can(profile, 'bd.approval.read') && <Link href={listFor('/approvals', a.companyId)}>Autres agréments de {a.companyName}</Link>}
        {can(profile, 'training.enrollment.read') && <Link href="/training/enrollments">Inscriptions aux sessions</Link>}
      </nav>
    </EntitySheet>
  );
}
