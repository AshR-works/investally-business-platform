import { Inject, Injectable } from '@nestjs/common';
import { ActorContext, CLOCK, Clock, DomainError, ID_GENERATOR, IdGenerator, Page, UNIT_OF_WORK, UnitOfWork } from '../../../shared-kernel';
import { AUDIT_RECORDER, AuditAction, AuditRecorder } from '../../audit';
import {
  CatalogueListQuery, MODULE_REPOSITORY, ModuleRepository, PROGRAM_REPOSITORY, ProgramRepository, ROOM_REPOSITORY, RoomRepository, TRAINER_REPOSITORY, TrainerRepository,
  TRAINING_REPOSITORY, TrainingRepository,
} from '../domain/catalogue-repositories';
import { keyOf } from '../domain/catalogue-fields';
import { CourseModule } from '../domain/course-module';
import { Program } from '../domain/program';
import { RHYTHMS } from '../domain/rhythms';
import { Room, RoomKind } from '../domain/room';
import { Trainer } from '../domain/trainer';
import { Training } from '../domain/training';
import {
  ModuleView, ProgramView, RhythmView, RoomView, toModuleView, toProgramView, toRhythmView, toRoomView, toTrainerView, toTrainingView, TrainerView, TrainingView,
} from './catalogue-view';

const MAX_PAGE_SIZE = 100;
export const normalizePage = (query: { page: number; pageSize: number }) => ({
  page: Math.max(1, Math.floor(query.page)),
  pageSize: Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(query.pageSize))),
});

/** Une version périmée (la fiche a changé depuis que l'appelant l'a lue) est un conflit. */
export function assertVersion(current: number, expected: number, label: string): void {
  if (current !== expected) throw new DomainError('CONFLICT', `${label} a été modifié par un autre utilisateur : rechargez la fiche avant de la modifier`);
}

/** Action sur l'état d'un élément du catalogue. */
export type StatusAction = 'archive' | 'reactivate';

// ───────────────────────────── Programmes ─────────────────────────────

export interface CreateProgramCommand { name: string; description?: string | null; audience?: string | null; actor: ActorContext }
export interface UpdateProgramCommand { id: string; version: number; name?: string; description?: string | null; audience?: string | null; actor: ActorContext }
export interface ChangeStatusCommand { id: string; version: number; action: StatusAction; actor: ActorContext }

@Injectable()
export class CreateProgramUseCase {
  constructor(
    @Inject(PROGRAM_REPOSITORY) private readonly programs: ProgramRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  execute(command: CreateProgramCommand): Promise<ProgramView> {
    return this.unitOfWork.run(async () => {
      const program = Program.create({ ...command, id: this.ids.next(), now: this.clock.now() });
      if (await this.programs.existsByName(program.nameKey)) throw new DomainError('CONFLICT', `Un programme nommé « ${program.name} » existe déjà`);
      await this.programs.save(program);
      const view = toProgramView(program);
      await this.audit.record({ actor: command.actor, module: 'training', entityType: 'Program', entityId: program.id, action: AuditAction.Create, newValue: { ...view } });
      return view;
    });
  }
}

@Injectable()
export class UpdateProgramUseCase {
  constructor(
    @Inject(PROGRAM_REPOSITORY) private readonly programs: ProgramRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  execute(command: UpdateProgramCommand): Promise<ProgramView> {
    return this.unitOfWork.run(async () => {
      const program = await this.programs.findById(command.id);
      if (!program) throw new DomainError('NOT_FOUND', 'Programme introuvable');
      assertVersion(program.version, command.version, 'Le programme');
      const before = toProgramView(program);
      program.update(command);
      if (program.nameKey !== keyOf(before.name) && (await this.programs.existsByName(program.nameKey, program.id))) {
        throw new DomainError('CONFLICT', `Un programme nommé « ${program.name} » existe déjà`);
      }
      await this.programs.save(program);
      const after = toProgramView((await this.programs.findById(program.id)) ?? program);
      await this.audit.record({ actor: command.actor, module: 'training', entityType: 'Program', entityId: program.id, action: AuditAction.Update, oldValue: { ...before }, newValue: { ...after } });
      return after;
    });
  }
}

@Injectable()
export class ChangeProgramStatusUseCase {
  constructor(
    @Inject(PROGRAM_REPOSITORY) private readonly programs: ProgramRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  execute(command: ChangeStatusCommand): Promise<ProgramView> {
    return this.unitOfWork.run(async () => {
      const program = await this.programs.findById(command.id);
      if (!program) throw new DomainError('NOT_FOUND', 'Programme introuvable');
      assertVersion(program.version, command.version, 'Le programme');
      const before = toProgramView(program);
      if (command.action === 'archive') program.archive();
      else program.reactivate();
      await this.programs.save(program);
      const refreshed = (await this.programs.findById(program.id)) ?? program;
      const after = toProgramView(refreshed, (await this.programs.activeTrainingCounts([program.id])).get(program.id) ?? 0);
      await this.audit.record({ actor: command.actor, module: 'training', entityType: 'Program', entityId: program.id, action: AuditAction.Update, oldValue: { ...before }, newValue: { ...after } });
      return after;
    });
  }
}

@Injectable()
export class GetProgramHandler {
  constructor(@Inject(PROGRAM_REPOSITORY) private readonly programs: ProgramRepository) {}

