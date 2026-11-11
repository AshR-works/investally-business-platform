import type { RoleView } from './types';

/** Libellés français des modules, ressources et actions du catalogue de permissions (`module.ressource.action`). Un code inconnu garde son texte brut. */
export const MODULE_LABEL: Record<string, string> = {
  iam: 'Administration', audit: 'Audit', docs: 'Documents', bd: 'CRM', training: 'Investudy', reporting: 'Reporting',
};
export const ACTION_LABEL: Record<string, string> = {
  read: 'Lire', create: 'Créer', update: 'Modifier', delete: 'Supprimer', archive: 'Archiver', reassign: 'Réassigner', export: 'Exporter',
  download: 'Télécharger', manage: 'Gérer', cancel: 'Annuler', honor: 'Honorer', withdraw: 'Retirer', complete: 'Terminer', advance: 'Avancer',
  close_lost: 'Clore perdue', close_won: 'Clore gagnée', override: 'Déroger', pay: 'Verser', revoke: 'Révoquer', disable: 'Désactiver',
  assign_role: 'Attribuer un rôle', reset_mfa: 'Réinitialiser la MFA', reset_password: 'Réinitialiser le mot de passe',
};
export const SCOPE_LABEL: Record<string, string> = { OWN: 'Propre', TEAM: 'Équipe', ALL: 'Tous' };
/** Explication de chaque portée, affichée en légende. */
export const SCOPE_HELP: Record<string, string> = {
  OWN: 'les objets dont la personne est responsable',
  TEAM: 'les siens et ceux de ses subordonnés directs',
  ALL: 'tous les objets',
};

export interface RightsRow {
  code: string;
  module: string;
  resource: string;
  action: string;
  /** Portée accordée par rôle (clé : code du rôle) ; absent = aucun droit. */
  scopes: Record<string, string>;
}

/** Découpe `bd.company.read` en module, ressource et action (une ressource peut elle-même contenir des points : tout ce qui suit le module et précède la dernière partie). */
export function splitPermission(code: string): { module: string; resource: string; action: string } {
  const parts = code.split('.');
  if (parts.length < 3) return { module: parts[0] ?? code, resource: parts.slice(1, -1).join('.'), action: parts.at(-1) ?? code };
  return { module: parts[0]!, resource: parts.slice(1, -1).join('.'), action: parts.at(-1)! };
}

/** Matrice permissions × rôles, triée par module, ressource, action. Chaque permission apparaît une fois, avec la portée de chaque rôle qui l'a. */
export function buildRightsMatrix(roles: readonly RoleView[]): RightsRow[] {
  const rows = new Map<string, RightsRow>();
  for (const role of roles) {
    for (const p of role.permissions) {
      const row = rows.get(p.code) ?? { code: p.code, ...splitPermission(p.code), scopes: {} };
      row.scopes[role.code] = p.scope;
      rows.set(p.code, row);
    }
  }
  return [...rows.values()].sort((a, b) => a.code.localeCompare(b.code));
}

/** Filtre : module exact (ou tous) et texte recherché dans le code ou les libellés français. */
export function filterRights(rows: readonly RightsRow[], filter: { module: string; search: string }): RightsRow[] {
  const q = filter.search.trim().toLowerCase();
  return rows.filter((r) => {
    if (filter.module && r.module !== filter.module) return false;
    if (!q) return true;
    const label = `${MODULE_LABEL[r.module] ?? r.module} ${r.resource} ${ACTION_LABEL[r.action] ?? r.action}`.toLowerCase();
    return r.code.includes(q) || label.includes(q);
  });
}

/** Modules présents dans la matrice, dans l'ordre d'affichage voulu (inconnus à la fin). */
export function modulesOf(rows: readonly RightsRow[]): string[] {
  const order = Object.keys(MODULE_LABEL);
  return [...new Set(rows.map((r) => r.module))].sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99) || a.localeCompare(b));
}

/** Combien de permissions chaque rôle possède (en-tête de colonne). */
export function countByRole(rows: readonly RightsRow[], roleCode: string): number {
  return rows.filter((r) => r.scopes[roleCode]).length;
}
