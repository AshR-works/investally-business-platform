import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuditModule } from './modules/audit/audit.module';
import { BusinessDevelopmentModule } from './modules/business-development/business-development.module';
import { IamModule } from './modules/iam/iam.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AppThrottlerGuard } from './platform/app-throttler.guard';
import { PlatformModule } from './platform/platform.module';

@Module({
  imports: [
    // 100 requêtes par minute et par IP ; la connexion a sa propre limite plus stricte (voir AuthController).
    ThrottlerModule.forRoot({ throttlers: [{ name: 'default', ttl: 60_000, limit: 100 }] }),
    PlatformModule,
    AuditModule,
    IamModule,
    NotificationsModule,
    BusinessDevelopmentModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: AppThrottlerGuard }],
})
export class AppModule {}
