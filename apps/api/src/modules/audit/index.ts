// API publique du module Audit : seul point d'entrée autorisé pour les autres modules.
export { AuditAction } from './domain/audit-entry';
export { AUDIT_RECORDER } from './application/audit-recorder';
export type { AuditRecorder, AuditRecord } from './application/audit-recorder';
export { AUDIT_READER, LOGIN_HISTORY_DEFAULT_LIMIT, LOGIN_HISTORY_MAX_LIMIT, LOGIN_HISTORY_WINDOW_DAYS } from './application/audit-reader';
export type { AuditReader, LoginEvent, LoginHistoryPage } from './application/audit-reader';
