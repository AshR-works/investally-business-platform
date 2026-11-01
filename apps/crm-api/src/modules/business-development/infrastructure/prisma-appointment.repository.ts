import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../platform/prisma.service';
import { DomainError, Page } from '../../../shared-kernel';
import { Appointment, AppointmentStatus, AppointmentType } from '../domain/appointment';
import { AppointmentListItem, AppointmentListQuery, AppointmentRepository } from '../domain/appointment-repository';

type AppointmentRow = Prisma.AppointmentGetPayload<object>;
type AppointmentWithContext = Prisma.AppointmentGetPayload<{
  include: { company: { select: { name: true } }; contact: { select: { firstName: true; lastName: true } }; offer: { select: { reference: true } } };
}>;

const WITH_CONTEXT = {
  company: { select: { name: true } },
  contact: { select: { firstName: true, lastName: true } },
  offer: { select: { reference: true } },
} as const;

function toDomain(row: AppointmentRow): Appointment {
  return Appointment.rehydrate({
    id: row.id,
    type: row.type as AppointmentType,
    companyId: row.companyId,
    contactId: row.contactId,
    offerId: row.offerId,
    organizerUserId: row.organizerUserId,
    startsAt: row.startsAt,
    durationMinutes: row.durationMinutes,
    location: row.location,
    note: row.note,
    status: row.status as AppointmentStatus,
    outcomeNote: row.outcomeNote,
    closedAt: row.closedAt,
    postponements: row.postponements,
    lastPostponeReason: row.lastPostponeReason,
    createdAt: row.createdAt,
    version: row.version,
  });
}

const toItem = (row: AppointmentWithContext): AppointmentListItem => ({
  appointment: toDomain(row),
  companyName: row.company.name,
  contactName: row.contact ? `${row.contact.firstName} ${row.contact.lastName}` : null,
  offerReference: row.offer?.reference ?? null,
});

/** Persistance PostgreSQL des rendez-vous (jamais supprimés : on les tient ou on les annule, avec un texte). */
@Injectable()
export class PrismaAppointmentRepository implements AppointmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Crée ou met à jour le rendez-vous ; une modification sur une version périmée est un conflit (verrou optimiste). */
  async save(appointment: Appointment): Promise<void> {
    const data = {
      contactId: appointment.contactId,
      startsAt: appointment.startsAt,
      durationMinutes: appointment.durationMinutes,
      location: appointment.location,
      note: appointment.note,
      status: appointment.status,
      outcomeNote: appointment.outcomeNote,
      closedAt: appointment.closedAt,
      postponements: appointment.postponements,
      lastPostponeReason: appointment.lastPostponeReason,
    };
    const updated = await this.prisma.db.appointment.updateMany({
      where: { id: appointment.id, version: appointment.version },
      data: { ...data, version: { increment: 1 } },
    });
    if (updated.count === 1) return;
    if ((await this.prisma.db.appointment.count({ where: { id: appointment.id } })) > 0) {
      throw new DomainError('CONFLICT', 'Le rendez-vous a été modifié par un autre utilisateur : rechargez-le avant de le modifier');
    }
    await this.prisma.db.appointment.create({
      data: {
        id: appointment.id, type: appointment.type, companyId: appointment.companyId, offerId: appointment.offerId,
        organizerUserId: appointment.organizerUserId, ...data, version: appointment.version, createdAt: appointment.createdAt,
      },
    });
  }

  async findById(id: string): Promise<Appointment | null> {
    const row = await this.prisma.db.appointment.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  /** Une durée s'exprimant en minutes, le chevauchement se calcule en SQL sur l'heure de début et la durée. */
  async findConflicts(query: { organizerUserId: string; startsAt: Date; endsAt: Date; excludeId?: string }): Promise<AppointmentListItem[]> {
    const rows = await this.prisma.db.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "bd"."appointments"
      WHERE "organizer_user_id" = ${query.organizerUserId}::uuid
        AND "status" = 'PLANNED'
        AND "starts_at" < ${query.endsAt}
        AND "starts_at" + ("duration_minutes" * INTERVAL '1 minute') > ${query.startsAt}
        AND (${query.excludeId ?? null}::uuid IS NULL OR "id" <> ${query.excludeId ?? null}::uuid)
      ORDER BY "starts_at" ASC, "id" ASC`;
    if (rows.length === 0) return [];
    const found = await this.prisma.db.appointment.findMany({
      where: { id: { in: rows.map((r) => r.id) } }, include: WITH_CONTEXT, orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
    });
    return found.map(toItem);
  }

  async list(query: AppointmentListQuery): Promise<Page<AppointmentListItem>> {
    const where: Prisma.AppointmentWhereInput = {
      company: { deletedAt: null, ...(query.ownerIds ? { ownerUserId: { in: [...query.ownerIds] } } : {}) },
      startsAt: { gte: query.from, lt: query.to },
      type: { in: [...query.types] },
      ...(query.status ? { status: query.status } : {}),
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.offerId ? { offerId: query.offerId } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.db.appointment.findMany({
        where,
        include: WITH_CONTEXT,
        orderBy: [{ startsAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.db.appointment.count({ where }),
    ]);
    return { items: rows.map(toItem), total, page: query.page, pageSize: query.pageSize };
  }
}
