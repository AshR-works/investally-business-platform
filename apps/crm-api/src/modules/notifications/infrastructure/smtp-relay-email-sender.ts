import { Logger } from '@nestjs/common';
import { createTransport } from 'nodemailer';
import { AppConfig } from '../../../shared-kernel';
import { EmailMessage, EmailResult, EmailSender, invalidReason } from '../application/email-sender';

type Relay = NonNullable<AppConfig['email']['googleRelay']>;

/** Ce dont l'adaptateur a besoin d'un transport SMTP (celui de nodemailer, ou un faux dans les tests). */
export interface SmtpTransport {
  sendMail(options: { from: string; to: string; subject: string; text: string; html?: string }): Promise<{ accepted: readonly unknown[] }>;
}

/** Codes d'erreur de nodemailer qui disent « réessayez plus tard » : réseau, délai, résolution de nom. Le reste, hors réponses SMTP, est traité comme passager aussi. */
const REJECTED_CODES = new Set(['EAUTH', 'EENVELOPE', 'ETLS']);

/**
 * Envoi par un relais SMTP (le relais de Google Workspace : `smtp-relay.gmail.com:587`). Le serveur est reconnu par son ADRESSE IP, déclarée dans la
 * console d'administration de Google : aucun mot de passe n'existe donc dans cette application. Le chiffrement STARTTLS est EXIGÉ (`requireTLS`) :
 * si le relais ne l'offre pas, le message n'est pas envoyé en clair. Seul le mode `none` (essais locaux) l'abandonne, et la configuration le refuse en production.
 *
 * ⚠ Essayé contre un FAUX serveur SMTP (test d'intégration), jamais contre le vrai relais de Google (accès non disponibles).
 *
 * Aucune exception ne sort, et ni le contenu du message (liens d'invitation) ni l'adresse complète du destinataire ne sont journalisés.
 */
export class SmtpRelayEmailSender implements EmailSender {
  private readonly logger = new Logger(SmtpRelayEmailSender.name);

  constructor(
    private readonly relay: Relay,
    private readonly transport: SmtpTransport = createTransport({
      host: relay.host,
      port: relay.port,
      secure: false,
      requireTLS: relay.security === 'starttls',
      ignoreTLS: relay.security === 'none',
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
      disableFileAccess: true,
      disableUrlAccess: true,
    }),
  ) {}

  async send(message: EmailMessage): Promise<EmailResult> {
    const reason = invalidReason(message);
    if (reason) {
      this.logger.warn(`E-mail refusé avant envoi : ${reason}`);
      return { ok: false, reason: 'INVALID' };
    }
    try {
      const info = await this.transport.sendMail({
        from: this.relay.sender,
        to: message.to,
        subject: message.subject,
        text: message.text,
        ...(message.html === undefined ? {} : { html: message.html }),
      });
      if (info.accepted.length === 0) {
        this.logger.warn('Envoi SMTP : destinataire refusé par le relais');
        return { ok: false, reason: 'REJECTED' };
      }
      return { ok: true };
    } catch (error) {
      return this.failure(error);
    }
  }

  /** Transforme une erreur de transport en issue, sans jamais journaliser ni renvoyer de détail du message. */
  private failure(error: unknown): EmailResult {
    const { responseCode, code } = (error ?? {}) as { responseCode?: unknown; code?: unknown };
    const smtp = typeof responseCode === 'number' ? responseCode : null;
    const label = typeof code === 'string' ? code : 'inconnu';
    if (smtp !== null && smtp >= 500) {
      this.logger.warn(`Envoi SMTP refusé par le relais (réponse ${smtp})`);
      return { ok: false, reason: 'REJECTED' };
    }
    if (smtp === null && typeof code === 'string' && REJECTED_CODES.has(code)) {
      this.logger.warn(`Envoi SMTP refusé (${label}) : vérifier le relais, l'adresse IP autorisée et le chiffrement`);
      return { ok: false, reason: 'REJECTED' };
    }
    this.logger.warn(`Envoi SMTP impossible pour le moment (${smtp ?? label})`);
    return { ok: false, reason: 'UNAVAILABLE' };
  }
}
