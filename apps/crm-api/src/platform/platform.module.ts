import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, CLOCK, ID_GENERATOR, UNIT_OF_WORK } from '../shared-kernel';
import { loadAppConfig } from './app-config.loader';
import { HealthController } from './health.controller';
import { PrismaService } from './prisma.service';
import { SystemClock } from './system-clock';
import { UuidV7Generator } from './uuid-v7-generator';

/** Services techniques transverses (horloge, identifiants, base, unité de travail). */
@Global()
@Module({
  controllers: [HealthController],
  providers: [
    PrismaService,
    { provide: APP_CONFIG, useFactory: () => loadAppConfig() },
    { provide: UNIT_OF_WORK, useExisting: PrismaService },
    { provide: CLOCK, useClass: SystemClock },
    { provide: ID_GENERATOR, useClass: UuidV7Generator },
  ],
  exports: [PrismaService, APP_CONFIG, UNIT_OF_WORK, CLOCK, ID_GENERATOR],
})
export class PlatformModule {}
