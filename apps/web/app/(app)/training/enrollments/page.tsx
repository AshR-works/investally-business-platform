'use client';

import Link from 'next/link';
import { useState } from 'react';
import { PageHeader } from '../../../../components/data/page-header';
import { PageHeading } from '../../../../components/page-heading';
import { EnrollmentDialogs } from '../../../../components/training/enrollment-dialogs';
import { Icon } from '../../../../components/icon';
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
  const [enrolling, setEnrolling] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
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
        actions={can(profile, ENROLLMENT_PERMISSIONS.enroll) && (
          <button type="button" onClick={() => setEnrolling(true)} className="inline-flex items-center gap-2">
            <Icon name="plus" className="size-4" />Nouvelle inscription
          </button>
        )}
      />
      <p className="m-0 mb-3"><Link href="/training/sessions">← Sessions de formation</Link></p>
      <EnrollmentsTable caption="Inscriptions aux sessions de formation" defaultStatus="PENDING" refreshKey={refreshKey} />
      {enrolling && <EnrollmentDialogs dialog={{ kind: 'enroll' }} onClose={() => setEnrolling(false)} onDone={async () => { setEnrolling(false); setRefreshKey((k) => k + 1); }} />}
    </>
  );
}
