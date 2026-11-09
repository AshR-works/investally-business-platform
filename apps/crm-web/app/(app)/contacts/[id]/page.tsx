'use client';

import Link from 'next/link';
import { EntityLink } from '../../../../components/entity-link';
import { EntitySheet, SheetState, useEntity } from '../../../../components/entity-sheet';
import { Badge } from '../../../../components/data/badge';
import { useAuth } from '../../../../lib/auth-context';
import { contactRoleLabel } from '../../../../lib/contacts';
import { listFor } from '../../../../lib/company-context';
import { formatDate } from '../../../../lib/format';
import { can } from '../../../../lib/permissions';
import type { Contact } from '../../../../lib/types';

/** Fiche d'un contact : identité, entreprise (lien), et accès aux listes de cette entreprise. Hors portée = « introuvable ». */
export default function ContactSheetPage() {
  const { profile } = useAuth();
  const { entity: contact, error } = useEntity<Contact>('contacts');
  if (!contact) return <SheetState kind="contact" error={error} loaded={false} listHref="/contacts" listLabel="Tous les contacts" />;
  const name = `${contact.firstName} ${contact.lastName}`;
  return (
    <EntitySheet
      eyebrow="Business Development · Contact"
      title={name}
      description="Interlocuteur d’une entreprise. Modifiez-le depuis la liste des contacts ou la fiche de son entreprise."
      listHref="/contacts"
      listLabel="Tous les contacts"
      facts={[
        { label: 'Fonction', value: <Badge tone="neutral">{contactRoleLabel(contact.role)}</Badge> },
        { label: 'Entreprise', value: <EntityLink kind="company" id={contact.companyId} label={contact.companyName}>{contact.companyName}</EntityLink> },
        { label: 'E-mail', value: contact.email ?? '—' },
        { label: 'Téléphone', value: contact.phone ?? '—' },
        { label: 'Créé le', value: formatDate(contact.createdAt) },
      ]}
    >
      <nav aria-label={`Autour de ${contact.companyName}`} className="flex flex-wrap gap-4">
        {can(profile, 'bd.offer.read') && <Link href={listFor('/offers', contact.companyId)}>Offres de {contact.companyName}</Link>}
        {can(profile, 'bd.opportunity.read') && <Link href={listFor('/opportunities', contact.companyId)}>Opportunités de {contact.companyName}</Link>}
        {can(profile, 'bd.appointment.read') && <Link href={listFor('/agenda', contact.companyId)}>Agenda de {contact.companyName}</Link>}
        {can(profile, 'bd.contact.read') && <Link href={listFor('/contacts', contact.companyId)}>Autres contacts de {contact.companyName}</Link>}
      </nav>
    </EntitySheet>
  );
}
