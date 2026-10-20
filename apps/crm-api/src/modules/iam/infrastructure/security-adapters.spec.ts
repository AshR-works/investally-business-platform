import { SignJWT, exportPKCS8, exportSPKI, generateKeyPair } from 'jose';
import { AppConfig } from '../../../shared-kernel';
import { Argon2PasswordHasher } from './argon2-password-hasher';
import { Es256AccessTokenService } from './es256-access-token.service';
import { Sha256RefreshTokenFactory } from './sha256-refresh-token-factory';

const baseConfig = (over: Partial<AppConfig['jwt']> = {}, env: AppConfig['env'] = 'test'): AppConfig => ({
  env, cookieSecure: false, allowedOrigins: [], trustProxy: null,
  mfa: { encryptionKeyBase64: null }, email: { provider: 'log', microsoft365: null },
  jwt: { privateKeyPem: null, publicKeyPem: null, issuer: 'investally-crm', audience: 'investally-crm-api', ...over },
});

const b64 = (value: object | string) => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');
const claims = { sub: 'user-1', sid: 'session-1', amr: ['pwd'] };
const now = new Date('2026-10-20T10:00:00Z');
const FIFTEEN_MIN = 15 * 60_000;

describe('Argon2PasswordHasher (C3)', () => {
  const hasher = new Argon2PasswordHasher();

  it('produit un hachage argon2id vérifiable ; le mauvais mot de passe est refusé', async () => {
    const hash = await hasher.hash('phrase de passe tres longue 42');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain('phrase de passe');
    expect(await hasher.verify(hash, 'phrase de passe tres longue 42')).toBe(true);
    expect(await hasher.verify(hash, 'phrase de passe tres longue 43')).toBe(false);
  });

  it('utilise un sel unique : deux hachages du même mot de passe diffèrent', async () => {
    const [a, b] = await Promise.all([hasher.hash('meme mot de passe 1234'), hasher.hash('meme mot de passe 1234')]);
    expect(a).not.toBe(b);
  });

  it('applique les paramètres retenus (19 MiB, 2 passes, 1 thread)', async () => {
    expect(await hasher.hash('parametres de test 12')).toContain('m=19456,t=2,p=1');
  });

  it('refuse sans lever d\'exception un hachage corrompu ou vide', async () => {
    expect(await hasher.verify('pas-un-hachage', 'x')).toBe(false);
    expect(await hasher.verify('', 'x')).toBe(false);
  });

  it('verifyDummy ne lève jamais et ne valide jamais rien', async () => {
    await expect(hasher.verifyDummy('nimporte quoi')).resolves.toBeUndefined();
  });
});

describe('Sha256RefreshTokenFactory', () => {
  const factory = new Sha256RefreshTokenFactory();

  it("génère des jetons de 256 bits uniques dont seule l'empreinte SHA-256 est exploitable", () => {
    const a = factory.generate();
    const b = factory.generate();
    expect(a.token).not.toBe(b.token);
    expect(Buffer.from(a.token, 'base64url')).toHaveLength(32);
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.hash).toBe(factory.hashOf(a.token));
    expect(a.hash).not.toContain(a.token);
  });
});

