import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { IamModule } from '../iam/iam.module';
import {
  ChangeModuleStatusUseCase, ChangeProgramStatusUseCase, ChangeRoomStatusUseCase, ChangeTrainerStatusUseCase, ChangeTrainingStatusUseCase, CreateModuleUseCase, CreateProgramUseCase, CreateRoomUseCase,
  CreateTrainerUseCase, CreateTrainingUseCase, GetModuleHandler, GetProgramHandler, GetRoomHandler, GetTrainerHandler, GetTrainingHandler, ListModulesHandler, ListProgramsHandler, ListRhythmsHandler,
  ListRoomsHandler, ListTrainersHandler, ListTrainingsHandler, TrainingViews, UpdateModuleUseCase, UpdateProgramUseCase, UpdateRoomUseCase, UpdateTrainerUseCase, UpdateTrainingUseCase,
} from './application/catalogue-use-cases';
import { MODULE_REPOSITORY, PROGRAM_REPOSITORY, ROOM_REPOSITORY, TRAINER_REPOSITORY, TRAINING_REPOSITORY } from './domain/catalogue-repositories';
import { PrismaModuleRepository, PrismaProgramRepository, PrismaRoomRepository, PrismaTrainerRepository, PrismaTrainingRepository } from './infrastructure/prisma-catalogue.repositories';
import { ModulesController, ProgramsController, RhythmsController, RoomsController, TrainersController, TrainingsController } from './presentation/catalogue.controllers';

/** Composition root du module Formation (Investudy). S5.1 : catalogue (programmes, certificats, modules, salles, formateurs, rythmes). */
@Module({
  imports: [AuditModule, IamModule],
  controllers: [ProgramsController, TrainingsController, ModulesController, RhythmsController, RoomsController, TrainersController],
  providers: [
    CreateProgramUseCase, UpdateProgramUseCase, ChangeProgramStatusUseCase, GetProgramHandler, ListProgramsHandler,
    CreateTrainingUseCase, UpdateTrainingUseCase, ChangeTrainingStatusUseCase, GetTrainingHandler, ListTrainingsHandler,
    TrainingViews,
    CreateModuleUseCase, UpdateModuleUseCase, ChangeModuleStatusUseCase, GetModuleHandler, ListModulesHandler, ListRhythmsHandler,
    CreateRoomUseCase, UpdateRoomUseCase, ChangeRoomStatusUseCase, GetRoomHandler, ListRoomsHandler,
    CreateTrainerUseCase, UpdateTrainerUseCase, ChangeTrainerStatusUseCase, GetTrainerHandler, ListTrainersHandler,
    { provide: PROGRAM_REPOSITORY, useClass: PrismaProgramRepository },
    { provide: TRAINING_REPOSITORY, useClass: PrismaTrainingRepository },
    { provide: MODULE_REPOSITORY, useClass: PrismaModuleRepository },
    { provide: ROOM_REPOSITORY, useClass: PrismaRoomRepository },
    { provide: TRAINER_REPOSITORY, useClass: PrismaTrainerRepository },
  ],
})
export class TrainingModule {}
