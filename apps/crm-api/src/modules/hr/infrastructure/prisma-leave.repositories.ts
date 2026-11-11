import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../platform/prisma.service';
import { DomainError, Page } from '../../../shared-kernel';
import { LeaveAdjustment, LeaveSettings, LeaveType, PublicHoliday, DEFAULT_LEAVE_SETTINGS } from '../domain/leave-config';
import { LeaveAdjustmentRepository, LeaveConfigRepository, LeaveRequestListQuery, LeaveRequestRepository } from '../domain/leave-repositories';
import { LeaveRequest, LeaveStatus } from '../domain/leave-request';

const day = (date: Date): string => date.toISOString().slice(0, 10);
const date = (iso: string): Date => new Date(`${iso}T00:00:00Z`);
const ACTIVE = [LeaveStatus.Pending, LeaveStatus.Approved];

type RequestRow = Prisma.LeaveRequestGetPayload<object>;

function toRequest(row: RequestRow): LeaveRequest {
  return LeaveRequest.rehydrate({
    id: row.id, employeeId: row.employeeId, leaveTypeId: row.leaveTypeId, start: day(row.startDate), end: day(row.endDate), startHalf: row.startHalf, endHalf: row.endHalf,
    days: Number(row.days), status: row.status as LeaveStatus, note: row.note, requestedByUserId: row.requestedByUserId, decidedByUserId: row.decidedByUserId,
    decidedAt: row.decidedAt, decisionNote: row.decisionNote, cancelledAt: row.cancelledAt, cancelReason: row.cancelReason, createdAt: row.createdAt, version: row.version,
  });
}

