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
import { CONTRACT_REPOSITORY, CONTRACT_TYPE_REPOSITORY } from './domain/contract-repositories';
import { EMPLOYEE_REPOSITORY } from './domain/employee-repository';
import { LEAVE_ADJUSTMENT_REPOSITORY, LEAVE_CONFIG_REPOSITORY, LEAVE_REQUEST_REPOSITORY } from './domain/leave-repositories';
import { USER_DIRECTORY } from './domain/user-directory';
import { PrismaContractRepository, PrismaContractTypeRepository } from './infrastructure/prisma-contract.repositories';
import { PrismaEmployeeRepository } from './infrastructure/prisma-employee.repository';
import { PrismaLeaveAdjustmentRepository, PrismaLeaveConfigRepository, PrismaLeaveRequestRepository } from './infrastructure/prisma-leave.repositories';
import { PrismaUserDirectory } from './infrastructure/prisma-user-directory';
import { ContractsController } from './presentation/contracts.controller';
import { EmployeesController } from './presentation/employees.controller';
import { LeaveController } from './presentation/leave.controller';

/** Composition root du module RH (RH légère : annuaire, organigramme, absences et congés ; ADR-0009, D64). */
@Module({
  imports: [AuditModule, IamModule],
  controllers: [EmployeesController, LeaveController, ContractsController],
  providers: [
    RegisterEmployeeUseCase, UpdateEmployeeUseCase, SetEmployeeStatusUseCase, GetEmployeeHandler, ListEmployeesHandler, ListDirectoryHandler, GetOrgChartHandler, ListHierarchyGapsHandler, ListLinkableUsersHandler,
    RequestLeaveUseCase, DecideLeaveUseCase, CancelLeaveUseCase, GetLeaveRequestHandler, ListLeaveRequestsHandler, GetLeaveBalanceHandler, GetTeamCalendarHandler,
    ListLeaveTypesHandler, CreateLeaveTypeUseCase, UpdateLeaveTypeUseCase, GetLeaveSettingsHandler, UpdateLeaveSettingsUseCase, ListHolidaysHandler, AddHolidayUseCase, RemoveHolidayUseCase,
    AdjustBalanceUseCase, ListAdjustmentsHandler,
    ListContractTypesHandler, CreateContractTypeUseCase, UpdateContractTypeUseCase, CreateContractUseCase, AdjustContractUseCase, EndContractUseCase, GetContractHandler, ListContractsHandler, ListDeadlinesHandler,
    { provide: EMPLOYEE_REPOSITORY, useClass: PrismaEmployeeRepository },
    { provide: LEAVE_REQUEST_REPOSITORY, useClass: PrismaLeaveRequestRepository },
    { provide: LEAVE_CONFIG_REPOSITORY, useClass: PrismaLeaveConfigRepository },
    { provide: LEAVE_ADJUSTMENT_REPOSITORY, useClass: PrismaLeaveAdjustmentRepository },
    { provide: CONTRACT_REPOSITORY, useClass: PrismaContractRepository },
    { provide: CONTRACT_TYPE_REPOSITORY, useClass: PrismaContractTypeRepository },
    { provide: USER_DIRECTORY, useClass: PrismaUserDirectory },
  ],
})
export class HrModule {}
