/**
 * Faire de `managerId` le responsable de `userId` crée-t-il un cycle hiérarchique ?
 * `ancestorsOfManager` : les responsables successifs de `managerId` (son responsable, puis le responsable de celui-ci…).
 * Un cycle fausserait la portée « Équipe » et boucle à l'infini dans toute remontée de la hiérarchie.
 */
export function createsCycle(userId: string, managerId: string, ancestorsOfManager: readonly string[]): boolean {
  return managerId === userId || ancestorsOfManager.includes(userId);
}

/** Profondeur maximale de remontée hiérarchique : au-delà, la hiérarchie est considérée comme corrompue (refus). */
export const MAX_HIERARCHY_DEPTH = 20;
