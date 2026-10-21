import { Inject, Injectable } from '@nestjs/common';
import {
  ActorContext, CLOCK, Clock, DomainError, ID_GENERATOR, IdGenerator, UNIT_OF_WORK, UnitOfWork,
} from '../../../shared-kernel';
import { AUDIT_RECORDER, AuditAction, AuditRecorder } from '../../audit';
import {
  PASSWORD_HISTORY_REPOSITORY, PasswordHistoryRepository, USER_REPOSITORY, UserRepository,
} from '../domain/auth-repositories';
import { Email } from '../domain/email';
import { checkPasswordPolicy } from '../domain/password-policy';
import { RoleCode } from '../domain/roles';
import { User } from '../domain/user';
import { PASSWORD_HASHER, PasswordHasher } from './ports';

/**
 * Création directe d'un compte actif avec mot de passe (outil de démarrage et tests ; le parcours normal est
 * l'invitation).
 */
export interface CreateUserCommand {
  email: string;
  displayName: string;
  password: string;
  roles: readonly RoleCode[];
  managerId?: string | null;
  actor: ActorContext;
}

/** Compte créé : identifiant, adresse et rôles. */
export interface CreatedUser {
  id: string;
  email: string;
}

/**
 * Création d'un compte actif avec mot de passe. Use case INTERNE en S3.1 : aucune API publique
 * (l'administration des utilisateurs arrive en S3.3 ; le premier SuperAdmin est amorcé en S3.2).
 */
@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HISTORY_REPOSITORY) private readonly history: PasswordHistoryRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  /**
   * Vérifie la politique de mot de passe et l'unicité de l'adresse, crée le compte, ses rôles et son historique, et
   * l'audite.
   */
  async execute(command: CreateUserCommand): Promise<CreatedUser> {
    const email = Email.of(command.email);
    const displayName = command.displayName.trim();
    if (displayName.length === 0 || displayName.length > 200) {
      throw new DomainError('VALIDATION', 'Le nom doit contenir entre 1 et 200 caractères');
    }

    const problems = checkPasswordPolicy(command.password, { email: email.value, displayName });
    if (problems.length > 0) {
      throw new DomainError('VALIDATION', `Mot de passe refusé : ${problems.join(' ; ')}`);
    }
    if (command.roles.length === 0) {
      throw new DomainError('VALIDATION', 'Au moins un rôle est obligatoire');
    }

    const passwordHash = await this.hasher.hash(command.password);

    return this.unitOfWork.run(async () => {
      if (await this.users.emailExists(email.key)) {
        throw new DomainError('CONFLICT', 'Un compte existe déjà pour cette adresse e-mail');
      }
      const now = this.clock.now();
      const user = User.create({
        id: this.ids.next(), email, displayName, passwordHash, managerId: command.managerId ?? null, now,
      });
      await this.users.save(user);
      await this.history.add({ id: this.ids.next(), userId: user.id, passwordHash, createdAt: now });
      await this.users.assignRoles(user.id, command.roles, command.actor.userId);

      await this.audit.record({
        actor: command.actor,
        module: 'iam',
        entityType: 'User',
        entityId: user.id,
        action: AuditAction.Create,
        // Jamais de mot de passe ni de hachage dans l'audit.
        newValue: { email: email.value, displayName, roles: [...command.roles], managerId: command.managerId ?? null },
      });
      return { id: user.id, email: email.value };
    });
  }
}
