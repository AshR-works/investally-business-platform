import { PERMISSION_CODES, PERMISSIONS } from './permission-catalog';

/** Portée d'une permission : sur quels objets elle s'applique. */
export enum Scope {
  /** Objets dont l'acteur est propriétaire / affecté / participant. */
  Own = 'OWN',
  /** Objets de l'acteur et de ses subordonnés directs. */
  Team = 'TEAM',
  /** Tous les objets. */
  All = 'ALL',
}

export enum RoleCode {
  SuperAdmin = 'SUPER_ADMIN',
  Direction = 'DIRECTION',
  HeadOfSales = 'HEAD_OF_SALES',
  AccountManager = 'ACCOUNT_MANAGER',
  /** Responsable Investudy — ajouté (absent du prompt maître), confirmé le 2026-10-20 : gère programmes, sessions, salles. */
  TrainingManager = 'TRAINING_MANAGER',
  Trainer = 'TRAINER',
  Support = 'SUPPORT',
  Finance = 'FINANCE',
  Hr = 'HR',
  Tax = 'TAX',
}

/**
 * Un rôle métier : code, libellé, description et exigence de MFA (obligatoire pour tous depuis la décision du
 * 2026-10-20).
 */
export interface RoleDefinition {
  code: RoleCode;
  label: string;
  description: string;
  /** MFA exigé (SECURITY.md §2.3). Décision produit 2026-10-20 : obligatoire pour tous les rôles. */
  mfaRequired: boolean;
}

export const ROLES: readonly RoleDefinition[] = [
  { code: RoleCode.SuperAdmin, label: 'Super administrateur', description: 'Accès complet au CRM : administration, métier, audit et tableaux de bord. Compte à haut risque : MFA obligatoire, toutes les actions auditées, ne peut pas modifier ses propres rôles.', mfaRequired: true },
  { code: RoleCode.Direction, label: 'Direction', description: 'Supervision en lecture de tout le CRM, tableaux de bord stratégiques.', mfaRequired: true },
  { code: RoleCode.HeadOfSales, label: 'Responsable commercial', description: "Pilote l'équipe commerciale et le pipeline global.", mfaRequired: true },
  { code: RoleCode.AccountManager, label: 'Chargé de compte', description: 'Mène ses propres entreprises, offres, relances, rendez-vous et inscriptions.', mfaRequired: true },
  { code: RoleCode.TrainingManager, label: 'Responsable Investudy', description: 'Gère programmes, sessions, salles, formateurs, apprenants, certifications.', mfaRequired: true },
  { code: RoleCode.Trainer, label: 'Formateur', description: 'Anime ses sessions : présences, évaluations.', mfaRequired: true },
  { code: RoleCode.Support, label: 'Support', description: 'Consultation pour assister les utilisateurs et les clients.', mfaRequired: true },
  { code: RoleCode.Finance, label: 'Finance', description: "Accès CRM limité à la préparation de facturation (l'ERP couvrira le reste).", mfaRequired: true },
  { code: RoleCode.Hr, label: 'RH', description: "Aucun accès métier CRM (l'ERP couvrira le périmètre RH).", mfaRequired: true },
  { code: RoleCode.Tax, label: 'Fiscalité', description: "Aucun accès métier CRM (l'ERP couvrira le périmètre fiscal).", mfaRequired: true },
];

/** Droit accordé à un rôle : permission exacte ou motif (`bd.*`) et portée (Propre, Équipe, Tous). */
export interface Grant {
  /** Code exact (`bd.company.read`) ou motif (`bd.company.*`, `bd.*`). */
  permission: string;
  scope: Scope;
}

/** Raccourci d'écriture d'un droit dans la matrice rôles → permissions. */
const g = (permission: string, scope: Scope): Grant => ({ permission, scope });
const { Own, Team, All } = Scope;

