import 'reflect-metadata';
import { RequestMethod, INestApplication } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ModulesContainer, NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PERMISSION_CODES } from '../src/modules/iam/domain/permission-catalog';
import { PERMISSION_KEY } from '../src/modules/iam/presentation/protected.decorator';
import { loadAppConfig } from '../src/platform/app-config.loader';

interface Route { key: string; guards: string[]; permission: string | undefined }

/**
 * Parcourt TOUTES les routes réellement montées par l'application. Une nouvelle route doit être soit protégée par
 * `@Protected('permission')` (permission du catalogue), soit déclarée ici explicitement comme publique ou
 * « authentifiée seulement » : impossible d'ajouter un endpoint ouvert par simple oubli.
 */
function discoverRoutes(app: INestApplication): Route[] {
  const routes: Route[] = [];
  for (const module of app.get(ModulesContainer).values()) {
    for (const wrapper of module.controllers.values()) {
      if (!wrapper.metatype) continue;
      const base = Reflect.getMetadata(PATH_METADATA, wrapper.metatype) as string | undefined;
      const classGuards = (Reflect.getMetadata(GUARDS_METADATA, wrapper.metatype) ?? []) as { name: string }[];
      const prototype = wrapper.metatype.prototype as Record<string, unknown>;
      for (const name of Object.getOwnPropertyNames(prototype)) {
        const handler = prototype[name];
        if (typeof handler !== 'function') continue;
        const method = Reflect.getMetadata(METHOD_METADATA, handler) as number | undefined;
        if (method === undefined) continue;
        const path = (Reflect.getMetadata(PATH_METADATA, handler) as string | undefined) ?? '';
        const guards = [...classGuards, ...((Reflect.getMetadata(GUARDS_METADATA, handler) ?? []) as { name: string }[])];
        routes.push({
          key: `${RequestMethod[method]} /${[base, path].filter(Boolean).join('/').replace(/\/+/g, '/').replace(/^\//, '').replace(/\/$/, '')}`,
          guards: guards.map((guard) => guard.name),
          permission: Reflect.getMetadata(PERMISSION_KEY, handler) as string | undefined,
        });
      }
    }
  }
  return routes.sort((a, b) => a.key.localeCompare(b.key));
}

/** Aucune authentification : seules les routes qui doivent l'être (santé, entrée dans le système). */
const PUBLIC_ROUTES = [
  'GET /health/live',
  'GET /health/ready',
  'POST /auth/login',
  'POST /auth/refresh',
  'POST /auth/invitation/accept',
];

/** Identité exigée (jeton valide, session active) mais pas de permission : actions sur SON propre compte. */
const AUTHENTICATED_ONLY_ROUTES = [
  'POST /auth/logout',
  'GET /auth/me',
  'POST /auth/change-password',
  'POST /auth/mfa/enroll/start',
  'POST /auth/mfa/enroll/confirm',
  'POST /auth/mfa/verify',
  'POST /auth/mfa/recovery-codes/regenerate',
];

describe('Protection de toutes les routes (E2)', () => {
  let app: INestApplication;
  let routes: Route[];

  beforeAll(async () => {
    process.env.DATABASE_URL ??= 'postgresql://unused:unused@127.0.0.1:1/unused';
    app = await NestFactory.create(AppModule, { logger: false });
    configureApp(app, loadAppConfig());
    await app.init();
    routes = discoverRoutes(app);
  }, 60_000);
  afterAll(() => app.close());

  it('découvre bien les routes de l\'application (le test ne passe pas à vide)', () => {
    expect(routes.length).toBeGreaterThanOrEqual(28);
    expect(routes.map((r) => r.key)).toEqual(expect.arrayContaining(['POST /auth/login', 'GET /companies', 'GET /admin/users', 'GET /admin/roles']));
  });

  it('les routes publiques sont exactement celles attendues, et ne portent aucune garde', () => {
    const open = routes.filter((r) => r.guards.length === 0).map((r) => r.key);
    expect(open).toEqual([...PUBLIC_ROUTES].sort());
  });

  it('les routes « authentifiées seulement » exigent le jeton et ne déclarent aucune permission', () => {
    for (const key of AUTHENTICATED_ONLY_ROUTES) {
      const route = routes.find((r) => r.key === key);
      expect(route).toBeDefined();
      expect(route!.guards).toContain('AccessTokenGuard');
      expect(route!.permission).toBeUndefined();
    }
  });

  it('TOUTE autre route est protégée : identité, MFA vérifié, permission du catalogue', () => {
    const exempt = new Set([...PUBLIC_ROUTES, ...AUTHENTICATED_ONLY_ROUTES]);
    const protectedRoutes = routes.filter((r) => !exempt.has(r.key));
    expect(protectedRoutes.length).toBeGreaterThanOrEqual(16);

    const unprotected = protectedRoutes.filter(
      (r) => !r.permission || !['AccessTokenGuard', 'RequireMfaGuard', 'PermissionGuard'].every((g) => r.guards.includes(g)),
    );
    expect(unprotected.map((r) => r.key)).toEqual([]);
  });

  it('chaque permission déclarée existe dans le catalogue (aucune faute de frappe qui refuserait tout le monde… ou autoriserait par erreur)', () => {
    for (const route of routes.filter((r) => r.permission)) {
      expect(PERMISSION_CODES.has(route.permission!)).toBe(true);
    }
  });

  it('les actions sensibles exigent en plus un MFA récent (step-up), et la permission est vérifiée AVANT le step-up', () => {
    const sensitive = ['POST /admin/users', 'POST /admin/users/:id/disable', 'POST /admin/users/:id/enable', 'PUT /admin/users/:id/roles', 'POST /admin/users/:id/mfa/reset', 'POST /admin/users/:id/sessions/revoke'];
    for (const key of sensitive) {
      const route = routes.find((r) => r.key === key);
      expect(route).toBeDefined();
      expect(route!.guards).toContain('RequireRecentMfaGuard');
      expect(route!.guards.indexOf('PermissionGuard')).toBeLessThan(route!.guards.indexOf('RequireRecentMfaGuard'));
    }
  });

  it('les gardes s\'exécutent dans le bon ordre : identité → MFA → permission', () => {
    for (const route of routes.filter((r) => r.permission)) {
      expect(route.guards.slice(0, 3)).toEqual(['AccessTokenGuard', 'RequireMfaGuard', 'PermissionGuard']);
    }
  });

  it('il n\'existe pas deux fois la même route', () => {
    const keys = routes.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
