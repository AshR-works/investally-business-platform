import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ActorContext, CLOCK, Clock, DomainError, ID_GENERATOR, IdGenerator, UNIT_OF_WORK, UnitOfWork } from '../../../shared-kernel';
import { AUDIT_RECORDER, AuditAction, AuditRecorder } from '../../audit';
import { decideFor } from '../../iam';
import type { AccessContext } from '../../iam';
import { checkCategory, checkUpload } from '../domain/document-policy';
import { Document, DocumentVersion, ScanStatus } from '../domain/document';
import { DOCUMENT_REPOSITORY, DocumentRepository, OBJECT_STORAGE, ObjectStorage } from '../domain/ports';
import { DocumentDetailView, DocumentView, toDocumentView, toVersionView } from './document-views';
import { DOCUMENT_OWNER_REGISTRY, DocumentOwnerRegistry } from './owner-registry';

/** Empreinte SHA-256 hexadécimale d'un contenu. */
export function sha256Of(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Clé de stockage ALÉATOIRE (jamais le nom fourni) : deux niveaux de dossiers pour éviter un dossier géant. */
export function newStorageKey(): string {
  const id = randomBytes(24).toString('hex');
  return `${id.slice(0, 2)}/${id.slice(2, 4)}/${id}`;
}

/**
 * Contrôle d'accès commun : un document n'est JAMAIS plus accessible que son objet propriétaire. L'objet doit exister
 * et être visible de l'appelant (résolveur du module métier), puis la permission documentaire est évaluée avec la
 * portée appropriée (Propre / Équipe / Tous) sur le propriétaire de CET objet. Tout refus est « introuvable » (404).
 */
@Injectable()
export class DocumentOwnerGate {
  constructor(@Inject(DOCUMENT_OWNER_REGISTRY) private readonly registry: DocumentOwnerRegistry) {}

  /** Vérifie l'accès à l'objet et la permission ; lève « introuvable » sinon, « validation » si le type est inconnu. */
  async require(ownerType: string, ownerId: string, access: AccessContext, permission: string, notFound: string): Promise<void> {
    const resolver = this.registry.resolver(ownerType);
    if (!resolver) throw new DomainError('VALIDATION', 'Type d\'objet non pris en charge');
    const owner = await resolver.resolve(ownerId, access);
    if (!owner || !decideFor(access, permission, owner.ownerUserId).allowed) throw new DomainError('NOT_FOUND', notFound);
  }
}

/** Ce que reçoit un envoi : le fichier est contrôlé et stocké, jamais exécuté. */
export interface UploadCommand {
  ownerType: string;
  ownerId: string;
  title: string;
  category?: string | null;
  fileName: string;
  bytes: Buffer;
  access: AccessContext;
  actor: ActorContext;
}

/**
 * Envoie un NOUVEAU document : contrôle l'objet propriétaire et le droit, contrôle le fichier (taille, format par
 * signature, extension cohérente), calcule l'empreinte SHA-256, écrit le contenu sous une clé aléatoire puis enregistre
 * le document, sa première version et l'audit dans UNE transaction. Si la base échoue, l'objet écrit est retiré.
 */
@Injectable()
export class UploadDocumentUseCase {
  constructor(
    @Inject(DOCUMENT_REPOSITORY) private readonly documents: DocumentRepository,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    private readonly gate: DocumentOwnerGate,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  /** Enregistre le document et renvoie sa vue (version 1). */
  async execute(command: UploadCommand): Promise<DocumentView> {
    await this.gate.require(command.ownerType, command.ownerId, command.access, 'docs.document.create', 'Objet introuvable');
    const category = checkCategory(command.category);
    const file = checkUpload(command.fileName, command.bytes);
    const now = this.clock.now();
    const document = Document.create({
      id: this.ids.next(), ownerType: command.ownerType, ownerId: command.ownerId, title: command.title, category, createdBy: command.access.actorId, now,
    });
    const version: DocumentVersion = {
      id: this.ids.next(), documentId: document.id, versionNumber: 1, storageKey: newStorageKey(), fileName: file.fileName,
      mimeType: file.mimeType, sizeBytes: command.bytes.length, sha256: sha256Of(command.bytes), scanStatus: ScanStatus.Pending,
      uploadedBy: command.access.actorId, createdAt: now,
    };

    await this.storage.put(version.storageKey, command.bytes);
    try {
      await this.unitOfWork.run(async () => {
        await this.documents.createWithVersion(document, version);
        await this.audit.record({
          actor: command.actor, module: 'docs', entityType: 'Document', entityId: document.id, action: AuditAction.Create,
          newValue: {
            ownerType: document.ownerType, ownerId: document.ownerId, title: document.title, category, version: 1,
            fileName: version.fileName, sizeBytes: version.sizeBytes, mimeType: version.mimeType, sha256: version.sha256,
          },
        });
      });
    } catch (error) {
      await this.storage.removeOrphan(version.storageKey);
      throw error;
    }
    return toDocumentView(document, version);
  }
}

/** Ce que reçoit l'ajout d'une version. */
export interface AddVersionCommand {
  documentId: string;
  fileName: string;
  bytes: Buffer;
  access: AccessContext;
  actor: ActorContext;
}

/**
 * Ajoute une VERSION à un document existant : les versions précédentes restent intactes et téléchargeables. Refusé si
 * le document est archivé. Mêmes contrôles de fichier et d'accès qu'un premier envoi.
 */
@Injectable()
export class AddDocumentVersionUseCase {
  constructor(
    @Inject(DOCUMENT_REPOSITORY) private readonly documents: DocumentRepository,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    private readonly gate: DocumentOwnerGate,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  /** Écrit le nouveau contenu puis enregistre la version, l'avancement du document et l'audit. */
  async execute(command: AddVersionCommand): Promise<DocumentView> {
    const document = await this.documents.findById(command.documentId);
    if (!document) throw new DomainError('NOT_FOUND', 'Document introuvable');
    await this.gate.require(document.ownerType, document.ownerId, command.access, 'docs.document.create', 'Document introuvable');
    const file = checkUpload(command.fileName, command.bytes);
    const number = document.nextVersionNumber();
    const version: DocumentVersion = {
      id: this.ids.next(), documentId: document.id, versionNumber: number, storageKey: newStorageKey(), fileName: file.fileName,
      mimeType: file.mimeType, sizeBytes: command.bytes.length, sha256: sha256Of(command.bytes), scanStatus: ScanStatus.Pending,
      uploadedBy: command.access.actorId, createdAt: this.clock.now(),
    };

    await this.storage.put(version.storageKey, command.bytes);
    try {
      await this.unitOfWork.run(async () => {
        document.registerVersion(number);
        await this.documents.addVersion(document, version);
        await this.audit.record({
          actor: command.actor, module: 'docs', entityType: 'Document', entityId: document.id, action: AuditAction.Update,
          newValue: { event: 'version_added', version: number, fileName: version.fileName, sizeBytes: version.sizeBytes, mimeType: version.mimeType, sha256: version.sha256 },
        });
      });
    } catch (error) {
      await this.storage.removeOrphan(version.storageKey);
      throw error;
    }
    return toDocumentView(document, version);
  }
}

/** Liste les documents d'un objet propriétaire que l'appelant peut voir. */
@Injectable()
export class ListDocumentsHandler {
  constructor(
    @Inject(DOCUMENT_REPOSITORY) private readonly documents: DocumentRepository,
    private readonly gate: DocumentOwnerGate,
  ) {}

  /** Documents de l'objet (les archivés seulement sur demande), avec leur version courante. */
  async execute(query: { ownerType: string; ownerId: string; includeArchived: boolean; access: AccessContext }): Promise<DocumentView[]> {
    await this.gate.require(query.ownerType, query.ownerId, query.access, 'docs.document.read', 'Objet introuvable');
    const list = await this.documents.listByOwner(query.ownerType, query.ownerId, query.includeArchived);
    const versions = new Map((await this.documents.currentVersions(list.map((d) => d.id))).map((v) => [v.documentId, v]));
    return list.flatMap((document) => {
      const current = versions.get(document.id);
      return current ? [toDocumentView(document, current)] : [];
    });
  }
}

/** Détail d'un document (versions comprises) ; hors accès, « introuvable ». */
@Injectable()
export class GetDocumentHandler {
  constructor(
    @Inject(DOCUMENT_REPOSITORY) private readonly documents: DocumentRepository,
    private readonly gate: DocumentOwnerGate,
  ) {}

  /** Lit le document et toutes ses versions. */
  async execute(query: { id: string; access: AccessContext }): Promise<DocumentDetailView> {
    const document = await this.documents.findById(query.id);
    if (!document) throw new DomainError('NOT_FOUND', 'Document introuvable');
    await this.gate.require(document.ownerType, document.ownerId, query.access, 'docs.document.read', 'Document introuvable');
    const versions = await this.documents.listVersions(document.id);
    const current = versions.find((v) => v.versionNumber === document.currentVersionNumber);
    if (!current) throw new DomainError('NOT_FOUND', 'Document introuvable');
    return { ...toDocumentView(document, current), versions: [...versions].sort((a, b) => b.versionNumber - a.versionNumber).map(toVersionView) };
  }
}

/** Fichier prêt à être servi : octets vérifiés, nom, type. */
export interface DownloadedFile {
  bytes: Buffer;
  fileName: string;
  mimeType: string;
  versionNumber: number;
  sha256: string;
  scanStatus: string;
}

/**
 * Télécharge une version (la courante par défaut) : contrôle d'accès, lecture du contenu, VÉRIFICATION de l'empreinte
 * SHA-256 avant d'envoyer quoi que ce soit, et audit de chaque téléchargement. Une empreinte qui ne correspond pas
 * (fichier altéré ou perdu) est auditée puis refusée : on ne sert jamais un contenu douteux.
 */
@Injectable()
export class DownloadDocumentUseCase {
  constructor(
    @Inject(DOCUMENT_REPOSITORY) private readonly documents: DocumentRepository,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    private readonly gate: DocumentOwnerGate,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
  ) {}

  /** Lit, vérifie et trace ; renvoie le contenu à servir en pièce jointe. */
  async execute(query: { id: string; versionNumber?: number; access: AccessContext; actor: ActorContext }): Promise<DownloadedFile> {
    const document = await this.documents.findById(query.id);
    if (!document) throw new DomainError('NOT_FOUND', 'Document introuvable');
    await this.gate.require(document.ownerType, document.ownerId, query.access, 'docs.document.download', 'Document introuvable');
    const version = await this.documents.findVersion(document.id, query.versionNumber ?? document.currentVersionNumber);
    if (!version) throw new DomainError('NOT_FOUND', 'Version introuvable');

    const bytes = await this.storage.get(version.storageKey);
    if (sha256Of(bytes) !== version.sha256) {
      await this.audit.record({
        actor: query.actor, module: 'docs', entityType: 'Document', entityId: document.id, action: AuditAction.Download,
        newValue: { event: 'integrity_failed', version: version.versionNumber },
      });
      throw new Error(`Empreinte SHA-256 incorrecte pour le document ${document.id} version ${version.versionNumber}`);
    }
    await this.audit.record({
      actor: query.actor, module: 'docs', entityType: 'Document', entityId: document.id, action: AuditAction.Download,
      newValue: { version: version.versionNumber, sha256: version.sha256, sizeBytes: version.sizeBytes },
    });
    return { bytes, fileName: version.fileName, mimeType: version.mimeType, versionNumber: version.versionNumber, sha256: version.sha256, scanStatus: version.scanStatus };
  }
}

/**
 * Archive un document : suppression LOGIQUE. Le document n'apparaît plus par défaut et n'accepte plus de version, mais
 * ses versions et ses fichiers sont conservés (jamais de suppression définitive). Sans effet s'il l'est déjà.
 */
@Injectable()
export class ArchiveDocumentUseCase {
  constructor(
    @Inject(DOCUMENT_REPOSITORY) private readonly documents: DocumentRepository,
    private readonly gate: DocumentOwnerGate,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  /** Passe le document à « archivé » et trace l'action. */
  async execute(command: { id: string; access: AccessContext; actor: ActorContext }): Promise<void> {
    await this.unitOfWork.run(async () => {
      const document = await this.documents.findById(command.id);
      if (!document) throw new DomainError('NOT_FOUND', 'Document introuvable');
      await this.gate.require(document.ownerType, document.ownerId, command.access, 'docs.document.delete', 'Document introuvable');
      if (document.isArchived) return;
      document.archive();
      await this.documents.save(document);
      await this.audit.record({
        actor: command.actor, module: 'docs', entityType: 'Document', entityId: document.id, action: AuditAction.Delete,
        newValue: { event: 'archived', title: document.title },
      });
    });
  }
}
