/**
 * Adresse d'écoute de l'API. Par défaut **127.0.0.1** : seul un serveur web de la même machine la joint, elle n'est jamais exposée directement.
 * Dans un conteneur, le serveur web est un AUTRE conteneur : l'image positionne `API_HOST=0.0.0.0` (écoute sur le réseau interne de la composition,
 * sans port publié sur la machine hôte). Toute valeur qui n'est pas une adresse IPv4 est refusée : une faute de frappe ne doit jamais ouvrir l'API.
 */
export function listenAddress(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.API_HOST?.trim();
  if (!raw) return '127.0.0.1';
  const octets = raw.split('.');
  const valid = octets.length === 4 && octets.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
  if (!valid) throw new Error(`API_HOST doit être une adresse IPv4 (reçu « ${raw} »)`);
  return raw;
}
