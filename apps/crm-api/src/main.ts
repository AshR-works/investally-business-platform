import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { loadAppConfig } from './platform/app-config.loader';

/**
 * Démarre l'API : charge la configuration (refuse de démarrer si elle est dangereuse en production), monte
 * l'application et écoute sur l'adresse locale uniquement.
 */
async function bootstrap() {
  const config = loadAppConfig(); // lève une erreur si la configuration de production est dangereuse
  const app = await NestFactory.create(AppModule);
  configureApp(app, config);

  // L'API n'écoute que sur l'adresse locale : seul le serveur web (même machine) la joint, elle n'est jamais exposée directement.
  await app.listen(Number(process.env.PORT ?? 3001), '127.0.0.1');
}

void bootstrap();
