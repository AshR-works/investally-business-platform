import { Page } from '../../src/shared-kernel';
import { CatalogueListQuery, ModuleRepository, ProgramRepository, RoomRepository, TrainerRepository, TrainingRepository } from '../../src/modules/training/domain/catalogue-repositories';
import { CourseModule } from '../../src/modules/training/domain/course-module';
import { Program } from '../../src/modules/training/domain/program';
import { Room } from '../../src/modules/training/domain/room';
import { Trainer } from '../../src/modules/training/domain/trainer';
import { Training } from '../../src/modules/training/domain/training';

const pageOf = <T>(items: T[], query: { page: number; pageSize: number }): Page<T> => ({
  items: items.slice((query.page - 1) * query.pageSize, query.page * query.pageSize), total: items.length, page: query.page, pageSize: query.pageSize,
});

/** Dépôts en mémoire du catalogue, pour les tests unitaires (les versions ne sont pas incrémentées : c'est le travail de la base). */
export class InMemoryPrograms implements ProgramRepository {
  readonly items: Program[] = [];
  trainings: InMemoryTrainings | null = null;
  async save(program: Program) { if (!this.items.includes(program)) this.items.push(program); }
  async findById(id: string) { return this.items.find((p) => p.id === id) ?? null; }
  async existsByName(nameKey: string, excludeId?: string) { return this.items.some((p) => p.nameKey === nameKey && p.id !== excludeId); }
  async list(query: CatalogueListQuery) {
    return pageOf(this.items.filter((p) => (!query.status || p.status === query.status) && (!query.search || p.name.toLowerCase().includes(query.search.toLowerCase()))), query);
  }
  async activeTrainingCounts(programIds: readonly string[]) {
    return new Map(programIds.map((id) => [id, (this.trainings?.items ?? []).filter((t) => t.programId === id && t.status === 'ACTIVE').length]));
  }
}

export class InMemoryTrainings implements TrainingRepository {
  readonly items: Training[] = [];
  constructor(private readonly programs: InMemoryPrograms) {}
  async save(training: Training) { if (!this.items.includes(training)) this.items.push(training); }
  async findById(id: string) { return this.items.find((t) => t.id === id) ?? null; }
  async existsByTitle(programId: string, titleKey: string, excludeId?: string) { return this.items.some((t) => t.programId === programId && t.titleKey === titleKey && t.id !== excludeId); }
  async list(query: CatalogueListQuery & { programId?: string }) {
    const rows = this.items
      .filter((t) => (!query.programId || t.programId === query.programId) && (!query.status || t.status === query.status))
      .map((training) => ({ training, programName: this.programs.items.find((p) => p.id === training.programId)?.name ?? '' }));
    return pageOf(rows, query);
  }
}

export class InMemoryRooms implements RoomRepository {
  readonly items: Room[] = [];
  async save(room: Room) { if (!this.items.includes(room)) this.items.push(room); }
  async findById(id: string) { return this.items.find((r) => r.id === id) ?? null; }
  async existsByName(nameKey: string, excludeId?: string) { return this.items.some((r) => r.nameKey === nameKey && r.id !== excludeId); }
  async list(query: CatalogueListQuery) { return pageOf(this.items.filter((r) => !query.status || r.status === query.status), query); }
}

export class InMemoryTrainers implements TrainerRepository {
  readonly items: Trainer[] = [];
  async save(trainer: Trainer) { if (!this.items.includes(trainer)) this.items.push(trainer); }
  async findById(id: string) { return this.items.find((t) => t.id === id) ?? null; }
  async existsByEmail(email: string, excludeId?: string) { return this.items.some((t) => t.email === email && t.id !== excludeId); }
  async findByUserId(userId: string) { return this.items.find((t) => t.userId === userId) ?? null; }
  async list(query: CatalogueListQuery) { return pageOf(this.items.filter((t) => !query.status || t.status === query.status), query); }
}

export class InMemoryModules implements ModuleRepository {
  readonly items: CourseModule[] = [];
  async save(module: CourseModule) { if (!this.items.includes(module)) this.items.push(module); }
  async findById(id: string) { return this.items.find((m) => m.id === id) ?? null; }
  async findByIds(ids: readonly string[]) { return this.items.filter((m) => ids.includes(m.id)); }
  async existsByTitle(titleKey: string, excludeId?: string) { return this.items.some((m) => m.titleKey === titleKey && m.id !== excludeId); }
  async list(query: CatalogueListQuery) { return pageOf(this.items.filter((m) => !query.status || m.status === query.status), query); }
}
