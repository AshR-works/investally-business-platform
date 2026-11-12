import { Module } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../../shared-kernel';
import { EMAIL_SENDER, EmailSender } from './application/email-sender';
import { createEmailSender } from './infrastructure/email-sender.factory';

/** Composition root du module Notifications : fournisseur d'e-mail choisi par la configuration. */
@Module({
  providers: [
    {
      provide: EMAIL_SENDER,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): EmailSender => createEmailSender(config),
    },
  ],
  exports: [EMAIL_SENDER],
})
/**
 * Module de notifications : fournit le port d'envoi d'e-mails (journal en développement ; en production, Microsoft 365 ou
 * le relais SMTP de Google Workspace).
 */
export class NotificationsModule {}
