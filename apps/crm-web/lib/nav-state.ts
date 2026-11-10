import type { Domain } from './modules';

/**
 * État d'ouverture des domaines du menu (lot A) : une seule rubrique ouverte à la fois (accordéon), par défaut celle de la page courante.
 * `null` = rien de choisi à la main (la rubrique de la page courante est ouverte) ; `'none'` = tout est replié ; un domaine = celui que la personne a ouvert.
 * Le choix n'est PAS mémorisé : il se remet à zéro à chaque changement de page, donc une rubrique ouverte « pour voir » ne reste pas ouverte ensuite.
 */
export type OpenDomain = Domain | 'none' | null;

/** Le domaine est ouvert : celui que la personne a choisi, sinon celui de la page courante. */
export function isDomainOpen(manual: OpenDomain, active: Domain | null | undefined, domain: Domain): boolean {
  if (manual === 'none') return false;
  if (manual !== null) return manual === domain;
  return domain === active;
}

/** Après un clic sur l'en-tête d'un domaine : s'il est ouvert on le replie (tout est replié), sinon on l'ouvre et les autres se referment. */
export function toggleDomain(manual: OpenDomain, active: Domain | null | undefined, domain: Domain): OpenDomain {
  return isDomainOpen(manual, active, domain) ? 'none' : domain;
}
