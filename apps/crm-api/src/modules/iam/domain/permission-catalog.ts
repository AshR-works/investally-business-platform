/**
 * Catalogue des permissions du CRM. Code = `module.ressource.action` (minuscules, snake_case).
 * Source de vérité : le seed et la documentation (docs/RBAC.md) en sont dérivés.
 * Aucune permission d'écriture ou de suppression n'existe sur le journal d'audit (append-only).
 */
export interface ResourceDefinition {
  module: string;
  resource: string;
  label: string;
  actions: readonly string[];
}

const CRUD = ['read', 'create', 'update'] as const;

export const RESOURCES: readonly ResourceDefinition[] = [
  // Identity & Access
  { module: 'iam', resource: 'user', label: 'Utilisateurs', actions: ['read', 'create', 'update', 'disable', 'assign_role', 'reset_mfa', 'reset_password'] },
  { module: 'iam', resource: 'role', label: 'Rôles et permissions', actions: ['read', 'manage'] },
  { module: 'iam', resource: 'session', label: 'Sessions', actions: ['read', 'revoke'] },
  // Audit
  { module: 'audit', resource: 'log', label: "Journal d'audit", actions: ['read', 'export'] },
  // Documents
  { module: 'docs', resource: 'document', label: 'Documents', actions: ['read', 'create', 'update', 'delete', 'download', 'export'] },
  // Business Development
  { module: 'bd', resource: 'company', label: 'Entreprises', actions: [...CRUD, 'archive', 'export'] },
  { module: 'bd', resource: 'contact', label: 'Contacts', actions: [...CRUD, 'delete'] },
  { module: 'bd', resource: 'offer', label: 'Offres', actions: [...CRUD, 'withdraw'] },
  { module: 'bd', resource: 'receipt', label: 'Décharges', actions: [...CRUD] },
  { module: 'bd', resource: 'followup', label: 'Relances', actions: [...CRUD, 'complete'] },
  { module: 'bd', resource: 'appointment', label: 'Rendez-vous', actions: [...CRUD, 'cancel'] },
  { module: 'bd', resource: 'visit', label: 'Visites Investally', actions: [...CRUD] },
  { module: 'bd', resource: 'opportunity', label: 'Opportunités', actions: [...CRUD, 'advance', 'close', 'export'] },
  { module: 'bd', resource: 'ambassador', label: 'Ambassadeurs', actions: [...CRUD] },
  // Training / Investudy
  { module: 'training', resource: 'program', label: 'Programmes', actions: [...CRUD, 'archive'] },
  { module: 'training', resource: 'training', label: 'Formations', actions: [...CRUD] },
  { module: 'training', resource: 'session', label: 'Sessions', actions: [...CRUD, 'cancel', 'close'] },
  { module: 'training', resource: 'room', label: 'Salles', actions: ['read', 'manage'] },
  { module: 'training', resource: 'trainer', label: 'Formateurs', actions: ['read', 'manage'] },
  { module: 'training', resource: 'learner', label: 'Apprenants', actions: [...CRUD, 'delete'] },
  { module: 'training', resource: 'enrollment', label: 'Inscriptions', actions: [...CRUD, 'cancel'] },
  { module: 'training', resource: 'attendance', label: 'Présences', actions: ['read', 'record'] },
  { module: 'training', resource: 'evaluation', label: 'Évaluations', actions: ['read', 'record'] },
  { module: 'training', resource: 'certification', label: 'Certifications et attestations', actions: ['read', 'issue', 'revoke'] },
  // Reporting
  { module: 'reporting', resource: 'dashboard', label: 'Tableaux de bord', actions: ['account_manager', 'head_of_sales', 'training', 'direction', 'security', 'admin'] },
  { module: 'reporting', resource: 'kpi', label: 'Indicateurs', actions: ['read'] },
  { module: 'reporting', resource: 'report', label: 'Rapports', actions: ['read', 'export'] },
];

/** Une permission du catalogue : code `module.ressource.action`, module, ressource, action et description. */
export interface PermissionDefinition {
  code: string;
  module: string;
  resource: string;
  action: string;
  description: string;
}

export const PERMISSIONS: readonly PermissionDefinition[] = RESOURCES.flatMap((r) =>
  r.actions.map((action) => ({
    code: `${r.module}.${r.resource}.${action}`,
    module: r.module,
    resource: r.resource,
    action,
    description: `${r.label} : ${action}`,
  })),
);

export const PERMISSION_CODES: ReadonlySet<string> = new Set(PERMISSIONS.map((p) => p.code));
