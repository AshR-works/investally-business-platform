import { Logger } from '@nestjs/common';
import { EmailMessage, EmailResult, EmailSender, invalidReason } from '../application/email-sender';

const KEPT = 50;

/**
 * Adaptateur de développement et de test : N'ENVOIE RIEN. Il ne journalise que des métadonnées (domaine du
 * destinataire, taille du sujet), jamais le contenu (liens d'invitation, codes). Les derniers messages sont
 * conservés en mémoire pour les tests et pour le développement local.
 */
export class LogEmailSender implements EmailSender {
  constructor(private readonly logContent = false) {}

  private readonly logger = new Logger(LogEmailSender.name);
  private readonly kept: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<EmailResult> {
    const reason = invalidReason(message);
    if (reason) {
      this.logger.warn(`E-mail refusé avant envoi : ${reason}`);
      return { ok: false, reason: 'INVALID' };
    }
    this.kept.push(message);
    if (this.kept.length > KEPT) this.kept.shift();
    const domain = message.to.slice(message.to.lastIndexOf('@') + 1);
    this.logger.log(`E-mail NON envoyé (mode journal) : destinataire @${domain}, sujet ${message.subject.length} caractères`);
    if (this.logContent) {
      // Développement local uniquement (la configuration refuse cette option en production).
      this.logger.warn(`[DEV] Contenu de l'e-mail à ${message.to}\nSujet : ${message.subject}\n${message.text}`);
    }
    return { ok: true };
  }

  /** Messages « envoyés » depuis le démarrage (les plus récents en dernier). Réservé aux tests et au développement. */
  get sent(): readonly EmailMessage[] {
    return this.kept;
  }
}
