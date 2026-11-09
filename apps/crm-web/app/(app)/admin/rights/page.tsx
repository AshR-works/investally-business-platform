'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../../../../components/data/badge';
import { Card } from '../../../../components/data/card';
import { PageHeader } from '../../../../components/data/page-header';
import { SearchField, Toolbar } from '../../../../components/data/toolbar';
import { PageHeading } from '../../../../components/page-heading';
import { api, ApiError } from '../../../../lib/api';
import { useAuth } from '../../../../lib/auth-context';
import { can } from '../../../../lib/permissions';
import { ACTION_LABEL, buildRightsMatrix, countByRole, filterRights, MODULE_LABEL, modulesOf, SCOPE_HELP, SCOPE_LABEL } from '../../../../lib/rights';
import type { RoleView } from '../../../../lib/types';

const SCOPE_TONE: Record<string, 'ok' | 'info' | 'neutral'> = { ALL: 'ok', TEAM: 'info', OWN: 'neutral' };

/**
 * Droits : la matrice des rôles et de leurs permissions, en **lecture seule** (aucune modification ici : les droits suivent la
 * configuration livrée avec l'application). Pour chaque permission, la portée de chaque rôle (Propre, Équipe, Tous) ou rien. Lue depuis
 * `GET /admin/roles` (droit `iam.role.read`), telle qu'enregistrée en base.
 */
export default function RightsPage() {
  const { profile } = useAuth();
  const canRead = can(profile, 'iam.role.read');
  const [roles, setRoles] = useState<RoleView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [module, setModule] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!canRead) return;
    api<RoleView[]>('/admin/roles').then(setRoles).catch((e) => setError(e instanceof ApiError ? e.message : 'Chargement impossible'));
  }, [canRead]);

  const rows = useMemo(() => buildRightsMatrix(roles ?? []), [roles]);
  const shown = useMemo(() => filterRights(rows, { module, search }), [rows, module, search]);
  const modules = useMemo(() => modulesOf(rows), [rows]);

  if (!canRead) {
    return (
      <>
        <PageHeading>Droits</PageHeading>
        <p>Votre profil n&apos;a pas accès aux droits.</p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Droits"
        description="Qui peut faire quoi, par rôle. Lecture seule : un droit s’accorde avec une portée, et un rôle sans portée n’a pas ce droit."
      />
      {error && <p role="alert" className="error">{error}</p>}
      {!roles && !error && <p role="status">Chargement…</p>}
      {roles && (
        <>
          <ul className="mb-4 flex list-none flex-wrap gap-x-6 gap-y-1 p-0 text-[length:var(--text-sm)] text-ink-2" aria-label="Légende des portées">
            {Object.keys(SCOPE_LABEL).reverse().map((s) => <li key={s}><strong className="text-ink">{SCOPE_LABEL[s]}</strong> : {SCOPE_HELP[s]}</li>)}
            <li><strong className="text-ink">—</strong> : aucun droit</li>
          </ul>
          <Card>
            <Toolbar>
              <label className="m-0 flex items-center gap-2 text-[length:var(--text-sm)] font-normal">
                Domaine
                <select value={module} onChange={(e) => setModule(e.target.value)} style={{ width: 'auto', marginTop: 0 }}>
                  <option value="">Tous</option>
                  {modules.map((m) => <option key={m} value={m}>{MODULE_LABEL[m] ?? m}</option>)}
                </select>
              </label>
              <p className="m-0 text-[length:var(--text-sm)] font-semibold" aria-live="polite">{shown.length} permission{shown.length > 1 ? 's' : ''}</p>
              <SearchField label="Rechercher une permission" onSearch={setSearch} />
            </Toolbar>
            <div className="table-wrap">
              <table>
                <caption className="sr-only">Permissions par rôle</caption>
                <thead>
                  <tr>
                    <th scope="col">Permission</th>
                    {roles.map((r) => (
                      <th key={r.code} scope="col" title={r.description}>
                        {r.label}
                        <span className="block text-xs font-normal text-ink-2">{countByRole(rows, r.code)} droits</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.length === 0 && <tr><td colSpan={roles.length + 1} className="text-ink-2">Aucune permission ne correspond à ces critères.</td></tr>}
                  {shown.map((row) => (
                    <tr key={row.code}>
                      <th scope="row" className="text-left font-normal">
                        <strong>{ACTION_LABEL[row.action] ?? row.action}</strong>
                        <span className="block text-xs text-ink-2">{MODULE_LABEL[row.module] ?? row.module} · {row.resource} <code>{row.code}</code></span>
                      </th>
                      {roles.map((r) => {
                        const scope = row.scopes[r.code];
                        return (
                          <td key={r.code}>
                            {scope ? <Badge tone={SCOPE_TONE[scope] ?? 'neutral'}>{SCOPE_LABEL[scope] ?? scope}</Badge> : <><span aria-hidden="true" className="text-ink-2">—</span><span className="sr-only">Aucun droit</span></>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </>
  );
}
