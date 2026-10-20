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

  it('rejette un nom vide avec une réponse problem+json (400)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/companies`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    });
    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toContain('application/problem+json');
  });

  it('rejette les champs inconnus (whitelist stricte)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/companies`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Acme', isAdmin: true }),
    });
    expect(res.status).toBe(400);
  });

  it('plafonne la pagination (pageSize > 100 refusé)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/companies?pageSize=1000`);
    expect(res.status).toBe(400);
  });
});
