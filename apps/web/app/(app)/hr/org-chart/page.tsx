'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '../../../../components/data/card';
import { PageHeader } from '../../../../components/data/page-header';
import { PageHeading } from '../../../../components/page-heading';
import { api, ApiError } from '../../../../lib/api';
import { useAuth } from '../../../../lib/auth-context';
import { buildOrgTree, countNodes, type DirectoryEntry, fullName, type OrgNode } from '../../../../lib/hr';
import { can } from '../../../../lib/permissions';

/** Un nœud : la personne, et ses collaborateurs directs dans une liste repliable (un nœud sans collaborateur est une simple ligne). */
function Node({ node, depth }: { node: OrgNode; depth: number }) {
  const { entry, reports } = node;
  const label = (
    <span className="inline-flex flex-wrap items-baseline gap-x-2">
      <strong>{fullName(entry)}</strong>
      <span className="text-ink-2">{entry.jobTitle} · {entry.department}</span>
      {reports.length > 0 && <span className="text-[length:var(--text-sm)] text-ink-2">({reports.length} collaborateur{reports.length > 1 ? 's' : ''})</span>}
    </span>
  );
  return (
    <li>
      {reports.length === 0 ? (
        <div className="py-1.5">{label}</div>
      ) : (
        <details open={depth < 2}>
          <summary className="cursor-pointer py-1.5">{label}</summary>
          <ul className="m-0 list-none border-l border-line pl-5">
            {reports.map((r) => <Node key={r.entry.id} node={r} depth={depth + 1} />)}
          </ul>
        </details>
      )}
    </li>
  );
}

/**
 * Organigramme : qui rend compte à qui, d'après les fiches du personnel (D58). Les personnes en poste seulement. **Il ne modifie ni ne reflète les droits
 * d'accès** : la hiérarchie des comptes (qui décide de la portée « Équipe ») est séparée ; la page Personnel signale les écarts à la RH.
 */
export default function OrgChartPage() {
  const { profile } = useAuth();
  const canRead = can(profile, 'hr.directory.read');
  const [entries, setEntries] = useState<DirectoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!canRead) return;
    api<DirectoryEntry[]>('/hr/org-chart').then(setEntries).catch((e) => setError(e instanceof ApiError ? e.message : 'Chargement impossible'));
  }, [canRead]);
  const tree = useMemo(() => buildOrgTree(entries ?? []), [entries]);

  if (!canRead) {
    return (
      <>
        <PageHeading>Organigramme</PageHeading>
        <p>Votre profil n&apos;a pas accès à l&apos;organigramme.</p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Ressources humaines"
        title="Organigramme"
        description="Qui rend compte à qui. Les personnes en poste seulement ; l’organigramme ne change pas les droits d’accès."
      />
      {error && <p role="alert" className="error">{error}</p>}
      {!entries && !error && <p role="status">Chargement…</p>}
      {entries && (
        <Card>
          <div className="p-5">
            <p className="m-0 mb-3 text-[length:var(--text-sm)] font-semibold" aria-live="polite">{countNodes(tree)} personne{countNodes(tree) > 1 ? 's' : ''}</p>
            {tree.length === 0 ? <p className="m-0 text-ink-2">Aucune personne dans l’organigramme pour le moment.</p> : (
              <ul className="m-0 list-none p-0" aria-label="Organigramme du personnel">
                {tree.map((n) => <Node key={n.entry.id} node={n} depth={0} />)}
              </ul>
            )}
          </div>
        </Card>
      )}
    </>
  );
}
