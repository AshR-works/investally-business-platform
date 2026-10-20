import { Module } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../../shared-kernel';
import { EMAIL_SENDER, EmailSender } from './application/email-sender';
import { LogEmailSender } from './infrastructure/log-email-sender';
import { MicrosoftGraphEmailSender } from './infrastructure/microsoft-graph-email-sender';

/** Composition root du module Notifications : fournisseur d'e-mail choisi par la configuration. */
@Module({
  providers: [
    {
      provide: EMAIL_SENDER,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): EmailSender =>
        config.email.provider === 'microsoft365' && config.email.microsoft365
          ? new MicrosoftGraphEmailSender(config.email.microsoft365)
          : new LogEmailSender(config.email.logContent),
    },
  ],
  exports: [EMAIL_SENDER],
})
export class NotificationsModule {}