  async execute(query: { id: string }): Promise<ProgramView> {
    const program = await this.programs.findById(query.id);
    if (!program) throw new DomainError('NOT_FOUND', 'Programme introuvable');
    return toProgramView(program, (await this.programs.activeTrainingCounts([program.id])).get(program.id) ?? 0);
  }
}

@Injectable()
export class ListProgramsHandler {
  constructor(@Inject(PROGRAM_REPOSITORY) private readonly programs: ProgramRepository) {}

  async execute(query: CatalogueListQuery): Promise<Page<ProgramView>> {
    const result = await this.programs.list({ ...query, ...normalizePage(query), search: query.search?.trim() || undefined });
    const counts = await this.programs.activeTrainingCounts(result.items.map((p) => p.id));
    return { ...result, items: result.items.map((p) => toProgramView(p, counts.get(p.id) ?? 0)) };
  }
}

// ───────────────────────────── Certificats (formations) ─────────────────────────────

export interface CreateTrainingCommand {
  programId: string; title: string; objectives?: string | null; prerequisites?: string | null; priceAmount?: string | number | null;
  modulePriceAmount?: string | number | null; priceCurrency?: string | null; moduleIds?: readonly string[]; actor: ActorContext;
}
export interface UpdateTrainingCommand {
  id: string; version: number; title?: string; objectives?: string | null; prerequisites?: string | null; priceAmount?: string | number | null;
  modulePriceAmount?: string | number | null; priceCurrency?: string | null; moduleIds?: readonly string[]; actor: ActorContext;
}

/** Les modules demandés existent ; ceux qui s'ajoutent (absents de `already`) doivent de plus être actifs. */
async function assertModulesUsable(modules: ModuleRepository, ids: readonly string[], already: readonly string[] = []): Promise<void> {
  if (ids.length === 0) return;
  const found = new Map((await modules.findByIds(ids)).map((m) => [m.id, m]));
  for (const id of ids) {
    const module = found.get(id);
    if (!module) throw new DomainError('NOT_FOUND', 'Module introuvable');
    if (module.status === 'ARCHIVED' && !already.includes(id)) throw new DomainError('INVARIANT_VIOLATION', `Le module « ${module.title} » est archivé : on ne peut pas l'ajouter à un certificat`);
  }
}

@Injectable()
export class TrainingViews {
  constructor(
    @Inject(PROGRAM_REPOSITORY) private readonly programs: ProgramRepository,
    @Inject(MODULE_REPOSITORY) private readonly modules: ModuleRepository,
  ) {}