describe('Es256AccessTokenService (C4)', () => {
  let service: Es256AccessTokenService;
  beforeAll(async () => {
    service = await Es256AccessTokenService.create(baseConfig());
  });

  it('émet puis vérifie un jeton ES256 avec kid, durée de 15 min et claims attendus', async () => {
    const { token, expiresAt } = await service.issue(claims, FIFTEEN_MIN, now);
    expect(expiresAt).toEqual(new Date(now.getTime() + FIFTEEN_MIN));
    const header = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString());
    expect(header).toMatchObject({ alg: 'ES256', typ: 'JWT' });
    expect(header.kid).toBeTruthy();
    expect(await service.verify(token, now)).toEqual(claims);
  });

  it('ne met aucune permission ni donnée personnelle dans le jeton', async () => {
    const { token } = await service.issue(claims, FIFTEEN_MIN, now);
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    expect(Object.keys(payload).sort()).toEqual(['amr', 'aud', 'exp', 'iat', 'iss', 'jti', 'sid', 'sub']);
  });

  it('refuse un jeton expiré (avec 5 s de tolérance d\'horloge)', async () => {
    const { token } = await service.issue(claims, FIFTEEN_MIN, now);
    expect(await service.verify(token, new Date(now.getTime() + FIFTEEN_MIN + 4_000))).not.toBeNull();
    expect(await service.verify(token, new Date(now.getTime() + FIFTEEN_MIN + 6_000))).toBeNull();
  });

  it('refuse un jeton falsifié (charge utile modifiée, signature conservée)', async () => {
    const { token } = await service.issue(claims, FIFTEEN_MIN, now);
    const [h, p, s] = token.split('.');
    const forged = { ...JSON.parse(Buffer.from(p, 'base64url').toString()), sub: 'administrateur' };
    expect(await service.verify(`${h}.${b64(forged)}.${s}`, now)).toBeNull();
  });

  it('refuse une signature tronquée, vide ou altérée', async () => {
    const { token } = await service.issue(claims, FIFTEEN_MIN, now);
    const [h, p, s] = token.split('.');
    expect(await service.verify(`${h}.${p}.`, now)).toBeNull();
    expect(await service.verify(`${h}.${p}.${s.slice(0, -4)}AAAA`, now)).toBeNull();
    expect(await service.verify(`${h}.${p}`, now)).toBeNull();
  });

  it('refuse alg:none (jeton non signé)', async () => {
    const unsigned = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ ...claims, iss: 'investally-crm', aud: 'investally-crm-api', iat: 1, exp: 9999999999 })}.`;
    expect(await service.verify(unsigned, now)).toBeNull();
  });

  it('refuse la confusion d\'algorithme : HS256 signé avec un secret quelconque', async () => {
    const hs = await new SignJWT({ sid: 's', amr: ['pwd'] })
      .setProtectedHeader({ alg: 'HS256' }).setSubject('u').setIssuer('investally-crm').setAudience('investally-crm-api')
      .setIssuedAt(Math.floor(now.getTime() / 1000)).setExpirationTime(Math.floor(now.getTime() / 1000) + 600)
      .sign(new TextEncoder().encode('secret-quelconque-de-32-caracteres!!'));
    expect(await service.verify(hs, now)).toBeNull();
  });

  it('refuse un jeton signé par une autre clé', async () => {
    const other = await Es256AccessTokenService.create(baseConfig());
    const { token } = await other.issue(claims, FIFTEEN_MIN, now);
    expect(await service.verify(token, now)).toBeNull();
  });

  it('refuse un mauvais émetteur ou une mauvaise audience avec une signature pourtant valide', async () => {
    const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true });
    const jwt = { privateKeyPem: await exportPKCS8(privateKey), publicKeyPem: await exportSPKI(publicKey) };
    const verifier = await Es256AccessTokenService.create(baseConfig(jwt));
    const wrongAudience = await Es256AccessTokenService.create(baseConfig({ ...jwt, audience: 'autre-api' }));
    const wrongIssuer = await Es256AccessTokenService.create(baseConfig({ ...jwt, issuer: 'autre-emetteur' }));
    const sameConfig = await Es256AccessTokenService.create(baseConfig(jwt));

    expect(await verifier.verify((await sameConfig.issue(claims, FIFTEEN_MIN, now)).token, now)).toEqual(claims);
    expect(await verifier.verify((await wrongAudience.issue(claims, FIFTEEN_MIN, now)).token, now)).toBeNull();
    expect(await verifier.verify((await wrongIssuer.issue(claims, FIFTEEN_MIN, now)).token, now)).toBeNull();
  });

  it('refuse un jeton dont les claims ont un mauvais type (sid absent, amr non tableau)', async () => {
    const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true });
    const jwt = { privateKeyPem: await exportPKCS8(privateKey), publicKeyPem: await exportSPKI(publicKey) };
    const verifier = await Es256AccessTokenService.create(baseConfig(jwt));
    const sign = (extra: Record<string, unknown>) =>
      new SignJWT(extra).setProtectedHeader({ alg: 'ES256' }).setSubject('u').setIssuer('investally-crm').setAudience('investally-crm-api')
        .setIssuedAt(Math.floor(now.getTime() / 1000)).setExpirationTime(Math.floor(now.getTime() / 1000) + 600).sign(privateKey);

    expect(await verifier.verify(await sign({ amr: ['pwd'] }), now)).toBeNull();
    expect(await verifier.verify(await sign({ sid: 's', amr: 'pwd' }), now)).toBeNull();
    expect(await verifier.verify(await sign({ sid: 's', amr: [1] }), now)).toBeNull();
    expect(await verifier.verify(await sign({ sid: 's', amr: ['pwd'] }), now)).toEqual({ sub: 'u', sid: 's', amr: ['pwd'] });
  });

  it('ne lève jamais d\'exception sur une entrée absurde', async () => {
    for (const garbage of ['', 'a', 'a.b', 'a.b.c', '....', '\u0000', 'x'.repeat(100_000)]) {
      expect(await service.verify(garbage, now)).toBeNull();
    }
  });

  it('refuse de créer le service en production sans clés', async () => {
    await expect(Es256AccessTokenService.create(baseConfig({}, 'production'))).rejects.toThrow(/production/);
  });
});
