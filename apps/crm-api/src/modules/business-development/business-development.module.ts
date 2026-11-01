import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { DocumentsModule } from '../documents/documents.module';
import { IamModule } from '../iam/iam.module';
import { CompanyDocumentOwnerResolver } from './application/company-document-owner';
import { PlannedFollowupsCloser } from './application/followup-closer';
import { CloseFollowupUseCase, GetFollowupHandler, ListFollowupsHandler, PlanFollowupUseCase, UpdateFollowupUseCase } from './application/followup-use-cases';
import { OfferDocumentOwnerResolver, ReceiptDocumentOwnerResolver } from './application/offer-document-owners';
import { DeleteContactUseCase, GetContactHandler, ListContactsHandler, RegisterContactUseCase, UpdateContactUseCase } from './application/contact-use-cases';
import { ExportCompanySheetHandler } from './application/export-company-sheet.query';
import { FacilitationResolver } from './application/facilitation-resolver';
import { GetFacilitatorHandler, ListFacilitatorsHandler } from './application/facilitator-queries';
import { GetCompanyHandler } from './application/get-company.query';
import { GetCompanyOverviewHandler } from './application/get-company-overview.query';
import { ListCompaniesHandler } from './application/list-companies.query';
import { ChangeOfferStatusUseCase, GetOfferHandler, ListOffersHandler, RegisterOfferUseCase, UpdateOfferUseCase } from './application/offer-use-cases';
import { CancelReceiptUseCase, GetReceiptHandler, ListReceiptsHandler, RegisterReceiptUseCase } from './application/receipt-use-cases';
import { RegisterCompanyUseCase } from './application/register-company.use-case';
import { RegisterFacilitatorUseCase } from './application/register-facilitator.use-case';
import { UpdateCompanyUseCase } from './application/update-company.use-case';
import { COMPANY_OVERVIEW_READER } from './domain/company-overview-reader';
import { COMPANY_REPOSITORY } from './domain/company-repository';
import { CONTACT_REPOSITORY } from './domain/contact-repository';
import { FACILITATOR_REPOSITORY } from './domain/facilitator-repository';
import { FOLLOWUP_REPOSITORY } from './domain/followup-repository';
import { OFFER_REPOSITORY } from './domain/offer-repository';
import { RECEIPT_REPOSITORY } from './domain/receipt-repository';
import { PrismaCompanyOverviewReader } from './infrastructure/prisma-company-overview.reader';
import { PrismaCompanyRepository } from './infrastructure/prisma-company.repository';
import { PrismaContactRepository } from './infrastructure/prisma-contact.repository';
import { PrismaFacilitatorRepository } from './infrastructure/prisma-facilitator.repository';
import { PrismaFollowupRepository } from './infrastructure/prisma-followup.repository';
import { PrismaOfferRepository } from './infrastructure/prisma-offer.repository';
import { PrismaReceiptRepository } from './infrastructure/prisma-receipt.repository';
import { CompaniesController } from './presentation/companies.controller';
import { ContactsController } from './presentation/contacts.controller';
import { FacilitatorsController } from './presentation/facilitators.controller';
import { FollowupsController } from './presentation/followups.controller';
import { OffersController } from './presentation/offers.controller';
import { ReceiptsController } from './presentation/receipts.controller';

/** Composition root du module Business Development. */
@Module({
  imports: [AuditModule, IamModule, DocumentsModule],
  controllers: [CompaniesController, FacilitatorsController, ContactsController, OffersController, ReceiptsController, FollowupsController],
  providers: [
    RegisterCompanyUseCase,
    RegisterFacilitatorUseCase,
    FacilitationResolver,
    UpdateCompanyUseCase,
    ExportCompanySheetHandler,
    ListCompaniesHandler,
    GetCompanyOverviewHandler,
    GetCompanyHandler,
    ListFacilitatorsHandler,
    GetFacilitatorHandler,
    CompanyDocumentOwnerResolver,
    RegisterContactUseCase,
    UpdateContactUseCase,
    DeleteContactUseCase,
    GetContactHandler,
    ListContactsHandler,
    RegisterOfferUseCase,
    UpdateOfferUseCase,
    ChangeOfferStatusUseCase,
    GetOfferHandler,
    ListOffersHandler,
    OfferDocumentOwnerResolver,
    ReceiptDocumentOwnerResolver,
    RegisterReceiptUseCase,
    CancelReceiptUseCase,
    GetReceiptHandler,
    ListReceiptsHandler,
    PlannedFollowupsCloser,
    PlanFollowupUseCase,
    UpdateFollowupUseCase,
    CloseFollowupUseCase,
    GetFollowupHandler,
    ListFollowupsHandler,
    { provide: COMPANY_REPOSITORY, useClass: PrismaCompanyRepository },
    { provide: COMPANY_OVERVIEW_READER, useClass: PrismaCompanyOverviewReader },
    { provide: FACILITATOR_REPOSITORY, useClass: PrismaFacilitatorRepository },
    { provide: CONTACT_REPOSITORY, useClass: PrismaContactRepository },
    { provide: OFFER_REPOSITORY, useClass: PrismaOfferRepository },
    { provide: RECEIPT_REPOSITORY, useClass: PrismaReceiptRepository },
    { provide: FOLLOWUP_REPOSITORY, useClass: PrismaFollowupRepository },
  ],
})
/** Module « Développement commercial » : entreprises cibles et facilitateurs (premières briques du pipeline commercial). */
export class BusinessDevelopmentModule {}