  async of(training: Training): Promise<TrainingView> {
    const program = await this.programs.findById(training.programId);
    return toTrainingView(training, program?.name ?? '', await this.modules.findByIds(training.moduleIds));
  }
}

@Injectable()
export class CreateTrainingUseCase {
  constructor(
    @Inject(TRAINING_REPOSITORY) private readonly trainings: TrainingRepository,
    @Inject(PROGRAM_REPOSITORY) private readonly programs: ProgramRepository,
    @Inject(MODULE_REPOSITORY) private readonly modules: ModuleRepository,
    private readonly views: TrainingViews,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  execute(command: CreateTrainingCommand): Promise<TrainingView> {
    return this.unitOfWork.run(async () => {
      const program = await this.programs.findById(command.programId);
      if (!program) throw new DomainError('NOT_FOUND', 'Programme introuvable');
      if (program.status === 'ARCHIVED') throw new DomainError('INVARIANT_VIOLATION', 'Le programme est archivé : on ne peut pas y ajouter de certificat');
      const training = Training.create({ ...command, id: this.ids.next(), now: this.clock.now() });
      if (await this.trainings.existsByTitle(program.id, training.titleKey)) {
        throw new DomainError('CONFLICT', `Le programme « ${program.name} » comporte déjà un certificat intitulé « ${training.title} »`);
      }
      await assertModulesUsable(this.modules, training.moduleIds);
      await this.trainings.save(training);
      const view = await this.views.of(training);
      await this.audit.record({ actor: command.actor, module: 'training', entityType: 'Training', entityId: training.id, action: AuditAction.Create, newValue: { ...view } });
      return view;
    });
  }
}

@Injectable()
export class UpdateTrainingUseCase {
  constructor(
    @Inject(TRAINING_REPOSITORY) private readonly trainings: TrainingRepository,
    @Inject(MODULE_REPOSITORY) private readonly modules: ModuleRepository,
    private readonly views: TrainingViews,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  execute(command: UpdateTrainingCommand): Promise<TrainingView> {
    return this.unitOfWork.run(async () => {
      const training = await this.trainings.findById(command.id);
      if (!training) throw new DomainError('NOT_FOUND', 'Certificat introuvable');
      assertVersion(training.version, command.version, 'Le certificat');
      const before = await this.views.of(training);
      const previousModules = [...training.moduleIds];
      training.update(command);
      if (training.titleKey !== keyOf(before.title) && (await this.trainings.existsByTitle(training.programId, training.titleKey, training.id))) {
        throw new DomainError('CONFLICT', `Le programme « ${before.programName} » comporte déjà un certificat intitulé « ${training.title} »`);
      }
      await assertModulesUsable(this.modules, training.moduleIds, previousModules);
      await this.trainings.save(training);
      const after = await this.views.of((await this.trainings.findById(training.id)) ?? training);
      await this.audit.record({ actor: command.actor, module: 'training', entityType: 'Training', entityId: training.id, action: AuditAction.Update, oldValue: { ...before }, newValue: { ...after } });
      return after;
    });
  }
}

@Injectable()
export class ChangeTrainingStatusUseCase {
  constructor(
    @Inject(TRAINING_REPOSITORY) private readonly trainings: TrainingRepository,
    @Inject(PROGRAM_REPOSITORY) private readonly programs: ProgramRepository,
    private readonly views: TrainingViews,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  execute(command: ChangeStatusCommand): Promise<TrainingView> {
    return this.unitOfWork.run(async () => {
      const training = await this.trainings.findById(command.id);
      if (!training) throw new DomainError('NOT_FOUND', 'Certificat introuvable');
      assertVersion(training.version, command.version, 'Le certificat');
      const program = await this.programs.findById(training.programId);
      if (command.action === 'reactivate' && program?.status === 'ARCHIVED') {
        throw new DomainError('INVARIANT_VIOLATION', 'Le programme est archivé : réactivez-le avant de réactiver ce certificat');
      }
      const before = await this.views.of(training);
      if (command.action === 'archive') training.archive();
      else training.reactivate();
      await this.trainings.save(training);
      const after = await this.views.of((await this.trainings.findById(training.id)) ?? training);
      await this.audit.record({ actor: command.actor, module: 'training', entityType: 'Training', entityId: training.id, action: AuditAction.Update, oldValue: { ...before }, newValue: { ...after } });
      return after;
    });
  }
}

@Injectable()
export class GetTrainingHandler {
  constructor(@Inject(TRAINING_REPOSITORY) private readonly trainings: TrainingRepository, private readonly views: TrainingViews) {}

  async execute(query: { id: string }): Promise<TrainingView> {
    const training = await this.trainings.findById(query.id);
    if (!training) throw new DomainError('NOT_FOUND', 'Certificat introuvable');
    return this.views.of(training);
  }
}

@Injectable()
export class ListTrainingsHandler {
  constructor(
    @Inject(TRAINING_REPOSITORY) private readonly trainings: TrainingRepository,
    @Inject(MODULE_REPOSITORY) private readonly modules: ModuleRepository,
  ) {}

