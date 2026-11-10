import { AppConfig } from '../../shared-kernel';
import { createEmailSender } from './infrastructure/email-sender.factory';
import { LogEmailSender } from './infrastructure/log-email-sender';
import { MicrosoftGraphEmailSender } from './infrastructure/microsoft-graph-email-sender';
import { SmtpRelayEmailSender } from './infrastructure/smtp-relay-email-sender';

const config = (email: Partial<AppConfig['email']>): AppConfig => ({
  env: 'test', cookieSecure: false, allowedOrigins: [], trustProxy: null, releasedDomains: null, publicUrl: 'http://127.0.0.1:3000',
  mfa: { encryptionKeyBase64: null }, documents: { directory: '/tmp/docs' },
  email: { provider: 'log', microsoft365: null, googleRelay: null, logContent: false, ...email },
  jwt: { privateKeyPem: null, publicKeyPem: null, issuer: 'investally-crm', audience: 'investally-crm-api' },
});

const RELAY = { host: 'smtp-relay.gmail.com', port: 587, sender: 'no-reply@exemple.test', security: 'starttls' as const };
const M365 = { tenantId: 't', clientId: 'c', clientSecret: 's', sender: 'crm@exemple.test' };

describe('choix de l’adaptateur d’envoi', () => {
  it('journal par défaut (développement et test)', () => {
    expect(createEmailSender(config({}))).toBeInstanceOf(LogEmailSender);
  });

  it('relais SMTP quand la configuration le demande', () => {
    expect(createEmailSender(config({ provider: 'google-relay', googleRelay: RELAY }))).toBeInstanceOf(SmtpRelayEmailSender);
  });

  it('Microsoft 365 quand la configuration le demande', () => {
    expect(createEmailSender(config({ provider: 'microsoft365', microsoft365: M365 }))).toBeInstanceOf(MicrosoftGraphEmailSender);
  });

  it('ne prend pas un adaptateur dont les réglages manquent : retour au journal, jamais un envoi sans configuration', () => {
    expect(createEmailSender(config({ provider: 'google-relay', googleRelay: null }))).toBeInstanceOf(LogEmailSender);
    expect(createEmailSender(config({ provider: 'microsoft365', microsoft365: null }))).toBeInstanceOf(LogEmailSender);
  });

  it('ne choisit pas le relais quand seul Microsoft 365 est demandé, et inversement', () => {
    expect(createEmailSender(config({ provider: 'microsoft365', microsoft365: M365, googleRelay: RELAY }))).toBeInstanceOf(MicrosoftGraphEmailSender);
    expect(createEmailSender(config({ provider: 'google-relay', microsoft365: M365, googleRelay: RELAY }))).toBeInstanceOf(SmtpRelayEmailSender);
  });
});
