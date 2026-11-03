/** Part de la largeur du tableau réservée aux colonnes quand une case de sélection occupe 3 rem à gauche (le reste est la marge de la case). */
export const SELECTION_SHARE = 93;

/**
 * Largeurs fixes des colonnes d'un tableau, en pourcentage : chaque colonne reçoit sa part relative (`weight`, 1 par défaut) de la largeur
 * disponible, quel que soit son contenu. Trier ou changer de page ne déplace donc jamais une colonne.
 */
export function columnWidths(weights: readonly (number | undefined)[], hasSelection: boolean): string[] {
  const parts = weights.map((w) => (w !== undefined && w > 0 ? w : 1));
  const total = parts.reduce((sum, w) => sum + w, 0);
  const share = hasSelection ? SELECTION_SHARE : 100;
  return parts.map((w) => `${((w / total) * share).toFixed(2)}%`);
}