  async execute(query: CatalogueListQuery & { programId?: string }): Promise<Page<TrainingView>> {
    const result = await this.trainings.list({ ...query, ...normalizePage(query), search: query.search?.trim() || undefined });
    const modules = await this.modules.findByIds([...new Set(result.items.flatMap((row) => row.training.moduleIds))]);
    return { ...result, items: result.items.map((row) => toTrainingView(row.training, row.programName, modules)) };
  }
}

// ───────────────────────────── Modules ─────────────────────────────

export interface CreateModuleCommand { title: string; description?: string | null; requiresWorkstations?: boolean; actor: ActorContext }
export interface UpdateModuleCommand { id: string; version: number; title?: string; description?: string | null; requiresWorkstations?: boolean; actor: ActorContext }

@Injectable()
export class CreateModuleUseCase {
  constructor(
    @Inject(MODULE_REPOSITORY) private readonly modules: ModuleRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  execute(command: CreateModuleCommand): Promise<ModuleView> {
    return this.unitOfWork.run(async () => {
      const module = CourseModule.create({ ...command, id: this.ids.next(), now: this.clock.now() });
      if (await this.modules.existsByTitle(module.titleKey)) throw new DomainError('CONFLICT', `Un module intitulé « ${module.title} » existe déjà`);
      await this.modules.save(module);
      const view = toModuleView(module);
      await this.audit.record({ actor: command.actor, module: 'training', entityType: 'Module', entityId: module.id, action: AuditAction.Create, newValue: { ...view } });
      return view;
    });
  }
}

@Injectable()
export class UpdateModuleUseCase {
  constructor(
    @Inject(MODULE_REPOSITORY) private readonly modules: ModuleRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  execute(command: UpdateModuleCommand): Promise<ModuleView> {
    return this.unitOfWork.run(async () => {
      const module = await this.modules.findById(command.id);
      if (!module) throw new DomainError('NOT_FOUND', 'Module introuvable');
      assertVersion(module.version, command.version, 'Le module');
      const before = toModuleView(module);
      module.update(command);
      if (module.titleKey !== keyOf(before.title) && (await this.modules.existsByTitle(module.titleKey, module.id))) {
        throw new DomainError('CONFLICT', `Un module intitulé « ${module.title} » existe déjà`);
      }
      await this.modules.save(module);
      const after = toModuleView((await this.modules.findById(module.id)) ?? module);
      await this.audit.record({ actor: command.actor, module: 'training', entityType: 'Module', entityId: module.id, action: AuditAction.Update, oldValue: { ...before }, newValue: { ...after } });
      return after;
    });
  }
}

@Injectable()
export class ChangeModuleStatusUseCase {
  constructor(
    @Inject(MODULE_REPOSITORY) private readonly modules: ModuleRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  execute(command: ChangeStatusCommand): Promise<ModuleView> {
    return this.unitOfWork.run(async () => {
      const module = await this.modules.findById(command.id);
      if (!module) throw new DomainError('NOT_FOUND', 'Module introuvable');
      assertVersion(module.version, command.version, 'Le module');
      const before = toModuleView(module);
      if (command.action === 'archive') module.archive();
      else module.reactivate();
      await this.modules.save(module);
      const after = toModuleView((await this.modules.findById(module.id)) ?? module);
      await this.audit.record({ actor: command.actor, module: 'training', entityType: 'Module', entityId: module.id, action: AuditAction.Update, oldValue: { ...before }, newValue: { ...after } });
      return after;
    });
  }
}

@Injectable()
export class GetModuleHandler {
  constructor(@Inject(MODULE_REPOSITORY) private readonly modules: ModuleRepository) {}

  async execute(query: { id: string }): Promise<ModuleView> {
    const module = await this.modules.findById(query.id);
    if (!module) throw new DomainError('NOT_FOUND', 'Module introuvable');
    return toModuleView(module);
  }
}

@Injectable()
export class ListModulesHandler {
  constructor(@Inject(MODULE_REPOSITORY) private readonly modules: ModuleRepository) {}

