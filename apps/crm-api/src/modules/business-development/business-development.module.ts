import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { DocumentsModule } from '../documents/documents.module';
import { IamModule } from '../iam/iam.module';
import { CompanyDocumentOwnerResolver } from './application/company-document-owner';
import { GetAppointmentHandler, ListAppointmentsHandler, PlanAppointmentUseCase, TransitionAppointmentUseCase, UpdateAppointmentUseCase } from './application/appointment-use-cases';
import {
  AdvanceOpportunityUseCase, CloseOpportunityUseCase, CreateOpportunityUseCase, GetOpportunityHandler, GrantWaiverUseCase, ListOpportunitiesHandler, UpdateOpportunityUseCase,
} from './application/opportunity-use-cases';
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
import { APPOINTMENT_REPOSITORY } from './domain/appointment-repository';
import { COMPANY_OVERVIEW_READER } from './domain/company-overview-reader';
import { COMPANY_REPOSITORY } from './domain/company-repository';
import { OWNER_DIRECTORY } from './domain/owner-directory';
import { PrismaOwnerDirectory } from './infrastructure/prisma-owner-directory';
import { OPPORTUNITY_TOTALS } from './domain/opportunity-totals';
import { APPROVAL_REPOSITORY } from './domain/approval-repository';
import { AMBASSADOR_REPOSITORY } from './domain/ambassador-repository';
import { PrismaAmbassadorRepository } from './infrastructure/prisma-ambassador.repository';
import { GetAmbassadorHandler, ListAmbassadorsHandler, RegisterAmbassadorUseCase, UpdateAmbassadorUseCase } from './application/ambassador-use-cases';
import { AmbassadorsController } from './presentation/ambassadors.controller';
import { PrismaApprovalRepository } from './infrastructure/prisma-approval.repository';
import { ApprovalDocumentOwnerResolver } from './application/approval-document-owners';
import { CloseApprovalUseCase, GetApprovalHandler, ListApprovalsHandler, RegisterApprovalUseCase } from './application/approval-use-cases';
import { ApprovalsController } from './presentation/approvals.controller';
import { PrismaOpportunityTotals } from './infrastructure/prisma-opportunity-totals';
import { ChangeCompanyStatusUseCase, ListOwnerCandidatesHandler, ReassignCompanyUseCase } from './application/company-lifecycle-use-cases';
import { CONTACT_REPOSITORY } from './domain/contact-repository';
import { FACILITATOR_REPOSITORY } from './domain/facilitator-repository';
import { FOLLOWUP_REPOSITORY } from './domain/followup-repository';
import { OFFER_REPOSITORY } from './domain/offer-repository';
import { DECISION_MAKER_MEETINGS, OPPORTUNITY_REPOSITORY } from './domain/opportunity-repository';
import { RECEIPT_REPOSITORY } from './domain/receipt-repository';
import { PrismaAppointmentRepository } from './infrastructure/prisma-appointment.repository';
import { PrismaCompanyOverviewReader } from './infrastructure/prisma-company-overview.reader';
import { PrismaCompanyRepository } from './infrastructure/prisma-company.repository';
import { PrismaContactRepository } from './infrastructure/prisma-contact.repository';
import { PrismaFacilitatorRepository } from './infrastructure/prisma-facilitator.repository';
import { PrismaFollowupRepository } from './infrastructure/prisma-followup.repository';
import { PrismaOfferRepository } from './infrastructure/prisma-offer.repository';
import { PrismaDecisionMakerMeetings, PrismaOpportunityRepository } from './infrastructure/prisma-opportunity.repository';
import { PrismaReceiptRepository } from './infrastructure/prisma-receipt.repository';
import { AppointmentsController } from './presentation/appointments.controller';
import { CompaniesController } from './presentation/companies.controller';
import { ContactsController } from './presentation/contacts.controller';
import { FacilitatorsController } from './presentation/facilitators.controller';
import { FollowupsController } from './presentation/followups.controller';
import { OffersController } from './presentation/offers.controller';
import { OpportunitiesController } from './presentation/opportunities.controller';
import { ReceiptsController } from './presentation/receipts.controller';

/** Composition root du module Business Development. */
@Module({
  imports: [AuditModule, IamModule, DocumentsModule],
  controllers: [CompaniesController, FacilitatorsController, ContactsController, OffersController, ReceiptsController, FollowupsController, AppointmentsController, OpportunitiesController, ApprovalsController, AmbassadorsController],
  providers: [
    RegisterCompanyUseCase,
    RegisterFacilitatorUseCase,
    FacilitationResolver,
    UpdateCompanyUseCase,
    RegisterApprovalUseCase,
    RegisterAmbassadorUseCase,
    UpdateAmbassadorUseCase,
    GetAmbassadorHandler,
    ListAmbassadorsHandler,
    CloseApprovalUseCase,
    GetApprovalHandler,
    ListApprovalsHandler,
    ApprovalDocumentOwnerResolver,
    ChangeCompanyStatusUseCase,
    ReassignCompanyUseCase,
    ListOwnerCandidatesHandler,
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
    PlanAppointmentUseCase,
    UpdateAppointmentUseCase,
    TransitionAppointmentUseCase,
    GetAppointmentHandler,
    ListAppointmentsHandler,
    CreateOpportunityUseCase,
    UpdateOpportunityUseCase,
    AdvanceOpportunityUseCase,
    GrantWaiverUseCase,
    CloseOpportunityUseCase,
    GetOpportunityHandler,
    ListOpportunitiesHandler,
    { provide: COMPANY_REPOSITORY, useClass: PrismaCompanyRepository },
    { provide: OWNER_DIRECTORY, useClass: PrismaOwnerDirectory },
    { provide: OPPORTUNITY_TOTALS, useClass: PrismaOpportunityTotals },
    { provide: APPROVAL_REPOSITORY, useClass: PrismaApprovalRepository },
    { provide: AMBASSADOR_REPOSITORY, useClass: PrismaAmbassadorRepository },
    { provide: COMPANY_OVERVIEW_READER, useClass: PrismaCompanyOverviewReader },
    { provide: FACILITATOR_REPOSITORY, useClass: PrismaFacilitatorRepository },
    { provide: CONTACT_REPOSITORY, useClass: PrismaContactRepository },
    { provide: OFFER_REPOSITORY, useClass: PrismaOfferRepository },
    { provide: RECEIPT_REPOSITORY, useClass: PrismaReceiptRepository },
    { provide: FOLLOWUP_REPOSITORY, useClass: PrismaFollowupRepository },
    { provide: APPOINTMENT_REPOSITORY, useClass: PrismaAppointmentRepository },
    { provide: OPPORTUNITY_REPOSITORY, useClass: PrismaOpportunityRepository },
    { provide: DECISION_MAKER_MEETINGS, useClass: PrismaDecisionMakerMeetings },
  ],
})
/** Module « Développement commercial » : entreprises cibles et facilitateurs (premières briques du pipeline commercial). */
export class BusinessDevelopmentModule {}
