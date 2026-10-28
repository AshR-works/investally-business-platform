import type { RoleView } from './types';

/** Portée d'un droit, de la plus étroite à la plus large (même ordre que le serveur). */
export type ScopeCode = 'OWN' | 'TEAM' | 'ALL';
export const SCOPE_RANK: Record<ScopeCode, number> = { OWN: 1, TEAM: 2, ALL: 3 };
export const SCOPE_LABEL: Record<ScopeCode, string> = { OWN: 'Propres', TEAM: 'Équipe', ALL: 'Tous' };

/** Rôles qui donnent un accès étendu : mis en garde dans l'interface (le serveur applique ses propres garde-fous). */
export const SENSITIVE_ROLES: readonly string[] = ['SUPER_ADMIN'];

/** Familles de rôles, dans l'ordre d'affichage. Un rôle absent de cette liste tombe dans « Autres rôles ». */
export interface RoleGroup { id: string; label: string; description: string; roles: readonly string[] }
export const ROLE_GROUPS: readonly RoleGroup[] = [
  { id: 'pilotage', label: 'Pilotage', description: 'Supervision et tableaux de bord de direction.', roles: ['DIRECTION'] },
  { id: 'commercial', label: 'Commercial', description: 'Entreprises, offres, relances et pipeline.', roles: ['HEAD_OF_SALES', 'ACCOUNT_MANAGER'] },
  { id: 'investudy', label: 'Investudy (formation)', description: 'Programmes, sessions, formateurs et apprenants.', roles: ['TRAINING_MANAGER', 'TRAINER'] },
  { id: 'fonctions', label: 'Support et fonctions support', description: 'Assistance et préparation de la gestion.', roles: ['SUPPORT', 'FINANCE', 'HR', 'TAX'] },
  { id: 'administration', label: 'Administration', description: 'Accès complet au système.', roles: ['SUPER_ADMIN'] },
];
const OTHERS: RoleGroup = { id: 'autres', label: 'Autres rôles', description: 'Rôles hors des familles connues.', roles: [] };

export interface GroupedRoles { group: RoleGroup; roles: RoleView[] }

/** Range les rôles de l'API par famille ; un rôle inconnu va dans « Autres rôles », un rôle absent de l'API est ignoré. */
export function groupRoles(roles: readonly RoleView[]): GroupedRoles[] {
  const byCode = new Map(roles.map((r) => [r.code, r]));
  const used = new Set<string>();
  const result: GroupedRoles[] = ROLE_GROUPS.map((group) => ({
    group,
    roles: group.roles.map((code) => byCode.get(code)).filter((r): r is RoleView => {
      if (r) used.add(r.code);
      return r !== undefined;
    }),
  })).filter((g) => g.roles.length > 0);
  const rest = roles.filter((r) => !used.has(r.code));
  if (rest.length > 0) result.push({ group: OTHERS, roles: [...rest] });
  return result;
}

/** Modules du catalogue, dans l'ordre d'affichage, avec leur libellé. */
export const MODULE_ORDER = ['bd', 'training', 'docs', 'reporting', 'audit', 'iam'] as const;
export const MODULE_LABELS: Record<string, string> = {
  bd: 'Business Development',
  training: 'Investudy (formation)',
  docs: 'Documents',
  reporting: 'Reporting',
  audit: 'Audit',
  iam: 'Identité et accès',
};

/** Libellés des ressources (clé `module.ressource`), identiques à ceux du catalogue du serveur (un test le vérifie). */
export const RESOURCE_LABELS: Record<string, string> = {
  'iam.user': 'Utilisateurs', 'iam.role': 'Rôles et permissions', 'iam.session': 'Sessions',
  'audit.log': "Journal d'audit",
  'docs.document': 'Documents',
  'bd.company': 'Entreprises', 'bd.contact': 'Contacts', 'bd.offer': 'Offres', 'bd.receipt': 'Décharges', 'bd.followup': 'Relances',
  'bd.appointment': 'Rendez-vous', 'bd.visit': 'Visites Investally', 'bd.opportunity': 'Opportunités', 'bd.ambassador': 'Ambassadeurs',
  'training.program': 'Programmes', 'training.training': 'Formations', 'training.session': 'Sessions', 'training.room': 'Salles',
  'training.trainer': 'Formateurs', 'training.learner': 'Apprenants', 'training.enrollment': 'Inscriptions', 'training.attendance': 'Présences',
  'training.evaluation': 'Évaluations', 'training.certification': 'Certifications et attestations',
  'reporting.dashboard': 'Tableaux de bord', 'reporting.kpi': 'Indicateurs', 'reporting.report': 'Rapports',
};

