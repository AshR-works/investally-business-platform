import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../platform/prisma.service';
import { DomainError, Page } from '../../../shared-kernel';
import { IsoDate, toIsoDate } from '../domain/session-dates';
import { SessionListQuery, SessionRepository } from '../domain/session-repositories';
import { TrainingSession } from '../domain/training-session';

type SessionRow = Prisma.TrainingSessionGetPayload<object>;

const dateOf = (iso: IsoDate): Date => new Date(`${iso}T00:00:00.000Z`);

const sessionOf = (r: SessionRow): TrainingSession =>
  TrainingSession.rehydrate({
    id: r.id, trainingId: r.trainingId, rhythm: r.rhythm, startDate: toIsoDate(r.startDate), endDate: toIsoDate(r.endDate), roomId: r.roomId,
    trainerId: r.trainerId, capacity: r.capacity, status: r.status, cancelReason: r.cancelReason, createdAt: r.createdAt, version: r.version,
  });

@Injectable()
export class PrismaSessionRepository implements SessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(session: TrainingSession): Promise<void> {
    const data = {
      trainingId: session.trainingId, roomId: session.roomId, trainerId: session.trainerId, rhythm: session.rhythm, startDate: dateOf(session.startDate),
      endDate: dateOf(session.endDate), capacity: session.capacity, status: session.status, cancelReason: session.cancelReason,
    };
    const db = this.prisma.db.trainingSession;
    if ((await db.updateMany({ where: { id: session.id, version: session.version }, data: { ...data, version: { increment: 1 } } })).count === 1) return;
    if ((await db.count({ where: { id: session.id } })) > 0) throw new DomainError('CONFLICT', 'La session a été modifiée par un autre utilisateur');
    await db.create({ data: { id: session.id, ...data, version: session.version, createdAt: session.createdAt } });
  }

  async findById(id: string): Promise<TrainingSession | null> {
    const row = await this.prisma.db.trainingSession.findUnique({ where: { id } });
    return row ? sessionOf(row) : null;
  }

  async lockResources(roomId: string, trainerId: string): Promise<void> {
    // Ordre fixe (salle puis formateur) : deux planifications concurrentes ne peuvent pas s'interbloquer, et la seconde voit la première.
    await this.prisma.db.$queryRaw`SELECT id FROM training.rooms WHERE id = ${roomId}::uuid FOR UPDATE`;
    await this.prisma.db.$queryRaw`SELECT id FROM training.trainers WHERE id = ${trainerId}::uuid FOR UPDATE`;
  }

  async findConflicts(input: { roomId: string; trainerId: string; start: IsoDate; end: IsoDate; excludeId?: string }): Promise<TrainingSession[]> {
    const rows = await this.prisma.db.trainingSession.findMany({
      where: {
        status: { not: 'CANCELLED' },
        startDate: { lte: dateOf(input.end) },
        endDate: { gte: dateOf(input.start) },
        OR: [{ roomId: input.roomId }, { trainerId: input.trainerId }],
        ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
      },
      orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
    });
    return rows.map(sessionOf);
  }

  async list(query: SessionListQuery): Promise<Page<TrainingSession>> {
    const where: Prisma.TrainingSessionWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.roomId ? { roomId: query.roomId } : {}),
      ...(query.trainerId ? { trainerId: query.trainerId } : {}),
      ...(query.trainingId ? { trainingId: query.trainingId } : {}),
      ...(query.from ? { endDate: { gte: dateOf(query.from) } } : {}),
      ...(query.to ? { startDate: { lte: dateOf(query.to) } } : {}),
      ...(query.visibleToUserIds ? { trainer: { userId: { in: [...query.visibleToUserIds] } } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.db.trainingSession.findMany({ where, orderBy: [{ startDate: 'desc' }, { id: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.db.trainingSession.count({ where }),
    ]);
    return { items: rows.map(sessionOf), total, page: query.page, pageSize: query.pageSize };
  }
}
