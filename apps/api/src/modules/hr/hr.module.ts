import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { IamModule } from '../iam/iam.module';
import {
  GetEmployeeHandler, GetOrgChartHandler, ListDirectoryHandler, ListEmployeesHandler, ListHierarchyGapsHandler, ListLinkableUsersHandler, RegisterEmployeeUseCase, SetEmployeeStatusUseCase, UpdateEmployeeUseCase,
} from './application/employee-use-cases';
import {
  AddHolidayUseCase, AdjustBalanceUseCase, CancelLeaveUseCase, CreateLeaveTypeUseCase, DecideLeaveUseCase, GetLeaveBalanceHandler, GetLeaveRequestHandler, GetLeaveSettingsHandler,
  GetTeamCalendarHandler, ListAdjustmentsHandler, ListHolidaysHandler, ListLeaveRequestsHandler, ListLeaveTypesHandler, RemoveHolidayUseCase, RequestLeaveUseCase,
  UpdateLeaveSettingsUseCase, UpdateLeaveTypeUseCase,
} from './application/leave-use-cases';
import {
  AdjustContractUseCase, CreateContractTypeUseCase, CreateContractUseCase, EndContractUseCase, GetContractHandler, ListContractsHandler, ListContractTypesHandler, ListDeadlinesHandler,
  UpdateContractTypeUseCase,
} from './application/contract-use-cases';
import {
  CancelJourneyUseCase, CompleteJourneyTaskUseCase, GetJourneyHandler, LaunchJourneyUseCase, ListJourneyTemplatesHandler, ListJourneysHandler, ReopenJourneyTaskUseCase,
  UpdateJourneyTemplateUseCase,
} from './application/journey-use-cases';
import { DeclarePresenceUseCase, GetPresenceBoardHandler, RemovePresenceUseCase } from './application/presence-use-cases';
import { CONTRACT_REPOSITORY, CONTRACT_TYPE_REPOSITORY } from './domain/contract-repositories';
import { JOURNEY_REPOSITORY, JOURNEY_TEMPLATE_REPOSITORY } from './domain/journey-repositories';
import { EMPLOYEE_REPOSITORY } from './domain/employee-repository';
import { LEAVE_ADJUSTMENT_REPOSITORY, LEAVE_CONFIG_REPOSITORY, LEAVE_REQUEST_REPOSITORY } from './domain/leave-repositories';
import { PRESENCE_REPOSITORY } from './domain/presence-repositories';
import { USER_DIRECTORY } from './domain/user-directory';
import { PrismaContractRepository, PrismaContractTypeRepository } from './infrastructure/prisma-contract.repositories';
import { PrismaJourneyRepository, PrismaJourneyTemplateRepository } from './infrastructure/prisma-journey.repositories';
import { PrismaEmployeeRepository } from './infrastructure/prisma-employee.repository';
import { PrismaLeaveAdjustmentRepository, PrismaLeaveConfigRepository, PrismaLeaveRequestRepository } from './infrastructure/prisma-leave.repositories';
import { PrismaPresenceRepository } from './infrastructure/prisma-presence.repository';
import { PrismaUserDirectory } from './infrastructure/prisma-user-directory';
import { ContractsController } from './presentation/contracts.controller';
import { EmployeesController } from './presentation/employees.controller';
import { JourneysController } from './presentation/journeys.controller';
import { LeaveController } from './presentation/leave.controller';
import { PresencesController } from './presentation/presences.controller';

/** Composition root du module RH (RH légère : annuaire, organigramme, absences et congés ; ADR-0009, D64). */
@Module({
  imports: [AuditModule, IamModule],
  controllers: [EmployeesController, LeaveController, ContractsController, JourneysController, PresencesController],
  providers: [
    RegisterEmployeeUseCase, UpdateEmployeeUseCase, SetEmployeeStatusUseCase, GetEmployeeHandler, ListEmployeesHandler, ListDirectoryHandler, GetOrgChartHandler, ListHierarchyGapsHandler, ListLinkableUsersHandler,
    RequestLeaveUseCase, DecideLeaveUseCase, CancelLeaveUseCase, GetLeaveRequestHandler, ListLeaveRequestsHandler, GetLeaveBalanceHandler, GetTeamCalendarHandler,
    ListLeaveTypesHandler, CreateLeaveTypeUseCase, UpdateLeaveTypeUseCase, GetLeaveSettingsHandler, UpdateLeaveSettingsUseCase, ListHolidaysHandler, AddHolidayUseCase, RemoveHolidayUseCase,
    AdjustBalanceUseCase, ListAdjustmentsHandler,
    ListContractTypesHandler, CreateContractTypeUseCase, UpdateContractTypeUseCase, CreateContractUseCase, AdjustContractUseCase, EndContractUseCase, GetContractHandler, ListContractsHandler, ListDeadlinesHandler,
    ListJourneyTemplatesHandler, UpdateJourneyTemplateUseCase, LaunchJourneyUseCase, ListJourneysHandler, GetJourneyHandler, CompleteJourneyTaskUseCase, ReopenJourneyTaskUseCase, CancelJourneyUseCase,
    DeclarePresenceUseCase, RemovePresenceUseCase, GetPresenceBoardHandler,
    { provide: EMPLOYEE_REPOSITORY, useClass: PrismaEmployeeRepository },
    { provide: LEAVE_REQUEST_REPOSITORY, useClass: PrismaLeaveRequestRepository },
    { provide: LEAVE_CONFIG_REPOSITORY, useClass: PrismaLeaveConfigRepository },
    { provide: LEAVE_ADJUSTMENT_REPOSITORY, useClass: PrismaLeaveAdjustmentRepository },
    { provide: CONTRACT_REPOSITORY, useClass: PrismaContractRepository },
    { provide: CONTRACT_TYPE_REPOSITORY, useClass: PrismaContractTypeRepository },
    { provide: JOURNEY_REPOSITORY, useClass: PrismaJourneyRepository },
    { provide: JOURNEY_TEMPLATE_REPOSITORY, useClass: PrismaJourneyTemplateRepository },
    { provide: PRESENCE_REPOSITORY, useClass: PrismaPresenceRepository },
    { provide: USER_DIRECTORY, useClass: PrismaUserDirectory },
  ],
})
export class HrModule {}
