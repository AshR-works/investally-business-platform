'use client';

import { effectiveRights, SCOPE_LABEL, type ScopeCode } from '../../lib/roles';
import type { RoleView } from '../../lib/types';
import { Badge, type Tone } from '../data/badge';

/** La portée se lit dans le TEXTE du badge ; la teinte n'est qu'un renfort (WCAG 1.4.1). */
const SCOPE_TONE: Record<ScopeCode, Tone> = { ALL: 'warn', TEAM: 'info', OWN: 'neutral' };

/**
 * Aperçu en LECTURE SEULE des droits qu'obtiendra la personne avec les rôles cochés, regroupés par module (EXD-14).
 * C'est une information : le serveur reste le seul juge de chaque requête. Plusieurs rôles se cumulent, la portée la plus
 * large l'emporte pour une même permission.
 */
export function RightsPreview({ roles, selected }: { roles: RoleView[]; selected: string[] }) {
  const rights = effectiveRights(roles, selected);
  return (
    <section aria-labelledby="rights-preview-title" className="min-w-0 rounded-control border border-line bg-surface-2 p-3">
      <h3 id="rights-preview-title" className="m-0 text-base">Droits effectifs</h3>
      <p className="hint mb-3 mt-1">Aperçu en lecture seule. Plusieurs rôles se cumulent ; pour une même permission, la portée la plus large l’emporte.</p>
      {rights.modules.length === 0 ? (
        <p className="m-0 text-ink-2">Cochez au moins un rôle pour voir les droits qu’il accorde.</p>
      ) : (
        <div className="max-h-[52vh] overflow-y-auto pr-1">
          {rights.modules.map((module, index) => (
            <details key={module.module} open={index === 0} className="mb-2 rounded-control border border-line-strong bg-surface">
              <summary className="cursor-pointer px-3 py-2 font-semibold">
                {module.label} <span className="font-normal text-ink-2">· {module.permissionCount} permission{module.permissionCount > 1 ? 's' : ''}</span>
              </summary>
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">Droits du module {module.label}</caption>
                <thead className="sr-only"><tr><th scope="col">Ressource</th><th scope="col">Actions et portée</th></tr></thead>
                <tbody>
                  {module.resources.map((resource) => (
                    <tr key={resource.key} className="border-t border-line align-top">
                      <th scope="row" className="w-2/5 px-3 py-2 text-left font-semibold">{resource.label}</th>
                      <td className="px-3 py-2">
                        <ul className="m-0 flex list-none flex-wrap gap-x-3 gap-y-1.5 p-0">
                          {resource.actions.map((action) => (
                            <li key={action.action} className="inline-flex items-center gap-1.5">
                              {action.label}
                              <Badge tone={SCOPE_TONE[action.scope]}>{SCOPE_LABEL[action.scope]}</Badge>
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
