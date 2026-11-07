import type { IconName } from '../components/icon';
import { can } from './permissions';
import type { Profile } from './types';

/** Un module de l'application tel que le hub et la navigation le présentent. */
export interface AppModule {
  id: string;
  label: string;
  description: string;
  icon: IconName;
  group: 'Espace de travail' | 'Opérations' | 'Pilotage' | 'Gouvernance';
  /** Chemin de l'écran ; absent tant que le module n'est pas livré (affiché « À venir », jamais cliquable). */
  href?: string;
  /** Droit requis pour voir le module (informatif : le serveur re-contrôle chaque requête). */
  permission?: string;
}

/**
 * Catalogue des modules de la plateforme. Un module sans `href` n'existe pas encore : il apparaît sur le hub en « À venir »
 * et nulle part ailleurs. Livrer un module = lui donner un `href` ici (CAD-H1-3).
 */
export const MODULES: readonly AppModule[] = [
  { id: 'agenda', label: 'Agenda', description: 'Rendez-vous et visites', icon: 'cal', group: 'Espace de travail', href: '/agenda', permission: 'bd.appointment.read' },
  { id: 'commissions', label: 'Commissions', description: 'Commissions des facilitateurs à verser', icon: 'card', group: 'Espace de travail', href: '/commissions', permission: 'bd.commission.read' },
  { id: 'ambassadors', label: 'Ambassadeurs', description: 'Clients et apprenants relais commerciaux', icon: 'users', group: 'Espace de travail', href: '/ambassadors', permission: 'bd.ambassador.read' },
  { id: 'companies', label: 'Entreprises', description: 'Entreprises cibles et clientes', icon: 'building', group: 'Espace de travail', href: '/companies', permission: 'bd.company.read' },
  { id: 'contacts', label: 'Contacts', description: 'Interlocuteurs des entreprises', icon: 'user', group: 'Espace de travail', href: '/contacts', permission: 'bd.contact.read' },
  { id: 'followups', label: 'Relances', description: 'Relances à faire sur les offres', icon: 'cal', group: 'Espace de travail', href: '/followups', permission: 'bd.followup.read' },
  { id: 'offers', label: 'Offres', description: 'Offres faites aux entreprises', icon: 'doc', group: 'Espace de travail', href: '/offers', permission: 'bd.offer.read' },
  { id: 'opportunities', label: 'Opportunités', description: 'Pipeline commercial', icon: 'target', group: 'Espace de travail', href: '/opportunities', permission: 'bd.opportunity.read' },
  { id: 'training', label: 'Formation', description: 'Catalogue Investudy : programmes, certificats, salles, formateurs', icon: 'cap', group: 'Espace de travail', href: '/training', permission: 'training.program.read' },
  { id: 'sessions', label: 'Sessions de formation', description: 'Planifier, ouvrir, reporter et annuler les sessions', icon: 'cal', group: 'Espace de travail', href: '/training/sessions', permission: 'training.session.read' },
  { id: 'finance', label: 'Finance', description: 'Facturation et suivi des paiements', icon: 'card', group: 'Opérations' },
  { id: 'hr', label: 'Ressources humaines', description: 'Personnel et organisation', icon: 'brief', group: 'Opérations' },
  { id: 'tax', label: 'Fiscalité', description: 'Obligations et déclarations', icon: 'doc', group: 'Opérations' },
  { id: 'stocks', label: 'Stocks', description: 'Articles, mouvements et inventaires', icon: 'box', group: 'Opérations' },
  { id: 'reporting', label: 'Reporting', description: 'Rapports périodiques et incidents', icon: 'chart', group: 'Pilotage' },
  { id: 'users', label: 'Utilisateurs', description: 'Comptes, rôles et sessions', icon: 'users', group: 'Gouvernance', href: '/admin/users', permission: 'iam.user.read' },
  { id: 'security', label: 'Sécurité', description: 'Journal d’audit et alertes', icon: 'shield', group: 'Gouvernance' },
];

/** Modules livrés et que le profil a le droit d'ouvrir. */
export function availableModules(profile: Profile | null): AppModule[] {
  return MODULES.filter((m) => m.href && (!m.permission || can(profile, m.permission)));
}

/** Modules pas encore livrés (présentés « À venir » sur le hub). */
export function upcomingModules(): AppModule[] {
  return MODULES.filter((m) => !m.href);
}
