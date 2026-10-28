import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { DocumentsModule } from '../documents/documents.module';
import { IamModule } from '../iam/iam.module';
import { CompanyDocumentOwnerResolver } from './application/company-document-owner';
import { GetFacilitatorHandler, ListFacilitatorsHandler } from './application/facilitator-queries';
import { GetCompanyHandler } from './application/get-company.query';
import { ListCompaniesHandler } from './application/list-companies.query';
import { RegisterCompanyUseCase } from './application/register-company.use-case';
import { RegisterFacilitatorUseCase } from './application/register-facilitator.use-case';
import { COMPANY_REPOSITORY } from './domain/company-repository';
import { FACILITATOR_REPOSITORY } from './domain/facilitator-repository';
import { PrismaCompanyRepository } from './infrastructure/prisma-company.repository';
import { PrismaFacilitatorRepository } from './infrastructure/prisma-facilitator.repository';
import { CompaniesController } from './presentation/companies.controller';
import { FacilitatorsController } from './presentation/facilitators.controller';

/** Composition root du module Business Development. */
@Module({
  imports: [AuditModule, IamModule, DocumentsModule],
  controllers: [CompaniesController, FacilitatorsController],
  providers: [
    RegisterCompanyUseCase,
    RegisterFacilitatorUseCase,
    ListCompaniesHandler,
    GetCompanyHandler,
    ListFacilitatorsHandler,
    GetFacilitatorHandler,
    CompanyDocumentOwnerResolver,
    { provide: COMPANY_REPOSITORY, useClass: PrismaCompanyRepository },
    { provide: FACILITATOR_REPOSITORY, useClass: PrismaFacilitatorRepository },
  ],
})
/** Module « Développement commercial » : entreprises cibles et facilitateurs (premières briques du pipeline commercial). */
export class BusinessDevelopmentModule {}
