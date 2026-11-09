/** Ce que le module RH a le droit de savoir d'un compte : son existence, son nom et son responsable (jamais d'e-mail ni de secret). */
export interface UserRef {
  id: string;
  displayName: string;
  /** Statut du compte (`ACTIVE`, `PENDING`, `LOCKED`, `DISABLED`). */
  status: string;
  /** Responsable du compte (`iam.users.manager_id`) : sert à signaler un écart avec l'organigramme RH, jamais à le modifier. */
  managerUserId: string | null;
}

/** Port de lecture des comptes d'accès : le module RH ne dépend pas du modèle des utilisateurs. */
export interface UserDirectory {
  find(id: string): Promise<UserRef | null>;
  findMany(ids: readonly string[]): Promise<UserRef[]>;
}

export const USER_DIRECTORY = Symbol('UserDirectory');
