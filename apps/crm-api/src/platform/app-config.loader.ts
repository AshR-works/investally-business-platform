import { AppConfig, AppEnvironment } from '../shared-kernel';

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

  return {
    env: environment,
    cookieSecure,
    allowedOrigins,
    trustProxy: env.TRUST_PROXY?.trim() || null,
    jwt: { privateKeyPem, publicKeyPem, issuer: 'investally-crm', audience: 'investally-crm-api' },
  };
}
