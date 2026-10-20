import { Inject, Injectable } from '@nestjs/common';
import { ActorContext, CLOCK, Clock, DomainError, UNIT_OF_WORK, UnitOfWork } from '../../../../shared-kernel';
import { AUDIT_RECORDER, AuditAction, AuditRecorder } from '../../../audit';
import {
  REFRESH_TOKEN_REPOSITORY, RefreshTokenRepository, SESSION_REPOSITORY, SessionRepository, USER_REPOSITORY, UserRepository,
} from '../../domain/auth-repositories';
import { MAX_HIERARCHY_DEPTH, createsCycle } from '../../domain/hierarchy';
import { RoleCode } from '../../domain/roles';
import { UserStatus } from '../../domain/user';
import { parseRoles } from './invitations.use-cases';
import { UserView, toUserView } from './user-view';

/** Toute opération qui peut retirer un SuperAdmin actif passe par cette vérification, sous verrou. */
async function assertNotLastSuperAdmin(users: UserRepository): Promise<void> {
  await users.lockSuperAdminInvariant();
  if ((await users.countActiveSuperAdmins()) <= 1) {
    throw new DomainError('INVARIANT_VIOLATION', 'Opération refusée : il doit toujours rester au moins un SuperAdmin actif');
  }
}

export interface UpdateUserCommand {
  userId: string;
  displayName?: string;
  /** `undefined` : inchangé ; `null` : retirer le responsable. */
  managerId?: string | null;
  actor: ActorContext;
}

@Injectable()
export class UpdateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: UpdateUserCommand): Promise<UserView> {
    if (command.displayName === undefined && command.managerId === undefined) {
      throw new DomainError('VALIDATION', 'Rien à modifier : indiquez un nom ou un responsable');
    }
    return this.unitOfWork.run(async () => {
      const user = await this.users.lockById(command.userId);
      if (!user) throw new DomainError('NOT_FOUND', 'Utilisateur introuvable');
      const before = { displayName: user.displayName, managerId: user.managerId };

      if (command.displayName !== undefined) user.rename(command.displayName);
      if (command.managerId !== undefined) {
        if (command.managerId !== null) {
          if (!(await this.users.findById(command.managerId))) throw new DomainError('NOT_FOUND', 'Responsable introuvable');
          const ancestors = await this.users.managerChainOf(command.managerId, MAX_HIERARCHY_DEPTH + 1);
          if (ancestors.length > MAX_HIERARCHY_DEPTH) throw new DomainError('INVARIANT_VIOLATION', 'Hiérarchie trop profonde ou corrompue');
          if (createsCycle(user.id, command.managerId, ancestors)) {
            throw new DomainError('INVARIANT_VIOLATION', 'Ce rattachement créerait un cycle dans la hiérarchie');
          }
        }
        user.assignManager(command.managerId);
      }
      await this.users.save(user);
      await this.audit.record({
        actor: command.actor, module: 'iam', entityType: 'User', entityId: user.id, action: AuditAction.Update,
        oldValue: before, newValue: { displayName: user.displayName, managerId: user.managerId },
      });
      return toUserView(user, await this.users.roleCodesOf(user.id));
    });
  }
}

/** Désactive (ou réactive) un compte. La désactivation coupe immédiatement toutes les sessions et tous les jetons. */
@Injectable()
export class SetUserStatusUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokens: RefreshTokenRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: { userId: string; enabled: boolean; actor: ActorContext }): Promise<UserView> {
    if (!command.enabled && command.actor.userId !== null && command.actor.userId === command.userId) {
      throw new DomainError('FORBIDDEN', 'Vous ne pouvez pas désactiver votre propre compte');
    }
    return this.unitOfWork.run(async () => {
      const now = this.clock.now();
      const user = await this.users.lockById(command.userId);
      if (!user) throw new DomainError('NOT_FOUND', 'Utilisateur introuvable');
      const before = user.status;

      let sessionsRevoked = 0;
      if (command.enabled) {
        user.enable();
      } else {
        const roles = await this.users.roleCodesOf(user.id);
        if (roles.includes(RoleCode.SuperAdmin) && user.status === UserStatus.Active) await assertNotLastSuperAdmin(this.users);
        user.disable();
        const revoked = await this.sessions.revokeAllOfUserExcept(user.id, null, now, 'Compte désactivé');
        for (const sessionId of revoked) await this.refreshTokens.revokeBySession(sessionId, now);
        sessionsRevoked = revoked.length;
      }
      await this.users.save(user);
      await this.audit.record({
        actor: command.actor, module: 'iam', entityType: 'User', entityId: user.id, action: AuditAction.Update,
        oldValue: { status: before }, newValue: { status: user.status, sessionsRevoked },
      });
      return toUserView(user, await this.users.roleCodesOf(user.id));
    });
  }
}

/**
 * Remplace les rôles d'un utilisateur. Interdit pour soi-même (aucune auto-élévation, SuperAdmin compris), et refusé
 * s'il retire le rôle SuperAdmin au dernier SuperAdmin actif. Les droits étant résolus à chaque requête, l'effet est immédiat.
 */
@Injectable()
export class AssignRolesUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: { userId: string; roles: readonly string[]; actor: ActorContext }): Promise<UserView> {
    if (command.actor.userId !== null && command.actor.userId === command.userId) {
      throw new DomainError('FORBIDDEN', 'Vous ne pouvez pas modifier vos propres rôles : un autre SuperAdmin doit le faire');
    }
    const roles = parseRoles(command.roles);

    return this.unitOfWork.run(async () => {
      const user = await this.users.lockById(command.userId);
      if (!user) throw new DomainError('NOT_FOUND', 'Utilisateur introuvable');

      const before = await this.users.roleCodesOf(user.id);
      const removesSuperAdmin = before.includes(RoleCode.SuperAdmin) && !roles.includes(RoleCode.SuperAdmin);
      if (removesSuperAdmin && user.status === UserStatus.Active) await assertNotLastSuperAdmin(this.users);

      await this.users.replaceRoles(user.id, roles, command.actor.userId);
      await this.audit.record({
        actor: command.actor, module: 'iam', entityType: 'User', entityId: user.id, action: AuditAction.RoleChange,
        oldValue: { roles: [...before].sort() },
        newValue: {
          roles: [...roles].sort(),
          added: roles.filter((role) => !before.includes(role)).sort(),
          removed: before.filter((role) => !roles.includes(role)).sort(),
        },
      });
      return toUserView(user, roles);
    });
  }
}
