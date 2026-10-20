import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { loadAppConfig } from '../src/platform/app-config.loader';

/** Vérifie le câblage (DI, validation, format d'erreur) sans base de données. */
describe('Démarrage de l\'application', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.DATABASE_URL ??= 'postgresql://unused:unused@127.0.0.1:1/unused';
    app = await NestFactory.create(AppModule, { logger: false });
    configureApp(app, loadAppConfig());
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  it('répond sur /health/live', async () => {
    const res = await fetch(`${baseUrl}/health/live`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('refuse sans identité : 401 problem+json, quelle que soit la route métier (la validation se teste avec un jeton)', async () => {
    for (const request of [
      () => fetch(`${baseUrl}/api/v1/companies`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: '' }) }),
      () => fetch(`${baseUrl}/api/v1/companies`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Acme', isAdmin: true }) }),
      () => fetch(`${baseUrl}/api/v1/companies?pageSize=1000`),
      () => fetch(`${baseUrl}/api/v1/companies/00000000-0000-7000-8000-000000000001`),
      () => fetch(`${baseUrl}/api/v1/admin/users`),
      () => fetch(`${baseUrl}/api/v1/admin/roles`),
    ]) {
      const res = await request();
      expect(res.status).toBe(401);
      expect(res.headers.get('content-type')).toContain('application/problem+json');
    }
  });

  it("n'expose aucun détail interne sur une route protégée sans identité", async () => {
    const res = await fetch(`${baseUrl}/api/v1/companies`);
    const body = JSON.stringify(await res.json());
    expect(body).not.toMatch(/stack|prisma|sql|node_modules/i);
  });
});
