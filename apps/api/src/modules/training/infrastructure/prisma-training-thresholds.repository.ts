import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/prisma.service';
import { DomainError } from '../../../shared-kernel';
import { DEFAULT_TRAINING_THRESHOLDS, TrainingThresholds } from '../domain/evaluation';
import { TrainingThresholdsRepository } from '../domain/evaluation-repositories';

/** Persistance PostgreSQL des seuils d'éligibilité : une seule ligne (id = 1), comme les réglages de congés. */
@Injectable()
export class PrismaTrainingThresholdsRepository implements TrainingThresholdsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<TrainingThresholds> {
    const row = await this.prisma.db.trainingThresholds.findUnique({ where: { id: 1 } });
    if (!row) return DEFAULT_TRAINING_THRESHOLDS;
    return { attendanceThresholdPercent: Number(row.attendanceThresholdPercent), scoreThreshold: Number(row.scoreThreshold), version: row.version };
  }

  async save(thresholds: TrainingThresholds): Promise<void> {
    const updated = await this.prisma.db.trainingThresholds.updateMany({
      where: { id: 1, version: thresholds.version },
      data: { attendanceThresholdPercent: thresholds.attendanceThresholdPercent, scoreThreshold: thresholds.scoreThreshold, version: { increment: 1 } },
    });
    if (updated.count !== 1) throw new DomainError('CONFLICT', "Les seuils d'éligibilité ont été modifiés par un autre utilisateur : rechargez-les");
  }
}
