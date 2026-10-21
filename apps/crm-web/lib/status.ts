import type { Tone } from '../components/data/badge';

/** Libellé et teinte d'un statut (le sens reste porté par le texte). */
export interface StatusStyle {
  label: string;
  tone: Tone;
}

/** Statuts d'une entreprise cible, tels que l'API les fournit. */
export const COMPANY_STATUS: Record<string, StatusStyle> = {
  TARGET: { label: 'Cible', tone: 'neutral' },
  CONTACTED: { label: 'Contactée', tone: 'info' },
  QUALIFIED: { label: 'Qualifiée', tone: 'warn' },
  CLIENT: { label: 'Cliente', tone: 'ok' },
  ARCHIVED: { label: 'Archivée', tone: 'neutral' },
};

/** Statuts d'un compte utilisateur. */
export const USER_STATUS: Record<string, StatusStyle> = {
  ACTIVE: { label: 'Actif', tone: 'ok' },
  PENDING: { label: 'Invitation en attente', tone: 'warn' },
  LOCKED: { label: 'Verrouillé', tone: 'bad' },
  DISABLED: { label: 'Désactivé', tone: 'neutral' },
};

/** Style d'un statut ; un statut inconnu garde son code brut en teinte neutre (jamais d'erreur d'affichage). */
export function statusStyle(table: Record<string, StatusStyle>, code: string): StatusStyle {
  return table[code] ?? { label: code, tone: 'neutral' };
}