  async execute(query: CatalogueListQuery): Promise<Page<ModuleView>> {
    const result = await this.modules.list({ ...query, ...normalizePage(query), search: query.search?.trim() || undefined });
    return { ...result, items: result.items.map(toModuleView) };
  }
}

/** Rythmes de session (valeurs de référence). */
@Injectable()
export class ListRhythmsHandler {
  execute(): RhythmView[] {
    return RHYTHMS.map(toRhythmView);
  }
}

// ───────────────────────────── Salles ─────────────────────────────

export interface CreateRoomCommand { name: string; kind?: RoomKind; learnerSeats: number; unavailableSeats?: number; trainerSeats?: number; equipment?: string | null; actor: ActorContext }
export interface UpdateRoomCommand { id: string; version: number; name?: string; kind?: RoomKind; learnerSeats?: number; unavailableSeats?: number; trainerSeats?: number; equipment?: string | null; actor: ActorContext }

@Injectable()
export class CreateRoomUseCase {
  constructor(
    @Inject(ROOM_REPOSITORY) private readonly rooms: RoomRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  execute(command: CreateRoomCommand): Promise<RoomView> {
    return this.unitOfWork.run(async () => {
      const room = Room.create({ ...command, id: this.ids.next(), now: this.clock.now() });
      if (await this.rooms.existsByName(room.nameKey)) throw new DomainError('CONFLICT', `Une salle nommée « ${room.name} » existe déjà`);
      await this.rooms.save(room);
      const view = toRoomView(room);
      await this.audit.record({ actor: command.actor, module: 'training', entityType: 'Room', entityId: room.id, action: AuditAction.Create, newValue: { ...view } });
      return view;
    });
  }
}

@Injectable()
export class UpdateRoomUseCase {
  constructor(
    @Inject(ROOM_REPOSITORY) private readonly rooms: RoomRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  execute(command: UpdateRoomCommand): Promise<RoomView> {
    return this.unitOfWork.run(async () => {
      const room = await this.rooms.findById(command.id);
      if (!room) throw new DomainError('NOT_FOUND', 'Salle introuvable');
      assertVersion(room.version, command.version, 'La salle');
      const before = toRoomView(room);
      room.update(command);
      if (room.nameKey !== keyOf(before.name) && (await this.rooms.existsByName(room.nameKey, room.id))) {
        throw new DomainError('CONFLICT', `Une salle nommée « ${room.name} » existe déjà`);
      }
      await this.rooms.save(room);
      const after = toRoomView((await this.rooms.findById(room.id)) ?? room);
      await this.audit.record({ actor: command.actor, module: 'training', entityType: 'Room', entityId: room.id, action: AuditAction.Update, oldValue: { ...before }, newValue: { ...after } });
      return after;
    });
  }
}

@Injectable()
export class ChangeRoomStatusUseCase {
  constructor(
    @Inject(ROOM_REPOSITORY) private readonly rooms: RoomRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  execute(command: ChangeStatusCommand): Promise<RoomView> {
    return this.unitOfWork.run(async () => {
      const room = await this.rooms.findById(command.id);
      if (!room) throw new DomainError('NOT_FOUND', 'Salle introuvable');
      assertVersion(room.version, command.version, 'La salle');
      const before = toRoomView(room);
      if (command.action === 'archive') room.archive();
      else room.reactivate();
      await this.rooms.save(room);
      const after = toRoomView((await this.rooms.findById(room.id)) ?? room);
      await this.audit.record({ actor: command.actor, module: 'training', entityType: 'Room', entityId: room.id, action: AuditAction.Update, oldValue: { ...before }, newValue: { ...after } });
      return after;
    });
  }
}

@Injectable()
export class GetRoomHandler {
  constructor(@Inject(ROOM_REPOSITORY) private readonly rooms: RoomRepository) {}

  async execute(query: { id: string }): Promise<RoomView> {
    const room = await this.rooms.findById(query.id);
    if (!room) throw new DomainError('NOT_FOUND', 'Salle introuvable');
    return toRoomView(room);
  }
}

@Injectable()
export class ListRoomsHandler {
  constructor(@Inject(ROOM_REPOSITORY) private readonly rooms: RoomRepository) {}

