import { randomBytes } from 'node:crypto';
import { AppConfig } from '../../../shared-kernel';
import { AesGcmSecretCipher } from './aes-gcm-secret-cipher';

const key = () => randomBytes(32);
const SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

describe('AesGcmSecretCipher (C2)', () => {
  const cipher = new AesGcmSecretCipher(key());

  it('chiffre puis déchiffre à l\'identique ; le chiffré ne contient pas le secret', () => {
    const blob = cipher.encrypt(SECRET, 'user-1');
    expect(blob).toMatch(/^v1\.[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(blob).not.toContain(SECRET);
    expect(cipher.decrypt(blob, 'user-1')).toBe(SECRET);
  });

  it('deux chiffrements du même secret diffèrent (IV aléatoire)', () => {
    expect(cipher.encrypt(SECRET, 'user-1')).not.toBe(cipher.encrypt(SECRET, 'user-1'));
  });

  it('LIAISON À L\'UTILISATEUR : un secret copié sur un autre compte est indéchiffrable', () => {
    const blob = cipher.encrypt(SECRET, 'user-1');
    expect(() => cipher.decrypt(blob, 'user-2')).toThrow();
  });

  it('détecte toute altération : chiffré, étiquette d\'authentification, IV', () => {
    const [version, iv, tag, data] = cipher.encrypt(SECRET, 'user-1').split('.');
    const flip = (part: string) => (part[0] === 'A' ? 'B' : 'A') + part.slice(1);
    for (const tampered of [`${version}.${iv}.${tag}.${flip(data)}`, `${version}.${iv}.${flip(tag)}.${data}`, `${version}.${flip(iv)}.${tag}.${data}`]) {
      expect(() => cipher.decrypt(tampered, 'user-1')).toThrow();
    }
  });

  it('refuse un chiffré mal formé ou de version inconnue', () => {
    for (const bad of ['', 'v1', 'v1.a.b', 'v2.a.b.c', 'v1.a.b.c.d', 'pas du tout un chiffré']) {
      expect(() => cipher.decrypt(bad, 'user-1')).toThrow();
    }
  });

  it('refuse un chiffré produit avec une autre clé', () => {
    const other = new AesGcmSecretCipher(key());
    expect(() => cipher.decrypt(other.encrypt(SECRET, 'user-1'), 'user-1')).toThrow();
  });

  it("refuse une clé qui n'est pas de 32 octets", () => {
    expect(() => new AesGcmSecretCipher(Buffer.alloc(16))).toThrow(/32 octets/);
  });

  it("gère les secrets vides et non ASCII", () => {
    expect(cipher.decrypt(cipher.encrypt('', 'u'), 'u')).toBe('');
    expect(cipher.decrypt(cipher.encrypt('é😀', 'u'), 'u')).toBe('é😀');
  });

  describe('fromConfig', () => {
    const config = (env: AppConfig['env'], encryptionKeyBase64: string | null): AppConfig => ({
      env, cookieSecure: false, allowedOrigins: [], trustProxy: null,
      mfa: { encryptionKeyBase64 }, email: { provider: 'log', microsoft365: null },
      jwt: { privateKeyPem: null, publicKeyPem: null, issuer: 'i', audience: 'a' },
    });

    it('utilise la clé configurée : deux instances se relisent', () => {
      const k = key().toString('base64');
      const a = AesGcmSecretCipher.fromConfig(config('test', k));
      const b = AesGcmSecretCipher.fromConfig(config('test', k));
      expect(b.decrypt(a.encrypt(SECRET, 'u'), 'u')).toBe(SECRET);
    });

    it('en développement/test sans clé : clé éphémère, deux instances ne se relisent PAS', () => {
      const a = AesGcmSecretCipher.fromConfig(config('test', null));
      const b = AesGcmSecretCipher.fromConfig(config('test', null));
      expect(() => b.decrypt(a.encrypt(SECRET, 'u'), 'u')).toThrow();
    });

    it('refuse de démarrer en production sans clé', () => {
      expect(() => AesGcmSecretCipher.fromConfig(config('production', null))).toThrow(/MFA_ENCRYPTION_KEY/);
    });
  });
});
