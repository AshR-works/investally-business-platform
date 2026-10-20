import { ActorContext } from './actor-context';

/** Forme minimale d'une requête HTTP (sans dépendre d'Express) pour construire le contexte d'audit. */
export interface RequestLike {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}

const MAX_DEVICE_LENGTH = 300;

/** Qui agit, depuis où : IP et appareil de la requête (l'identité est ajoutée une fois l'utilisateur authentifié). */
export function actorContextFrom(req: RequestLike, identity: { userId: string | null; sessionId: string | null } = { userId: null, sessionId: null }): ActorContext {
  const userAgent = req.headers['user-agent'];
  return {
    userId: identity.userId,
    sessionId: identity.sessionId,
    ipAddress: req.ip ?? 'unknown',
    device: String(Array.isArray(userAgent) ? userAgent[0] : userAgent ?? 'unknown').slice(0, MAX_DEVICE_LENGTH),
  };
}