  async execute(query: CatalogueListQuery): Promise<Page<RoomView>> {
    const result = await this.rooms.list({ ...query, ...normalizePage(query), search: query.search?.trim() || undefined });
    return { ...result, items: result.items.map(toRoomView) };
  }
}

// ───────────────────────────── Formateurs ─────────────────────────────

export interface CreateTrainerCommand {
  lastName: string; firstName: string; specialties?: string | null; email?: string | null; phone?: string | null; userId?: string | null; actor: ActorContext;
}
export interface UpdateTrainerCommand {
  id: string; version: number; lastName?: string; firstName?: string; specialties?: string | null; email?: string | null; phone?: string | null;
  userId?: string | null; actor: ActorContext;
}

/** Un e-mail et un compte utilisateur ne servent qu'à un seul formateur. */
async function assertTrainerFree(trainers: TrainerRepository, trainer: Trainer): Promise<void> {
  if (trainer.email && (await trainers.existsByEmail(trainer.email, trainer.id))) {
    throw new DomainError('CONFLICT', 'Un formateur porte déjà cette adresse e-mail');
  }
  if (trainer.userId) {
    const other = await trainers.findByUserId(trainer.userId);
    if (other && other.id !== trainer.id) throw new DomainError('CONFLICT', 'Ce compte utilisateur est déjà lié à un autre formateur');
  }
}

@Injectable()
export class CreateTrainerUseCase {
  constructor(
    @Inject(TRAINER_REPOSITORY) private readonly trainers: TrainerRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  execute(command: CreateTrainerCommand): Promise<TrainerView> {
    return this.unitOfWork.run(async () => {
      const trainer = Trainer.create({ ...command, id: this.ids.next(), now: this.clock.now() });
      await assertTrainerFree(this.trainers, trainer);
      await this.trainers.save(trainer);
      const view = toTrainerView(trainer);
      await this.audit.record({ actor: command.actor, module: 'training', entityType: 'Trainer', entityId: trainer.id, action: AuditAction.Create, newValue: { ...view } });
      return view;
    });
  }
}

@Injectable()
export class UpdateTrainerUseCase {
  constructor(
    @Inject(TRAINER_REPOSITORY) private readonly trainers: TrainerRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  execute(command: UpdateTrainerCommand): Promise<TrainerView> {
    return this.unitOfWork.run(async () => {
      const trainer = await this.trainers.findById(command.id);
      if (!trainer) throw new DomainError('NOT_FOUND', 'Formateur introuvable');
      assertVersion(trainer.version, command.version, 'Le formateur');
      const before = toTrainerView(trainer);
      trainer.update(command);
      await assertTrainerFree(this.trainers, trainer);
      await this.trainers.save(trainer);
      const after = toTrainerView((await this.trainers.findById(trainer.id)) ?? trainer);
      await this.audit.record({ actor: command.actor, module: 'training', entityType: 'Trainer', entityId: trainer.id, action: AuditAction.Update, oldValue: { ...before }, newValue: { ...after } });
      return after;
    });
  }
}

@Injectable()
export class ChangeTrainerStatusUseCase {
  constructor(
    @Inject(TRAINER_REPOSITORY) private readonly trainers: TrainerRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  execute(command: ChangeStatusCommand): Promise<TrainerView> {
    return this.unitOfWork.run(async () => {
      const trainer = await this.trainers.findById(command.id);
      if (!trainer) throw new DomainError('NOT_FOUND', 'Formateur introuvable');
      assertVersion(trainer.version, command.version, 'Le formateur');
      const before = toTrainerView(trainer);
      if (command.action === 'archive') trainer.archive();
      else trainer.reactivate();
      await this.trainers.save(trainer);
      const after = toTrainerView((await this.trainers.findById(trainer.id)) ?? trainer);
      await this.audit.record({ actor: command.actor, module: 'training', entityType: 'Trainer', entityId: trainer.id, action: AuditAction.Update, oldValue: { ...before }, newValue: { ...after } });
      return after;
    });
  }
}

@Injectable()
export class GetTrainerHandler {
  constructor(@Inject(TRAINER_REPOSITORY) private readonly trainers: TrainerRepository) {}

  async execute(query: { id: string }): Promise<TrainerView> {
    const trainer = await this.trainers.findById(query.id);
    if (!trainer) throw new DomainError('NOT_FOUND', 'Formateur introuvable');
    return toTrainerView(trainer);
  }
}

@Injectable()
export class ListTrainersHandler {
  constructor(@Inject(TRAINER_REPOSITORY) private readonly trainers: TrainerRepository) {}

  async execute(query: CatalogueListQuery): Promise<Page<TrainerView>> {
    const result = await this.trainers.list({ ...query, ...normalizePage(query), search: query.search?.trim() || undefined });
    return { ...result, items: result.items.map(toTrainerView) };
  }
}