/** Matrice rôles → permissions. Les motifs sont résolus contre le catalogue. */
export const ROLE_GRANTS: Record<RoleCode, readonly Grant[]> = {
  [RoleCode.SuperAdmin]: [
    // Décision produit (2026-10-20) : accès complet. Garde-fous compensatoires : MFA, audit, pas d'auto-attribution de rôle.
    g('iam.*', All),
    g('audit.*', All),
    g('docs.*', All),
    g('bd.*', All),
    g('training.*', All),
    g('reporting.*', All),
  ],
  [RoleCode.Direction]: [
    g('bd.company.read', All), g('bd.company.export', All),
    g('bd.contact.read', All), g('bd.offer.read', All), g('bd.receipt.read', All),
    g('bd.followup.read', All), g('bd.appointment.read', All), g('bd.visit.read', All),
    g('bd.opportunity.read', All), g('bd.opportunity.export', All), g('bd.ambassador.read', All),
    g('bd.facilitator.read', All), g('bd.commission.read', All),
    g('training.program.read', All), g('training.training.read', All), g('training.session.read', All),
    g('training.learner.read', All), g('training.enrollment.read', All), g('training.attendance.read', All),
    g('training.evaluation.read', All), g('training.certification.read', All),
    g('docs.document.read', All), g('docs.document.download', All), g('docs.document.export', All),
    g('audit.log.read', All),
    g('reporting.dashboard.direction', All), g('reporting.dashboard.head_of_sales', All),
    g('reporting.dashboard.training', All), g('reporting.kpi.read', All),
    g('reporting.report.read', All), g('reporting.report.export', All),
    g('iam.session.read', Own), g('iam.session.revoke', Own),
  ],
  [RoleCode.HeadOfSales]: [
    g('bd.company.read', Team), g('bd.company.create', Team), g('bd.company.update', Team), g('bd.company.archive', Team), g('bd.company.export', Team),
    g('bd.contact.*', Team), g('bd.offer.*', Team), g('bd.receipt.*', Team),
    g('bd.followup.*', Team), g('bd.appointment.*', Team), g('bd.visit.*', Team),
    g('bd.opportunity.read', All), g('bd.opportunity.create', Team), g('bd.opportunity.update', Team),
    g('bd.opportunity.advance', Team), g('bd.opportunity.close', Team), g('bd.opportunity.export', Team),
    g('bd.ambassador.read', All), g('bd.ambassador.create', Team), g('bd.ambassador.update', Team),
    g('bd.facilitator.read', Team), g('bd.facilitator.create', Team), g('bd.commission.read', Team), g('bd.commission.manage', Team),
    g('training.program.read', All), g('training.session.read', All), g('training.enrollment.read', Team),
    g('training.learner.read', Team), g('training.certification.read', Team),
    g('docs.document.read', Team), g('docs.document.create', Team), g('docs.document.download', Team), g('docs.document.delete', Team),
    g('reporting.dashboard.head_of_sales', All), g('reporting.dashboard.account_manager', Team),
    g('reporting.kpi.read', All), g('reporting.report.read', All), g('reporting.report.export', Team),
    g('iam.session.read', Own), g('iam.session.revoke', Own),
  ],
  [RoleCode.AccountManager]: [
    g('bd.company.read', Own), g('bd.company.create', Own), g('bd.company.update', Own),
    g('bd.contact.read', Own), g('bd.contact.create', Own), g('bd.contact.update', Own),
    g('bd.offer.read', Own), g('bd.offer.create', Own), g('bd.offer.update', Own), g('bd.offer.withdraw', Own),
    g('bd.receipt.read', Own), g('bd.receipt.create', Own), g('bd.receipt.update', Own),
    g('bd.followup.read', Own), g('bd.followup.create', Own), g('bd.followup.update', Own), g('bd.followup.complete', Own),
    g('bd.appointment.read', Own), g('bd.appointment.create', Own), g('bd.appointment.update', Own), g('bd.appointment.cancel', Own),
    g('bd.visit.read', Own), g('bd.visit.create', Own), g('bd.visit.update', Own),
    g('bd.opportunity.read', Own), g('bd.opportunity.create', Own), g('bd.opportunity.update', Own), g('bd.opportunity.advance', Own),
    g('bd.ambassador.read', Own), g('bd.ambassador.create', Own),
    g('bd.facilitator.read', Own), g('bd.facilitator.create', Own),
    g('training.program.read', All), g('training.session.read', All),
    g('training.learner.read', Own), g('training.learner.create', Own), g('training.learner.update', Own),
    g('training.enrollment.read', Own), g('training.enrollment.create', Own),
    g('docs.document.read', Own), g('docs.document.create', Own), g('docs.document.update', Own), g('docs.document.download', Own),
    g('reporting.dashboard.account_manager', Own),
    g('iam.session.read', Own), g('iam.session.revoke', Own),
  ],
  [RoleCode.TrainingManager]: [
    g('training.*', All),
    g('bd.company.read', All), g('bd.contact.read', All), g('bd.opportunity.read', All), g('bd.ambassador.read', All),
    g('docs.document.read', All), g('docs.document.create', All), g('docs.document.update', All), g('docs.document.download', All),
    g('docs.document.delete', All), g('docs.document.export', All),
    g('reporting.dashboard.training', All), g('reporting.kpi.read', All), g('reporting.report.read', All), g('reporting.report.export', All),
    g('iam.session.read', Own), g('iam.session.revoke', Own),
  ],
  [RoleCode.Trainer]: [
    g('training.program.read', All), g('training.room.read', All),
    g('training.session.read', Own), g('training.learner.read', Own),
    g('training.attendance.read', Own), g('training.attendance.record', Own),
    g('training.evaluation.read', Own), g('training.evaluation.record', Own),
    g('training.certification.read', Own),
    g('docs.document.read', Own), g('docs.document.download', Own),
    g('reporting.dashboard.training', Own),
    g('iam.session.read', Own), g('iam.session.revoke', Own),
  ],
  [RoleCode.Support]: [
    g('bd.company.read', All), g('bd.contact.read', All),
    g('training.session.read', All), g('training.learner.read', All), g('training.enrollment.read', All),
    g('iam.session.read', Own), g('iam.session.revoke', Own),
  ],
  [RoleCode.Finance]: [
    g('bd.company.read', All), g('bd.facilitator.read', All), g('bd.commission.read', All),
    g('training.enrollment.read', All), g('training.session.read', All),
    g('reporting.kpi.read', All),
    g('iam.session.read', Own), g('iam.session.revoke', Own),
  ],
  [RoleCode.Hr]: [g('iam.session.read', Own), g('iam.session.revoke', Own)],
  [RoleCode.Tax]: [g('iam.session.read', Own), g('iam.session.revoke', Own)],
};

