import { AuditEntry } from './audit-entry';

/** Critères de lecture des événements de connexion d'UN utilisateur, dans une fenêtre de dates bornée. */
export interface LoginEventQuery {
  userId: string;
  /** Début de la fenêtre (inclus). */
  since: Date;
  /** Fin de la fenêtre (exclue) : sert de curseur pour la page suivante. */
  before?: Date;
  limit: number;
}

/** Append-only : aucune méthode de modification ni de suppression. */
export interface AuditRepository {
  append(entry: AuditEntry): Promise<void>;
  listByEntity(entityType: string, entityId: string): Promise<AuditEntry[]>;
  /** Connexions réussies et échouées de l'utilisateur, de la plus récente à la plus ancienne. */
  listLoginEvents(query: LoginEventQuery): Promise<AuditEntry[]>;
}

export const AUDIT_REPOSITORY = Symbol('AuditRepository');
