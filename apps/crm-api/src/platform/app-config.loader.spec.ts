import { loadAppConfig } from './app-config.loader';

const KEYS = { JWT_PRIVATE_KEY_PEM: 'priv', JWT_PUBLIC_KEY_PEM: 'pub' };
const MFA_KEY = Buffer.alloc(32, 7).toString('base64');
const M365 = { EMAIL_PROVIDER: 'microsoft365', M365_TENANT_ID: 't', M365_CLIENT_ID: 'c', M365_CLIENT_SECRET: 's', M365_SENDER: 'crm@investally.test' };
const PROD = { NODE_ENV: 'production', DOCUMENTS_DIR: '/var/lib/investally/documents', ...KEYS, ALLOWED_ORIGINS: 'https://crm.test', MFA_ENCRYPTION_KEY: MFA_KEY, APP_PUBLIC_URL: 'https://crm.test', ...M365 };

describe('loadAppConfig', () => {
  it('autorise le développement sans clé ni configuration (paire éphémère, cookie non sécurisé)', () => {
    const config = loadAppConfig({});
    expect(config.env).toBe('development');
    expect(config.cookieSecure).toBe(false);
    expect(config.jwt.privateKeyPem).toBeNull();
    expect(config.allowedOrigins).toContain('http://127.0.0.1:3000');
  });

  it('refuse de démarrer en production sans clés de signature', () => {
    expect(() => loadAppConfig({ NODE_ENV: 'production', ALLOWED_ORIGINS: 'https://crm.test' })).toThrow(/JWT_PRIVATE_KEY_PEM/);
  });

  it('refuse de démarrer en production sans origines autorisées', () => {
    expect(() => loadAppConfig({ NODE_ENV: 'production', ...KEYS })).toThrow(/ALLOWED_ORIGINS/);
  });

  it('refuse un cookie non sécurisé en production', () => {
    expect(() =>
      loadAppConfig({ NODE_ENV: 'production', ...KEYS, ALLOWED_ORIGINS: 'https://crm.test', COOKIE_SECURE: 'false' }),
    ).toThrow(/COOKIE_SECURE/);
  });

  it('exige les deux clés ensemble', () => {
    expect(() => loadAppConfig({ JWT_PRIVATE_KEY_PEM: 'priv' })).toThrow(/ensemble/);
  });

  it('refuse de démarrer en production sans clé de chiffrement MFA', () => {
    const { MFA_ENCRYPTION_KEY, ...withoutKey } = PROD;
    expect(MFA_ENCRYPTION_KEY).toBeTruthy();
    expect(() => loadAppConfig(withoutKey)).toThrow(/MFA_ENCRYPTION_KEY/);
  });

  it('refuse une clé MFA qui ne fait pas 32 octets', () => {
    expect(() => loadAppConfig({ ...PROD, MFA_ENCRYPTION_KEY: Buffer.alloc(16).toString('base64') })).toThrow(/32 octets/);
    expect(() => loadAppConfig({ MFA_ENCRYPTION_KEY: 'court' })).toThrow(/32 octets/);
  });

  it("refuse le fournisseur d'e-mail « log » en production (des e-mails perdus en silence)", () => {
    const { EMAIL_PROVIDER, ...withoutProvider } = PROD;
    expect(EMAIL_PROVIDER).toBe('microsoft365');
    expect(() => loadAppConfig(withoutProvider)).toThrow(/microsoft365/);
    expect(() => loadAppConfig({ ...PROD, EMAIL_PROVIDER: 'log' })).toThrow(/microsoft365/);
  });

  it('exige les quatre paramètres Microsoft 365 quand ce fournisseur est choisi', () => {
    for (const missing of ['M365_TENANT_ID', 'M365_CLIENT_ID', 'M365_CLIENT_SECRET', 'M365_SENDER'] as const) {
      expect(() => loadAppConfig({ ...M365, [missing]: '' })).toThrow(/M365_TENANT_ID/);
    }
  });

  it('refuse un fournisseur d\'e-mail inconnu', () => {
    expect(() => loadAppConfig({ EMAIL_PROVIDER: 'sendgrid' })).toThrow(/EMAIL_PROVIDER/);
  });

  it("exige une adresse publique https en production (liens des e-mails) et accepte http en développement", () => {
    const { APP_PUBLIC_URL, ...withoutUrl } = PROD;
    expect(APP_PUBLIC_URL).toBeTruthy();
    expect(() => loadAppConfig(withoutUrl)).toThrow(/APP_PUBLIC_URL/);
    expect(() => loadAppConfig({ ...PROD, APP_PUBLIC_URL: 'http://crm.test' })).toThrow(/APP_PUBLIC_URL/);
    expect(() => loadAppConfig({ APP_PUBLIC_URL: 'pas une url' })).toThrow(/APP_PUBLIC_URL/);
    expect(loadAppConfig({}).publicUrl).toBe('http://127.0.0.1:3000');
    expect(loadAppConfig({ ...PROD, APP_PUBLIC_URL: 'https://crm.test///' }).publicUrl).toBe('https://crm.test');
  });

  it("EMAIL_LOG_CONTENT : autorisé en développement, interdit en production, désactivé par défaut", () => {
    expect(loadAppConfig({}).email.logContent).toBe(false);
    expect(loadAppConfig({ EMAIL_LOG_CONTENT: 'true' }).email.logContent).toBe(true);
    expect(loadAppConfig({ EMAIL_LOG_CONTENT: 'oui' }).email.logContent).toBe(false); // seule la valeur exacte « true » l'active
    expect(() => loadAppConfig({ ...PROD, EMAIL_LOG_CONTENT: 'true' })).toThrow(/EMAIL_LOG_CONTENT/);
  });

  it('en développement : fournisseur « log » et clé MFA éphémère par défaut', () => {
    const config = loadAppConfig({});
    expect(config.email.provider).toBe('log');
    expect(config.mfa.encryptionKeyBase64).toBeNull();
  });

  it('en production : cookie sécurisé par défaut, origines lues, retours à la ligne des PEM restaurés', () => {
    const config = loadAppConfig({
      ...PROD, JWT_PRIVATE_KEY_PEM: 'a\\nb', JWT_PUBLIC_KEY_PEM: 'c\\nd',
      ALLOWED_ORIGINS: 'https://crm.test, https://autre.test', TRUST_PROXY: 'loopback',
    });
    expect(config.cookieSecure).toBe(true);
    expect(config.allowedOrigins).toEqual(['https://crm.test', 'https://autre.test']);
    expect(config.jwt.privateKeyPem).toBe('a\nb');
    expect(config.trustProxy).toBe('loopback');
  });

  it('en production, le dossier des documents est obligatoire et absolu (jamais un chemin relatif à la racine web)', () => {
    const { DOCUMENTS_DIR: _unused, ...withoutDir } = PROD;
    expect(() => loadAppConfig(withoutDir)).toThrow(/DOCUMENTS_DIR/);
    expect(() => loadAppConfig({ ...PROD, DOCUMENTS_DIR: 'public/uploads' })).toThrow(/DOCUMENTS_DIR/);
    expect(loadAppConfig(PROD).documents.directory).toBe('/var/lib/investally/documents');
  });

  it('en développement, un dossier temporaire par défaut ; DOCUMENTS_DIR le remplace', () => {
    expect(loadAppConfig({}).documents.directory).toMatch(/investally-documents$/);
    expect(loadAppConfig({ DOCUMENTS_DIR: 'C:/tmp/docs' }).documents.directory).toBe('C:/tmp/docs');
  });
});
