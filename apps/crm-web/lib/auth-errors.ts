import { ApiError } from './api';

/** Durée (secondes) d'attente affichée après un refus pour trop de tentatives (la limite du serveur est d'une minute). */
export const RATE_LIMIT_WAIT_SECONDS = 60;

/** Vrai si le serveur refuse pour trop de tentatives (limitation de débit, HTTP 429). */
export function isRateLimited(error: unknown): boolean {
  return error instanceof ApiError && error.status === 429;
}

/**
 * Message à afficher pour un échec d'authentification : le message du serveur (identique pour un compte connu ou
 * inconnu, jamais enrichi ici), un texte propre à la limitation de débit, ou un texte de repli pour une panne réseau.
 */
export function authErrorMessage(error: unknown, fallback: string): string {
  if (isRateLimited(error)) return 'Trop de tentatives. Patientez avant de réessayer.';
  return error instanceof ApiError ? error.message : fallback;
}

/** Secondes restantes avant `until` (en millisecondes depuis l'époque), jamais négatives. */
export function secondsLeft(until: number, now: number): number {
  return Math.max(0, Math.ceil((until - now) / 1000));
}
