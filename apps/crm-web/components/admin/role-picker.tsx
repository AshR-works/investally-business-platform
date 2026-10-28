'use client';

import { useId } from 'react';
import { diffRoles, effectiveRights, groupRoles, selectionSummary, SENSITIVE_ROLES, toggleRole } from '../../lib/roles';
import { roleLabel } from '../../lib/permissions';
import type { RoleView } from '../../lib/types';
import { Badge } from '../data/badge';
import { RightsPreview } from './rights-preview';

/**
 * Choix des rôles d'un utilisateur (EXD-14) : les rôles sont rangés par FAMILLE, chacun est une carte entièrement
 * cliquable, un compteur annoncé dit combien de rôles et de permissions sont choisis, « Tout désélectionner » vide la
 * sélection, et l'aperçu des droits effectifs (par module) se met à jour à chaque choix. Si `original` est fourni
 * (modification), les rôles ajoutés ou retirés sont signalés avant l'enregistrement.
 * `locked` (message) bloque la sélection : on ne modifie pas ses propres rôles (règle du serveur, rappelée ici).
 */
export function RolePicker({ roles, selected, onChange, original, locked }: {
  roles: RoleView[];
  selected: string[];
  onChange: (next: string[]) => void;
  original?: string[];
  locked?: string;
}) {
  const base = useId();
  const groups = groupRoles(roles);
  const { permissionCount } = effectiveRights(roles, selected);
  const diff = original ? diffRoles(original, selected) : { added: [], removed: [] };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p role="status" className="m-0 font-semibold">{selectionSummary(selected.length, permissionCount)}</p>
          <button type="button" className="secondary small" disabled={Boolean(locked) || selected.length === 0} onClick={() => onChange([])}>
            Tout désélectionner
          </button>
        </div>
        {locked && <p role="note" className="mb-3 mt-0 rounded-control border border-line-strong bg-warn-bg p-2.5 text-sm text-ink">{locked}</p>}

        {groups.map(({ group, roles: groupRolesList }) => (
          <fieldset key={group.id} className="m-0 mb-4 border-0 p-0">
            <legend className="mb-0.5 p-0 text-sm font-bold">{group.label}</legend>
            <p className="m-0 mb-2 text-sm text-ink-2">{group.description}</p>
            {groupRolesList.map((role) => {
              const checked = selected.includes(role.code);
              const sensitive = SENSITIVE_ROLES.includes(role.code);
              const id = `${base}-${role.code}`;
              return (
                <label
                  key={role.code}
                  className={`mb-2 flex items-start gap-3 rounded-control border p-3 font-normal border-line-strong has-[:checked]:border-brand-strong has-[:checked]:bg-selected focus-within:[box-shadow:var(--focus)] ${locked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 size-5 shrink-0"
                    checked={checked}
                    disabled={Boolean(locked)}
                    onChange={() => onChange(toggleRole(selected, role.code))}
                    aria-labelledby={`${id}-name`}
                    aria-describedby={`${id}-desc`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <strong id={`${id}-name`}>{roleLabel(role.code)}</strong>
                      {sensitive && <Badge tone="bad">Accès complet</Badge>}
                      {diff.added.includes(role.code) && <Badge tone="ok">Sera ajouté</Badge>}
                      {diff.removed.includes(role.code) && <Badge tone="warn">Sera retiré</Badge>}
                    </span>
                    <span id={`${id}-desc`} className="mt-0.5 block text-sm text-ink-2">
                      {role.description} · {role.permissions.length} permission{role.permissions.length > 1 ? 's' : ''}
                    </span>
                    {sensitive && checked && (
                      <span className="mt-1 block text-sm text-bad">Toutes les actions de ce compte sont auditées et un code MFA récent sera demandé.</span>
                    )}
                  </span>
                </label>
              );
            })}
          </fieldset>
        ))}

        {original && (diff.added.length > 0 || diff.removed.length > 0) && (
          <p className="m-0 text-sm text-ink-2">
            Changements :{diff.added.length > 0 && <> ajout de {diff.added.map(roleLabel).join(', ')}</>}
            {diff.added.length > 0 && diff.removed.length > 0 && ' ;'}
            {diff.removed.length > 0 && <> retrait de {diff.removed.map(roleLabel).join(', ')}</>}.
          </p>
        )}
      </div>
      {/* Collé en haut de la fenêtre : l'aperçu reste visible pendant qu'on choisit les derniers rôles de la liste. */}
      <div className="min-w-0 lg:sticky lg:top-0 lg:self-start">
        <RightsPreview roles={roles} selected={selected} />
      </div>
    </div>
  );
}
