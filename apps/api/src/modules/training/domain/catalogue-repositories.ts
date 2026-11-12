import { Page } from '../../../shared-kernel';
import { CatalogueStatus } from './catalogue-fields';
import { CourseModule } from './course-module';
import { Program } from './program';
import { Room } from './room';
import { Trainer } from './trainer';
import { Training } from './training';

export interface CatalogueListQuery {
  page: number;
  pageSize: number;
  search?: string;
  status?: CatalogueStatus;
}

/**
 * Ports de persistance du catalogue. `save` crée ou met à jour : une version périmée est un conflit, de même qu'un nom, un titre ou
 * un e-mail déjà pris (garanti en dernier ressort par la base).
 */
export interface ProgramRepository {
  save(program: Program): Promise<void>;
  findById(id: string): Promise<Program | null>;
  existsByName(nameKey: string, excludeId?: string): Promise<boolean>;
  list(query: CatalogueListQuery): Promise<Page<Program>>;
  /** Nombre de formations actives par programme (affichage du catalogue). */
  activeTrainingCounts(programIds: readonly string[]): Promise<Map<string, number>>;
}

export interface TrainingRepository {
  save(training: Training): Promise<void>;
  findById(id: string): Promise<Training | null>;
  existsByTitle(programId: string, titleKey: string, excludeId?: string): Promise<boolean>;
  list(query: CatalogueListQuery & { programId?: string }): Promise<Page<{ training: Training; programName: string }>>;
}

export interface ModuleRepository {
  save(module: CourseModule): Promise<void>;
  findById(id: string): Promise<CourseModule | null>;
  /** Les modules existants parmi ces identifiants (ordre quelconque). */
  findByIds(ids: readonly string[]): Promise<CourseModule[]>;
  existsByTitle(titleKey: string, excludeId?: string): Promise<boolean>;
  list(query: CatalogueListQuery): Promise<Page<CourseModule>>;
}

export interface RoomRepository {
  save(room: Room): Promise<void>;
  findById(id: string): Promise<Room | null>;
  existsByName(nameKey: string, excludeId?: string): Promise<boolean>;
  list(query: CatalogueListQuery): Promise<Page<Room>>;
}

export interface TrainerRepository {
  save(trainer: Trainer): Promise<void>;
  findById(id: string): Promise<Trainer | null>;
  existsByEmail(email: string, excludeId?: string): Promise<boolean>;
  /** Le formateur lié à ce compte utilisateur, s'il y en a un. */
  findByUserId(userId: string): Promise<Trainer | null>;
  list(query: CatalogueListQuery): Promise<Page<Trainer>>;
}

export const PROGRAM_REPOSITORY = Symbol('ProgramRepository');
export const TRAINING_REPOSITORY = Symbol('TrainingRepository');
export const MODULE_REPOSITORY = Symbol('ModuleRepository');
export const ROOM_REPOSITORY = Symbol('RoomRepository');
export const TRAINER_REPOSITORY = Symbol('TrainerRepository');
