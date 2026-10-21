/** Sélection persistante (EXD-02) : ensemble d'identifiants, conservé d'une page à l'autre jusqu'à désélection. */
export type Selection = ReadonlySet<string>;

/** Ajoute l'identifiant s'il n'y est pas, le retire sinon (renvoie un nouvel ensemble). */
export function toggleId(selection: Selection, id: string): Set<string> {
  const next = new Set(selection);
  if (!next.delete(id)) next.add(id);
  return next;
}

/** Vrai si tous les identifiants donnés sont sélectionnés (et qu'il y en a au moins un). */
export function allSelected(selection: Selection, ids: readonly string[]): boolean {
  return ids.length > 0 && ids.every((id) => selection.has(id));
}

/** Vrai si une partie seulement des identifiants est sélectionnée (case d'en-tête « indéterminée »). */
export function someSelected(selection: Selection, ids: readonly string[]): boolean {
  return ids.some((id) => selection.has(id)) && !allSelected(selection, ids);
}

/** Sélectionne ou désélectionne tous les identifiants donnés, sans toucher à la sélection des autres pages. */
export function setMany(selection: Selection, ids: readonly string[], selected: boolean): Set<string> {
  const next = new Set(selection);
  for (const id of ids) {
    if (selected) next.add(id);
    else next.delete(id);
  }
  return next;
}
