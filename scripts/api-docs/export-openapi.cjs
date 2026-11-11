// Exporte la description OpenAPI RÉELLE de l'API (celle de /api/docs) en y ajoutant ce que le code sait et que Swagger ignore : la permission exigée de chaque route,
// la portée minimale, et si un second facteur récent (« step-up ») est demandé.
//
//   node scripts/api-docs/export-openapi.cjs --dist apps/crm-api/dist-docs --out docs/api/openapi.json
//
// Pré-requis : l'API est compilée dans --dist (`npx tsc -p tsconfig.build.json --outDir <dist>` dans apps/crm-api) et DATABASE_URL pointe une base JETABLE
// (le démarrage de l'application se connecte à la base ; rien n'y est écrit). Aucune écoute réseau : le document est produit en mémoire.
const fs = require('node:fs');
const path = require('node:path');

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : fallback; };
const root = path.resolve(__dirname, '..', '..');
const dist = path.resolve(root, arg('dist', 'apps/crm-api/dist-docs'));
const out = path.resolve(root, arg('out', 'docs/api/openapi.json'));
const apiRequire = require('node:module').createRequire(path.join(root, 'apps', 'crm-api', 'package.json'));

require(apiRequire.resolve('reflect-metadata'));
const { NestFactory } = apiRequire('@nestjs/core');
const { DocumentBuilder, SwaggerModule } = apiRequire('@nestjs/swagger');
const { AppModule } = require(path.join(dist, 'src', 'app.module'));
const { configureApp } = require(path.join(dist, 'src', 'app.setup'));
const { loadAppConfig } = require(path.join(dist, 'src', 'platform', 'app-config.loader'));
const { PERMISSION_KEY, MIN_SCOPE_KEY } = require(path.join(dist, 'src', 'modules', 'iam', 'presentation', 'protected.decorator'));

const METHODS = ['get', 'post', 'put', 'delete', 'patch', 'all', 'options', 'head']; // RequestMethod : GET=0, POST=1, PUT=2, DELETE=3, PATCH=4…
const openApiPath = (p) => p.replace(/:([A-Za-z0-9_]+)/g, '{$1}').replace(/\/+/g, '/');

(async () => {
  const config = loadAppConfig();
  const app = await NestFactory.create(AppModule, { logger: ['error'] });
  configureApp(app, { ...config, env: 'development' });
  await app.init();

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Investally Business Platform')
      .setVersion('0.1.0')
      .setDescription('API REST (JSON) du CRM Investally. Authentification : jeton d’accès Bearer (JWT) obtenu par POST /auth/login puis POST /auth/mfa/verify ; second facteur obligatoire sur les routes protégées.')
      .addBearerAuth()
      .build(),
  );

  // Ce que Swagger ne sait pas : permission, portée minimale, step-up. On parcourt les contrôleurs réels.
  const enriched = new Map();
  const container = app.get(apiRequire('@nestjs/core').ModulesContainer);
  for (const module of container.values()) {
    for (const wrapper of module.controllers.values()) {
      const controller = wrapper.metatype;
      if (!controller) continue;
      const base = Reflect.getMetadata('path', controller) ?? '';
      const prefix = '/' + [base].flat().join('/');
      const proto = controller.prototype;
      for (const name of Object.getOwnPropertyNames(proto)) {
        const handler = proto[name];
        if (typeof handler !== 'function' || name === 'constructor') continue;
        const routePath = Reflect.getMetadata('path', handler);
        const method = Reflect.getMetadata('method', handler);
        if (routePath === undefined || method === undefined) continue;
        const guards = (Reflect.getMetadata('__guards__', handler) ?? []).map((g) => g.name);
        const full = openApiPath(`/api/v1${prefix}/${[routePath].flat().join('/')}`).replace(/\/$/, '') || '/';
        enriched.set(`${METHODS[method]} ${full}`, {
          permission: Reflect.getMetadata(PERMISSION_KEY, handler) ?? null,
          minScope: Reflect.getMetadata(MIN_SCOPE_KEY, handler) ?? null,
          stepUp: guards.includes('RequireRecentMfaGuard'),
          protected: guards.includes('AccessTokenGuard'),
        });
      }
    }
  }
  let matched = 0;
  for (const [route, operations] of Object.entries(document.paths)) {
    for (const [method, operation] of Object.entries(operations)) {
      const info = enriched.get(`${method} ${route}`) ?? enriched.get(`${method} ${route.replace(/^\/api\/v1/, '')}`);
      if (!info) continue;
      matched += 1;
      if (info.permission) operation['x-permission'] = info.permission;
      if (info.minScope) operation['x-min-scope'] = info.minScope;
      if (info.stepUp) operation['x-step-up'] = true;
      operation['x-protected'] = info.protected;
    }
  }
  const total = Object.values(document.paths).reduce((n, ops) => n + Object.keys(ops).length, 0);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(document, null, 2) + '\n', 'utf8');
  console.log(`openapi : ${Object.keys(document.paths).length} chemins, ${total} opérations, ${matched} enrichies (permission, portée, step-up) -> ${path.relative(root, out)}`);
  await app.close();
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
