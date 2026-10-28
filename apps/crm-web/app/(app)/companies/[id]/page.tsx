'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FacilitationPanel } from '../../../../components/companies/facilitation-panel';
import { Badge } from '../../../../components/data/badge';
import { Card } from '../../../../components/data/card';
import { PageHeader } from '../../../../components/data/page-header';
import { DocumentsPanel } from '../../../../components/documents/documents-panel';
import { PageHeading } from '../../../../components/page-heading';
import { api, ApiError } from '../../../../lib/api';
import { useAuth } from '../../../../lib/auth-context';
import { formatDate } from '../../../../lib/format';
import { can } from '../../../../lib/permissions';
import { COMPANY_STATUS, statusStyle } from '../../../../lib/status';
import type { Company } from '../../../../lib/types';

/**
 * Fiche d'une entreprise (version minimale de S3.6) : identité de l'entreprise et ses documents. Les contacts, offres,
 * rendez-vous et l'historique viendront avec S4.1. Une entreprise hors de la portée de l'utilisateur est « introuvable ».
 */
export default function CompanyPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Company>(`/companies/${id}`).then(setCompany).catch((e) => setError(e instanceof ApiError ? e.message : 'Chargement impossible'));
  }, [id]);

  if (error) {
    return (
      <>
        <PageHeading title="Entreprise introuvable">Entreprise introuvable</PageHeading>
        <p role="alert" className="error">{error}</p>
      </>
    );
  }
  if (!company) return <p role="status">Chargement…</p>;

  const status = statusStyle(COMPANY_STATUS, company.status);
  return (
    <>
      <PageHeader eyebrow="Business Development" title={company.name} description="Fiche de l’entreprise. Contacts, offres et rendez-vous arrivent avec les prochaines sessions." />
      <Card className="mb-8">
        <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-6 p-5">
          <div><dt className="text-xs font-semibold text-ink-2">Statut</dt><dd className="m-0 mt-1"><Badge tone={status.tone}>{status.label}</Badge></dd></div>
          <div><dt className="text-xs font-semibold text-ink-2">Secteur</dt><dd className="m-0 mt-1">{company.sector ?? '—'}</dd></div>
          <div><dt className="text-xs font-semibold text-ink-2">Pays</dt><dd className="m-0 mt-1">{company.country ?? '—'}</dd></div>
          <div><dt className="text-xs font-semibold text-ink-2">E-mail</dt><dd className="m-0 mt-1">{company.email ?? '—'}</dd></div>
          <div><dt className="text-xs font-semibold text-ink-2">Téléphone</dt><dd className="m-0 mt-1">{company.phone ?? '—'}</dd></div>
          <div><dt className="text-xs font-semibold text-ink-2">Créée le</dt><dd className="m-0 mt-1">{formatDate(company.createdAt)}</dd></div>
        </dl>
      </Card>
      <FacilitationPanel facilitation={company.facilitation} />
      {can(profile, 'docs.document.read') && <DocumentsPanel ownerType="company" ownerId={company.id} />}
    </>
  );
}
