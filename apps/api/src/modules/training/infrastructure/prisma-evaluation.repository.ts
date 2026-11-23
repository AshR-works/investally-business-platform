import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../platform/prisma.service';
import { DomainError } from '../../../shared-kernel';
import { Evaluation } from '../domain/evaluation';
import { EvaluationRepository } from '../domain/evaluation-repositories';

const toEvaluation = (row: Prisma.EvaluationGetPayload<object>): Evaluation =>
  Evaluation.rehydrate({
    id: row.id, enrollmentId: row.enrollmentId, score: Number(row.score), recordedByUserId: row.recordedByUserId,
    createdAt: row.createdAt, updatedAt: row.updatedAt, version: row.version,
  });

/** Persistance PostgreSQL des évaluations : au plus un enregistrement par inscription (unicité garantie par la base). */
@Injectable()
export class PrismaEvaluationRepository implements EvaluationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(evaluation: Evaluation): Promise<void> {
    try {
      const updated = await this.prisma.db.evaluation.updateMany({
        where: { id: evaluation.id }, data: { score: evaluation.score, recordedByUserId: evaluation.recordedByUserId, version: { increment: 1 } },
      });
      if (updated.count === 1) return;
      await this.prisma.db.evaluation.create({
        data: {
          id: evaluation.id, enrollmentId: evaluation.enrollmentId, score: evaluation.score, recordedByUserId: evaluation.recordedByUserId,
          version: evaluation.version, createdAt: evaluation.createdAt,
        },
      });
    } catch (e) {
      // Unicité (une évaluation par inscription) : deux saisies simultanées pour la même inscription.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new DomainError('CONFLICT', 'Une évaluation est déjà saisie pour cette inscription : rechargez la page');
      throw e;
    }
  }

  async find(enrollmentId: string): Promise<Evaluation | null> {
    const row = await this.prisma.db.evaluation.findUnique({ where: { enrollmentId } });
    return row ? toEvaluation(row) : null;
  }

  async bySession(enrollmentIds: readonly string[]): Promise<Evaluation[]> {
    if (enrollmentIds.length === 0) return [];
    const rows = await this.prisma.db.evaluation.findMany({ where: { enrollmentId: { in: [...enrollmentIds] } } });
    return rows.map(toEvaluation);
  }
}
