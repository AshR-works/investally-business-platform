import 'reflect-metadata';
import { CreateUserUseCase } from '../src/modules/iam/application/create-user.use-case';
import { base32Decode } from '../src/modules/iam/domain/base32';
import { RoleCode } from '../src/modules/iam/domain/roles';
import { totp } from '../src/modules/iam/domain/totp';
import { SYSTEM_ACTOR, TEST_PASSWORD, TestApp, startTestApp, uniqueEmail } from './support/test-app';

const describeDb = process.env.DATABASE_URL && process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const json = async (res: Response): Promise<any> => res.json();
const HEADERS = { 'content-type': 'application/json', 'user-agent': 'recette-mfa' };
const STEP_MS = 30_000;

const codeAt = (secret: string, offset = 0) => totp(base32Decode(secret), Date.now() + offset * STEP_MS);
const claimsOf = (token: string) => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')) as { amr: string[]; sid: string };

/** Parcours MFA complet sur HTTP, avec de vrais codes TOTP calculés à partir du secret renvoyé. */
describeDb('MFA HTTP (PostgreSQL)', () => {
  let t: TestApp;
  beforeAll(async () => { t = await startTestApp(); }, 60_000);
  afterAll(() => t.close());

  const post = (path: string, body?: unknown, headers: Record<string, string> = {}) =>
    fetch(`${t.baseUrl}${path}`, { method: 'POST', headers: { ...HEADERS, ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const get = (path: string, headers: Record<string, string> = {}) => fetch(`${t.baseUrl}${path}`, { headers: { ...HEADERS, ...headers } });
  const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

  async function newUser(roles: RoleCode[] = [RoleCode.AccountManager]) {
    const email = uniqueEmail('mfahttp');
    await t.get(CreateUserUseCase).execute({ email, displayName: 'Utilisateur Http', password: TEST_PASSWORD, roles, actor: SYSTEM_ACTOR });
    return email;
  }
  async function loginAs(email: string) {
    const res = await post('/api/v1/auth/login', { email, password: TEST_PASSWORD });
    return { res, body: await json(res) };
  }
  /** Utilisateur enrôlé ; le code de confirmation consomme le pas de temps courant. */
  async function enrolledUser() {
    const email = await newUser();
    const first = await loginAs(email);
    const started = await json(await post('/api/v1/auth/mfa/enroll/start', undefined, bearer(first.body.accessToken)));
    const confirmedRes = await post('/api/v1/auth/mfa/enroll/confirm', { code: codeAt(started.secret) }, bearer(first.body.accessToken));
    const confirmed = await json(confirmedRes);
    return { email, secret: started.secret as string, first, started, confirmedRes, confirmed };
  }

  describe('E1 — parcours complet', () => {
    it('connexion → enrôlement → confirmation → déconnexion → connexion → vérification → amr = [pwd, otp]', async () => {
      const email = await newUser();

      // 1) Connexion initiale : mot de passe seul, MFA à enrôler
      const first = await loginAs(email);
      expect(first.body).toMatchObject({ mfaRequired: true, mfaEnrolled: false, mfaVerified: false });
      expect(claimsOf(first.body.accessToken).amr).toEqual(['pwd']);

      // 2) Démarrage de l'enrôlement : secret + URI scannable
      const startRes = await post('/api/v1/auth/mfa/enroll/start', undefined, bearer(first.body.accessToken));
      expect(startRes.status).toBe(200);
      expect(startRes.headers.get('cache-control')).toBe('no-store');
      const started = await json(startRes);
      expect(started.secret).toMatch(/^[A-Z2-7]{32}$/);
      expect(started.otpauthUri).toContain('otpauth://totp/');
      expect(started.otpauthUri).toContain(`secret=${started.secret}`);

      // 3) Confirmation avec un vrai code TOTP : codes de secours + jeton vérifié
      const confirmedRes = await post('/api/v1/auth/mfa/enroll/confirm', { code: codeAt(started.secret) }, bearer(first.body.accessToken));
      expect(confirmedRes.status).toBe(200);
      const confirmed = await json(confirmedRes);
      expect(confirmed.recoveryCodes).toHaveLength(10);
      expect(claimsOf(confirmed.accessToken).amr).toEqual(['pwd', 'otp']);
      const me = await json(await get('/api/v1/auth/me', bearer(confirmed.accessToken)));
      expect(me).toMatchObject({ mfaVerified: true, hasFreshMfa: true });

      // 4) Déconnexion, puis nouvelle connexion : MFA configuré mais pas encore vérifié
      expect((await post('/api/v1/auth/logout', undefined, bearer(confirmed.accessToken))).status).toBe(204);
      const second = await loginAs(email);
      expect(second.body).toMatchObject({ mfaRequired: true, mfaEnrolled: true, mfaVerified: false });
      expect(claimsOf(second.body.accessToken).amr).toEqual(['pwd']);
      expect(await json(await get('/api/v1/auth/me', bearer(second.body.accessToken)))).toMatchObject({ mfaVerified: false, hasFreshMfa: false });

      // 5) Vérification du code (pas suivant : le pas courant a servi à la confirmation, anti-rejeu)
      const verifyRes = await post('/api/v1/auth/mfa/verify', { code: codeAt(started.secret, 1) }, bearer(second.body.accessToken));
      expect(verifyRes.status).toBe(200);
      const verified = await json(verifyRes);
      expect(claimsOf(verified.accessToken).amr).toEqual(['pwd', 'otp']);
      expect(await json(await get('/api/v1/auth/me', bearer(verified.accessToken)))).toMatchObject({ mfaVerified: true, hasFreshMfa: true });
    }, 60_000);

    it('le secret n\'est renvoyé qu\'à l\'enrôlement : ni /me, ni la connexion, ni la vérification ne le contiennent', async () => {
      const user = await enrolledUser();
      const second = await loginAs(user.email);
      const verified = await json(await post('/api/v1/auth/mfa/verify', { code: codeAt(user.secret, 1) }, bearer(second.body.accessToken)));
      const me = await json(await get('/api/v1/auth/me', bearer(verified.accessToken)));
      for (const payload of [second.body, verified, me]) expect(JSON.stringify(payload)).not.toContain(user.secret);
    }, 60_000);

    it('un enrôlement actif ne peut pas être remplacé depuis une session (409)', async () => {
      const user = await enrolledUser();
      const again = await post('/api/v1/auth/mfa/enroll/start', undefined, bearer(user.confirmed.accessToken));
      expect(again.status).toBe(409);
    }, 60_000);
  });

  describe('E2 — code erroné et limitation', () => {
    it('401 générique pour un mauvais code, puis 429 + Retry-After à la 6e tentative en une minute', async () => {
      const user = await enrolledUser();
      const second = await loginAs(user.email);
      const statuses: number[] = [];
      let last: Response | undefined;
      for (let i = 0; i < 6; i++) {
        last = await post('/api/v1/auth/mfa/verify', { code: '000000' }, bearer(second.body.accessToken));
        statuses.push(last.status);
      }
      expect(statuses).toEqual([401, 401, 401, 401, 401, 429]);
      expect(Number(last!.headers.get('retry-after'))).toBeGreaterThan(0);
    }, 60_000);

    it('le message d\'un mauvais code est identique quelle que soit la cause (code faux, format invalide)', async () => {
      const user = await enrolledUser();
      const second = await loginAs(user.email);
      const a = await post('/api/v1/auth/mfa/verify', { code: '000000' }, bearer(second.body.accessToken));
      const b = await post('/api/v1/auth/mfa/verify', { code: 'abc' }, bearer(second.body.accessToken));
      expect([a.status, b.status]).toEqual([401, 401]);
      const [bodyA, bodyB] = [await json(a), await json(b)];
      expect(bodyA.detail).toBe(bodyB.detail);
      expect(bodyA.detail).toBe('Code invalide');
    }, 60_000);

    it('limite par SESSION : un autre utilisateur de la même IP n\'est pas bloqué', async () => {
      const burned = await enrolledUser();
      const sessionBurned = await loginAs(burned.email);
      for (let i = 0; i < 6; i++) await post('/api/v1/auth/mfa/verify', { code: '000000' }, bearer(sessionBurned.body.accessToken));

      const colleague = await enrolledUser();
      const sessionColleague = await loginAs(colleague.email);
      const res = await post('/api/v1/auth/mfa/verify', { code: codeAt(colleague.secret, 1) }, bearer(sessionColleague.body.accessToken));
      expect(res.status).toBe(200);
    }, 120_000);

    it('refuse un corps invalide : code absent, démesuré, champ inconnu', async () => {
      const user = await enrolledUser();
      const second = await loginAs(user.email);
      for (const body of [{}, { code: 'x'.repeat(33) }, { code: '123456', admin: true }, { code: 123456 }]) {
        expect((await post('/api/v1/auth/mfa/verify', body, bearer(second.body.accessToken))).status).toBe(400);
      }
    }, 60_000);
  });

  describe('E3 — codes de secours et step-up', () => {
    it('un code de secours connecte par HTTP (une fois) et indique combien il en reste', async () => {
      const user = await enrolledUser();
      const second = await loginAs(user.email);
      const code = user.confirmed.recoveryCodes[0] as string;

      const ok = await post('/api/v1/auth/mfa/verify', { code }, bearer(second.body.accessToken));
      expect(ok.status).toBe(200);
      expect((await json(ok)).recoveryCodesRemaining).toBe(9);

      const third = await loginAs(user.email);
      expect((await post('/api/v1/auth/mfa/verify', { code }, bearer(third.body.accessToken))).status).toBe(401); // déjà consommé
    }, 60_000);

    it('la régénération exige un MFA récent (guard + cas d\'usage) et invalide les anciens codes', async () => {
      const user = await enrolledUser();

      // Session mot de passe seul : MFA_REQUIRED
      const pwdOnly = await loginAs(user.email);
      const refused = await post('/api/v1/auth/mfa/recovery-codes/regenerate', undefined, bearer(pwdOnly.body.accessToken));
      expect(refused.status).toBe(403);
      expect((await json(refused)).title).toBe('MFA_REQUIRED');

      // Session vérifiée récemment : OK
      const ok = await post('/api/v1/auth/mfa/recovery-codes/regenerate', undefined, bearer(user.confirmed.accessToken));
      expect(ok.status).toBe(200);
      const fresh = (await json(ok)).recoveryCodes as string[];
      expect(fresh).toHaveLength(10);
      expect(fresh.some((c) => (user.confirmed.recoveryCodes as string[]).includes(c))).toBe(false);

      // MFA vérifié il y a plus de 10 minutes : MFA_STEP_UP_REQUIRED
      const sid = claimsOf(user.confirmed.accessToken).sid;
      await t.prisma.db.userSession.update({ where: { id: sid }, data: { mfaVerifiedAt: new Date(Date.now() - 11 * 60_000) } });
      const stale = await post('/api/v1/auth/mfa/recovery-codes/regenerate', undefined, bearer(user.confirmed.accessToken));
      expect(stale.status).toBe(403);
      expect((await json(stale)).title).toBe('MFA_STEP_UP_REQUIRED');

      // Un step-up (nouveau code) rend de nouveau l'action possible
      const stepUp = await json(await post('/api/v1/auth/mfa/verify', { code: fresh[0] }, bearer(user.confirmed.accessToken)));
      const again = await post('/api/v1/auth/mfa/recovery-codes/regenerate', undefined, bearer(stepUp.accessToken));
      expect(again.status).toBe(200);
    }, 120_000);
  });

  describe('E4 — authentification obligatoire', () => {
    it.each([
      '/api/v1/auth/mfa/enroll/start',
      '/api/v1/auth/mfa/enroll/confirm',
      '/api/v1/auth/mfa/verify',
      '/api/v1/auth/mfa/recovery-codes/regenerate',
    ])('POST %s sans jeton : 401', async (path) => {
      expect((await post(path, { code: '123456' })).status).toBe(401);
      expect((await post(path, { code: '123456' }, { authorization: 'Bearer a.b.c' })).status).toBe(401);
    });
  });

  describe('E5 — contrôle de l\'origine (CSRF)', () => {
    it.each([
      '/api/v1/auth/mfa/enroll/start',
      '/api/v1/auth/mfa/enroll/confirm',
      '/api/v1/auth/mfa/verify',
      '/api/v1/auth/mfa/recovery-codes/regenerate',
    ])('POST %s depuis une origine inconnue : 403', async (path) => {
      const user = await enrolledUser();
      const res = await post(path, { code: '123456' }, { ...bearer(user.confirmed.accessToken), origin: 'https://evil.test' });
      expect(res.status).toBe(403);
    }, 60_000);

    it('accepte l\'origine autorisée', async () => {
      const user = await enrolledUser();
      const second = await loginAs(user.email);
      const res = await post('/api/v1/auth/mfa/verify', { code: codeAt(user.secret, 1) }, { ...bearer(second.body.accessToken), origin: 'http://127.0.0.1:3000' });
      expect(res.status).toBe(200);
    }, 60_000);
  });
});
