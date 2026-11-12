import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../platform/prisma.service';
import { DomainError } from '../../../shared-kernel';
import { Document, DocumentStatus, DocumentVersion, ScanStatus } from '../domain/document';
import { DocumentRepository } from '../domain/ports';

type DocumentRow = Prisma.DocumentGetPayload<object>;
type VersionRow = Prisma.DocumentVersionGetPayload<object>;

/** Ligne de base → document du domaine. */
function toDocument(row: DocumentRow): Document {
  return Document.rehydrate({
    id: row.id, ownerType: row.ownerType, ownerId: row.ownerId, title: row.title, category: row.category,
    status: row.status as DocumentStatus, currentVersionNumber: row.currentVersionNumber, createdBy: row.createdBy,
    version: row.version, createdAt: row.createdAt,
  });
}

/** Ligne de base → version du domaine (la taille est un entier 64 bits en base, un nombre ≤ 10 Mo ici). */
function toVersion(row: VersionRow): DocumentVersion {
  return {
    id: row.id, documentId: row.documentId, versionNumber: row.versionNumber, storageKey: row.storageKey, fileName: row.fileName,
    mimeType: row.mimeType, sizeBytes: Number(row.sizeBytes), sha256: row.sha256, scanStatus: row.scanStatus as ScanStatus,
    uploadedBy: row.uploadedBy, createdAt: row.createdAt,
  };
}

/** Données d'une version à écrire. */
function versionData(version: DocumentVersion) {
  return {
    id: version.id, documentId: version.documentId, versionNumber: version.versionNumber, storageKey: version.storageKey,
    fileName: version.fileName, mimeType: version.mimeType, sizeBytes: BigInt(version.sizeBytes), sha256: version.sha256,
    scanStatus: version.scanStatus, uploadedBy: version.uploadedBy, createdAt: version.createdAt,
  };
}

/**
 * Persistance PostgreSQL des documents (schéma `docs`). Aucune méthode ne supprime : les déclencheurs de la base
 * refusent aussi la suppression et la modification du contenu d'une version.
 */
@Injectable()
export class PrismaDocumentRepository implements DocumentRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Crée le document et sa première version. */
  async createWithVersion(document: Document, version: DocumentVersion): Promise<void> {
    await this.prisma.db.document.create({
      data: {
        id: document.id, ownerType: document.ownerType, ownerId: document.ownerId, title: document.title, category: document.category,
        status: document.status, currentVersionNumber: document.currentVersionNumber, createdBy: document.createdBy,
        version: document.version, createdAt: document.createdAt,
      },
    });
    await this.prisma.db.documentVersion.create({ data: versionData(version) });
  }

  /** Ajoute une version et avance la version courante ; refus si quelqu'un d'autre a modifié le document entre-temps. */
  async addVersion(document: Document, version: DocumentVersion): Promise<void> {
    const updated = await this.prisma.db.document.updateMany({
      where: { id: document.id, version: document.version, status: { not: DocumentStatus.Archived }, deletedAt: null },
      data: { currentVersionNumber: document.currentVersionNumber, version: { increment: 1 } },
    });
    if (updated.count !== 1) throw new DomainError('CONFLICT', 'Le document a été modifié par un autre utilisateur');
    try {
      await this.prisma.db.documentVersion.create({ data: versionData(version) });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new DomainError('CONFLICT', 'Une autre version vient d\'être ajoutée : réessayez');
      }
      throw error;
    }
  }

  /** Enregistre l'état du document (archivage) avec verrou optimiste. */
  async save(document: Document): Promise<void> {
    const updated = await this.prisma.db.document.updateMany({
      where: { id: document.id, version: document.version, deletedAt: null },
      data: { status: document.status, version: { increment: 1 } },
    });
    if (updated.count !== 1) throw new DomainError('CONFLICT', 'Le document a été modifié par un autre utilisateur');
  }

  async findById(id: string): Promise<Document | null> {
    const row = await this.prisma.db.document.findFirst({ where: { id, deletedAt: null } });
    return row ? toDocument(row) : null;
  }

  async findVersion(documentId: string, versionNumber: number): Promise<DocumentVersion | null> {
    const row = await this.prisma.db.documentVersion.findUnique({ where: { documentId_versionNumber: { documentId, versionNumber } } });
    return row ? toVersion(row) : null;
  }

  async listVersions(documentId: string): Promise<DocumentVersion[]> {
    const rows = await this.prisma.db.documentVersion.findMany({ where: { documentId }, orderBy: { versionNumber: 'desc' } });
    return rows.map(toVersion);
  }

  /** Documents d'un objet, du plus récent au plus ancien (les archivés seulement sur demande, 200 au plus). */
  async listByOwner(ownerType: string, ownerId: string, includeArchived: boolean): Promise<Document[]> {
    const rows = await this.prisma.db.document.findMany({
      where: {
        ownerType, ownerId, deletedAt: null,
        ...(includeArchived ? {} : { status: { in: [DocumentStatus.Draft, DocumentStatus.Active] } }),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map(toDocument);
  }

  /** Version courante de chaque document donné (le numéro courant est lu sur le document lui-même). */
  async currentVersions(documentIds: readonly string[]): Promise<DocumentVersion[]> {
    if (documentIds.length === 0) return [];
    const documents = await this.prisma.db.document.findMany({ where: { id: { in: [...documentIds] } }, select: { id: true, currentVersionNumber: true } });
    const rows = await this.prisma.db.documentVersion.findMany({
      where: { OR: documents.map((d) => ({ documentId: d.id, versionNumber: d.currentVersionNumber })) },
    });
    return rows.map(toVersion);
  }
}
