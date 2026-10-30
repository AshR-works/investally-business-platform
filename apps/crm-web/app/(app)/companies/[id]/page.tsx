'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { CompanyDialog } from '../../../../components/companies/company-dialog';
import { ContactsPanel } from '../../../../components/contacts/contacts-panel';
import { FacilitationPanel } from '../../../../components/companies/facilitation-panel';
import { Badge } from '../../../../components/data/badge';
import { Card } from '../../../../components/data/card';
import { PageHeader } from '../../../../components/data/page-header';
import { DocumentsPanel } from '../../../../components/documents/documents-panel';
import { Icon } from '../../../../components/icon';
import { PageHeading } from '../../../../components/page-heading';
import { api, ApiError } from '../../../../lib/api';
import { useAuth } from '../../../../lib/auth-context';
import { openCompanySheet } from '../../../../lib/export-sheet';
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
  const [editing, setEditing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(
    () => api<Company>(`/companies/${id}`).then(setCompany).catch((e) => setError(e instanceof ApiError ? e.message : 'Chargement impossible')),
    [id],
  );
  useEffect(() => {
    void load();
  }, [load]);

  /** Exporte la fiche : le serveur contrôle la portée et trace l'export ; le navigateur propose l'enregistrement en PDF. */
  async function exportSheet() {
    setActionError(null);
    try {
      await openCompanySheet(id);
    } catch (e) {
      setActionError(e instanceof ApiError || e instanceof Error ? e.message : 'Export impossible');
    }
  }

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
      <PageHeader
        eyebrow="Business Development"
        title={company.name}
        description="Fiche de l’entreprise. Contacts, offres et rendez-vous arrivent avec les prochaines sessions."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="secondary inline-flex items-center gap-2" onClick={() => void exportSheet()}>
              <Icon name="doc" className="size-4" />Exporter la fiche
            </button>
            {can(profile, 'bd.company.update') && (
              <button type="button" className="inline-flex items-center gap-2" onClick={() => setEditing(true)}>
                <Icon name="gear" className="size-4" />Modifier
              </button>
            )}
          </div>
        }
      />
      {actionError && <p role="alert" className="error">{actionError}</p>}
      {editing && (
        <CompanyDialog
          company={company}
          onClose={() => setEditing(false)}
          onDone={async () => {
            setEditing(false);
            await load();
          }}
        />
      )}
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
      {can(profile, 'bd.contact.read') && <ContactsPanel company={{ id: company.id, name: company.name }} />}
      {can(profile, 'docs.document.read') && <DocumentsPanel ownerType="company" ownerId={company.id} />}
    </>
  );
}
