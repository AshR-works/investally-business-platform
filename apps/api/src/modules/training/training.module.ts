import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { BusinessDevelopmentModule } from '../business-development/business-development.module';
import { IamModule } from '../iam/iam.module';
import {
  ChangeModuleStatusUseCase, ChangeProgramStatusUseCase, ChangeRoomStatusUseCase, ChangeTrainerStatusUseCase, ChangeTrainingStatusUseCase, CreateModuleUseCase, CreateProgramUseCase, CreateRoomUseCase,
  CreateTrainerUseCase, CreateTrainingUseCase, GetModuleHandler, GetProgramHandler, GetRoomHandler, GetTrainerHandler, GetTrainingHandler, ListModulesHandler, ListProgramsHandler, ListRhythmsHandler,
  ListRoomsHandler, ListTrainersHandler, ListTrainingsHandler, TrainingViews, UpdateModuleUseCase, UpdateProgramUseCase, UpdateRoomUseCase, UpdateTrainerUseCase, UpdateTrainingUseCase,
} from './application/catalogue-use-cases';
import {
  CancelEnrollmentUseCase, ConfirmEnrollmentUseCase, EnrollLearnerUseCase, EnrollmentRules, EnrollmentViews, GetEnrollmentHandler, ListApprovalOptionsHandler, ListEnrollmentsHandler, ReplaceEnrollmentUseCase,
} from './application/enrollment-use-cases';
import { DeleteLearnerUseCase, GetLearnerHandler, ListLearnersHandler, RegisterLearnerUseCase, UpdateLearnerUseCase } from './application/learner-use-cases';
import { ENROLLMENT_REPOSITORY, LEARNER_REPOSITORY } from './domain/enrollment-repositories';
import { PrismaEnrollmentRepository, PrismaLearnerRepository } from './infrastructure/prisma-enrollment.repositories';
import { EnrollmentsController, LearnersController } from './presentation/enrollment.controllers';
import {
  CancelSessionUseCase, GetSessionHandler, ListSessionsHandler, OpenSessionUseCase, PlanSessionUseCase, PostponeSessionUseCase, SessionRules, SessionViews, UpdateSessionUseCase,
} from './application/session-use-cases';
import { SESSION_REPOSITORY } from './domain/session-repositories';
import { PrismaSessionRepository } from './infrastructure/prisma-session.repository';
import { SessionsController } from './presentation/session.controller';
import { MODULE_REPOSITORY, PROGRAM_REPOSITORY, ROOM_REPOSITORY, TRAINER_REPOSITORY, TRAINING_REPOSITORY } from './domain/catalogue-repositories';
import { PrismaModuleRepository, PrismaProgramRepository, PrismaRoomRepository, PrismaTrainerRepository, PrismaTrainingRepository } from './infrastructure/prisma-catalogue.repositories';
import { ModulesController, ProgramsController, RhythmsController, RoomsController, TrainersController, TrainingsController } from './presentation/catalogue.controllers';

/** Composition root du module Formation (Investudy). S5.1 : catalogue (programmes, certificats, modules, salles, formateurs, rythmes). S5.2a : sessions. S5.2b : apprenants et inscriptions. */
@Module({
  imports: [AuditModule, IamModule, BusinessDevelopmentModule],
  controllers: [ProgramsController, TrainingsController, ModulesController, RhythmsController, RoomsController, TrainersController, SessionsController, LearnersController, EnrollmentsController],
  providers: [
    CreateProgramUseCase, UpdateProgramUseCase, ChangeProgramStatusUseCase, GetProgramHandler, ListProgramsHandler,
    CreateTrainingUseCase, UpdateTrainingUseCase, ChangeTrainingStatusUseCase, GetTrainingHandler, ListTrainingsHandler,
    TrainingViews,
    CreateModuleUseCase, UpdateModuleUseCase, ChangeModuleStatusUseCase, GetModuleHandler, ListModulesHandler, ListRhythmsHandler,
    CreateRoomUseCase, UpdateRoomUseCase, ChangeRoomStatusUseCase, GetRoomHandler, ListRoomsHandler,
    CreateTrainerUseCase, UpdateTrainerUseCase, ChangeTrainerStatusUseCase, GetTrainerHandler, ListTrainersHandler,
    PlanSessionUseCase, UpdateSessionUseCase, OpenSessionUseCase, PostponeSessionUseCase, CancelSessionUseCase, GetSessionHandler, ListSessionsHandler, SessionViews, SessionRules,
    RegisterLearnerUseCase, UpdateLearnerUseCase, DeleteLearnerUseCase, GetLearnerHandler, ListLearnersHandler,
    EnrollLearnerUseCase, ConfirmEnrollmentUseCase, CancelEnrollmentUseCase, ReplaceEnrollmentUseCase, GetEnrollmentHandler, ListEnrollmentsHandler, ListApprovalOptionsHandler, EnrollmentViews, EnrollmentRules,
    { provide: LEARNER_REPOSITORY, useClass: PrismaLearnerRepository },
    { provide: ENROLLMENT_REPOSITORY, useClass: PrismaEnrollmentRepository },
    { provide: SESSION_REPOSITORY, useClass: PrismaSessionRepository },
    { provide: PROGRAM_REPOSITORY, useClass: PrismaProgramRepository },
    { provide: TRAINING_REPOSITORY, useClass: PrismaTrainingRepository },
    { provide: MODULE_REPOSITORY, useClass: PrismaModuleRepository },
    { provide: ROOM_REPOSITORY, useClass: PrismaRoomRepository },
    { provide: TRAINER_REPOSITORY, useClass: PrismaTrainerRepository },
  ],
})
export class TrainingModule {}
