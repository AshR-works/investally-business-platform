import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError, api, describeProblem, hasAccessToken, resetApiClient, setAccessToken, setSessionLostHandler, setStepUpHandler,
} from '../lib/api';

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;

const TOKEN_REJECTED = { 'www-authenticate': 'Bearer error="invalid_token"' };

function json(status: number, body: unknown, extraHeaders: Record<string, string> = {}): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...extraHeaders } });
}

let calls: { url: string; init: RequestInit }[];

function mockFetch(handler: Handler) {
  calls = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return handler(url, init);
  }));
}
const authHeader = (call: { init: RequestInit }) => (call.init.headers as Record<string, string>).Authorization;

beforeEach(() => resetApiClient());
afterEach(() => vi.unstubAllGlobals());

describe('describeProblem', () => {
  it('utilise le détail texte de l\'API et son code', () => {
    expect(describeProblem(400, { title: 'VALIDATION', detail: 'Au moins 12 caractères' })).toEqual({ code: 'VALIDATION', message: 'Au moins 12 caractères' });
  });
  it('assemble les messages de validation de la liste', () => {
    expect(describeProblem(400, { title: 'BadRequestException', detail: { message: ['a', 'b'] } }).message).toBe('a ; b');
  });
  it('message dédié pour la limitation de débit', () => {
    expect(describeProblem(429, null).code).toBe('RATE_LIMITED');
  });
  it('n\'affiche jamais un détail inattendu (objet, nombre)', () => {
    expect(describeProblem(500, { title: 'X', detail: { stack: 'secret' } }).message).toBe('Une erreur est survenue. Réessayez.');
    expect(describeProblem(500, { detail: 42 }).message).toBe('Une erreur est survenue. Réessayez.');
  });
});

