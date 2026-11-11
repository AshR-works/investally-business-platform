import { AccessTokenService, ACCESS_TOKEN_SERVICE } from '../../src/modules/iam/application/ports';
import { CreateUserUseCase } from '../../src/modules/iam/application/create-user.use-case';
import { RoleCode } from '../../src/modules/iam/domain/roles';
import { SYSTEM_ACTOR, TEST_PASSWORD, TestApp, startTestApp, uniqueEmail } from './test-app';

export interface ApiResponse {
  status: number;
  headers: Headers;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
  /** Corps brut de la réponse (fichiers téléchargés). */
  bytes: Buffer;
}

/** Client HTTP minimal. `ip` simule le client réel derrière le proxy (TRUST_PROXY=loopback) : une limite par IP par scénario. */
export class Api {
  constructor(private readonly baseUrl: string) {}

  async call(
    method: string,
    path: string,
    options: { token?: string; body?: unknown; raw?: { type: string; data: Buffer }; ip?: string; headers?: Record<string, string>; cookie?: string } = {},
  ): Promise<ApiResponse> {
    const headers: Record<string, string> = { 'user-agent': 'recette-rbac', ...options.headers };
    if (options.body !== undefined) headers['content-type'] = 'application/json';
    if (options.raw) headers['content-type'] = options.raw.type;
    if (options.token) headers.authorization = `Bearer ${options.token}`;
    if (options.cookie) headers.cookie = options.cookie;
    if (options.ip) headers['x-forwarded-for'] = options.ip;
    const payload = options.raw ? new Uint8Array(options.raw.data) : options.body === undefined ? undefined : JSON.stringify(options.body);
    const res = await fetch(`${this.baseUrl}${path}`, { method, headers, body: payload });
    const bytes = Buffer.from(await res.arrayBuffer());
    const text = bytes.toString('utf8');
    let body: unknown = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    return { status: res.status, headers: res.headers, body, bytes };
  }
}

export async function startRbacApp(): Promise<{ t: TestApp; api: Api }> {
  // Derrière le proxy Next.js : l'IP cliente vient de X-Forwarded-For (et le test la fait varier par scénario).
  process.env.TRUST_PROXY = 'loopback';
  const t = await startTestApp();
  return { t, api: new Api(t.baseUrl) };
}

export async function createUserWithRoles(t: TestApp, roles: RoleCode[], options: { email?: string; managerId?: string | null; name?: string } = {}) {
  const email = options.email ?? uniqueEmail(roles[0].toLowerCase());
  const { id } = await t.get(CreateUserUseCase).execute({
    email, displayName: options.name ?? 'Utilisateur Test', password: TEST_PASSWORD, roles, managerId: options.managerId ?? null, actor: SYSTEM_ACTOR,
  });
  return { id, email };
}

/**
 * Session « MFA vérifié » obtenue sans recalculer de TOTP (le parcours TOTP est testé à part en S3.2) :
 * connexion réelle, session marquée vérifiée en base, jeton `pwd+otp` émis par le vrai service de jetons.
 */
export async function mfaSession(t: TestApp, api: Api, email: string, ip = '127.0.0.1', mfaAgeMs = 0) {
  const login = await api.call('POST', '/api/v1/auth/login', { body: { email, password: TEST_PASSWORD }, ip });
  if (login.status !== 200) throw new Error(`connexion impossible pour ${email} : ${login.status}`);
  const { userId, sessionId } = login.body as { userId: string; sessionId: string };
  const verifiedAt = new Date(Date.now() - mfaAgeMs);
  await t.prisma.db.userSession.update({ where: { id: sessionId }, data: { mfaVerified: true, mfaVerifiedAt: verifiedAt } });
  const issued = await (t.get(ACCESS_TOKEN_SERVICE as never) as AccessTokenService).issue({ sub: userId, sid: sessionId, amr: ['pwd', 'otp'] }, 15 * 60_000, new Date());
  return { token: issued.token, userId, sessionId, passwordOnlyToken: login.body.accessToken as string };
}
