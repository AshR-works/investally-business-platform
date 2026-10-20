import { ActorContext } from '../../../shared-kernel';

export enum AuditAction {
  Create = 'CREATE',
  Update = 'UPDATE',
  Delete = 'DELETE',
  View = 'VIEW',
  Download = 'DOWNLOAD',
  Export = 'EXPORT',
  Login = 'LOGIN',
  Logout = 'LOGOUT',
}

/** Entrée immuable du journal : qui, quoi, quand, d'où, avant, après. */
export interface AuditEntry {
  id: string;
  actor: ActorContext;
  module: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  createdAt: Date;
}
