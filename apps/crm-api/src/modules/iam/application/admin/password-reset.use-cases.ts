import { Inject, Injectable } from '@nestjs/common';
import {
  APP_CONFIG, ActorContext, AppConfig, CLOCK, Clock, DomainError, ID_GENERATOR, IdGenerator, UNIT_OF_WORK, UnitOfWork,
} from '../../../../shared-kernel';
import { AUDIT_RECORDER, AuditAction, AuditRecorder } from '../../../audit';
import { EMAIL_SENDER, EmailSender } from '../../../notifications';
import {
  INVITATION_REPOSITORY, InvitationRepository, PASSWORD_HISTORY_REPOSITORY, PasswordHistoryRepository,
  REFRESH_TOKEN_REPOSITORY, RefreshTokenRepository, SESSION_REPOSITORY, SessionRepository, USER_REPOSITORY, UserRepository,
} from '../../domain/auth-repositories';
import { Email } from '../../domain/email';
import {
  ADMIN_RESET_TTL_MS, InvitationPurpose, SELF_SERVICE_RESET_MAX_PER_HOUR, SELF_SERVICE_RESET_TTL_MS, evaluateInvitation,
} from '../../domain/invitation';
import { checkPasswordPolicy } from '../../domain/password-policy';
import { User, UserStatus } from '../../domain/user';
import { PASSWORD_HISTORY_DEPTH } from '../change-password.use-case';
import { INVITATION_TOKEN_FACTORY, OpaqueTokenFactory, PASSWORD_HASHER, PasswordHasher } from '../ports';

const INVALID_LINK = 'Lien invalide ou expiré';

/** Le jeton est dans le FRAGMENT (`#`) : ni envoyé au serveur, ni dans l'en-tête Referer. */
export function passwordResetLink(publicUrl: string, token: string): string {
  return `${publicUrl}/reset-password#token=${token}`;
}

/**
 * Retire les caractères de contrôle d'un nom avant de l'écrire dans un e-mail (pas d'injection d'en-têtes ni de
 * lignes).
 */
const cleanName = (name: string): string => name.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();

/**
 * Compose l'e-mail de réinitialisation (lien, durée de validité, rappel que le MFA est conservé, conduite à tenir si
 * la demande n'est pas la vôtre).
 */
function resetEmail(displayName: string, link: string, validity: string, byAdministrator: boolean) {
  return {
    subject: 'Réinitialisation de votre mot de passe Investally CRM',
    text:
      `Bonjour ${cleanName(displayName)},\n\n` +
      (byAdministrator
        ? `Un administrateur a demandé la réinitialisation de votre mot de passe Investally CRM.\n\n`
        : `Une réinitialisation de votre mot de passe Investally CRM a été demandée.\n\n`) +
      `Pour choisir un nouveau mot de passe, ouvrez ce lien (valable ${validity}, utilisable une seule fois) :\n\n${link}\n\n` +
      `Votre second facteur (application d'authentification) reste inchangé : il vous sera demandé à la connexion.\n\n` +
      `Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe actuel reste valable ` +
      `et personne ne peut entrer sans votre second facteur. Si cela se répète, prévenez un administrateur.\n`,
  };
}

/**
 * Compose l'e-mail de confirmation « votre mot de passe a été modifié » (date UTC, adresse IP) envoyé au titulaire.
 */
function passwordChangedEmail(displayName: string, when: Date, ipAddress: string) {
  return {
    subject: 'Votre mot de passe Investally CRM a été modifié',
    text:
      `Bonjour ${cleanName(displayName)},\n\n` +
      `Le mot de passe de votre compte Investally CRM a été modifié le ${when.toISOString()} (UTC), depuis l'adresse ${ipAddress.slice(0, 64)}. ` +
      `Toutes vos sessions ont été fermées.\n\n` +
      `Si ce n'était pas vous, prévenez immédiatement un administrateur.\n`,
  };
}

/** Un compte peut se réinitialiser seulement s'il est actif ou verrouillé ET possède déjà un mot de passe. */
function isResettable(user: User): boolean {
  return (user.status === UserStatus.Active || user.status === UserStatus.Locked) && user.passwordHash !== null;
}

