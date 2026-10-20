import { Module } from '@nestjs/common';
import { AuditModule } from './modules/audit/audit.module';
import { BusinessDevelopmentModule } from './modules/business-development/business-development.module';
import { PlatformModule } from './platform/platform.module';

@Module({ imports: [PlatformModule, AuditModule, BusinessDevelopmentModule] })
export class AppModule {}
