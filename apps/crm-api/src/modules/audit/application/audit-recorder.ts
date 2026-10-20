import { Inject, Injectable } from '@nestjs/common';
import { ActorContext, CLOCK, Clock, ID_GENERATOR, IdGenerator } from '../../../shared-kernel';
import { AUDIT_REPOSITORY, AuditRepository } from '../domain/audit-repository';
import { AuditAction } from '../domain/audit-entry';

export interface AuditRecord {
  actor: ActorContext;
  module: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
}

/** API publique d'audit pour les autres modules. */
export interface AuditRecorder {
  record(record: AuditRecord): Promise<void>;
}

export const AUDIT_RECORDER = Symbol('AuditRecorder');

@Injectable()
export class DefaultAuditRecorder implements AuditRecorder {
  constructor(
    @Inject(AUDIT_REPOSITORY) private readonly repository: AuditRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async record(record: AuditRecord): Promise<void> {
    await this.repository.append({
      id: this.ids.next(),
      actor: record.actor,
      module: record.module,
      entityType: record.entityType,
      entityId: record.entityId,
      action: record.action,
      oldValue: record.oldValue ?? null,
      newValue: record.newValue ?? null,
      createdAt: this.clock.now(),
    });
  }
}