/**
 * « Mot de passe oublié » (libre-service, route publique).
 *
 *  - Réponse **identique** que le compte existe ou non (aucune énumération) : ce cas d'usage ne signale jamais rien à
 *    l'appelant ; le contrôleur répond sans attendre son résultat, donc le temps de réponse ne révèle rien non plus.
 *  - Chaque demande est **auditée** (action PASSWORD_RESET, issue ISSUED / UNKNOWN / INELIGIBLE / THROTTLED, adresse IP et
 *    appareil), sans jamais journaliser l'adresse saisie quand elle ne correspond à aucun compte.
 *  - Au plus 3 liens par heure et par compte ; lien de 60 minutes, à usage unique ; les liens précédents sont révoqués.
 *  - Le lien ne donne **aucun accès** : il permet seulement de choisir un mot de passe ; le MFA reste exigé à la connexion.
 */
@Injectable()
export class RequestPasswordResetUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(INVITATION_REPOSITORY) private readonly links: InvitationRepository,
    @Inject(INVITATION_TOKEN_FACTORY) private readonly tokens: OpaqueTokenFactory,
    @Inject(EMAIL_SENDER) private readonly email: EmailSender,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /**
   * Traite une demande « mot de passe oublié » : ne signale jamais rien à l'appelant (anti-énumération), audite
   * toujours l'issue et envoie le lien seulement si le compte est éligible et sous le plafond.
   */
  async execute(command: { email: string; actor: ActorContext }): Promise<void> {
    const actor: ActorContext = { ...command.actor, userId: null, sessionId: null };
    let emailKey: string;
    try {
      emailKey = Email.of(command.email ?? '').key;
    } catch {
      await this.record(actor, 'unknown', 'UNKNOWN');
      return;
    }

    const issued = this.tokens.generate();
    const outcome = await this.unitOfWork.run(async () => {
      // Verrou de ligne : deux demandes simultanées pour un même compte ne dépassent pas le plafond.
      const user = await this.users.lockByEmailKey(emailKey);
      if (!user) return { kind: 'UNKNOWN' as const, userId: 'unknown' };
      if (!isResettable(user)) return { kind: 'INELIGIBLE' as const, userId: user.id };

      const now = this.clock.now();
      const recent = await this.links.countCreatedSince(user.id, InvitationPurpose.PasswordReset, new Date(now.getTime() - 60 * 60 * 1000));
      if (recent >= SELF_SERVICE_RESET_MAX_PER_HOUR) return { kind: 'THROTTLED' as const, userId: user.id };

      await this.links.revokeAllOfUser(user.id, now);
      const expiresAt = new Date(now.getTime() + SELF_SERVICE_RESET_TTL_MS);
      await this.links.save({
        id: this.ids.next(), userId: user.id, tokenHash: issued.hash, purpose: InvitationPurpose.PasswordReset,
        createdBy: null, createdAt: now, expiresAt, usedAt: null, revokedAt: null,
      });
      await this.record(actor, user.id, 'ISSUED', { expiresAt: expiresAt.toISOString() });
      return { kind: 'ISSUED' as const, userId: user.id, user };
    });

    if (outcome.kind !== 'ISSUED') {
      await this.record(actor, outcome.userId, outcome.kind);
      return;
    }

    // Envoi HORS transaction ; un échec est audité (jamais signalé à l'appelant).
    const message = resetEmail(outcome.user.displayName, passwordResetLink(this.config.publicUrl, issued.token), '60 minutes', false);
    const result = await this.email.send({ to: outcome.user.email.value, ...message });
    if (!result.ok) await this.record(actor, outcome.userId, 'EMAIL_FAILED', { reason: result.reason });
  }

  /** Écrit l'entrée d'audit d'une demande (issue : ISSUED, UNKNOWN, INELIGIBLE, THROTTLED, EMAIL_FAILED). */
  private record(actor: ActorContext, entityId: string, outcome: string, extra: Record<string, unknown> = {}): Promise<void> {
    return this.audit.record({
      actor, module: 'iam', entityType: 'User', entityId, action: AuditAction.PasswordReset,
      newValue: { event: 'password_reset_requested', outcome, ...extra },
    });
  }
}

