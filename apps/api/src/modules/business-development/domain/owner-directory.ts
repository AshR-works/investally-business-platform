/** Une personne qui peut porter des entreprises (utilisateur actif au rôle commercial). */
export interface OwnerSummary {
  id: string;
  name: string;
}

/**
 * Port de l'annuaire des propriétaires : qui peut recevoir une entreprise, et comment s'appelle un propriétaire. Il lit
 * l'identité sans que le module commercial dépende du modèle des utilisateurs.
 */
export interface OwnerDirectory {
  /** Les utilisateurs actifs au rôle commercial parmi `ids` (tous si `ids` est absent), triés par nom. */
  candidates(ids?: readonly string[]): Promise<OwnerSummary[]>;
  /** Le nom de chaque identifiant connu (les inconnus sont absents du résultat). */
  names(ids: readonly string[]): Promise<ReadonlyMap<string, string>>;
}

export const OWNER_DIRECTORY = Symbol('OwnerDirectory');
