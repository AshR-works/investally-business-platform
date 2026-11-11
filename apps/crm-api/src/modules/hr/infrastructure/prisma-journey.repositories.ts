import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../platform/prisma.service';
import { DomainError, Page } from '../../../shared-kernel';
import { Journey, JourneyKind, JourneyStatus, JourneyTaskOwner, JourneyTemplate } from '../domain/journey';
import { JourneyListQuery, JourneyRepository, JourneyTemplateRepository } from '../domain/journey-repositories';

const day = (value: Date): string => value.toISOString().slice(0, 10);
const date = (iso: string): Date => new Date(`${iso}T00:00:00Z`);

type JourneyRow = Prisma.JourneyGetPayload<{ include: { tasks: true } }>;

function toJourney(row: JourneyRow): Journey {
  return Journey.rehydrate({
    id: row.id, employeeId: row.employeeId, kind: row.kind as JourneyKind, referenceDate: day(row.referenceDate), status: row.status as JourneyStatus, launchedByUserId: row.launchedByUserId,
    tasks: [...row.tasks].sort((a, b) => a.sortOrder - b.sortOrder).map((t) => ({ id: t.id, title: t.title, owner: t.owner as JourneyTaskOwner, dueOn: day(t.dueOn), doneAt: t.doneAt, doneByUserId: t.doneByUserId })),
    completedAt: row.completedAt, cancelledAt: row.cancelledAt, version: row.version, createdAt: row.createdAt,
  });
}

/** Persistance PostgreSQL des parcours (jamais supprimés : on les annule). Les tâches sont créées au lancement ; ensuite seul leur état « cochée » change. */
@Injectable()
export class PrismaJourneyRepository implements JourneyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(journey: Journey): Promise<void> {
    const data = { status: journey.status, completedAt: journey.completedAt, cancelledAt: journey.cancelledAt };
    try {
      const updated = await this.prisma.db.journey.updateMany({ where: { id: journey.id, version: journey.version }, data: { ...data, version: { increment: 1 } } });
      if (updated.count === 1) {
        for (const task of journey.tasks) await this.prisma.db.journeyTask.update({ where: { id: task.id }, data: { doneAt: task.doneAt, doneByUserId: task.doneByUserId } });
        return;
      }
      if ((await this.prisma.db.journey.count({ where: { id: journey.id } })) > 0) throw new DomainError('CONFLICT', 'Le parcours a été modifié par un autre utilisateur : rechargez-le');
      await this.prisma.db.journey.create({
        data: {
          id: journey.id, employeeId: journey.employeeId, kind: journey.kind, referenceDate: date(journey.referenceDate), launchedByUserId: journey.launchedByUserId, ...data, version: journey.version, createdAt: journey.createdAt,
          tasks: { create: journey.tasks.map((t, index) => ({ id: t.id, title: t.title, owner: t.owner, dueOn: date(t.dueOn), sortOrder: (index + 1) * 10, doneAt: t.doneAt, doneByUserId: t.doneByUserId })) },
        },
      });
    } catch (e) {
      // Index unique partiel : un second parcours en cours pour le même employé et la même nature.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new DomainError('CONFLICT', 'Un parcours de cette nature est déjà en cours pour cet employé');
      throw e;
    }
  }

  async findById(id: string): Promise<Journey | null> {
    const row = await this.prisma.db.journey.findUnique({ where: { id }, include: { tasks: true } });
    return row ? toJourney(row) : null;
  }

  async activeOf(employeeId: string, kind: JourneyKind): Promise<Journey | null> {
    const row = await this.prisma.db.journey.findFirst({ where: { employeeId, kind, status: 'ACTIVE' }, include: { tasks: true } });
    return row ? toJourney(row) : null;
  }

  async list(query: JourneyListQuery): Promise<Page<Journey>> {
    const where: Prisma.JourneyWhereInput = {
      ...(query.employeeIds ? { employeeId: { in: [...query.employeeIds] } } : {}),
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.db.journey.findMany({ where, include: { tasks: true }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.db.journey.count({ where }),
    ]);
    return { items: rows.map(toJourney), total, page: query.page, pageSize: query.pageSize };
  }

  /** Verrou de ligne : le second lancement attend la fin du premier, puis voit son résultat. Sans transaction, le verrou se libère aussitôt. */
  async lockEmployee(employeeId: string): Promise<void> {
    await this.prisma.db.$queryRaw`SELECT id FROM hr.employees WHERE id = ${employeeId}::uuid FOR UPDATE`;
  }
}

type TemplateRow = Prisma.JourneyTemplateGetPayload<{ include: { tasks: true } }>;

const toTemplate = (row: TemplateRow): JourneyTemplate =>
  JourneyTemplate.rehydrate({
    id: row.id, kind: row.kind as JourneyKind, version: row.version,
    tasks: [...row.tasks].sort((a, b) => a.sortOrder - b.sortOrder).map((t) => ({ title: t.title, owner: t.owner as JourneyTaskOwner, dueOffsetDays: t.dueOffsetDays })),
  });

/** Persistance des modèles : les tâches sont remplacées en bloc, dans la transaction du cas d'usage. */
@Injectable()
export class PrismaJourneyTemplateRepository implements JourneyTemplateRepository {
  constructor(private readonly prisma: PrismaService) {}

  async all(): Promise<JourneyTemplate[]> {
    const rows = await this.prisma.db.journeyTemplate.findMany({ include: { tasks: true } });
    return rows.map(toTemplate);
  }

  async get(kind: JourneyKind): Promise<JourneyTemplate | null> {
    const row = await this.prisma.db.journeyTemplate.findUnique({ where: { kind }, include: { tasks: true } });
    return row ? toTemplate(row) : null;
  }

  async save(template: JourneyTemplate): Promise<void> {
    const updated = await this.prisma.db.journeyTemplate.updateMany({ where: { id: template.id, version: template.version }, data: { version: { increment: 1 } } });
    if (updated.count !== 1) throw new DomainError('CONFLICT', 'Le modèle a été modifié par un autre utilisateur : rechargez-le');
    await this.prisma.db.journeyTemplateTask.deleteMany({ where: { templateId: template.id } });
    await this.prisma.db.journeyTemplateTask.createMany({
      data: template.tasks.map((t, index) => ({ id: crypto.randomUUID(), templateId: template.id, title: t.title, owner: t.owner, dueOffsetDays: t.dueOffsetDays, sortOrder: (index + 1) * 10 })),
    });
  }
}
