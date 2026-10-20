import { Inject, Injectable } from '@nestjs/common';
import {
  APP_CONFIG, ActorContext, AppConfig, CLOCK, Clock, DomainError, ID_GENERATOR, IdGenerator, UNIT_OF_WORK, UnitOfWork,
} from '../../../../shared-kernel';
import { AUDIT_RECORDER, AuditAction, AuditRecorder } from '../../../audit';
import { EMAIL_SENDER, EmailSender } from '../../../notifications';
import {
  INVITATION_REPOSITORY, InvitationRepository, PASSWORD_HISTORY_REPOSITORY, PasswordHistoryRepository, USER_REPOSITORY,
  UserRepository,
} from '../../domain/auth-repositories';
import { Email } from '../../domain/email';
import { INVITATION_TTL_MS, evaluateInvitation } from '../../domain/invitation';
import { checkPasswordPolicy } from '../../domain/password-policy';
import { ROLES, RoleCode } from '../../domain/roles';
import { User, UserStatus } from '../../domain/user';
import { INVITATION_TOKEN_FACTORY, OpaqueTokenFactory, PASSWORD_HASHER, PasswordHasher } from '../ports';
import { UserView, toUserView } from './user-view';

const INVALID_LINK = 'Lien invalide ou expiré';
const KNOWN_ROLES: ReadonlySet<string> = new Set(ROLES.map((role) => role.code));

/** Lien d'invitation : le jeton est dans le FRAGMENT (`#`), que le navigateur n'envoie ni au serveur ni dans l'en-tête Referer. */
export function invitationLink(publicUrl: string, token: string): string {
  return `${publicUrl}/invitation#token=${token}`;
}

function invitationEmail(displayName: string, link: string) {
  const name = displayName.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  return {
    subject: 'Invitation à Investally CRM',
    text:
      `Bonjour ${name},\n\n` +
      `Un compte Investally CRM a été créé pour vous. Pour l'activer, choisissez votre mot de passe en ouvrant ce lien ` +
      `(valable 48 heures, utilisable une seule fois) :\n\n${link}\n\n` +
      `Vous devrez ensuite configurer une application d'authentification : le second facteur est obligatoire.\n\n` +
      `Si vous n'attendiez pas ce message, ignorez-le : aucun accès n'est possible sans ce lien.\n`,
  };
}

export interface InviteUserCommand {
  email: string;
  displayName: string;
  roles: readonly string[];
  managerId?: string | null;
  actor: ActorContext;
}

export interface InvitationResult {
  user: UserView;
  /** `false` : le compte est créé mais l'e-mail n'a pas pu partir ; renvoyer l'invitation. */
  emailSent: boolean;
}

/** Vérifie et dédoublonne les rôles demandés (jamais un rôle inconnu). */
export function parseRoles(input: readonly string[]): RoleCode[] {
  const unique = [...new Set(input)];
  if (unique.length === 0) throw new DomainError('VALIDATION', 'Au moins un rôle est obligatoire');
  const unknown = unique.filter((role) => !KNOWN_ROLES.has(role));
  if (unknown.length > 0) throw new DomainError('VALIDATION', `Rôle inconnu : ${unknown[0].slice(0, 50)}`);
  return unique as RoleCode[];
}

/**
 * Crée un compte EN ATTENTE, sans mot de passe, et envoie un lien d'activation. Aucun mot de passe connu d'un tiers
 * n'existe donc avant que l'utilisateur ne l'ait choisi lui-même : ferme la limite « première inscription au MFA
 * protégée par le seul mot de passe » (dette D13).
 */
@Injectable()
export class InviteUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(INVITATION_REPOSITORY) private readonly invitations: InvitationRepository,
    @Inject(INVITATION_TOKEN_FACTORY) private readonly tokens: OpaqueTokenFactory,
    @Inject(EMAIL_SENDER) private readonly email: EmailSender,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async execute(command: InviteUserCommand): Promise<InvitationResult> {
    const email = Email.of(command.email);
    const roles = parseRoles(command.roles);
    const displayName = command.displayName.trim();
    if (displayName.length === 0 || displayName.length > 200) throw new DomainError('VALIDATION', 'Le nom doit contenir entre 1 et 200 caractères');

    const issued = this.tokens.generate();
    const created = await this.unitOfWork.run(async () => {
      if (await this.users.emailExists(email.key)) throw new DomainError('CONFLICT', 'Un compte existe déjà pour cette adresse e-mail');
      if (command.managerId && !(await this.users.findById(command.managerId))) throw new DomainError('NOT_FOUND', 'Responsable introuvable');

      const now = this.clock.now();
      const user = User.invite({ id: this.ids.next(), email, displayName, managerId: command.managerId ?? null, now });
      await this.users.save(user);
      await this.users.assignRoles(user.id, roles, command.actor.userId);

      const expiresAt = new Date(now.getTime() + INVITATION_TTL_MS);
      await this.invitations.save({
        id: this.ids.next(), userId: user.id, tokenHash: issued.hash, createdBy: command.actor.userId,
        createdAt: now, expiresAt, usedAt: null, revokedAt: null,
      });
      await this.audit.record({
        actor: command.actor, module: 'iam', entityType: 'User', entityId: user.id, action: AuditAction.Create,
        // Jamais le jeton : seulement l'événement et l'échéance.
        newValue: { email: email.value, displayName, roles, managerId: command.managerId ?? null, status: UserStatus.Pending, invitationExpiresAt: expiresAt.toISOString() },
      });
      return { user, expiresAt };
    });

    // Envoi HORS transaction : jamais d'appel externe pendant qu'une transaction est ouverte.
    const emailSent = await this.send(created.user, issued.token, command.actor);
    return { user: toUserView(created.user, roles), emailSent };
  }

  private async send(user: User, token: string, actor: ActorContext): Promise<boolean> {
    const message = invitationEmail(user.displayName, invitationLink(this.config.publicUrl, token));
    const result = await this.email.send({ to: user.email.value, ...message });
    if (!result.ok) {
      await this.audit.record({
        actor, module: 'iam', entityType: 'User', entityId: user.id, action: AuditAction.Update,
        newValue: { event: 'invitation_email_failed', reason: result.reason },
      });
    }
    return result.ok;
  }
}

