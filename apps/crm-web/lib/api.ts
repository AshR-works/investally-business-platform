/**
 * Client HTTP de l'interface.
 *
 * - Le jeton d'accès vit UNIQUEMENT en mémoire (jamais localStorage/sessionStorage : un script injecté ne peut pas le lire
 *   durablement). Le jeton de rafraîchissement est dans un cookie HttpOnly que ce code ne voit jamais.
 * - Un 401 dû au jeton (en-tête `WWW-Authenticate: invalid_token`) déclenche UN rafraîchissement (partagé entre les
 *   requêtes simultanées), puis UNE nouvelle tentative. Un autre 401 (mauvais code, mauvais mot de passe) est remonté tel quel.
 * - Un 403 `MFA_STEP_UP_REQUIRED` demande un code à l'utilisateur (via le gestionnaire enregistré), puis UNE nouvelle tentative.
 */

/** Erreur renvoyée par l'API : statut HTTP, code stable (`FORBIDDEN`, `MFA_REQUIRED`…) et message lisible. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    /** Code stable de l'API (champ `title` du problem+json), ex. `FORBIDDEN`, `MFA_REQUIRED`. */
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let accessToken: string | null = null;
let refreshInFlight: Promise<boolean> | null = null;
let stepUpHandler: (() => Promise<boolean>) | null = null;
let stepUpInFlight: Promise<boolean> | null = null;
let onSessionLost: (() => void) | null = null;

/** Installe (ou efface) le jeton d'accès, gardé uniquement en mémoire. */
export function setAccessToken(token: string | null): void {
  accessToken = token;
}
/** Vrai si un jeton d'accès est actuellement en mémoire. */
export function hasAccessToken(): boolean {
  return accessToken !== null;
}
/** Enregistre la fonction qui demande un code frais à l'utilisateur quand l'API exige un MFA récent. */
export function setStepUpHandler(handler: (() => Promise<boolean>) | null): void {
  stepUpHandler = handler;
}
/** Enregistre la fonction appelée quand la session est définitivement perdue (rafraîchissement refusé). */
export function setSessionLostHandler(handler: (() => void) | null): void {
  onSessionLost = handler;
}
/** Remise à zéro (tests, déconnexion). */
export function resetApiClient(): void {
  accessToken = null;
  refreshInFlight = null;
  stepUpInFlight = null;
  stepUpHandler = null;
  onSessionLost = null;
}

/** Corps d'erreur `application/problem+json` de l'API (RFC 7807). */
export interface ProblemBody {
  title?: unknown;
  detail?: unknown;
}

/** Message lisible : le `detail` de l'API s'il est textuel ou une liste de textes (validation), sinon un message générique. */
export function describeProblem(status: number, body: ProblemBody | null): { code: string; message: string } {
  const code = typeof body?.title === 'string' ? body.title : 'ERROR';
  const detail = body?.detail;
  if (typeof detail === 'string' && detail) return { code, message: detail };
  if (detail && typeof detail === 'object') {
    const inner = (detail as { message?: unknown }).message;
    if (Array.isArray(inner) && inner.every((item) => typeof item === 'string')) return { code, message: inner.join(' ; ') };
    if (typeof inner === 'string') return { code, message: inner };
  }
  if (status === 429) return { code: 'RATE_LIMITED', message: 'Trop de tentatives. Patientez une minute puis réessayez.' };
  return { code, message: 'Une erreur est survenue. Réessayez.' };
}

/** Lit la réponse d'erreur et la transforme en `ApiError`. */
async function toError(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => null)) as ProblemBody | null;
  const { code, message } = describeProblem(res.status, body);
  return new ApiError(res.status, code, message);
}

/** Échange le cookie de rafraîchissement contre un nouveau jeton d'accès. Une seule requête à la fois. */
export function refreshAccessToken(): Promise<boolean> {
  refreshInFlight ??= (async () => {
    try {
      const res = await fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'same-origin' });
      if (!res.ok) {
        accessToken = null;
        return false;
      }
      const body = (await res.json()) as { accessToken?: string };
      accessToken = typeof body.accessToken === 'string' ? body.accessToken : null;
      return accessToken !== null;
    } catch {
      accessToken = null;
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

/** Demande un code frais à l'utilisateur ; plusieurs actions simultanées ne posent qu'une seule question. */
function requestStepUp(): Promise<boolean> {
  if (!stepUpHandler) return Promise.resolve(false);
  stepUpInFlight ??= stepUpHandler().finally(() => {
    stepUpInFlight = null;
  });
  return stepUpInFlight;
}

/** Options d'un appel : méthode, corps JSON, et `auth: false` pour les routes publiques. */
export interface RequestOptions {
  method?: string;
  body?: unknown;
  /** `false` : route publique (connexion, activation), jamais de jeton ni de rafraîchissement automatique. */
  auth?: boolean;
}

/** Envoie une requête vers `/api/v1` avec le jeton en en-tête (jamais dans l'URL) et sans mise en cache. */
async function send(path: string, options: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.auth !== false && accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return fetch(`/api/v1${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    credentials: 'same-origin',
    cache: 'no-store',
  });
}

/**
 * Vrai si l'API accuse le jeton (`WWW-Authenticate: invalid_token`) : seul cas où un rafraîchissement automatique est
 * justifié.
 */
function isTokenRejected(res: Response): boolean {
  return /invalid_token/i.test(res.headers.get('WWW-Authenticate') ?? '');
}

/**
 * Appel d'API de toute l'interface : rafraîchit le jeton une fois si le jeton est refusé, demande un code MFA et
 * rejoue une fois si l'action est sensible, sinon remonte l'erreur lisible.
 */
export async function api<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  let res = await send(path, options);

  // Seul un 401 qui accuse le JETON (en-tête RFC 6750 posé par l'API) justifie un rafraîchissement. Un 401 sans cet en-tête
  // (mauvais code MFA, identifiants refusés) ne doit jamais être rejoué : la tentative serait comptée deux fois contre le verrouillage.
  if (res.status === 401 && options.auth !== false && isTokenRejected(res)) {
    if (await refreshAccessToken()) {
      res = await send(path, options);
    } else {
      onSessionLost?.();
    }
  }

  if (res.status === 403 && options.auth !== false) {
    const problem = (await res.clone().json().catch(() => null)) as ProblemBody | null;
    if (problem?.title === 'MFA_STEP_UP_REQUIRED' && (await requestStepUp())) {
      res = await send(path, options);
    }
  }

  if (!res.ok) throw await toError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