describe('api()', () => {
  it('envoie le jeton en mémoire et jamais dans l\'URL', async () => {
    mockFetch(() => json(200, { ok: true }));
    setAccessToken('tok-1');
    await api('/auth/me');
    expect(authHeader(calls[0])).toBe('Bearer tok-1');
    expect(calls[0].url).toBe('/api/v1/auth/me');
    expect(calls[0].url).not.toContain('tok-1');
  });

  it('route publique : aucun jeton envoyé, aucun rafraîchissement sur 401', async () => {
    mockFetch(() => json(401, { title: 'UNAUTHENTICATED', detail: 'Identifiants invalides' }));
    setAccessToken('tok-1');
    await expect(api('/auth/login', { method: 'POST', body: {}, auth: false })).rejects.toMatchObject({ status: 401, message: 'Identifiants invalides' });
    expect(calls).toHaveLength(1);
    expect(authHeader(calls[0])).toBeUndefined();
  });

  it("un 401 SANS invalid_token (mauvais code MFA) n'est JAMAIS rejoué ni ne déclenche de rafraîchissement", async () => {
    mockFetch(() => json(401, { title: 'UNAUTHENTICATED', detail: 'Code invalide' }));
    const lost = vi.fn();
    setSessionLostHandler(lost);
    setAccessToken('tok-1');
    await expect(api('/auth/mfa/verify', { method: 'POST', body: { code: '000000' } })).rejects.toMatchObject({ status: 401, message: 'Code invalide' });
    expect(calls).toHaveLength(1);
    expect(lost).not.toHaveBeenCalled();
    expect(hasAccessToken()).toBe(true);
  });

  it('401 : un rafraîchissement, puis une seule nouvelle tentative avec le nouveau jeton', async () => {
    let first = true;
    mockFetch((url) => {
      if (url === '/api/v1/auth/refresh') return json(200, { accessToken: 'tok-2' });
      if (first) { first = false; return json(401, { title: 'UNAUTHENTICATED', detail: 'x' }, TOKEN_REJECTED); }
      return json(200, { value: 1 });
    });
    setAccessToken('tok-1');
    await expect(api('/companies')).resolves.toEqual({ value: 1 });
    expect(calls.map((c) => c.url)).toEqual(['/api/v1/companies', '/api/v1/auth/refresh', '/api/v1/companies']);
    expect(authHeader(calls[2])).toBe('Bearer tok-2');
  });

  it('plusieurs 401 simultanés partagent UN SEUL rafraîchissement', async () => {
    const seen = new Map<string, number>();
    mockFetch(async (url, init) => {
      if (url === '/api/v1/auth/refresh') { await new Promise((r) => setTimeout(r, 20)); return json(200, { accessToken: 'tok-2' }); }
      const token = (init.headers as Record<string, string>).Authorization;
      seen.set(url, (seen.get(url) ?? 0) + 1);
      return token === 'Bearer tok-2' ? json(200, {}) : json(401, { title: 'UNAUTHENTICATED', detail: 'x' }, TOKEN_REJECTED);
    });
    setAccessToken('tok-1');
    await Promise.all([api('/a'), api('/b'), api('/c')]);
    expect(calls.filter((c) => c.url === '/api/v1/auth/refresh')).toHaveLength(1);
  });

  it('rafraîchissement refusé : session perdue signalée, jeton effacé, erreur remontée, pas de boucle', async () => {
    mockFetch((url) => (url === '/api/v1/auth/refresh' ? json(401, { title: 'UNAUTHENTICATED', detail: 'x' }) : json(401, { title: 'UNAUTHENTICATED', detail: 'Authentification requise' }, TOKEN_REJECTED)));
    const lost = vi.fn();
    setSessionLostHandler(lost);
    setAccessToken('tok-1');
    await expect(api('/companies')).rejects.toBeInstanceOf(ApiError);
    expect(lost).toHaveBeenCalledTimes(1);
    expect(hasAccessToken()).toBe(false);
    expect(calls).toHaveLength(2);
  });

  it('step-up : demande un code, puis rejoue la requête UNE fois ; sans code, l\'erreur est remontée', async () => {
    let allowed = false;
    mockFetch(() => (allowed ? json(200, { done: true }) : json(403, { title: 'MFA_STEP_UP_REQUIRED', detail: 'Une vérification MFA récente est requise' })));
    setAccessToken('tok-1');

    setStepUpHandler(async () => { allowed = true; return true; });
    await expect(api('/admin/users', { method: 'POST', body: {} })).resolves.toEqual({ done: true });
    expect(calls).toHaveLength(2);

    allowed = false;
    setStepUpHandler(async () => false);
    await expect(api('/admin/users', { method: 'POST', body: {} })).rejects.toMatchObject({ status: 403, code: 'MFA_STEP_UP_REQUIRED' });
  });

  it('plusieurs actions sensibles simultanées ne posent qu\'UNE question à l\'utilisateur', async () => {
    let allowed = false;
    mockFetch(() => (allowed ? json(200, {}) : json(403, { title: 'MFA_STEP_UP_REQUIRED', detail: 'x' })));
    const handler = vi.fn(async () => { await new Promise((r) => setTimeout(r, 10)); allowed = true; return true; });
    setStepUpHandler(handler);
    setAccessToken('tok-1');
    await Promise.all([api('/a', { method: 'POST' }), api('/b', { method: 'POST' })]);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('un 403 ordinaire ne déclenche pas de step-up', async () => {
    mockFetch(() => json(403, { title: 'FORBIDDEN', detail: 'Accès refusé' }));
    const handler = vi.fn(async () => true);
    setStepUpHandler(handler);
    setAccessToken('tok-1');
    await expect(api('/admin/users')).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN', message: 'Accès refusé' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('204 sans corps', async () => {
    mockFetch(() => json(204, undefined));
    await expect(api('/auth/logout', { method: 'POST' })).resolves.toBeUndefined();
  });

  it('n\'écrit le jeton ni dans localStorage ni dans sessionStorage', async () => {
    const store = { setItem: vi.fn(), getItem: vi.fn(), removeItem: vi.fn() };
    vi.stubGlobal('localStorage', store);
    vi.stubGlobal('sessionStorage', store);
    mockFetch((url) => (url === '/api/v1/auth/refresh' ? json(200, { accessToken: 'tok-2' }) : json(200, {})));
    setAccessToken('tok-1');
    await api('/x');
    expect(store.setItem).not.toHaveBeenCalled();
  });
});
