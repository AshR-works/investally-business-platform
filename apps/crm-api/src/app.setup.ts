import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import type { Application, NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { ProblemDetailsFilter } from './platform/problem-details.filter';
import { AppConfig } from './shared-kernel';

/**
 * Configuration commune à l'application réelle et aux tests de bout en bout : ce que les tests exercent
 * est exactement ce qui tourne en production.
 */
export function configureApp(app: INestApplication, config: AppConfig): void {
  const express = app.getHttpAdapter().getInstance() as Application;
  express.disable('x-powered-by');
  if (config.trustProxy) {
    // Derrière le proxy Next.js : l'IP cliente vient de X-Forwarded-For (limitation de débit et audit exacts).
    express.set('trust proxy', /^\d+$/.test(config.trustProxy) ? Number(config.trustProxy) : config.trustProxy);
  }

  // En-têtes de sécurité (HSTS, nosniff, frame, CSP…). L'interface Swagger a besoin de scripts en ligne : exemptée.
  const secure = helmet();
  app.use((req: Request, res: Response, next: NextFunction) => (req.path.startsWith('/api/docs') ? next() : secure(req, res, next)));

  app.use(cookieParser());
  app.setGlobalPrefix('api/v1', { exclude: ['health/live', 'health/ready'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new ProblemDetailsFilter());
  app.enableShutdownHooks();

  // Swagger désactivé en production (SECURITY.md, OWASP A05).
  if (config.env !== 'production') {
    const swagger = new DocumentBuilder().setTitle('Investally Business Platform').setVersion('0.1.0').addBearerAuth().build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger));
  }
}
