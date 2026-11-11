/**
 * Ce que le serveur et l'interface partagent des exports d'administration (Lot C, D66) : les types d'export, leurs limites et les en-têtes des fichiers.
 * Fichier **sans dépendance ni décorateur** : l'interface (et ses tests) le lit pour décrire le contenu, et un test garde les deux côtés d'accord.
 */
export type AdminExportKind = 'users' | 'rights' | 'sessions';
export const ADMIN_EXPORT_KINDS: readonly AdminExportKind[] = ['users', 'rights', 'sessions'];

/** Garde-fous de volume : au-delà, l'export est refusé (réduire la période) plutôt que tronqué en silence (un audit tronqué trompe). */
export const MAX_USER_ROWS = 10_000;
export const MAX_SESSION_ROWS = 50_000;
export const DEFAULT_SESSION_DAYS = 90;
export const MAX_SESSION_DAYS = 365;

/** En-têtes des trois fichiers (lus par l'interface). */
export const ADMIN_EXPORT_HEADERS: Record<AdminExportKind, readonly string[]> = {
  users: ['Identifiant', 'E-mail', 'Nom', 'Statut', 'Rôles', 'Rôles (libellés)', 'Responsable (e-mail)', 'Second facteur actif', 'Dernière connexion', 'Créé le'],
  rights: ['Rôle', 'Rôle (libellé)', 'Second facteur exigé', 'Permission', 'Module', 'Ressource', 'Ressource (libellé)', 'Action', 'Portée'],
  sessions: ['Session', 'E-mail', 'Nom', 'Connexion', 'Dernière activité', 'Fin', 'État ou motif de fin', 'Adresse IP', 'Appareil', 'Niveau de risque', 'Second facteur vérifié'],
};
