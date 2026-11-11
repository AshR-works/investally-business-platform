import type { IconName } from '../components/icon';
import { can, canAll, domainOf, isReleased } from './permissions';
import type { Profile } from './types';

/**
 * Domaines métier du menu (D51) : chaque module livré ou à venir appartient à un seul domaine. L'ordre ci-dessous est l'ordre d'affichage ;
 * un domaine sans module visible pour le profil n'apparaît pas.
 */
export const DOMAINS = ['CRM', 'Investudy', 'Finance', 'Ressources humaines', 'Stocks', 'Reporting', 'Administration'] as const;
export type Domain = (typeof DOMAINS)[number];

/** Un module de l'application tel que le hub et la navigation le présentent. */
export interface AppModule {
  id: string;
  label: string;
  description: string;
  icon: IconName;
  group: Domain;
  /** Chemin de l'écran ; absent tant que le module n'est pas livré (affiché « À venir », jamais cliquable). */
  href?: string;
  /** Droit requis pour voir le module (informatif : le serveur re-contrôle chaque requête). */
  permission?: string;
  /** Le module n'est proposé qu'à qui détient la permission en portée « Tous » (ex. la gestion du personnel : la RH et la Direction, pas un chargé de compte qui ne voit que sa propre fiche). */
  allScope?: boolean;
}

/**
 * Catalogue des modules de la plateforme, **dans l'ordre d'affichage de chaque domaine**. Un module sans `href` n'existe pas encore : il apparaît
 * sur le hub en « À venir » et nulle part ailleurs. Livrer un module = lui donner un `href` ici (CAD-H1-3). Les Commissions vivent sous Finance (D54).
 */
export const MODULES: readonly AppModule[] = [
  { id: 'companies', label: 'Entreprises', description: 'Entreprises cibles et clientes', icon: 'building', group: 'CRM', href: '/companies', permission: 'bd.company.read' },
  { id: 'contacts', label: 'Contacts', description: 'Interlocuteurs des entreprises', icon: 'user', group: 'CRM', href: '/contacts', permission: 'bd.contact.read' },
  { id: 'opportunities', label: 'Opportunités', description: 'Pipeline commercial', icon: 'target', group: 'CRM', href: '/opportunities', permission: 'bd.opportunity.read' },
  { id: 'offers', label: 'Offres', description: 'Offres faites aux entreprises', icon: 'doc', group: 'CRM', href: '/offers', permission: 'bd.offer.read' },
  { id: 'approvals', label: 'Agréments', description: 'Promesses de paiement signées par les clients', icon: 'shield', group: 'CRM', href: '/approvals', permission: 'bd.approval.read' },
  { id: 'followups', label: 'Relances', description: 'Relances à faire sur les offres', icon: 'cal', group: 'CRM', href: '/followups', permission: 'bd.followup.read' },
  { id: 'agenda', label: 'Agenda', description: 'Rendez-vous et visites', icon: 'cal', group: 'CRM', href: '/agenda', permission: 'bd.appointment.read' },
  { id: 'ambassadors', label: 'Ambassadeurs', description: 'Clients et apprenants relais commerciaux', icon: 'users', group: 'CRM', href: '/ambassadors', permission: 'bd.ambassador.read' },
  { id: 'training', label: 'Catalogue', description: 'Programmes, certificats, modules, salles et formateurs', icon: 'cap', group: 'Investudy', href: '/training', permission: 'training.program.read' },
  { id: 'sessions', label: 'Sessions de formation', description: 'Planifier, ouvrir, reporter et annuler les sessions', icon: 'cal', group: 'Investudy', href: '/training/sessions', permission: 'training.session.read' },
  { id: 'enrollments', label: 'Inscriptions', description: 'Inscriptions aux sessions : confirmer, annuler, replacer', icon: 'doc', group: 'Investudy', href: '/training/enrollments', permission: 'training.enrollment.read' },
  { id: 'learners', label: 'Apprenants', description: 'Personnes inscrites aux formations, par entreprise', icon: 'users', group: 'Investudy', href: '/training/learners', permission: 'training.learner.read' },
  { id: 'commissions', label: 'Commissions', description: 'Commissions des facilitateurs à verser', icon: 'card', group: 'Finance', href: '/commissions', permission: 'bd.commission.read' },
  { id: 'finance', label: 'Facturation et paiements', description: 'Facturation et suivi des paiements', icon: 'card', group: 'Finance' },
  { id: 'tax', label: 'Fiscalité', description: 'Obligations et déclarations', icon: 'doc', group: 'Finance' },
  { id: 'directory', label: 'Annuaire', description: 'Le personnel : postes, services et contacts professionnels', icon: 'users', group: 'Ressources humaines', href: '/hr', permission: 'hr.directory.read' },
  { id: 'org-chart', label: 'Organigramme', description: 'Qui rend compte à qui', icon: 'building', group: 'Ressources humaines', href: '/hr/org-chart', permission: 'hr.directory.read' },
  { id: 'staff', label: 'Personnel', description: 'Fiches du personnel : créer, modifier, enregistrer une sortie', icon: 'brief', group: 'Ressources humaines', href: '/hr/employees', permission: 'hr.employee.read', allScope: true },
  { id: 'leave', label: 'Mes absences', description: 'Votre solde de congé et vos demandes d’absence', icon: 'cal', group: 'Ressources humaines', href: '/hr/leave', permission: 'hr.leave.read' },
  { id: 'leave-approvals', label: 'Absences à valider', description: 'Les demandes d’absence de vos collaborateurs directs', icon: 'doc', group: 'Ressources humaines', href: '/hr/leave/approvals', permission: 'hr.leave.approve' },
  { id: 'leave-calendar', label: 'Calendrier d’équipe', description: 'Qui est absent, jour par jour', icon: 'cal', group: 'Ressources humaines', href: '/hr/leave/calendar', permission: 'hr.leave.read' },
  { id: 'leave-balances', label: 'Soldes de congé', description: 'Soldes de tout le personnel et ajustements motivés', icon: 'users', group: 'Ressources humaines', href: '/hr/leave/balances', permission: 'hr.leave.manage', allScope: true },
  { id: 'leave-settings', label: 'Paramètres des congés', description: 'Règles, types d’absence et jours fériés', icon: 'gear', group: 'Ressources humaines', href: '/hr/leave/settings', permission: 'hr.leave.manage', allScope: true },
  { id: 'stocks', label: 'Stocks', description: 'Articles, mouvements et inventaires', icon: 'box', group: 'Stocks' },
  { id: 'reporting', label: 'Reporting', description: 'Rapports périodiques et incidents', icon: 'chart', group: 'Reporting' },
  { id: 'users', label: 'Utilisateurs', description: 'Comptes, rôles et sessions', icon: 'users', group: 'Administration', href: '/admin/users', permission: 'iam.user.read' },
  { id: 'rights', label: 'Droits', description: 'Rôles et permissions, en lecture seule', icon: 'shield', group: 'Administration', href: '/admin/rights', permission: 'iam.role.read' },
  { id: 'security', label: 'Sécurité', description: 'Journal d’audit et alertes', icon: 'shield', group: 'Administration' },
];

