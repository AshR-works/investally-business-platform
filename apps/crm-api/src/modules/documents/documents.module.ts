import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { IamModule } from '../iam/iam.module';
import {
  AddDocumentVersionUseCase, ArchiveDocumentUseCase, DocumentOwnerGate, DownloadDocumentUseCase, GetDocumentHandler, ListDocumentsHandler,
  UploadDocumentUseCase,
} from './application/document-use-cases';
import { DOCUMENT_OWNER_REGISTRY, InMemoryDocumentOwnerRegistry } from './application/owner-registry';
import { DOCUMENT_REPOSITORY, OBJECT_STORAGE } from './domain/ports';
import { LocalDiskObjectStorage } from './infrastructure/local-disk-object-storage';
import { PrismaDocumentRepository } from './infrastructure/prisma-document.repository';
import { DocumentsController } from './presentation/documents.controller';

/** Composition root du module Documents (service partagé : les autres modules y déclarent leurs objets propriétaires). */
@Module({
  imports: [AuditModule, IamModule],
  controllers: [DocumentsController],
  providers: [
    DocumentOwnerGate,
    UploadDocumentUseCase,
    AddDocumentVersionUseCase,
    ListDocumentsHandler,
    GetDocumentHandler,
    DownloadDocumentUseCase,
    ArchiveDocumentUseCase,
    { provide: DOCUMENT_REPOSITORY, useClass: PrismaDocumentRepository },
    { provide: OBJECT_STORAGE, useClass: LocalDiskObjectStorage },
    { provide: DOCUMENT_OWNER_REGISTRY, useClass: InMemoryDocumentOwnerRegistry },
  ],
  exports: [DOCUMENT_OWNER_REGISTRY],
})
/**
 * Module « Documents » : versions immuables avec empreinte SHA-256, stockage derrière un port, téléchargement contrôlé
 * et audité. Les droits d'accès suivent ceux de l'objet propriétaire (résolveur déclaré par chaque module métier).
 */
export class DocumentsModule {}
