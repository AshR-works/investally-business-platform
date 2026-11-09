import type { IconName } from '../components/icon';
import { can } from './permissions';
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
  { id: 'hr', label: 'Ressources humaines', description: 'Personnel et organisation', icon: 'brief', group: 'Ressources humaines' },
  { id: 'stocks', label: 'Stocks', description: 'Articles, mouvements et inventaires', icon: 'box', group: 'Stocks' },
  { id: 'reporting', label: 'Reporting', description: 'Rapports périodiques et incidents', icon: 'chart', group: 'Reporting' },
  { id: 'users', label: 'Utilisateurs', description: 'Comptes, rôles et sessions', icon: 'users', group: 'Administration', href: '/admin/users', permission: 'iam.user.read' },
  { id: 'security', label: 'Sécurité', description: 'Journal d’audit et alertes', icon: 'shield', group: 'Administration' },
];

/** Modules livrés et que le profil a le droit d'ouvrir. */
export function availableModules(profile: Profile | null): AppModule[] {
  return MODULES.filter((m) => m.href && (!m.permission || can(profile, m.permission)));
}

/** Modules pas encore livrés (présentés « À venir » sur le hub). */
export function upcomingModules(): AppModule[] {
  return MODULES.filter((m) => !m.href);
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
