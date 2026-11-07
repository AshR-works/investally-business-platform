import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { RoleCode, Scope, resolveGrants } from '../src/modules/iam/domain/roles';
import { loadAppConfig } from '../src/platform/app-config.loader';
import { IDOR_ROUTES, OBJECT_ID_IN_QUERY } from './support/idor-registry';
import { discoverRoutes, Route } from './support/route-discovery';

/**
 * Contrat anti-IDOR, volet structurel (sans base) : impossible d'ajouter une route qui désigne un objet sans la classer,
 * donc sans la soumettre à la sonde d'intégration (`idor-contract.integration.spec.ts`).
 */
describe('Contrat anti-IDOR : classement de toutes les routes (structurel)', () => {
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

  it('toute route à paramètre de chemin est classée dans le registre', () => {
    const withParam = routes.filter((r) => r.key.includes('/:')).map((r) => r.key);
    expect(withParam.length).toBeGreaterThanOrEqual(15);
    expect(withParam.filter((key) => !(key in IDOR_ROUTES))).toEqual([]);
  });

  it('toute route qui reçoit un identifiant d\'objet en requête est classée', () => {
    for (const key of OBJECT_ID_IN_QUERY) {
      expect(routes.map((r) => r.key)).toContain(key);
      expect(IDOR_ROUTES[key]).toBe('objet');
    }
  });

  it('le registre ne contient aucune route disparue (il reste fidèle au code)', () => {
    const existing = new Set(routes.map((r) => r.key));
    expect(Object.keys(IDOR_ROUTES).filter((key) => !existing.has(key))).toEqual([]);
  });

  it('les routes « admin » exigent une permission iam.user.* que SEUL le Super administrateur détient, avec la portée Tous', () => {
    const adminRoutes = routes.filter((r) => IDOR_ROUTES[r.key] === 'admin');
    expect(adminRoutes.length).toBeGreaterThanOrEqual(8);
    for (const route of adminRoutes) {
      expect(route.permission).toMatch(/^iam\.user\./);
      const holders = Object.values(RoleCode).filter((role) => resolveGrants(role).some((g) => g.permission === route.permission));
      expect([route.key, holders]).toEqual([route.key, [RoleCode.SuperAdmin]]);
      expect(resolveGrants(RoleCode.SuperAdmin).find((g) => g.permission === route.permission)?.scope).toBe(Scope.All);
    }
  });

  it('les routes « portée Tous » exigent la portée ALL dès la garde, pour tout rôle qui détient la permission en portée plus étroite', () => {
    const wide = routes.filter((r) => IDOR_ROUTES[r.key] === 'portee-tous');
    expect(wide.length).toBeGreaterThanOrEqual(1);
    for (const route of wide) {
      expect([route.key, route.minScope]).toEqual([route.key, 'ALL']);
    }
  });

  it('les routes « référentiel » (catalogue partagé) exigent une permission du module training, détenue en portée Tous par tous les rôles qui la détiennent', () => {
    const shared = routes.filter((r) => IDOR_ROUTES[r.key] === 'referentiel');
    expect(shared.length).toBeGreaterThanOrEqual(12);
    for (const route of shared) {
      expect([route.key, route.permission]).toEqual([route.key, expect.stringMatching(/^training\./)]);
      for (const role of Object.values(RoleCode)) {
        for (const grant of resolveGrants(role).filter((g) => g.permission === route.permission)) {
          expect([route.key, role, grant.scope]).toEqual([route.key, role, Scope.All]);
        }
      }
    }
  });

  it('les routes « lecture-formateur » (sessions) : seul le formateur lit en portée Propre, tous les autres rôles en portée Tous', () => {
    const reads = routes.filter((r) => IDOR_ROUTES[r.key] === 'lecture-formateur');
    expect(reads.map((r) => r.key)).toEqual(['GET /sessions/:id']);
    for (const route of reads) {
      expect([route.key, route.permission]).toEqual([route.key, 'training.session.read']);
      for (const role of Object.values(RoleCode)) {
        for (const grant of resolveGrants(role).filter((g) => g.permission === route.permission)) {
          expect([route.key, role, grant.scope]).toEqual([route.key, role, role === RoleCode.Trainer ? Scope.Own : Scope.All]);
        }
      }
    }
  });

  it('les routes « objet » exigent toutes une permission du catalogue (le contrôle par objet vient en plus)', () => {
    for (const route of routes.filter((r) => IDOR_ROUTES[r.key] === 'objet')) {
      expect([route.key, Boolean(route.permission)]).toEqual([route.key, true]);
    }
  });
});
