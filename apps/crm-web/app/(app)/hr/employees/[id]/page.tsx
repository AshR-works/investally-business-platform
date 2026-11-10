'use client';

import { Badge } from '../../../../../components/data/badge';
import { EntityLink } from '../../../../../components/entity-link';
import { EntitySheet, SheetState, useEntity } from '../../../../../components/entity-sheet';
import { useAuth } from '../../../../../lib/auth-context';
import { formatDate } from '../../../../../lib/format';
import { type Employee, fullName, isArchived } from '../../../../../lib/hr';
import { canAll } from '../../../../../lib/permissions';
import { MailLink } from '../../../../../components/mail-link';

const day = (iso: string | null): string => (iso ? formatDate(`${iso}T00:00:00Z`) : '—');

/** Fiche d'un employé : identité professionnelle, poste, service, responsable, compte lié, dates d'entrée et de sortie. Sa lecture est tracée dans l'audit. Hors portée = « introuvable ». */
export default function EmployeeSheetPage() {
  const { profile } = useAuth();
  const { entity: e, error } = useEntity<Employee>('hr/employees');
  if (!e) return <SheetState kind="employee" error={error} loaded={false} listHref="/hr/employees" listLabel="Tout le personnel" />;
  const archived = isArchived(e);
  return (
    <EntitySheet
      eyebrow="Ressources humaines · Employé"
      title={fullName(e)}
      description="Identité professionnelle seulement. Les modifications et les sorties se font depuis la liste du personnel ; la consultation de cette fiche est enregistrée."
      listHref="/hr/employees"
      listLabel="Tout le personnel"
      facts={[
        { label: 'État', value: archived ? <Badge tone="neutral">Sorti</Badge> : <Badge tone="ok">En poste</Badge> },
        { label: 'Matricule', value: e.matricule ?? '—' },
        { label: 'Poste', value: e.jobTitle },
        { label: 'Service', value: e.department },
        { label: 'Responsable', value: e.managerEmployeeId ? (canAll(profile, 'hr.employee.read') ? <EntityLink kind="employee" id={e.managerEmployeeId} label={e.managerName ?? ''}>{e.managerName}</EntityLink> : e.managerName) : '—' },
        { label: 'Compte d’accès', value: e.userName ?? 'Aucun compte lié' },
        { label: 'E-mail professionnel', value: <MailLink email={e.workEmail} /> },
        { label: 'Téléphone professionnel', value: e.workPhone ?? '—' },
        { label: 'Entrée', value: day(e.hiredOn) },
        ...(archived ? [{ label: 'Sortie', value: day(e.leftOn) }] : []),
        ...(archived && e.archiveReason ? [{ label: 'Motif de sortie', value: e.archiveReason }] : []),
      ]}
    />
  );
}