/** Libellés des actions. Une action inconnue garde son code (jamais d'erreur d'affichage). */
export const ACTION_LABELS: Record<string, string> = {
  read: 'Consulter', create: 'Créer', update: 'Modifier', delete: 'Supprimer', archive: 'Archiver', export: 'Exporter',
  disable: 'Désactiver', assign_role: 'Attribuer des rôles', reset_mfa: 'Réinitialiser le MFA', reset_password: 'Réinitialiser le mot de passe',
  manage: 'Gérer', revoke: 'Révoquer', download: 'Télécharger', withdraw: 'Retirer', complete: 'Terminer', cancel: 'Annuler',
  advance: 'Faire avancer', close: 'Clore', record: 'Enregistrer', issue: 'Délivrer',
  account_manager: 'Chargé de compte', head_of_sales: 'Responsable commercial', training: 'Formation', direction: 'Direction', security: 'Sécurité', admin: 'Administration',
};
export const actionLabel = (action: string): string => ACTION_LABELS[action] ?? action;
export const moduleLabel = (module: string): string => MODULE_LABELS[module] ?? module;
export const resourceLabel = (module: string, resource: string): string => RESOURCE_LABELS[`${module}.${resource}`] ?? resource;

/**
 * Droits obtenus en cumulant les rôles choisis : pour une même permission, la portée la plus large l'emporte (règle du
 * serveur, `widestScope`). Un test compare cette fonction à celle du serveur sur tous les rôles.
 */
export function mergeGrants(roles: readonly RoleView[], selected: readonly string[]): Map<string, ScopeCode> {
  const chosen = new Set(selected);
  const merged = new Map<string, ScopeCode>();
  for (const role of roles) {
    if (!chosen.has(role.code)) continue;
    for (const grant of role.permissions) {
      const scope = grant.scope as ScopeCode;
      const current = merged.get(grant.code);
      if (current === undefined || SCOPE_RANK[scope] > SCOPE_RANK[current]) merged.set(grant.code, scope);
    }
  }
  return merged;
}

export interface RightAction { action: string; label: string; scope: ScopeCode }
export interface RightResource { key: string; label: string; actions: RightAction[] }
export interface RightModule { module: string; label: string; permissionCount: number; resources: RightResource[] }
export interface EffectiveRights { modules: RightModule[]; permissionCount: number }

/** Droits effectifs regroupés par module puis par ressource, pour l'aperçu en lecture seule. */
export function effectiveRights(roles: readonly RoleView[], selected: readonly string[]): EffectiveRights {
  const merged = mergeGrants(roles, selected);
  const modules = new Map<string, Map<string, RightAction[]>>();
  for (const [code, scope] of merged) {
    const [module, resource, ...rest] = code.split('.');
    const action = rest.join('.');
    const resources = modules.get(module) ?? new Map<string, RightAction[]>();
    const list = resources.get(resource) ?? [];
    list.push({ action, label: actionLabel(action), scope });
    resources.set(resource, list);
    modules.set(module, resources);
  }
  const order = (m: string) => { const i = (MODULE_ORDER as readonly string[]).indexOf(m); return i === -1 ? MODULE_ORDER.length : i; };
  const result: RightModule[] = [...modules].sort(([a], [b]) => order(a) - order(b) || a.localeCompare(b)).map(([module, resources]) => ({
    module,
    label: moduleLabel(module),
    permissionCount: [...resources.values()].reduce((n, list) => n + list.length, 0),
    resources: [...resources].map(([resource, actions]) => ({
      key: `${module}.${resource}`,
      label: resourceLabel(module, resource),
      actions: actions.sort((a, b) => a.label.localeCompare(b.label, 'fr')),
    })).sort((a, b) => a.label.localeCompare(b.label, 'fr')),
  }));
  return { modules: result, permissionCount: merged.size };
}

/** Rôles ajoutés et retirés par rapport à l'état d'origine, dans l'ordre de leur apparition. */
export function diffRoles(original: readonly string[], selected: readonly string[]): { added: string[]; removed: string[] } {
  return { added: selected.filter((c) => !original.includes(c)), removed: original.filter((c) => !selected.includes(c)) };
}

/** Vrai si les deux listes contiennent les mêmes rôles (l'ordre ne compte pas). */
export function sameRoles(a: readonly string[], b: readonly string[]): boolean {
  const d = diffRoles(a, b);
  return d.added.length === 0 && d.removed.length === 0;
}

/** Ajoute le code à la liste s'il n'y est pas, le retire sinon (sans modifier la liste d'origine). */
export function toggleRole(list: readonly string[], code: string): string[] {
  return list.includes(code) ? list.filter((c) => c !== code) : [...list, code];
}

/** Phrase du compteur de sélection, annoncée aux lecteurs d'écran. */
export function selectionSummary(roleCount: number, permissionCount: number): string {
  if (roleCount === 0) return 'Aucun rôle sélectionné';
  const roles = `${roleCount} rôle${roleCount > 1 ? 's' : ''} sélectionné${roleCount > 1 ? 's' : ''}`;
  return `${roles} · ${permissionCount} permission${permissionCount > 1 ? 's' : ''}`;
}
