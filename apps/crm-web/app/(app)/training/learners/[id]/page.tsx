'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge } from '../../../../../components/data/badge';
import { Card } from '../../../../../components/data/card';
import { EntityLink } from '../../../../../components/entity-link';
import { EntitySheet, SheetState, useEntity } from '../../../../../components/entity-sheet';
import { api } from '../../../../../lib/api';
import { useAuth } from '../../../../../lib/auth-context';
import { type Enrollment, ENROLLMENT_PERMISSIONS, ENROLLMENT_STATUS, type Learner } from '../../../../../lib/enrollments';
import { formatDate } from '../../../../../lib/format';
import { can } from '../../../../../lib/permissions';
import { dateText } from '../../../../../lib/sessions';
import type { Page } from '../../../../../lib/types';
import { MailLink } from '../../../../../components/mail-link';

/** Fiche d'un apprenant : identité, entreprise (lien) et ses inscriptions aux sessions. Hors portée = « introuvable ». */
export default function LearnerSheetPage() {
  const { profile } = useAuth();
  const { entity: learner, error } = useEntity<Learner>('learners');
  const [enrollments, setEnrollments] = useState<Enrollment[] | null>(null);
  const canEnrollments = can(profile, ENROLLMENT_PERMISSIONS.readEnrollments);
  const learnerId = learner?.id;
  useEffect(() => {
    if (!learnerId || !canEnrollments) return;
    api<Page<Enrollment>>(`/enrollments?learnerId=${encodeURIComponent(learnerId)}&pageSize=50`).then((p) => setEnrollments(p.items)).catch(() => setEnrollments([]));
  }, [learnerId, canEnrollments]);

  if (!learner) return <SheetState kind="learner" error={error} loaded={false} listHref="/training/learners" listLabel="Tous les apprenants" />;
  return (
    <EntitySheet
      eyebrow="Investudy · Apprenant"
      title={`${learner.firstName} ${learner.lastName}`}
      description="Personne inscrite aux formations d’une entreprise. Modifiez-la depuis la liste des apprenants."
      listHref="/training/learners"
      listLabel="Tous les apprenants"
      facts={[
        { label: 'Entreprise', value: can(profile, 'bd.company.read') ? <EntityLink kind="company" id={learner.companyId} label={learner.companyName}>{learner.companyName}</EntityLink> : learner.companyName },
        { label: 'E-mail', value: <MailLink email={learner.email} /> },
        { label: 'Téléphone', value: learner.phone ?? '—' },
        { label: 'Créé le', value: formatDate(learner.createdAt) },
      ]}
    >
      {canEnrollments && (
        <Card className="mb-8">
          <div className="flex items-center justify-between gap-4 p-5 pb-0">
            <h2 className="m-0 text-[length:var(--text-lg)]">Inscriptions</h2>
            <Link href="/training/enrollments">Toutes les inscriptions</Link>
          </div>
          <div className="p-5">
            {enrollments === null ? <p role="status" className="m-0">Chargement…</p> : enrollments.length === 0 ? <p className="m-0 text-ink-2">Aucune inscription pour cet apprenant.</p> : (
              <ul className="m-0 list-none p-0">
                {enrollments.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center gap-3 border-b border-line py-2 last:border-0">
                    <Link href={`/training/sessions/${e.sessionId}`}>{e.trainingTitle}</Link>
                    <span className="text-ink-2">{dateText(e.sessionStart)} → {dateText(e.sessionEnd)}</span>
                    <Badge tone={ENROLLMENT_STATUS[e.status].tone}>{ENROLLMENT_STATUS[e.status].label}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      )}
    </EntitySheet>
  );
}