/** Renvoie une invitation : les liens précédents sont révoqués, un nouveau lien de 48 h est envoyé. */
@Injectable()
export class ResendInvitationUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(INVITATION_REPOSITORY) private readonly invitations: InvitationRepository,
    @Inject(INVITATION_TOKEN_FACTORY) private readonly tokens: OpaqueTokenFactory,
    @Inject(EMAIL_SENDER) private readonly email: EmailSender,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async execute(command: { userId: string; actor: ActorContext }): Promise<{ emailSent: boolean }> {
    const issued = this.tokens.generate();
    const user = await this.unitOfWork.run(async () => {
      const found = await this.users.lockById(command.userId);
      if (!found) throw new DomainError('NOT_FOUND', 'Utilisateur introuvable');
      if (found.status !== UserStatus.Pending) throw new DomainError('CONFLICT', "Ce compte est déjà activé : il n'y a pas d'invitation à renvoyer");

      const now = this.clock.now();
      await this.invitations.revokeAllOfUser(found.id, now);
      await this.invitations.save({
        id: this.ids.next(), userId: found.id, tokenHash: issued.hash, createdBy: command.actor.userId,
        createdAt: now, expiresAt: new Date(now.getTime() + INVITATION_TTL_MS), usedAt: null, revokedAt: null,
      });
      await this.audit.record({
        actor: command.actor, module: 'iam', entityType: 'User', entityId: found.id, action: AuditAction.Update,
        newValue: { event: 'invitation_resent' },
      });
      return found;
    });

    const message = invitationEmail(user.displayName, invitationLink(this.config.publicUrl, issued.token));
    const result = await this.email.send({ to: user.email.value, ...message });
    return { emailSent: result.ok };
  }
}

type AcceptResult = { ok: true } | { ok: false };

/**
 * Activation du compte par l'utilisateur : il choisit son mot de passe grâce au lien (usage unique, 48 h).
 * Tous les liens non valides (inconnu, expiré, utilisé, révoqué) produisent le MÊME refus. Un mot de passe refusé par
 * la politique NE consomme PAS le lien : l'utilisateur peut réessayer.
 */
@Injectable()
export class AcceptInvitationUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(INVITATION_REPOSITORY) private readonly invitations: InvitationRepository,
    @Inject(PASSWORD_HISTORY_REPOSITORY) private readonly history: PasswordHistoryRepository,
    @Inject(INVITATION_TOKEN_FACTORY) private readonly tokens: OpaqueTokenFactory,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(command: { token: string; password: string; actor: ActorContext }): Promise<void> {
    const tokenHash = this.tokens.hashOf(command.token ?? '');
    const record = await this.invitations.findByHash(tokenHash);
    const now = this.clock.now();

    if (!record || evaluateInvitation(record, now) !== 'VALID') {
      await this.deny(command.actor, record?.id ?? 'unknown', record ? evaluateInvitation(record, now) : 'UNKNOWN');
      throw new DomainError('VALIDATION', INVALID_LINK);
    }

    const target = await this.users.findById(record.userId);
    if (!target || target.status !== UserStatus.Pending) {
      await this.deny(command.actor, record.id, 'NOT_PENDING');
      throw new DomainError('VALIDATION', INVALID_LINK);
    }

    // La politique est vérifiée AVANT de consommer le lien.
    const problems = checkPasswordPolicy(command.password, { email: target.email.value, displayName: target.displayName });
    if (problems.length > 0) throw new DomainError('VALIDATION', `Mot de passe refusé : ${problems.join(' ; ')}`);
    const passwordHash = await this.hasher.hash(command.password);

    const result = await this.unitOfWork.run((): Promise<AcceptResult> => this.activate(record.id, tokenHash, record.userId, passwordHash, command.actor));
    if (!result.ok) {
      await this.deny(command.actor, record.id, 'RACE_OR_STATE');
      throw new DomainError('VALIDATION', INVALID_LINK);
    }
  }

  private async activate(recordId: string, tokenHash: string, userId: string, passwordHash: string, actor: ActorContext): Promise<AcceptResult> {
    const now = this.clock.now();
    // Consommation atomique : deux acceptations simultanées du même lien, une seule passe.
    if (!(await this.invitations.consume(tokenHash, now))) return { ok: false };
    const user = await this.users.lockById(userId);
    if (!user || user.status !== UserStatus.Pending) return { ok: false };

    user.activateWithPassword(passwordHash, now);
    await this.users.save(user);
    await this.history.add({ id: this.ids.next(), userId: user.id, passwordHash, createdAt: now });
    await this.audit.record({
      actor: { ...actor, userId: user.id }, module: 'iam', entityType: 'User', entityId: user.id, action: AuditAction.Update,
      newValue: { event: 'invitation_accepted', invitationId: recordId },
    });
    return { ok: true };
  }

  private async deny(actor: ActorContext, entityId: string, reason: string): Promise<void> {
    await this.audit.record({
      actor, module: 'iam', entityType: 'UserInvitation', entityId, action: AuditAction.AccessDenied,
      newValue: { reason },
    });
  }
}
