/** Qui agit, depuis où : porté de la requête jusqu'au journal d'audit. */
export interface ActorContext {
  userId: string | null;
  sessionId: string | null;
  ipAddress: string;
  device: string;
}
