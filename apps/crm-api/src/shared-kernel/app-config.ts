export type AppEnvironment = 'development' | 'test' | 'production';

/** Configuration validée au démarrage, lue depuis l'environnement (jamais depuis le dépôt). */
export interface AppConfig {
  env: AppEnvironment;
  /** Attribut `Secure` du cookie de rafraîchissement : toujours vrai hors développement local. */
  cookieSecure: boolean;
  /** Origines navigateur autorisées pour les routes d'authentification (défense CSRF en plus de SameSite). */
  allowedOrigins: readonly string[];
  /** Valeur de `trust proxy` d'Express (ex. `loopback`) quand l'API est derrière le proxy Next.js ; absent sinon. */
  trustProxy: string | null;
  /** Adresse publique du front (liens des e-mails d'invitation). HTTPS obligatoire en production. */
  publicUrl: string;
  mfa: {
    /** Clé AES-256 (32 octets en base64) qui chiffre les secrets TOTP au repos ; absente = clé éphémère (développement/test). */
    encryptionKeyBase64: string | null;
  };
  email: {
    /** `log` : n'envoie rien (développement/test) ; `microsoft365` : API Microsoft Graph. */
    provider: 'log' | 'microsoft365';
    /** Développement local seulement : affiche le CONTENU des e-mails (liens d'invitation) dans la console. Interdit en production. */
    logContent: boolean;
    microsoft365: { tenantId: string; clientId: string; clientSecret: string; sender: string } | null;
  };
  documents: {
    /** Dossier des fichiers téléversés, HORS de toute racine web (droits restreints). Obligatoire et absolu en production. */
    directory: string;
  };
  jwt: {
    /** Clé privée ES256 au format PEM PKCS#8 ; absente = paire éphémère (développement et test uniquement). */
    privateKeyPem: string | null;
    publicKeyPem: string | null;
    issuer: string;
    audience: string;
  };
}

export const APP_CONFIG = Symbol('AppConfig');
