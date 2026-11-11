import { Inject, Injectable } from '@nestjs/common';
import { ActorContext, CLOCK, Clock, DomainError } from '../../../../shared-kernel';
import { AUDIT_RECORDER, AuditAction, AuditRecorder } from '../../../audit';
import { decideFor } from '../../domain/access-context';
import { RESOURCES } from '../../domain/permission-catalog';
import { Scope } from '../../domain/roles';
import type { AccessContext } from '../access-types';
import { ADMIN_EXPORT_HEADERS, AdminExportKind, DEFAULT_SESSION_DAYS, MAX_SESSION_DAYS, MAX_SESSION_ROWS, MAX_USER_ROWS } from './admin-export-spec';
import { toCsv } from './csv';
import { ROLE_CATALOG_READER, RoleCatalogReader } from './user-view';

/**
 * Exports d'administration pour les audits (Lot C, décision D66) : les utilisateurs, les droits (rôles et permissions) et les sessions, en CSV.
 *
 * **Réservés au Super administrateur** (permission `iam.export.read` en portée Tous), **second facteur récent exigé**, **chaque export tracé dans l'audit avant d'être
 * remis** (si la trace échoue, rien n'est remis), et **aucun secret dans le fichier** : jamais de hachage de mot de passe, de secret du second facteur, de code de secours
 * ni de jeton. Le lecteur ci-dessous ne SÉLECTIONNE que des colonnes sûres : un secret ne peut pas fuiter par oubli d'un filtre.
 */
export { ADMIN_EXPORT_HEADERS, ADMIN_EXPORT_KINDS, DEFAULT_SESSION_DAYS, MAX_SESSION_DAYS, MAX_SESSION_ROWS, MAX_USER_ROWS } from './admin-export-spec';
export type { AdminExportKind } from './admin-export-spec';

export interface ExportedUserRow {
  id: string;
  email: string;
  displayName: string;
  status: string;
  roles: string[];
  managerEmail: string | null;
  mfaEnabled: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

export interface ExportedSessionRow {
  id: string;
  userEmail: string;
  userName: string;
  loggedInAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  absoluteExpiresAt: Date;
  loggedOutAt: Date | null;
  revokedAt: Date | null;
  revokedReason: string | null;
  ipAddress: string;
  device: string;
  riskLevel: string;
  mfaVerified: boolean;
}

/** Lecture seule des données exportées : renvoie au plus `limit + 1` lignes, pour que l'appelant sache si la limite est dépassée. */
export interface AdminExportReader {
  users(limit: number): Promise<ExportedUserRow[]>;
  sessions(since: Date, limit: number): Promise<ExportedSessionRow[]>;
}
export const ADMIN_EXPORT_READER = Symbol('AdminExportReader');

export interface AdminExportResult {
  csv: string;
  fileName: string;
  rows: number;
}

const STATUS_LABEL: Record<string, string> = { ACTIVE: 'Actif', PENDING: 'Invitation en attente', LOCKED: 'Verrouillé', DISABLED: 'Désactivé' };
const SCOPE_LABEL: Record<string, string> = { OWN: 'Propre', TEAM: 'Équipe', ALL: 'Tous' };
const iso = (date: Date | null): string => (date ? date.toISOString() : '');
/** Horodatage de nom de fichier : sans deux-points (interdits sous Windows). */
const stamp = (date: Date): string => date.toISOString().slice(0, 16).replace(':', 'h').replace('T', '_');

/** Fin d'une session au moment de l'export : active, déconnexion, révoquée (avec son motif) ou expirée. */
export function sessionEnd(row: Pick<ExportedSessionRow, 'expiresAt' | 'absoluteExpiresAt' | 'loggedOutAt' | 'revokedAt' | 'revokedReason'>, now: Date): { endedAt: Date | null; reason: string } {
  if (row.loggedOutAt) return { endedAt: row.loggedOutAt, reason: 'Déconnexion' };
  if (row.revokedAt) return { endedAt: row.revokedAt, reason: row.revokedReason ? `Révoquée : ${row.revokedReason}` : 'Révoquée' };
  const expiry = row.expiresAt < row.absoluteExpiresAt ? row.expiresAt : row.absoluteExpiresAt;
  if (expiry <= now) return { endedAt: expiry, reason: 'Expirée' };
  return { endedAt: null, reason: 'Active' };
}

@Injectable()
export class ExportAdminDataHandler {
  constructor(
    @Inject(ADMIN_EXPORT_READER) private readonly reader: AdminExportReader,
    @Inject(ROLE_CATALOG_READER) private readonly roles: RoleCatalogReader,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: { kind: AdminExportKind; days?: number; access: AccessContext; actor: ActorContext }): Promise<AdminExportResult> {
    // Défense en profondeur : la route exige déjà la permission en portée Tous ; le cas d'usage ne se fie pas au seul contrôleur.
    const decision = decideFor(command.access, 'iam.export.read', undefined);
    if (!decision.allowed || decision.scope !== Scope.All) throw new DomainError('FORBIDDEN', 'Les exports d’administration sont réservés au Super administrateur');
    const now = this.clock.now();
    const days = command.days ?? DEFAULT_SESSION_DAYS;
    if (command.kind === 'sessions' && (!Number.isInteger(days) || days < 1 || days > MAX_SESSION_DAYS)) {
      throw new DomainError('VALIDATION', `La période doit être de 1 à ${MAX_SESSION_DAYS} jours`);
    }

    const built = command.kind === 'users' ? await this.users() : command.kind === 'rights' ? await this.rights() : await this.sessions(now, days);
    const fileName = `investally-${{ users: 'utilisateurs', rights: 'droits', sessions: 'sessions' }[command.kind]}-${stamp(now)}.csv`;
    // La trace d'abord : si elle échoue, rien n'est remis. On y inscrit ce qui a été remis (nature, nombre de lignes, période), jamais le contenu.
    await this.audit.record({
      actor: command.actor,
      module: 'iam',
      entityType: 'AdminExport',
      entityId: command.kind,
      action: AuditAction.Export,
      newValue: { export: command.kind, format: 'csv', rows: built.rows, fileName, ...(command.kind === 'sessions' ? { days } : {}) },
    });
    return { csv: built.csv, fileName, rows: built.rows };
  }