/** Persistance PostgreSQL des demandes d'absence (jamais supprimées : on les annule). */
@Injectable()
export class PrismaLeaveRequestRepository implements LeaveRequestRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(request: LeaveRequest): Promise<void> {
    const data = {
      employeeId: request.employeeId, leaveTypeId: request.leaveTypeId, startDate: date(request.start), endDate: date(request.end), startHalf: request.startHalf, endHalf: request.endHalf,
      days: request.days, leaveYear: request.year, status: request.status, note: request.note, requestedByUserId: request.requestedByUserId, decidedByUserId: request.decidedByUserId,
      decidedAt: request.decidedAt, decisionNote: request.decisionNote, cancelledAt: request.cancelledAt, cancelReason: request.cancelReason,
    };
    const updated = await this.prisma.db.leaveRequest.updateMany({ where: { id: request.id, version: request.version }, data: { ...data, version: { increment: 1 } } });
    if (updated.count === 1) return;
    if ((await this.prisma.db.leaveRequest.count({ where: { id: request.id } })) > 0) {
      throw new DomainError('CONFLICT', 'La demande a été modifiée par un autre utilisateur : rechargez-la');
    }
    await this.prisma.db.leaveRequest.create({ data: { id: request.id, ...data, version: request.version, createdAt: request.createdAt } });
  }

  async findById(id: string): Promise<LeaveRequest | null> {
    const row = await this.prisma.db.leaveRequest.findUnique({ where: { id } });
    return row ? toRequest(row) : null;
  }

  async findActiveOverlapping(employeeId: string, from: string, to: string, excludeId?: string): Promise<LeaveRequest[]> {
    const rows = await this.prisma.db.leaveRequest.findMany({
      where: { employeeId, status: { in: ACTIVE }, startDate: { lte: date(to) }, endDate: { gte: date(from) }, ...(excludeId ? { id: { not: excludeId } } : {}) },
      orderBy: { startDate: 'asc' },
    });
    return rows.map(toRequest);
  }

  async sumDays(employeeId: string, year: number, leaveTypeIds: readonly string[], excludeId?: string): Promise<{ approved: number; pending: number }> {
    const rows = await this.prisma.db.leaveRequest.findMany({
      where: { employeeId, leaveYear: year, leaveTypeId: { in: [...leaveTypeIds] }, status: { in: ACTIVE }, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { days: true, status: true },
    });
    let approved = 0;
    let pending = 0;
    for (const row of rows) {
      if (row.status === LeaveStatus.Approved) approved += Number(row.days);
      else pending += Number(row.days);
    }
    return { approved, pending };
  }

  async list(query: LeaveRequestListQuery): Promise<Page<LeaveRequest>> {
    const where: Prisma.LeaveRequestWhereInput = {
      ...(query.employeeIds ? { employeeId: { in: [...query.employeeIds] } } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.year ? { leaveYear: query.year } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.db.leaveRequest.findMany({ where, orderBy: [{ startDate: 'desc' }, { id: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.db.leaveRequest.count({ where }),
    ]);
    return { items: rows.map(toRequest), total, page: query.page, pageSize: query.pageSize };
  }

  async approvedBetween(from: string, to: string, employeeIds?: readonly string[]): Promise<LeaveRequest[]> {
    const rows = await this.prisma.db.leaveRequest.findMany({
      where: { status: LeaveStatus.Approved, startDate: { lte: date(to) }, endDate: { gte: date(from) }, ...(employeeIds ? { employeeId: { in: [...employeeIds] } } : {}) },
      orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
    });
    return rows.map(toRequest);
  }

  /** Verrou de ligne : la seconde demande attend la fin de la première, puis voit son résultat (chevauchement, solde). Sans transaction, le verrou se libère aussitôt. */
  async lockEmployee(employeeId: string): Promise<void> {
    await this.prisma.db.$queryRaw`SELECT id FROM hr.employees WHERE id = ${employeeId}::uuid FOR UPDATE`;
  }
}

/** Persistance des règles, types d'absence et jours fériés. */
@Injectable()
export class PrismaLeaveConfigRepository implements LeaveConfigRepository {
  constructor(private readonly prisma: PrismaService) {}

  async settings(): Promise<LeaveSettings> {
    const row = await this.prisma.db.leaveSettings.findUnique({ where: { id: 1 } });
    if (!row) return DEFAULT_LEAVE_SETTINGS;
    return { accrualDaysPerMonth: Number(row.accrualDaysPerMonth), countsSaturday: row.countsSaturday, allowHalfDays: row.allowHalfDays, allowNegativeBalance: row.allowNegativeBalance, version: row.version };
  }

  async saveSettings(settings: LeaveSettings): Promise<void> {
    const updated = await this.prisma.db.leaveSettings.updateMany({
      where: { id: 1, version: settings.version },
      data: { accrualDaysPerMonth: settings.accrualDaysPerMonth, countsSaturday: settings.countsSaturday, allowHalfDays: settings.allowHalfDays, allowNegativeBalance: settings.allowNegativeBalance, version: { increment: 1 } },
    });
    if (updated.count !== 1) throw new DomainError('CONFLICT', 'Les règles de congés ont été modifiées par un autre utilisateur : rechargez-les');
  }

  private toType(row: Prisma.LeaveTypeGetPayload<object>): LeaveType {
    return LeaveType.rehydrate({
      id: row.id, code: row.code, label: row.label, deductsBalance: row.deductsBalance, requiresApproval: row.requiresApproval,
      maxDaysPerRequest: row.maxDaysPerRequest === null ? null : Number(row.maxDaysPerRequest), active: row.active, sortOrder: row.sortOrder, version: row.version, createdAt: row.createdAt,
    });
  }

  async types(includeInactive: boolean): Promise<LeaveType[]> {
    const rows = await this.prisma.db.leaveType.findMany({ where: includeInactive ? {} : { active: true }, orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }] });
    return rows.map((row) => this.toType(row));
  }

  async findType(id: string): Promise<LeaveType | null> {
    const row = await this.prisma.db.leaveType.findUnique({ where: { id } });
    return row ? this.toType(row) : null;
  }

  async findTypeByCode(code: string): Promise<LeaveType | null> {
    const row = await this.prisma.db.leaveType.findUnique({ where: { code } });
    return row ? this.toType(row) : null;
  }

  async saveType(type: LeaveType): Promise<void> {
    const data = {
      label: type.label, deductsBalance: type.deductsBalance, requiresApproval: type.requiresApproval, maxDaysPerRequest: type.maxDaysPerRequest, active: type.active, sortOrder: type.sortOrder,
    };
    try {
      const updated = await this.prisma.db.leaveType.updateMany({ where: { id: type.id, version: type.version }, data: { ...data, version: { increment: 1 } } });
      if (updated.count === 1) return;
      if ((await this.prisma.db.leaveType.count({ where: { id: type.id } })) > 0) throw new DomainError('CONFLICT', "Le type d'absence a été modifié par un autre utilisateur : rechargez-le");
      await this.prisma.db.leaveType.create({ data: { id: type.id, code: type.code, ...data, version: type.version, createdAt: type.createdAt } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new DomainError('CONFLICT', `Le code ${type.code} existe déjà`);
      throw e;
    }
  }

  async holidays(from: string, to: string): Promise<PublicHoliday[]> {
    const rows = await this.prisma.db.publicHoliday.findMany({ where: { day: { gte: date(from), lte: date(to) } }, orderBy: { day: 'asc' } });
    return rows.map((row) => ({ id: row.id, day: day(row.day), label: row.label }));
  }

  async findHoliday(id: string): Promise<PublicHoliday | null> {
    const row = await this.prisma.db.publicHoliday.findUnique({ where: { id } });
    return row ? { id: row.id, day: day(row.day), label: row.label } : null;
  }

  async findHolidayByDay(iso: string): Promise<PublicHoliday | null> {
    const row = await this.prisma.db.publicHoliday.findUnique({ where: { day: date(iso) } });
    return row ? { id: row.id, day: day(row.day), label: row.label } : null;
  }

  async addHoliday(holiday: PublicHoliday): Promise<void> {
    try {
      await this.prisma.db.publicHoliday.create({ data: { id: holiday.id, day: date(holiday.day), label: holiday.label } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new DomainError('CONFLICT', 'Un jour férié existe déjà à cette date');
      throw e;
    }
  }

  async removeHoliday(id: string): Promise<void> {
    await this.prisma.db.publicHoliday.deleteMany({ where: { id } });
  }
}

/** Ajustements de solde : ajout seul (aucune modification ni suppression n'existe). */
@Injectable()
export class PrismaLeaveAdjustmentRepository implements LeaveAdjustmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async add(adjustment: LeaveAdjustment): Promise<void> {
    await this.prisma.db.leaveAdjustment.create({
      data: { id: adjustment.id, employeeId: adjustment.employeeId, year: adjustment.year, days: adjustment.days, reason: adjustment.reason, createdByUserId: adjustment.createdByUserId, createdAt: adjustment.createdAt },
    });
  }

  async forYear(employeeId: string, year: number): Promise<LeaveAdjustment[]> {
    const rows = await this.prisma.db.leaveAdjustment.findMany({ where: { employeeId, year }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    return rows.map((row) => ({ id: row.id, employeeId: row.employeeId, year: row.year, days: Number(row.days), reason: row.reason, createdByUserId: row.createdByUserId, createdAt: row.createdAt }));
  }

  async total(employeeId: string, year: number): Promise<number> {
    const sum = await this.prisma.db.leaveAdjustment.aggregate({ where: { employeeId, year }, _sum: { days: true } });
    return Number(sum._sum.days ?? 0);
  }
}
