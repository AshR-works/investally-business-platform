'use client';

import Link from 'next/link';
import { PageHeader } from '../../../../components/data/page-header';
import { PageHeading } from '../../../../components/page-heading';
import { EnrollmentsTable } from '../../../../components/training/enrollments-table';
import { useAuth } from '../../../../lib/auth-context';
import { ENROLLMENT_PERMISSIONS } from '../../../../lib/enrollments';
import { can } from '../../../../lib/permissions';

/**
 * Inscriptions de toutes les sessions (S5.2b). Par défaut, la file des inscriptions **en attente de confirmation** : c'est le travail du
 * Responsable Investudy. Chaque rôle ne voit que les inscriptions de la portée de son entreprise (chargé de compte : les siennes).
 */
export default function EnrollmentsPage() {
  const { profile } = useAuth();
  if (!can(profile, ENROLLMENT_PERMISSIONS.readEnrollments)) {
    return (
      <>
        <PageHeading>Inscriptions</PageHeading>
        <p>Votre profil n&apos;a pas accès aux inscriptions.</p>
      </>
    );
  }
  return (
    <>
      <PageHeader
        eyebrow="Investudy"
        title="Inscriptions"
        description="Les inscriptions des apprenants aux sessions. Une inscription en attente occupe déjà une place et consomme son agrément ; le Responsable Investudy la confirme, l’annule ou la replace sur une autre session."
      />
      <p className="m-0 mb-3"><Link href="/training/sessions">← Sessions de formation</Link></p>
      <EnrollmentsTable caption="Inscriptions aux sessions de formation" defaultStatus="PENDING" />
    </>
  );
}