  private async users(): Promise<{ csv: string; rows: number }> {
    const rows = await this.reader.users(MAX_USER_ROWS);
    if (rows.length > MAX_USER_ROWS) throw new DomainError('VALIDATION', `Plus de ${MAX_USER_ROWS} utilisateurs : l’export est refusé plutôt que tronqué`);
    const labels = new Map((await this.roles.list()).map((role) => [role.code, role.label]));
    return {
      rows: rows.length,
      csv: toCsv(
        ADMIN_EXPORT_HEADERS.users,
        rows.map((u) => [u.id, u.email, u.displayName, STATUS_LABEL[u.status] ?? u.status, [...u.roles].sort().join(' | '), [...u.roles].sort().map((code) => labels.get(code) ?? code).join(' | '), u.managerEmail, u.mfaEnabled, iso(u.lastLoginAt), iso(u.createdAt)]),
      ),
    };
  }

  private async rights(): Promise<{ csv: string; rows: number }> {
    const roles = await this.roles.list();
    const resourceLabel = (module: string, resource: string) => RESOURCES.find((r) => r.module === module && r.resource === resource)?.label ?? '';
    const lines = roles.flatMap((role) =>
      [...role.permissions].sort((a, b) => a.code.localeCompare(b.code)).map((permission) => {
        const [module = '', resource = '', ...action] = permission.code.split('.');
        return [role.code, role.label, role.mfaRequired, permission.code, module, resource, resourceLabel(module, resource), action.join('.'), SCOPE_LABEL[permission.scope] ?? permission.scope];
      }),
    );
    return { rows: lines.length, csv: toCsv(ADMIN_EXPORT_HEADERS.rights, lines) };
  }

  private async sessions(now: Date, days: number): Promise<{ csv: string; rows: number }> {
    const since = new Date(now.getTime() - days * 24 * 3_600_000);
    const rows = await this.reader.sessions(since, MAX_SESSION_ROWS);
    if (rows.length > MAX_SESSION_ROWS) throw new DomainError('VALIDATION', `Plus de ${MAX_SESSION_ROWS} sessions sur ${days} jours : réduisez la période`);
    return {
      rows: rows.length,
      csv: toCsv(
        ADMIN_EXPORT_HEADERS.sessions,
        rows.map((s) => {
          const end = sessionEnd(s, now);
          return [s.id, s.userEmail, s.userName, iso(s.loggedInAt), iso(s.lastSeenAt), iso(end.endedAt), end.reason, s.ipAddress, s.device, s.riskLevel, s.mfaVerified];
        }),
      ),
    };
  }
}
