import { Module } from '@nestjs/common';
import { AUDIT_RECORDER, DefaultAuditRecorder } from './application/audit-recorder';
import { AUDIT_REPOSITORY } from './domain/audit-repository';
import { PrismaAuditRepository } from './infrastructure/prisma-audit.repository';

/** Composition root du module Audit. */
@Module({
  providers: [
    { provide: AUDIT_REPOSITORY, useClass: PrismaAuditRepository },
    { provide: AUDIT_RECORDER, useClass: DefaultAuditRecorder },
  ],
  exports: [AUDIT_RECORDER],
})
export class AuditModule {}
