/**
 * Le jeton d'invitation est dans le FRAGMENT de l'URL (`#token=…`) : le navigateur ne l'envoie ni au serveur ni dans
 * l'en-tête Referer. On le lit une fois, puis on efface aussitôt le fragment de la barre d'adresse et de l'historique.
 */
export function parseInvitationFragment(hash: string): string | null {
  if (!hash.startsWith('#')) return null; // jamais depuis le chemin ou la requête
  const params = new URLSearchParams(hash.slice(1));
  const token = params.get('token');
  if (!token || token.length > 200 || !/^[A-Za-z0-9_-]+$/.test(token)) return null;
  return token;
}
