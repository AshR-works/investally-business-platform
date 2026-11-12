import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../platform/prisma.service';
import { DomainError, Page } from '../../../shared-kernel';
import { CatalogueListQuery, ModuleRepository, ProgramRepository, RoomRepository, TrainerRepository, TrainingRepository } from '../domain/catalogue-repositories';
import { CourseModule } from '../domain/course-module';
import { Program } from '../domain/program';
import { Room } from '../domain/room';
import { Trainer } from '../domain/trainer';
import { Training } from '../domain/training';

const isUniqueViolation = (error: unknown): boolean => error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

/**
 * Enregistrement commun : mise à jour gardée par la version (une version périmée est un conflit), sinon création. Un nom, un titre
 * ou un e-mail déjà pris — vérifié aussi par la base — est un conflit.
 */
async function upsertVersioned(
  label: string,
  duplicate: string,
  update: () => Promise<{ count: number }>,
  exists: () => Promise<number>,
  create: () => Promise<unknown>,
): Promise<void> {
  try {
    if ((await update()).count === 1) return;
    if ((await exists()) > 0) throw new DomainError('CONFLICT', `${label} a été modifié par un autre utilisateur`);
    await create();
  } catch (error) {
    if (isUniqueViolation(error)) throw new DomainError('CONFLICT', duplicate);
    throw error;
  }
}

type ProgramRow = Prisma.ProgramGetPayload<object>;
const programOf = (r: ProgramRow): Program =>
  Program.rehydrate({ id: r.id, name: r.name, description: r.description, audience: r.audience, status: r.status, createdAt: r.createdAt, version: r.version });

@Injectable()
export class PrismaProgramRepository implements ProgramRepository {
  constructor(private readonly prisma: PrismaService) {}

  save(program: Program): Promise<void> {
    const data = { name: program.name, nameKey: program.nameKey, description: program.description, audience: program.audience, status: program.status };
    const db = this.prisma.db.program;
    return upsertVersioned(
      'Le programme', `Un programme nommé « ${program.name} » existe déjà`,
      () => db.updateMany({ where: { id: program.id, version: program.version }, data: { ...data, version: { increment: 1 } } }),
      () => db.count({ where: { id: program.id } }),
      () => db.create({ data: { id: program.id, ...data, version: program.version, createdAt: program.createdAt } }),
    );
  }

  async findById(id: string): Promise<Program | null> {
    const row = await this.prisma.db.program.findUnique({ where: { id } });
    return row ? programOf(row) : null;
  }

  async existsByName(nameKey: string, excludeId?: string): Promise<boolean> {
    return (await this.prisma.db.program.count({ where: { nameKey, ...(excludeId ? { id: { not: excludeId } } : {}) } })) > 0;
  }

