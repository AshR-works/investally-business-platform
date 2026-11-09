import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { IamModule } from '../iam/iam.module';
import {
  GetEmployeeHandler, GetOrgChartHandler, ListDirectoryHandler, ListEmployeesHandler, ListHierarchyGapsHandler, ListLinkableUsersHandler, RegisterEmployeeUseCase, SetEmployeeStatusUseCase, UpdateEmployeeUseCase,
} from './application/employee-use-cases';
import { EMPLOYEE_REPOSITORY } from './domain/employee-repository';
import { USER_DIRECTORY } from './domain/user-directory';
import { PrismaEmployeeRepository } from './infrastructure/prisma-employee.repository';
import { PrismaUserDirectory } from './infrastructure/prisma-user-directory';
import { EmployeesController } from './presentation/employees.controller';

/** Composition root du module RH (RH légère : annuaire et organigramme du personnel, ADR-0009). */
@Module({
  imports: [AuditModule, IamModule],
  controllers: [EmployeesController],
  providers: [
    RegisterEmployeeUseCase, UpdateEmployeeUseCase, SetEmployeeStatusUseCase, GetEmployeeHandler, ListEmployeesHandler, ListDirectoryHandler, GetOrgChartHandler, ListHierarchyGapsHandler, ListLinkableUsersHandler,
    { provide: EMPLOYEE_REPOSITORY, useClass: PrismaEmployeeRepository },
    { provide: USER_DIRECTORY, useClass: PrismaUserDirectory },
  ],
})
export class HrModule {}
