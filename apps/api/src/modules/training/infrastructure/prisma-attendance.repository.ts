import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../platform/prisma.service';
import { DomainError } from '../../../shared-kernel';
import { Attendance, AttendanceStatus } from '../domain/attendance';
import { AttendanceRepository } from '../domain/attendance-repositories';

const iso = (value: Date): string => value.toISOString().slice(0, 10);
const date = (text: string): Date => new Date(`${text}T00:00:00Z`);

const toAttendance = (row: Prisma.AttendanceGetPayload<object>): Attendance =>
  Attendance.rehydrate({
    id: row.id, enrollmentId: row.enrollmentId, day: iso(row.day), status: row.status as AttendanceStatus, recordedByUserId: row.recordedByUserId,
    createdAt: row.createdAt, updatedAt: row.updatedAt, version: row.version,
  });

/** Persistance PostgreSQL des présences aux séances : un enregistrement par inscription et par jour (unicité garantie par la base). */
@Injectable()
export class PrismaAttendanceRepository implements AttendanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(attendance: Attendance): Promise<void> {
    try {
      const updated = await this.prisma.db.attendance.updateMany({
        where: { id: attendance.id }, data: { status: attendance.status, recordedByUserId: attendance.recordedByUserId, version: { increment: 1 } },
      });
      if (updated.count === 1) return;
      await this.prisma.db.attendance.create({
        data: {
          id: attendance.id, enrollmentId: attendance.enrollmentId, day: date(attendance.day), status: attendance.status, recordedByUserId: attendance.recordedByUserId,
          version: attendance.version, createdAt: attendance.createdAt,
        },
      });
    } catch (e) {
      // Unicité (inscription, jour) : deux saisies simultanées du même jour.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new DomainError('CONFLICT', 'Une présence est déjà saisie ce jour-là : rechargez la page');
      throw e;
    }
  }

  async find(enrollmentId: string, day: string): Promise<Attendance | null> {
    const row = await this.prisma.db.attendance.findUnique({ where: { enrollmentId_day: { enrollmentId, day: date(day) } } });
    return row ? toAttendance(row) : null;
  }

  async bySession(enrollmentIds: readonly string[]): Promise<Attendance[]> {
    if (enrollmentIds.length === 0) return [];
    const rows = await this.prisma.db.attendance.findMany({
      where: { enrollmentId: { in: [...enrollmentIds] } }, orderBy: [{ day: 'asc' }, { enrollmentId: 'asc' }],
    });
    return rows.map(toAttendance);
  }
}
