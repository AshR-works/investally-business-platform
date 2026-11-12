import { Module } from '@nestjs/common';
import { AUDIT_READER, DefaultAuditReader } from './application/audit-reader';
import { AUDIT_RECORDER, DefaultAuditRecorder } from './application/audit-recorder';
import { AUDIT_REPOSITORY } from './domain/audit-repository';
import { PrismaAuditRepository } from './infrastructure/prisma-audit.repository';

/** Composition root du module Audit. */
@Module({
  providers: [
    { provide: AUDIT_REPOSITORY, useClass: PrismaAuditRepository },
    { provide: AUDIT_RECORDER, useClass: DefaultAuditRecorder },
    { provide: AUDIT_READER, useClass: DefaultAuditReader },
  ],
  exports: [AUDIT_RECORDER, AUDIT_READER],
})
/**
 * Module d'audit : fournit l'enregistreur (`AUDIT_RECORDER`) et le lecteur (`AUDIT_READER`, historique des connexions)
 * aux autres modules ; le journal est en ajout seul, partitionné par mois.
 */
export class AuditModule {}