/** Droit élargi : un motif est remplacé par les permissions exactes du catalogue. */
export interface ResolvedGrant {
  permission: string;
  scope: Scope;
}

const SCOPE_RANK: Record<Scope, number> = { [Scope.Own]: 1, [Scope.Team]: 2, [Scope.All]: 3 };

/**
 * Élargit un motif (`iam.*`) en codes de permission du catalogue ; un code exact reste tel quel, un motif inconnu ne
 * donne rien.
 */
function expand(pattern: string): string[] {
  if (PERMISSION_CODES.has(pattern)) return [pattern];
  if (!pattern.endsWith('.*')) return [];
  const prefix = pattern.slice(0, -1); // garde le point final
  return PERMISSIONS.filter((p) => p.code.startsWith(prefix)).map((p) => p.code);
}

/** Développe les motifs en codes exacts ; en cas de doublon, la portée la plus large l'emporte. */
export function resolveGrants(role: RoleCode): ResolvedGrant[] {
  const byPermission = new Map<string, Scope>();
  for (const grant of ROLE_GRANTS[role]) {
    for (const code of expand(grant.permission)) {
      const current = byPermission.get(code);
      if (!current || SCOPE_RANK[grant.scope] > SCOPE_RANK[current]) {
        byPermission.set(code, grant.scope);
      }
    }
  }
  return [...byPermission].map(([permission, scope]) => ({ permission, scope })).sort((a, b) => a.permission.localeCompare(b.permission));
}

/** Motifs de la matrice qui ne correspondent à aucune permission du catalogue (faute de frappe). */
export function unknownPatterns(): string[] {
  const unknown: string[] = [];
  for (const [role, grants] of Object.entries(ROLE_GRANTS)) {
    for (const grant of grants) {
      if (expand(grant.permission).length === 0) unknown.push(`${role}: ${grant.permission}`);
    }
  }
  return unknown;
}
