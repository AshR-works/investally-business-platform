// API publique du module Audit : seul point d'entrée autorisé pour les autres modules.
export { AuditAction } from './domain/audit-entry';
export { AUDIT_RECORDER } from './application/audit-recorder';
export type { AuditRecorder, AuditRecord } from './application/audit-recorder';
