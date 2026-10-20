import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { loadAppConfig } from './platform/app-config.loader';

async function bootstrap() {
  const config = loadAppConfig(); // lève une erreur si la configuration de production est dangereuse
  const app = await NestFactory.create(AppModule);
  configureApp(app, config);

  // MFA non vérifié et contrôle d'accès par permission non branché avant S3.2/S3.3 : écoute locale uniquement.
  await app.listen(Number(process.env.PORT ?? 3001), '127.0.0.1');
}

void bootstrap();