/**
 * Réinitialisation déclenchée par un **administrateur** (permission `iam.user.reset_password` + MFA récent, contrôlés
 * par la route). Jamais pour soi-même. Lien de 48 h, à usage unique.
 */
@Injectable()
export class IssuePasswordResetUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(INVITATION_REPOSITORY) private readonly links: InvitationRepository,
    @Inject(INVITATION_TOKEN_FACTORY) private readonly tokens: OpaqueTokenFactory,
    @Inject(EMAIL_SENDER) private readonly email: EmailSender,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /**
   * Interdit pour soi-même ; refuse un compte en attente ou désactivé ; révoque les liens précédents, crée un lien de
   * 48 h, l'audite puis l'envoie.
   */
  async execute(command: { userId: string; actor: ActorContext }): Promise<{ emailSent: boolean }> {
    if (command.actor.userId !== null && command.actor.userId === command.userId) {
      throw new DomainError('FORBIDDEN', 'Pour votre propre mot de passe, utilisez « Mon compte » ou « Mot de passe oublié »');
    }
    const issued = this.tokens.generate();
    const user = await this.unitOfWork.run(async () => {
      const found = await this.users.lockById(command.userId);
      if (!found) throw new DomainError('NOT_FOUND', 'Utilisateur introuvable');
      if (found.status === UserStatus.Pending) throw new DomainError('CONFLICT', "Ce compte n'est pas encore activé : renvoyez l'invitation");
      if (!isResettable(found)) throw new DomainError('CONFLICT', 'Ce compte est désactivé : réactivez-le avant de réinitialiser son mot de passe');

      const now = this.clock.now();
      await this.links.revokeAllOfUser(found.id, now);
      const expiresAt = new Date(now.getTime() + ADMIN_RESET_TTL_MS);
      await this.links.save({
        id: this.ids.next(), userId: found.id, tokenHash: issued.hash, purpose: InvitationPurpose.PasswordReset,
        createdBy: command.actor.userId, createdAt: now, expiresAt, usedAt: null, revokedAt: null,
      });
      await this.audit.record({
        actor: command.actor, module: 'iam', entityType: 'User', entityId: found.id, action: AuditAction.PasswordReset,
        newValue: { event: 'password_reset_issued_by_administrator', expiresAt: expiresAt.toISOString() },
      });
      return found;
    });

    const message = resetEmail(user.displayName, passwordResetLink(this.config.publicUrl, issued.token), '48 heures', true);
    const result = await this.email.send({ to: user.email.value, ...message });
    if (!result.ok) {
      await this.audit.record({
        actor: command.actor, module: 'iam', entityType: 'User', entityId: user.id, action: AuditAction.PasswordReset,
        newValue: { event: 'password_reset_email_failed', reason: result.reason },
      });
    }
    return { emailSent: result.ok };
  }
}

/**
 * Choix du nouveau mot de passe avec le lien (public). Tous les liens non valides (inconnu, expiré, utilisé, révoqué,
 * ou émis pour une invitation) produisent le MÊME refus. Un mot de passe refusé par la politique NE consomme PAS le lien.
 * Succès : toutes les sessions et tous les jetons de l'utilisateur sont coupés, les autres liens révoqués, le verrouillage
 * levé ; le MFA est conservé (le lien ne donne aucun accès). Un e-mail de confirmation prévient le titulaire.
 */
