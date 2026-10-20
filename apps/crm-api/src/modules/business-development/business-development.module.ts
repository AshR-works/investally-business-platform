import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { IamModule } from '../iam/iam.module';
import { GetCompanyHandler } from './application/get-company.query';
import { ListCompaniesHandler } from './application/list-companies.query';
import { RegisterCompanyUseCase } from './application/register-company.use-case';
import { COMPANY_REPOSITORY } from './domain/company-repository';
import { PrismaCompanyRepository } from './infrastructure/prisma-company.repository';
import { CompaniesController } from './presentation/companies.controller';

/** Composition root du module Business Development. */
@Module({
  imports: [AuditModule, IamModule],
  controllers: [CompaniesController],
  providers: [
    RegisterCompanyUseCase,
    ListCompaniesHandler,
    GetCompanyHandler,
    { provide: COMPANY_REPOSITORY, useClass: PrismaCompanyRepository },
  ],
})
export class BusinessDevelopmentModule {}