  async list(query: CatalogueListQuery): Promise<Page<Program>> {
    const where: Prisma.ProgramWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.db.program.findMany({ where, orderBy: [{ name: 'asc' }, { id: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.db.program.count({ where }),
    ]);
    return { items: rows.map(programOf), total, page: query.page, pageSize: query.pageSize };
  }

  async activeTrainingCounts(programIds: readonly string[]): Promise<Map<string, number>> {
    if (programIds.length === 0) return new Map();
    const groups = await this.prisma.db.training.groupBy({ by: ['programId'], where: { programId: { in: [...programIds] }, status: 'ACTIVE' }, _count: { _all: true } });
    return new Map(groups.map((g) => [g.programId, g._count._all]));
  }
}

const withModules = { modules: { orderBy: { position: 'asc' }, select: { moduleId: true } } } satisfies Prisma.TrainingInclude;
type TrainingRow = Prisma.TrainingGetPayload<{ include: typeof withModules }>;
const trainingOf = (r: TrainingRow): Training =>
  Training.rehydrate({
    id: r.id, programId: r.programId, title: r.title, objectives: r.objectives, prerequisites: r.prerequisites,
    pricing: r.priceCurrency ? { currency: r.priceCurrency, full: r.priceAmount?.toFixed(2) ?? null, perModule: r.modulePriceAmount?.toFixed(2) ?? null } : null,
    moduleIds: r.modules.map((m) => m.moduleId),
    status: r.status, createdAt: r.createdAt, version: r.version,
  });

@Injectable()
export class PrismaTrainingRepository implements TrainingRepository {
  constructor(private readonly prisma: PrismaService) {}

  save(training: Training): Promise<void> {
    const data = {
      title: training.title, titleKey: training.titleKey, objectives: training.objectives, prerequisites: training.prerequisites,
      priceAmount: training.pricing?.full ?? null, modulePriceAmount: training.pricing?.perModule ?? null, priceCurrency: training.pricing?.currency ?? null, status: training.status,
    };
    const db = this.prisma.db.training;
    return upsertVersioned(
      'Le certificat', `Le programme comporte déjà un certificat intitulé « ${training.title} »`,
      () => db.updateMany({ where: { id: training.id, version: training.version }, data: { ...data, version: { increment: 1 } } }),
      () => db.count({ where: { id: training.id } }),
      () => db.create({ data: { id: training.id, programId: training.programId, ...data, version: training.version, createdAt: training.createdAt } }),
    ).then(() => this.syncModules(training));
  }

  /** Aligne les modules du certificat sur sa liste ordonnée (remplacement complet, dans la transaction de l'enregistrement). */
  private async syncModules(training: Training): Promise<void> {
    const links = this.prisma.db.trainingModule;
    await links.deleteMany({ where: { trainingId: training.id } });
    if (training.moduleIds.length > 0) {
      await links.createMany({ data: training.moduleIds.map((moduleId, index) => ({ trainingId: training.id, moduleId, position: index + 1 })) });
    }
  }

  async findById(id: string): Promise<Training | null> {
    const row = await this.prisma.db.training.findUnique({ where: { id }, include: withModules });
    return row ? trainingOf(row) : null;
  }

  async existsByTitle(programId: string, titleKey: string, excludeId?: string): Promise<boolean> {
    return (await this.prisma.db.training.count({ where: { programId, titleKey, ...(excludeId ? { id: { not: excludeId } } : {}) } })) > 0;
  }

  async list(query: CatalogueListQuery & { programId?: string }): Promise<Page<{ training: Training; programName: string }>> {
    const where: Prisma.TrainingWhereInput = {
      ...(query.programId ? { programId: query.programId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.db.training.findMany({
        where, include: { ...withModules, program: { select: { name: true } } },
        orderBy: [{ program: { name: 'asc' } }, { title: 'asc' }, { id: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize,
      }),
      this.prisma.db.training.count({ where }),
    ]);
    return { items: rows.map((r) => ({ training: trainingOf(r), programName: r.program.name })), total, page: query.page, pageSize: query.pageSize };
  }
}

type ModuleRow = Prisma.CourseModuleGetPayload<object>;
const moduleOf = (r: ModuleRow): CourseModule =>
  CourseModule.rehydrate({ id: r.id, title: r.title, description: r.description, requiresWorkstations: r.requiresWorkstations, status: r.status, createdAt: r.createdAt, version: r.version });

@Injectable()
export class PrismaModuleRepository implements ModuleRepository {
  constructor(private readonly prisma: PrismaService) {}

  save(module: CourseModule): Promise<void> {
    const data = { title: module.title, titleKey: module.titleKey, description: module.description, requiresWorkstations: module.requiresWorkstations, status: module.status };
    const db = this.prisma.db.courseModule;
    return upsertVersioned(
      'Le module', `Un module intitulé « ${module.title} » existe déjà`,
      () => db.updateMany({ where: { id: module.id, version: module.version }, data: { ...data, version: { increment: 1 } } }),
      () => db.count({ where: { id: module.id } }),
      () => db.create({ data: { id: module.id, ...data, version: module.version, createdAt: module.createdAt } }),
    );
  }

  async findById(id: string): Promise<CourseModule | null> {
    const row = await this.prisma.db.courseModule.findUnique({ where: { id } });
    return row ? moduleOf(row) : null;
  }

  async findByIds(ids: readonly string[]): Promise<CourseModule[]> {
    if (ids.length === 0) return [];
    return (await this.prisma.db.courseModule.findMany({ where: { id: { in: [...ids] } } })).map(moduleOf);
  }

  async existsByTitle(titleKey: string, excludeId?: string): Promise<boolean> {
    return (await this.prisma.db.courseModule.count({ where: { titleKey, ...(excludeId ? { id: { not: excludeId } } : {}) } })) > 0;
  }

  async list(query: CatalogueListQuery): Promise<Page<CourseModule>> {
    const where: Prisma.CourseModuleWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.db.courseModule.findMany({ where, orderBy: [{ title: 'asc' }, { id: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.db.courseModule.count({ where }),
    ]);
    return { items: rows.map(moduleOf), total, page: query.page, pageSize: query.pageSize };
  }
}

type RoomRow = Prisma.RoomGetPayload<object>;
const roomOf = (r: RoomRow): Room =>
  Room.rehydrate({
    id: r.id, name: r.name, kind: r.kind, learnerSeats: r.learnerSeats, unavailableSeats: r.unavailableSeats, trainerSeats: r.trainerSeats, equipment: r.equipment, status: r.status,
    createdAt: r.createdAt, version: r.version,
  });

@Injectable()
export class PrismaRoomRepository implements RoomRepository {
  constructor(private readonly prisma: PrismaService) {}

  save(room: Room): Promise<void> {
    const data = {
      name: room.name, nameKey: room.nameKey, kind: room.kind, learnerSeats: room.learnerSeats, unavailableSeats: room.unavailableSeats, trainerSeats: room.trainerSeats,
      equipment: room.equipment, status: room.status,
    };
    const db = this.prisma.db.room;
    return upsertVersioned(
      'La salle', `Une salle nommée « ${room.name} » existe déjà`,
      () => db.updateMany({ where: { id: room.id, version: room.version }, data: { ...data, version: { increment: 1 } } }),
      () => db.count({ where: { id: room.id } }),
      () => db.create({ data: { id: room.id, ...data, version: room.version, createdAt: room.createdAt } }),
    );
  }

  async findById(id: string): Promise<Room | null> {
    const row = await this.prisma.db.room.findUnique({ where: { id } });
    return row ? roomOf(row) : null;
  }

  async existsByName(nameKey: string, excludeId?: string): Promise<boolean> {
    return (await this.prisma.db.room.count({ where: { nameKey, ...(excludeId ? { id: { not: excludeId } } : {}) } })) > 0;
  }

  async list(query: CatalogueListQuery): Promise<Page<Room>> {
    const where: Prisma.RoomWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.db.room.findMany({ where, orderBy: [{ name: 'asc' }, { id: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.db.room.count({ where }),
    ]);
    return { items: rows.map(roomOf), total, page: query.page, pageSize: query.pageSize };
  }
}

type TrainerRow = Prisma.TrainerGetPayload<object>;
const trainerOf = (r: TrainerRow): Trainer =>
  Trainer.rehydrate({
    id: r.id, lastName: r.lastName, firstName: r.firstName, specialties: r.specialties, email: r.email, phone: r.phone, userId: r.userId,
    status: r.status, createdAt: r.createdAt, version: r.version,
  });

@Injectable()
export class PrismaTrainerRepository implements TrainerRepository {
  constructor(private readonly prisma: PrismaService) {}

  save(trainer: Trainer): Promise<void> {
    const data = {
      lastName: trainer.lastName, firstName: trainer.firstName, specialties: trainer.specialties, email: trainer.email, emailKey: trainer.email,
      phone: trainer.phone, userId: trainer.userId, status: trainer.status,
    };
    const db = this.prisma.db.trainer;
    return upsertVersioned(
      'Le formateur', 'Cette adresse e-mail ou ce compte utilisateur est déjà celui d’un autre formateur',
      () => db.updateMany({ where: { id: trainer.id, version: trainer.version }, data: { ...data, version: { increment: 1 } } }),
      () => db.count({ where: { id: trainer.id } }),
      () => db.create({ data: { id: trainer.id, ...data, version: trainer.version, createdAt: trainer.createdAt } }),
    );
  }

  async findById(id: string): Promise<Trainer | null> {
    const row = await this.prisma.db.trainer.findUnique({ where: { id } });
    return row ? trainerOf(row) : null;
  }

  async existsByEmail(email: string, excludeId?: string): Promise<boolean> {
    return (await this.prisma.db.trainer.count({ where: { emailKey: email, ...(excludeId ? { id: { not: excludeId } } : {}) } })) > 0;
  }

  async findByUserId(userId: string): Promise<Trainer | null> {
    const row = await this.prisma.db.trainer.findUnique({ where: { userId } });
    return row ? trainerOf(row) : null;
  }

  async list(query: CatalogueListQuery): Promise<Page<Trainer>> {
    const where: Prisma.TrainerWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? { OR: [{ lastName: { contains: query.search, mode: 'insensitive' } }, { firstName: { contains: query.search, mode: 'insensitive' } }, { specialties: { contains: query.search, mode: 'insensitive' } }] }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.db.trainer.findMany({ where, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.db.trainer.count({ where }),
    ]);
    return { items: rows.map(trainerOf), total, page: query.page, pageSize: query.pageSize };
  }
}