@Injectable()
export class ResetPasswordUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(INVITATION_REPOSITORY) private readonly links: InvitationRepository,
    @Inject(PASSWORD_HISTORY_REPOSITORY) private readonly history: PasswordHistoryRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokens: RefreshTokenRepository,
    @Inject(INVITATION_TOKEN_FACTORY) private readonly tokens: OpaqueTokenFactory,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(EMAIL_SENDER) private readonly email: EmailSender,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  /**
   * Valide le lien, la politique et l'historique, consomme le lien de façon atomique, change le mot de passe, coupe
   * toutes les sessions, révoque les autres liens, audite et prévient le titulaire.
   */
  async execute(command: { token: string; password: string; actor: ActorContext }): Promise<void> {
    const tokenHash = this.tokens.hashOf(command.token ?? '');
    const record = await this.links.findByHash(tokenHash);
    const now = this.clock.now();

    const state = !record ? 'UNKNOWN' : record.purpose !== InvitationPurpose.PasswordReset ? 'WRONG_PURPOSE' : evaluateInvitation(record, now);
    if (!record || state !== 'VALID') {
      await this.deny(command.actor, record?.id ?? 'unknown', state);
      throw new DomainError('VALIDATION', INVALID_LINK);
    }

    const target = await this.users.findById(record.userId);
    if (!target || !isResettable(target)) {
      await this.deny(command.actor, record.id, 'NOT_RESETTABLE');
      throw new DomainError('VALIDATION', INVALID_LINK);
    }

    // Politique et historique vérifiés AVANT de consommer le lien : l'utilisateur peut réessayer.
    const problems = checkPasswordPolicy(command.password, { email: target.email.value, displayName: target.displayName });
    if (problems.length > 0) throw new DomainError('VALIDATION', `Mot de passe refusé : ${problems.join(' ; ')}`);
    const past = [target.passwordHash as string, ...(await this.history.recentHashes(target.id, PASSWORD_HISTORY_DEPTH))];
    for (const hash of new Set(past)) {
      if (await this.hasher.verify(hash, command.password)) {
        throw new DomainError('VALIDATION', `Ce mot de passe a déjà été utilisé (les ${PASSWORD_HISTORY_DEPTH} derniers sont refusés)`);
      }
    }
    const passwordHash = await this.hasher.hash(command.password);

    const done = await this.unitOfWork.run(async () => {
      const at = this.clock.now();
      // Consommation atomique : deux utilisations simultanées du même lien, une seule passe.
      if (!(await this.links.consume(tokenHash, at))) return null;
      const user = await this.users.lockById(target.id);
      if (!user || !isResettable(user)) return null;

      user.changePassword(passwordHash, at);
      await this.users.save(user);
      await this.history.add({ id: this.ids.next(), userId: user.id, passwordHash, createdAt: at });
      await this.links.revokeAllOfUser(user.id, at);
      const revoked = await this.sessions.revokeAllOfUserExcept(user.id, null, at, 'Réinitialisation du mot de passe');
      for (const sessionId of revoked) await this.refreshTokens.revokeBySession(sessionId, at);

      await this.audit.record({
        actor: { ...command.actor, userId: user.id, sessionId: null }, module: 'iam', entityType: 'User', entityId: user.id,
        action: AuditAction.PasswordReset,
        newValue: { event: 'password_reset_completed', linkId: record.id, sessionsRevoked: revoked.length },
      });
      return { user, at };
    });
    if (!done) {
      await this.deny(command.actor, record.id, 'RACE_OR_STATE');
      throw new DomainError('VALIDATION', INVALID_LINK);
    }

    // Prévient le titulaire (HORS transaction, au mieux) : un changement qu'il n'a pas demandé doit se voir.
    const message = passwordChangedEmail(done.user.displayName, done.at, command.actor.ipAddress);
    const result = await this.email.send({ to: done.user.email.value, ...message });
    if (!result.ok) {
      await this.audit.record({
        actor: command.actor, module: 'iam', entityType: 'User', entityId: done.user.id, action: AuditAction.PasswordReset,
        newValue: { event: 'password_changed_notice_failed', reason: result.reason },
      });
    }
  }

  /** Trace un lien refusé (motif interne) sans jamais écrire le jeton ni révéler le motif à l'appelant. */
  private deny(actor: ActorContext, entityId: string, reason: string): Promise<void> {
    return this.audit.record({
      actor, module: 'iam', entityType: 'UserInvitation', entityId, action: AuditAction.AccessDenied,
      newValue: { reason, flow: 'password_reset' },
    });
  }
}
