import { api } from './api';

/**
 * Exports d'administration pour les audits (Lot C, D66) : utilisateurs, droits et sessions en CSV. Réservés au Super administrateur ; le second facteur récent est
 * redemandé par le client d'API quand le serveur l'exige ; chaque export est tracé dans l'audit par le serveur. Le fichier ne contient aucun secret.
 */
export type ExportKind = 'users' | 'rights' | 'sessions';

export interface ExportDefinition {
  kind: ExportKind;
  title: string;
  description: string;
  /** Ce que contient le fichier, en une phrase. */
  columns: string;
  /** Mot du nom de fichier (le serveur le choisit aussi : le client le recalcule pour enregistrer sous le même nom). */
  slug: string;
  /** Vrai : la période (en jours) se choisit. */
  hasPeriod: boolean;
}

export const EXPORTS: readonly ExportDefinition[] = [
  {
    kind: 'users', title: 'Utilisateurs', slug: 'utilisateurs', hasPeriod: false,
    description: 'Tous les comptes : identité, statut, rôles, responsable, second facteur actif, dernière connexion, date de création.',
    columns: 'Identifiant, e-mail, nom, statut, rôles (codes et libellés), responsable, second facteur actif, dernière connexion, créé le.',
  },
  {
    kind: 'rights', title: 'Droits', slug: 'droits', hasPeriod: false,
    description: 'La matrice des droits telle qu’enregistrée en base : une ligne par rôle et par permission, avec sa portée (Propre, Équipe, Tous).',
    columns: 'Rôle, libellé, second facteur exigé, permission, module, ressource, action, portée.',
  },
  {
    kind: 'sessions', title: 'Sessions', slug: 'sessions', hasPeriod: true,
    description: 'Les connexions de tous les comptes sur la période : qui, quand, depuis quelle adresse et quel appareil, et comment la session s’est terminée.',
    columns: 'Session, e-mail, nom, connexion, dernière activité, fin, état ou motif de fin, adresse IP, appareil, niveau de risque, second facteur vérifié.',
  },
];

/** Périodes proposées pour les sessions (en jours) ; 90 par défaut, 365 au plus (la limite du serveur). */
export const PERIODS = [
  { days: 7, label: '7 jours' },
  { days: 30, label: '30 jours' },
  { days: 90, label: '90 jours' },
  { days: 180, label: '180 jours' },
  { days: 365, label: '365 jours' },
] as const;
export const DEFAULT_PERIOD = 90;

/** Une période valide : entier de 1 à 365. */
export function validPeriod(days: number): boolean {
  return Number.isInteger(days) && days >= 1 && days <= 365;
}

/** Adresse de l'export : la période ne se transmet que pour les sessions. */
export function exportPath(kind: ExportKind, days = DEFAULT_PERIOD): string {
  return kind === 'sessions' ? `/admin/exports/sessions?days=${days}` : `/admin/exports/${kind}`;
}

/** Nom du fichier enregistré, daté à la minute, sans deux-points (interdits sous Windows) : `investally-sessions-2026-11-11_09h00.csv`. */
export function exportFileName(kind: ExportKind, now: Date = new Date()): string {
  const slug = EXPORTS.find((e) => e.kind === kind)!.slug;
  return `investally-${slug}-${now.toISOString().slice(0, 16).replace(':', 'h').replace('T', '_')}.csv`;
}

/** Télécharge l'export : le serveur contrôle le droit, le second facteur récent et trace l'export ; le fichier est enregistré par le navigateur. */
export async function downloadExport(kind: ExportKind, days = DEFAULT_PERIOD): Promise<string> {
  const blob = await api<Blob>(exportPath(kind, days), { blob: true });
  const fileName = exportFileName(kind);
  const url = URL.createObjectURL(new Blob([blob], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return fileName;
}
