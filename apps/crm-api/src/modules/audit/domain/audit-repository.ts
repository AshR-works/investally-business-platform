import { AuditEntry } from './audit-entry';

/** Append-only : aucune méthode de modification ni de suppression. */
export interface AuditRepository {
  append(entry: AuditEntry): Promise<void>;
  listByEntity(entityType: string, entityId: string): Promise<AuditEntry[]>;
}

export const AUDIT_REPOSITORY = Symbol('AuditRepository');
