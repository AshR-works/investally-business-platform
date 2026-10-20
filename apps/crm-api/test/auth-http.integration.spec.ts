import 'reflect-metadata';
import { CreateUserUseCase } from '../src/modules/iam/application/create-user.use-case';
import { RoleCode } from '../src/modules/iam/domain/roles';
import { SYSTEM_ACTOR, TEST_PASSWORD, TestApp, startTestApp, uniqueEmail } from './support/test-app';

const describeDb = process.env.DATABASE_URL && process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const json = async (res: Response): Promise<any> => res.json();
const JSON_HEADERS = { 'content-type': 'application/json', 'user-agent': 'recette-http' };

/** Parcours HTTP complet sur l'application réelle (cookie, jetons, en-têtes, limitation de débit). */
describeDb('Authentification HTTP (PostgreSQL)', () => {
  let t: TestApp;
  beforeAll(async () => { t = await startTestApp(); }, 60_000);
  afterAll(() => t.close());

  async function newUser(roles: RoleCode[] = [RoleCode.AccountManager]) {
    const email = uniqueEmail('http');
    await t.get(CreateUserUseCase).execute({ email, displayName: 'Utilisateur Http', password: TEST_PASSWORD, roles, actor: SYSTEM_ACTOR });
    return email;
  }

  const post = (path: string, body?: unknown, headers: Record<string, string> = {}) =>
    fetch(`${t.baseUrl}${path}`, { method: 'POST', headers: { ...JSON_HEADERS, ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const get = (path: string, headers: Record<string, string> = {}) => fetch(`${t.baseUrl}${path}`, { headers: { ...JSON_HEADERS, ...headers } });

  /** Extrait le cookie de rafraîchissement (nom=valeur) et sa ligne Set-Cookie brute. */
  function refreshCookie(res: Response) {
    const raw = res.headers.getSetCookie().find((c) => c.startsWith('crm_refresh='));
    return { raw, pair: raw?.split(';')[0] };
  }
  async function loginAs(email: string) {
    const res = await post('/api/v1/auth/login', { email, password: TEST_PASSWORD });
    const body = await json(res);
    return { res, body, cookie: refreshCookie(res).pair! };
  }

  describe('D1 — connexion', () => {
    it('renvoie le jeton d\'accès dans le corps et le refresh token UNIQUEMENT dans un cookie HttpOnly SameSite=Strict', async () => {
      const email = await newUser();
      const { res, body, cookie } = await loginAs(email);

      expect(res.status).toBe(200);
      expect(body).toMatchObject({ mfaRequired: true, mfaVerified: false, riskLevel: 'LOW' });
      expect(body.accessToken.split('.')).toHaveLength(3);
      expect(Object.keys(body)).not.toContain('refreshToken');
      expect(JSON.stringify(body)).not.toContain(cookie.split('=')[1]);

      const raw = refreshCookie(res).raw!;
      expect(raw).toMatch(/HttpOnly/i);
      expect(raw).toMatch(/SameSite=Strict/i);
      expect(raw).toMatch(/Path=\/api\/v1\/auth/);
      expect(raw).toMatch(/Expires=/i);
      expect(raw).not.toMatch(/;\s*Secure/i); // environnement de test : cookie non sécurisé (obligatoire en production)
      expect(res.headers.get('cache-control')).toBe('no-store');
    });

    it('échec : 401 problem+json générique, aucun cookie, aucun détail interne', async () => {
      const email = await newUser();
      const res = await post('/api/v1/auth/login', { email, password: 'mauvais mot de passe' });
      const unknown = await post('/api/v1/auth/login', { email: uniqueEmail('inconnu'), password: 'mauvais mot de passe' });

      for (const r of [res, unknown]) {
        expect(r.status).toBe(401);
        expect(r.headers.get('content-type')).toContain('application/problem+json');
        expect(refreshCookie(r).raw).toBeUndefined();
      }
      const a = await json(res);
      const b = await json(unknown);
      expect(a).toEqual(b); // indiscernable : pas d'énumération de comptes
      expect(a.detail).toBe('Identifiants invalides');
      expect(JSON.stringify(a)).not.toMatch(/stack|prisma|sql|argon|\.ts/i);
    });

    it('refuse un corps invalide : champ inconnu, mot de passe démesuré, champ manquant', async () => {
      const email = await newUser();
      expect((await post('/api/v1/auth/login', { email, password: TEST_PASSWORD, admin: true })).status).toBe(400);
      expect((await post('/api/v1/auth/login', { email, password: 'x'.repeat(300) })).status).toBe(400);
      expect((await post('/api/v1/auth/login', { email })).status).toBe(400);
      expect((await post('/api/v1/auth/login', {})).status).toBe(400);
    });

    it('traite une adresse invalide comme un compte inconnu (401, pas 400)', async () => {
      expect((await post('/api/v1/auth/login', { email: 'pas une adresse', password: 'x' })).status).toBe(401);
    });
  });

  describe('D2 — rafraîchissement', () => {
    it('avec le cookie : nouveau jeton et nouveau cookie ; sans cookie ou avec un cookie bidon : 401', async () => {
      const { body, cookie } = await loginAs(await newUser());
      const res = await post('/api/v1/auth/refresh', undefined, { cookie });
      expect(res.status).toBe(200);
      const fresh = await json(res);
      expect(fresh.accessToken).not.toBe(body.accessToken);
      expect(refreshCookie(res).pair).not.toBe(cookie);

      expect((await post('/api/v1/auth/refresh')).status).toBe(401);
      const bogus = await post('/api/v1/auth/refresh', undefined, { cookie: 'crm_refresh=n-importe-quoi' });
      expect(bogus.status).toBe(401);
      expect(refreshCookie(bogus).raw).toMatch(/Expires=Thu, 01 Jan 1970/i); // cookie effacé
    });

    it("l'ancien cookie, rejoué hors tolérance, coupe la session ; ici dans la tolérance il est simplement refusé", async () => {
      const { cookie } = await loginAs(await newUser());
      expect((await post('/api/v1/auth/refresh', undefined, { cookie })).status).toBe(200);
      expect((await post('/api/v1/auth/refresh', undefined, { cookie })).status).toBe(401);
    });
  });

  describe('Profil pour l interface', () => {
    it('renvoie nom, rôles et droits sans aucun secret ; 401 sans jeton', async () => {
      const { body } = await loginAs(await newUser());
      const res = await get('/api/v1/auth/me/profile', { authorization: `Bearer ${body.accessToken}` });
      expect(res.status).toBe(200);
      const profile = await json(res);
      expect(Object.keys(profile).sort()).toEqual(['displayName', 'email', 'mfaEnrolled', 'permissions', 'roles', 'userId']);
      expect(profile).toMatchObject({ userId: body.userId, mfaEnrolled: false });
      expect(profile.roles.length).toBeGreaterThan(0);
      expect(profile.permissions.length).toBeGreaterThan(0);
      expect(profile.permissions[0]).toEqual({ code: expect.any(String), scope: expect.stringMatching(/^(OWN|TEAM|ALL)$/) });
      expect(JSON.stringify(profile)).not.toMatch(/hash|secret|argon/i);
      expect((await get('/api/v1/auth/me/profile', {})).status).toBe(401);
    });
  });

  describe('401 : jeton refusé ou identifiants refusés', () => {
    it('un jeton refusé porte WWW-Authenticate invalid_token ; un mot de passe refusé ne le porte pas', async () => {
      const noToken = await get('/api/v1/auth/me', {});
      expect(noToken.status).toBe(401);
      expect(noToken.headers.get('www-authenticate')).toBe('Bearer error="invalid_token"');

      const email = await newUser();
      const badLogin = await post('/api/v1/auth/login', { email, password: 'mauvais mot de passe' });
      expect(badLogin.status).toBe(401);
      expect(badLogin.headers.get('www-authenticate')).toBeNull();
    });
  });

  describe('D3 — /auth/me', () => {
    it('200 avec un jeton valide ; 401 sans en-tête, mal formé, falsifié ou vide', async () => {
      const { body } = await loginAs(await newUser());
      const ok = await get('/api/v1/auth/me', { authorization: `Bearer ${body.accessToken}` });
      expect(ok.status).toBe(200);
      expect(await json(ok)).toEqual({ userId: body.userId, sessionId: body.sessionId, mfaVerified: false, hasFreshMfa: false });

      const [h, p, s] = body.accessToken.split('.');
      const forgedPayload = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p, 'base64url').toString()), sub: 'autre' })).toString('base64url');
      for (const authorization of [undefined, 'Bearer ', 'Bearer', 'Basic abc', `Bearer ${h}.${p}.`, `Bearer ${h}.${forgedPayload}.${s}`, 'Bearer a.b.c']) {
        const res = await get('/api/v1/auth/me', authorization ? { authorization } : {});
        expect(res.status).toBe(401);
        expect((await json(res)).detail).toBe('Authentification requise');
      }
    });
  });

  describe('D4 — déconnexion', () => {
    it('204, puis le jeton d\'accès ET le cookie sont refusés immédiatement', async () => {
      const { body, cookie } = await loginAs(await newUser());
      const auth = { authorization: `Bearer ${body.accessToken}` };

      const out = await post('/api/v1/auth/logout', undefined, auth);
      expect(out.status).toBe(204);
      expect(refreshCookie(out).raw).toMatch(/Expires=Thu, 01 Jan 1970/i);

      expect((await get('/api/v1/auth/me', auth)).status).toBe(401);
      expect((await post('/api/v1/auth/refresh', undefined, { cookie })).status).toBe(401);
      expect((await post('/api/v1/auth/logout', undefined, auth)).status).toBe(401); // déjà déconnecté
    });

    it('exige un jeton valide', async () => {
      expect((await post('/api/v1/auth/logout')).status).toBe(401);
    });
  });

  describe('D5 — limitation de débit', () => {
    it('refuse la 6e tentative de connexion en une minute (429 + Retry-After), sans bloquer les autres comptes', async () => {
      const email = await newUser();
      const other = await newUser();
      const statuses: number[] = [];
      let last: Response | undefined;
      for (let i = 0; i < 6; i++) {
        last = await post('/api/v1/auth/login', { email, password: 'mauvais mot de passe' });
        statuses.push(last.status);
      }
      expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
      expect(statuses[5]).toBe(429);
      expect(Number(last!.headers.get('retry-after'))).toBeGreaterThan(0);

      // Même IP, autre compte : non touché (limite par couple IP + e-mail)
      expect((await post('/api/v1/auth/login', { email: other, password: TEST_PASSWORD })).status).toBe(200);
    });

    it('même avec le BON mot de passe, la 6e tentative est refusée (la limite précède la vérification)', async () => {
      const email = await newUser();
      for (let i = 0; i < 5; i++) await post('/api/v1/auth/login', { email, password: 'mauvais mot de passe' });
      expect((await post('/api/v1/auth/login', { email, password: TEST_PASSWORD })).status).toBe(429);
    });
  });

  describe('D6 — en-têtes de sécurité', () => {
    it.each(['/health/live', '/api/v1/auth/me'])('présents sur %s, X-Powered-By absent', async (path) => {
      const res = await get(path);
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('strict-transport-security')).toMatch(/max-age=\d+/);
      expect(res.headers.get('x-frame-options')).toBeTruthy();
      expect(res.headers.get('x-powered-by')).toBeNull();
    });
  });

  describe('D7 — erreurs', () => {
    it("ne laisse fuiter ni trace ni détail technique, y compris sur route inconnue ou corps JSON cassé", async () => {
      const unknown = await get('/api/v1/n-existe-pas');
      expect(unknown.status).toBe(404);
      const broken = await fetch(`${t.baseUrl}/api/v1/auth/login`, { method: 'POST', headers: JSON_HEADERS, body: '{"email": ' });
      expect(broken.status).toBe(400);
      for (const res of [unknown, broken]) {
        expect(JSON.stringify(await json(res))).not.toMatch(/stack|node_modules|at Object|\.ts:\d+/);
      }
    });
  });

  describe('CSRF — contrôle de l\'origine', () => {
    it('refuse une origine inconnue (403) et accepte une origine autorisée ou l\'absence d\'Origin (client non navigateur)', async () => {
      const { cookie } = await loginAs(await newUser());
      expect((await post('/api/v1/auth/refresh', undefined, { cookie, origin: 'https://evil.test' })).status).toBe(403);
      expect((await post('/api/v1/auth/login', { email: 'a@b.test', password: 'x' }, { origin: 'https://evil.test' })).status).toBe(403);
      expect((await post('/api/v1/auth/refresh', undefined, { cookie, origin: 'http://127.0.0.1:3000' })).status).toBe(200);
    });
  });

  describe('changement de mot de passe', () => {
    it('204 ; l\'ancien mot de passe ne fonctionne plus ; une politique violée donne 400 ; sans jeton 401', async () => {
      const email = await newUser();
      const { body } = await loginAs(email);
      const auth = { authorization: `Bearer ${body.accessToken}` };

      expect((await post('/api/v1/auth/change-password', { currentPassword: TEST_PASSWORD, newPassword: 'court' }, auth)).status).toBe(400);
      expect((await post('/api/v1/auth/change-password', { currentPassword: 'faux', newPassword: 'une nouvelle phrase de passe 58' }, auth)).status).toBe(403);
      expect((await post('/api/v1/auth/change-password', { currentPassword: TEST_PASSWORD, newPassword: 'une nouvelle phrase de passe 58' })).status).toBe(401);

      const ok = await post('/api/v1/auth/change-password', { currentPassword: TEST_PASSWORD, newPassword: 'une nouvelle phrase de passe 58' }, auth);
      expect(ok.status).toBe(204);
      expect((await post('/api/v1/auth/login', { email, password: TEST_PASSWORD })).status).toBe(401);
      expect((await post('/api/v1/auth/login', { email, password: 'une nouvelle phrase de passe 58' })).status).toBe(200);
    }, 60_000);
  });

  it("expose Swagger hors production", async () => {
    expect((await get('/api/docs')).status).toBe(200);
  });
});
