import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { AppConfig, AppEnvironment } from '../shared-kernel';

/** Lit l'environnement d'exécution (`production`, `test`, sinon développement). */
function parseEnvironment(raw: string | undefined): AppEnvironment {
  if (raw === 'production' || raw === 'test') return raw;
  return 'development';
}

/** PEM passés en variable d'environnement : les retours à la ligne sont souvent écrits `\n`. */
function pem(raw: string | undefined): string | null {
  const value = raw?.trim();
  return value ? value.replace(/\\n/g, '\n') : null;
}

/**
 * Lit et VALIDE la configuration. En production, tout ce qui touche à la sécurité est obligatoire :
 * l'application refuse de démarrer plutôt que de tourner avec un réglage dangereux.
 */
export function loadAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const environment = parseEnvironment(env.NODE_ENV);
  const production = environment === 'production';

  const privateKeyPem = pem(env.JWT_PRIVATE_KEY_PEM);
  const publicKeyPem = pem(env.JWT_PUBLIC_KEY_PEM);
  if (production && (!privateKeyPem || !publicKeyPem)) {
    throw new Error('JWT_PRIVATE_KEY_PEM et JWT_PUBLIC_KEY_PEM sont obligatoires en production');
  }
  if (Boolean(privateKeyPem) !== Boolean(publicKeyPem)) {
    throw new Error('JWT_PRIVATE_KEY_PEM et JWT_PUBLIC_KEY_PEM doivent être fournies ensemble');
  }

  const allowedOrigins = (env.ALLOWED_ORIGINS ?? (production ? '' : 'http://127.0.0.1:3000,http://localhost:3000'))
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (production && allowedOrigins.length === 0) {
    throw new Error('ALLOWED_ORIGINS est obligatoire en production');
  }

  const cookieSecure = env.COOKIE_SECURE ? env.COOKIE_SECURE !== 'false' : production;
  if (production && !cookieSecure) {
    throw new Error('COOKIE_SECURE=false est interdit en production');
  }

  const mfaKey = env.MFA_ENCRYPTION_KEY?.trim() || null;
  if (mfaKey !== null && Buffer.from(mfaKey, 'base64').length !== 32) {
    throw new Error('MFA_ENCRYPTION_KEY doit être une clé de 32 octets encodée en base64');
  }
  if (production && mfaKey === null) {
    throw new Error('MFA_ENCRYPTION_KEY est obligatoire en production');
  }

  const provider = env.EMAIL_PROVIDER === 'microsoft365' ? 'microsoft365' : env.EMAIL_PROVIDER === 'google-relay' ? 'google-relay' : 'log';
  if (env.EMAIL_PROVIDER && env.EMAIL_PROVIDER !== 'log' && env.EMAIL_PROVIDER !== 'microsoft365' && env.EMAIL_PROVIDER !== 'google-relay') {
    throw new Error("EMAIL_PROVIDER doit valoir 'log', 'microsoft365' ou 'google-relay'");
  }
  let microsoft365: AppConfig['email']['microsoft365'] = null;
  if (provider === 'microsoft365') {
    const { M365_TENANT_ID: tenantId, M365_CLIENT_ID: clientId, M365_CLIENT_SECRET: clientSecret, M365_SENDER: sender } = env;
    if (!tenantId || !clientId || !clientSecret || !sender) {
      throw new Error('M365_TENANT_ID, M365_CLIENT_ID, M365_CLIENT_SECRET et M365_SENDER sont obligatoires avec EMAIL_PROVIDER=microsoft365');
    }
    microsoft365 = { tenantId, clientId, clientSecret, sender };
  }
  let googleRelay: AppConfig['email']['googleRelay'] = null;
  if (provider === 'google-relay') {
    const sender = env.EMAIL_SENDER?.trim() ?? '';
    if (!/^[^\s@<>(),;:"[\]\\]+@[^\s@<>(),;:"[\]\\]+\.[^\s@<>(),;:"[\]\\]{2,}$/.test(sender)) {
      throw new Error("EMAIL_SENDER (l'adresse d'expédition, une seule adresse) est obligatoire avec EMAIL_PROVIDER=google-relay");
    }
    const host = env.SMTP_HOST?.trim() || 'smtp-relay.gmail.com';
    if (!/^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i.test(host)) {
      throw new Error('SMTP_HOST doit être un nom de serveur valide');
    }
    const rawPort = env.SMTP_PORT?.trim() || '587';
    const port = Number(rawPort);
    if (!/^\d{1,5}$/.test(rawPort) || port < 1 || port > 65535) throw new Error('SMTP_PORT doit être un numéro de port entre 1 et 65535');
    const security = env.SMTP_SECURITY?.trim() || 'starttls';
    if (security !== 'starttls' && security !== 'none') throw new Error("SMTP_SECURITY doit valoir 'starttls' ou 'none'");
    if (production && security === 'none') throw new Error("SMTP_SECURITY=none est interdit en production : les e-mails (liens d'activation) ne doivent jamais partir en clair");
    googleRelay = { host, port, sender, security };
  }
  if (production && provider === 'log') {
    // Le mode journal n'envoie rien : en production, des e-mails perdus en silence seraient pire qu'un refus de démarrer.
    throw new Error("EMAIL_PROVIDER=microsoft365 ou google-relay est obligatoire en production (le mode 'log' est réservé au développement et aux tests)");
  }

  const publicUrl = (env.APP_PUBLIC_URL?.trim() || (production ? '' : 'http://127.0.0.1:3000')).replace(/\/+$/, '');
  if (production && !/^https:\/\/[^\s/]+/.test(publicUrl)) {
    throw new Error('APP_PUBLIC_URL (https://...) est obligatoire en production : les liens des e-mails en dépendent');
  }
  if (!production && publicUrl && !/^https?:\/\/[^\s/]+/.test(publicUrl)) {
    throw new Error('APP_PUBLIC_URL doit être une URL http(s) valide');
  }

  const logContent = env.EMAIL_LOG_CONTENT === 'true';
  if (logContent && production) {
    throw new Error('EMAIL_LOG_CONTENT=true est interdit en production : il écrirait des liens d\'activation dans les journaux');
  }

  const documentsDirectory = env.DOCUMENTS_DIR?.trim() || (production ? '' : join(tmpdir(), 'investally-documents'));
  if (production && !isAbsolute(documentsDirectory)) {
    throw new Error('DOCUMENTS_DIR (chemin absolu, hors racine web) est obligatoire en production : les fichiers téléversés y sont stockés');
  }

  return {
    env: environment,
    cookieSecure,
    allowedOrigins,
    trustProxy: env.TRUST_PROXY?.trim() || null,
    publicUrl,
    mfa: { encryptionKeyBase64: mfaKey },
    email: { provider, microsoft365, googleRelay, logContent },
    documents: { directory: documentsDirectory },
    jwt: { privateKeyPem, publicKeyPem, issuer: 'investally-crm', audience: 'investally-crm-api' },
  };
}
