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
  LoginFailed = 'LOGIN_FAILED',
  AccessDenied = 'ACCESS_DENIED',
  PasswordChange = 'PASSWORD_CHANGE',
  /** Demande, émission ou usage d'un lien de réinitialisation de mot de passe. */
  PasswordReset = 'PASSWORD_RESET',
  MfaChange = 'MFA_CHANGE',
  RoleChange = 'ROLE_CHANGE',
  SessionRevoke = 'SESSION_REVOKE',
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
