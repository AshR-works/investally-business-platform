import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { seedCore } from '../../src/modules/iam/infrastructure/seed-core';
import { loadAppConfig } from '../../src/platform/app-config.loader';
import { PrismaService } from '../../src/platform/prisma.service';
import { UuidV7Generator } from '../../src/platform/uuid-v7-generator';
import { ActorContext } from '../../src/shared-kernel';

export const TEST_PASSWORD = 'phrase de passe tres longue 42';
export const SYSTEM_ACTOR: ActorContext = { userId: null, sessionId: null, ipAddress: '127.0.0.1', device: 'integration-test' };

export interface TestApp {
  app: INestApplication;
  baseUrl: string;
  prisma: PrismaService;
  get<T>(token: new (...args: never[]) => T | symbol): T;
  close(): Promise<void>;
}

/** Démarre l'application COMPLÈTE (mêmes réglages qu'en production) sur une base de test migrée, rôles chargés. */
export async function startTestApp(): Promise<TestApp> {
  process.env.NODE_ENV = 'test';
  const app = await NestFactory.create(AppModule, { logger: false });
  configureApp(app, loadAppConfig());
  await app.listen(0, '127.0.0.1');
  const prisma = app.get(PrismaService);
  await seedCore(prisma, new UuidV7Generator());
  return {
    app,
    baseUrl: await app.getUrl(),
    prisma,
    get: (token) => app.get(token as never, { strict: false }),
    close: () => app.close(),
  };
}

let counter = 0;
export const uniqueEmail = (label: string) => `${label}-${Date.now()}-${++counter}@investally.test`;
