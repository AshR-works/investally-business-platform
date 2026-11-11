import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../platform/prisma.service';
import { DomainError, Page } from '../../../shared-kernel';
import { Consumption } from '../domain/approval-cover';
import { Enrollment, SEAT_STATUSES } from '../domain/enrollment';
import { EnrollmentListQuery, EnrollmentRepository, LearnerListQuery, LearnerRepository } from '../domain/enrollment-repositories';
import { Learner, LearnerKind } from '../domain/learner';
import { toCents } from '../domain/money';
import { IsoDate, toIsoDate } from '../domain/session-dates';

const dateOf = (iso: IsoDate): Date => new Date(`${iso}T00:00:00.000Z`);
const seatStatuses = [...SEAT_STATUSES];

type LearnerRow = Prisma.LearnerGetPayload<object>;
const learnerOf = (r: LearnerRow): Learner =>
  Learner.rehydrate({
    id: r.id, kind: r.kind, companyId: r.companyId, contactId: r.contactId, lastName: r.lastName, firstName: r.firstName, email: r.email, phone: r.phone,
    deletedAt: r.deletedAt, createdAt: r.createdAt, version: r.version,
  });

@Injectable()
export class PrismaLearnerRepository implements LearnerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(learner: Learner): Promise<void> {
    const data = {
      kind: learner.kind, companyId: learner.companyId, contactId: learner.contactId, lastName: learner.lastName, firstName: learner.firstName, nameKey: learner.nameKey, email: learner.email,
      emailKey: learner.emailKey, phone: learner.phone, deletedAt: learner.deletedAt,
    };
    const db = this.prisma.db.learner;
    if ((await db.updateMany({ where: { id: learner.id, version: learner.version }, data: { ...data, version: { increment: 1 } } })).count === 1) return;
    if ((await db.count({ where: { id: learner.id } })) > 0) throw new DomainError('CONFLICT', "L'apprenant a été modifié par un autre utilisateur");
    await db.create({ data: { id: learner.id, ...data, version: learner.version, createdAt: learner.createdAt } });
  }

  async findById(id: string): Promise<Learner | null> {
    const row = await this.prisma.db.learner.findFirst({ where: { id, deletedAt: null } });
    return row ? learnerOf(row) : null;
  }

  async findDuplicates(input: { companyId: string | null; nameKey: string; emailKey: string | null; excludeId?: string }): Promise<Learner[]> {
    const rows = await this.prisma.db.learner.findMany({
      where: {
        companyId: input.companyId,
        ...(input.companyId === null ? { kind: { not: 'COMPANY' as const } } : {}),
        deletedAt: null,
        OR: [{ nameKey: input.nameKey }, ...(input.emailKey ? [{ emailKey: input.emailKey }] : [])],
        ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map(learnerOf);
  }

  async list(query: LearnerListQuery): Promise<Page<Learner>> {
    const search = query.search?.trim();
    const where: Prisma.LearnerWhereInput = {
      deletedAt: null,
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.companyIds ? { companyId: { in: [...query.companyIds] } } : {}),
      ...(search
        ? { OR: [{ lastName: { contains: search, mode: 'insensitive' } }, { firstName: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }] }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.db.learner.findMany({ where, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.db.learner.count({ where }),
    ]);
    return { items: rows.map(learnerOf), total, page: query.page, pageSize: query.pageSize };
  }

  async kindsOf(ids: readonly string[]): Promise<Map<string, LearnerKind>> {
    if (ids.length === 0) return new Map();
    const rows = await this.prisma.db.learner.findMany({ where: { id: { in: [...ids] } }, select: { id: true, kind: true } });
    return new Map(rows.map((r) => [r.id, r.kind]));
  }

  async namesOf(ids: readonly string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const rows = await this.prisma.db.learner.findMany({ where: { id: { in: [...ids] } }, select: { id: true, firstName: true, lastName: true } });
    return new Map(rows.map((r) => [r.id, `${r.firstName} ${r.lastName}`]));
  }
}

type EnrollmentRow = Prisma.EnrollmentGetPayload<object>;
const enrollmentOf = (r: EnrollmentRow): Enrollment =>
  Enrollment.rehydrate({
    id: r.id, sessionId: r.sessionId, learnerId: r.learnerId, companyId: r.companyId, approvalId: r.approvalId,
    payer: r.payerKind === 'SELF' ? { kind: 'SELF' } : r.payerKind === 'THIRD_PARTY' ? { kind: 'THIRD_PARTY', name: r.payerName ?? '', type: r.payerType! } : null, chargedAmount: r.chargedAmount === null ? null : r.chargedAmount.toFixed(2),
    status: r.status, comment: r.comment, cancelReason: r.cancelReason, confirmedAt: r.confirmedAt, replacedById: r.replacedById, createdAt: r.createdAt, version: r.version,
  });

@Injectable()
export class PrismaEnrollmentRepository implements EnrollmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(enrollment: Enrollment): Promise<void> {
    const data = {
      sessionId: enrollment.sessionId, learnerId: enrollment.learnerId, companyId: enrollment.companyId, approvalId: enrollment.approvalId,
      payerKind: enrollment.payer?.kind ?? null, payerName: enrollment.payer?.kind === 'THIRD_PARTY' ? enrollment.payer.name : null,
      payerType: enrollment.payer?.kind === 'THIRD_PARTY' ? enrollment.payer.type : null, chargedAmount: enrollment.chargedAmount,
      status: enrollment.status, comment: enrollment.comment, cancelReason: enrollment.cancelReason, confirmedAt: enrollment.confirmedAt, replacedById: enrollment.replacedById,
    };
    const db = this.prisma.db.enrollment;
    try {
      if ((await db.updateMany({ where: { id: enrollment.id, version: enrollment.version }, data: { ...data, version: { increment: 1 } } })).count === 1) return;
      if ((await db.count({ where: { id: enrollment.id } })) > 0) throw new DomainError('CONFLICT', "L'inscription a été modifiée par un autre utilisateur");
      await db.create({ data: { id: enrollment.id, ...data, version: enrollment.version, createdAt: enrollment.createdAt } });
    } catch (error) {
      // Filet de sécurité : l'index unique « une inscription vivante par apprenant et par session » refuse un doublon que deux requêtes auraient laissé passer.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new DomainError('CONFLICT', "L'apprenant est déjà inscrit à cette session");
      throw error;
    }
  }

  async findById(id: string): Promise<Enrollment | null> {
    const row = await this.prisma.db.enrollment.findUnique({ where: { id } });
    return row ? enrollmentOf(row) : null;
  }

  async lockSession(sessionId: string): Promise<void> {
    await this.prisma.db.$queryRaw`SELECT id FROM training.sessions WHERE id = ${sessionId}::uuid FOR UPDATE`;
  }

  countSeats(sessionId: string): Promise<number> {
    return this.prisma.db.enrollment.count({ where: { sessionId, status: { in: seatStatuses } } });
  }

  async countSeatsBySession(sessionIds: readonly string[]): Promise<Map<string, number>> {
    if (sessionIds.length === 0) return new Map();
    const rows = await this.prisma.db.enrollment.groupBy({ by: ['sessionId'], where: { sessionId: { in: [...sessionIds] }, status: { in: seatStatuses } }, _count: { _all: true } });
    return new Map(rows.map((r) => [r.sessionId, r._count._all]));
  }

  async consumptionOf(approvalId: string): Promise<Consumption> {
    const rows = await this.prisma.db.enrollment.findMany({ where: { approvalId, status: { in: seatStatuses } }, select: { chargedAmount: true } });
    return { places: rows.length, cents: rows.reduce((sum, r) => sum + (r.chargedAmount === null ? 0 : toCents(r.chargedAmount.toFixed(2))), 0) };
  }

  async hasLive(sessionId: string, learnerId: string): Promise<boolean> {
    return (await this.prisma.db.enrollment.count({ where: { sessionId, learnerId, status: { not: 'CANCELLED' } } })) > 0;
  }

  async findOverlap(input: { learnerId: string; start: IsoDate; end: IsoDate; excludeEnrollmentId?: string; excludeSessionId?: string }) {
    const row = await this.prisma.db.enrollment.findFirst({
      where: {
        learnerId: input.learnerId,
        status: { in: seatStatuses },
        ...(input.excludeEnrollmentId ? { id: { not: input.excludeEnrollmentId } } : {}),
        ...(input.excludeSessionId ? { sessionId: { not: input.excludeSessionId } } : {}),
        session: { status: { not: 'CANCELLED' }, startDate: { lte: dateOf(input.end) }, endDate: { gte: dateOf(input.start) } },
      },
      include: { session: { select: { startDate: true, endDate: true } } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return row ? { enrollment: enrollmentOf(row), sessionStart: toIsoDate(row.session.startDate), sessionEnd: toIsoDate(row.session.endDate) } : null;
  }

  async seatLearnerIds(sessionId: string): Promise<string[]> {
    const rows = await this.prisma.db.enrollment.findMany({ where: { sessionId, status: { in: seatStatuses } }, select: { learnerId: true } });
    return rows.map((r) => r.learnerId);
  }

  async listSeats(sessionId: string): Promise<Enrollment[]> {
    const rows = await this.prisma.db.enrollment.findMany({ where: { sessionId, status: { in: seatStatuses } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    return rows.map(enrollmentOf);
  }

  async hasConfirmed(learnerId: string): Promise<boolean> {
    return (await this.prisma.db.enrollment.count({ where: { learnerId, status: 'CONFIRMED' } })) > 0;
  }

  async list(query: EnrollmentListQuery): Promise<Page<Enrollment>> {
    const where: Prisma.EnrollmentWhereInput = {
      ...(query.sessionId ? { sessionId: query.sessionId } : {}),
      ...(query.learnerId ? { learnerId: query.learnerId } : {}),
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.companyIds ? { companyId: { in: [...query.companyIds] } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.db.enrollment.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.db.enrollment.count({ where }),
    ]);
    return { items: rows.map(enrollmentOf), total, page: query.page, pageSize: query.pageSize };
  }
}
