import { AppConfig } from '../../../shared-kernel';
import { EmailSender } from '../application/email-sender';
import { LogEmailSender } from './log-email-sender';
import { MicrosoftGraphEmailSender } from './microsoft-graph-email-sender';
import { SmtpRelayEmailSender } from './smtp-relay-email-sender';

/** Choisit l'adaptateur d'envoi d'après la configuration validée au démarrage (journal en développement et en test ; Microsoft 365 ou relais SMTP en production). */
export function createEmailSender(config: AppConfig): EmailSender {
  if (config.email.provider === 'microsoft365' && config.email.microsoft365) return new MicrosoftGraphEmailSender(config.email.microsoft365);
  if (config.email.provider === 'google-relay' && config.email.googleRelay) return new SmtpRelayEmailSender(config.email.googleRelay);
  return new LogEmailSender(config.email.logContent);
}
