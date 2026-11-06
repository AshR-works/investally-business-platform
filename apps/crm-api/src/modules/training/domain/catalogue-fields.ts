import { DomainError } from '../../../shared-kernel';

/** État d'un élément du catalogue : on archive ou on désactive, on ne supprime jamais (les sessions passées doivent le retrouver). */
export type CatalogueStatus = 'ACTIVE' | 'ARCHIVED';

/** Texte obligatoire : espaces nettoyés, longueur bornée. */
export function requiredText(raw: string | undefined | null, label: string, max: number): string {
  const value = (raw ?? '').trim().replace(/\s+/g, ' ');
  if (!value) throw new DomainError('VALIDATION', `${label} est obligatoire`);
  if (value.length > max) throw new DomainError('VALIDATION', `${label} ne peut dépasser ${max} caractères`);
  return value;
}

/** Texte facultatif : vide = absent (`null`). Les retours à la ligne sont conservés. */
export function optionalText(raw: string | undefined | null, label: string, max: number): string | null {
  const value = (raw ?? '').trim();
  if (!value) return null;
  if (value.length > max) throw new DomainError('VALIDATION', `${label} ne peut dépasser ${max} caractères`);
  return value;
}

/** Clé de comparaison pour l'unicité d'un nom : sans casse. */
export function keyOf(value: string): string {
  return value.toLocaleLowerCase('fr');
}

/** Un élément archivé n'accepte plus aucune modification (il faut d'abord le réactiver). */
export function assertActive(status: CatalogueStatus, label: string): void {
  if (status === 'ARCHIVED') throw new DomainError('INVARIANT_VIOLATION', `${label} est archivé : réactivez-le avant de le modifier`);
}