/** Modules livrés et que le profil a le droit d'ouvrir. */
export function availableModules(profile: Profile | null): AppModule[] {
  return MODULES.filter((m) => m.href && (!m.permission || (m.allScope ? canAll(profile, m.permission) : can(profile, m.permission))));
}

/** Le module est publié pour ce profil : son domaine de permission l'est (un module sans permission l'est toujours). */
export function isModuleReleased(profile: Profile | null, m: AppModule): boolean {
  return !m.permission || isReleased(profile, domainOf(m.permission));
}

/** Modules pas encore livrés, ou livrés mais hors de la version publiée (présentés « À venir » sur le hub). */
export function upcomingModules(profile: Profile | null = null): AppModule[] {
  return MODULES.filter((m) => !m.href || !isModuleReleased(profile, m));
}

/** Le module (publié ou non) qui correspond à une adresse de page, ou `null` pour une page sans module (compte, vue d'ensemble). */
export function pageModule(pathname: string): AppModule | null {
  return activeModule(MODULES, pathname);
}

/** Le module qui bloque la page (son domaine n'est pas publié), ou `null` : la page s'affiche. Une page sans module (compte, vue d'ensemble) n'est jamais bloquée. */
export function blockingModule(profile: Profile | null, pathname: string): AppModule | null {
  const module = pageModule(pathname);
  return module && !isModuleReleased(profile, module) ? module : null;
}

/** Les modules regroupés par domaine, dans l'ordre des domaines ; un domaine sans module n'apparaît pas. */
export function byDomain<T extends AppModule>(modules: readonly T[]): { domain: Domain; items: T[] }[] {
  return DOMAINS.map((domain) => ({ domain, items: modules.filter((m) => m.group === domain) })).filter((d) => d.items.length > 0);
}

/**
 * Le module qui correspond à la page courante : celui dont le chemin est le plus long parmi ceux qui la couvrent (la page `/training/sessions` est celle
 * des Sessions, pas du Catalogue qui est à `/training`). Une page sans module (compte, hub) ne correspond à aucun.
 */
export function activeModule<T extends AppModule>(modules: readonly T[], pathname: string): T | null {
  let best: T | null = null;
  for (const m of modules) {
    if (!m.href) continue;
    const covers = pathname === m.href || pathname.startsWith(`${m.href}/`);
    if (covers && (!best || m.href.length > best.href!.length)) best = m;
  }
  return best;
}
