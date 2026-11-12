import { PresenceDeclaration } from './presence';

/** Port de persistance des présences déclaratives (une par employé et par jour). */
export interface PresenceRepository {
  /** Crée ou met à jour ; une seconde déclaration du même jour (même employé) est un conflit : la base garantit l'unicité. */
  save(declaration: PresenceDeclaration): Promise<void>;
  find(employeeId: string, day: string): Promise<PresenceDeclaration | null>;
  /** Supprime la déclaration d'un employé pour un jour ; sans effet si elle n'existe pas. */
  remove(employeeId: string, day: string): Promise<void>;
  /** Déclarations dont le jour est dans [from, to] (bornes incluses), de ces employés (liste vide = aucune). Tri : jour, puis employé. */
  between(from: string, to: string, employeeIds: readonly string[]): Promise<PresenceDeclaration[]>;
}

export const PRESENCE_REPOSITORY = Symbol('PresenceRepository');
