import { loadAppConfig } from './app-config.loader';

const KEYS = { JWT_PRIVATE_KEY_PEM: 'priv', JWT_PUBLIC_KEY_PEM: 'pub' };

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

  it('en production : cookie sécurisé par défaut, origines lues, retours à la ligne des PEM restaurés', () => {
    const config = loadAppConfig({
      NODE_ENV: 'production', JWT_PRIVATE_KEY_PEM: 'a\\nb', JWT_PUBLIC_KEY_PEM: 'c\\nd',
      ALLOWED_ORIGINS: 'https://crm.test, https://autre.test', TRUST_PROXY: 'loopback',
    });
    expect(config.cookieSecure).toBe(true);
    expect(config.allowedOrigins).toEqual(['https://crm.test', 'https://autre.test']);
    expect(config.jwt.privateKeyPem).toBe('a\nb');
    expect(config.trustProxy).toBe('loopback');
  });
});
