import { DomainError } from '../../../shared-kernel';

/** États d'un document (la suppression est LOGIQUE : un document archivé n'est jamais effacé). */
export enum DocumentStatus {
  Draft = 'DRAFT',
  Active = 'ACTIVE',
  Archived = 'ARCHIVED',
  Deleted = 'DELETED',
}

/** Résultat de l'analyse antivirus d'une version (l'analyse est livrée en S7 : « PENDING » d'ici là). */
export enum ScanStatus {
  Pending = 'PENDING',
  Clean = 'CLEAN',
  Infected = 'INFECTED',
}

const MAX_TITLE_LENGTH = 300;

/** Contenu d'un document à un instant : une version immuable (fichier, empreinte SHA-256, auteur). */
export interface DocumentVersion {
  id: string;
  documentId: string;
  versionNumber: number;
  /** Clé aléatoire côté stockage : jamais le nom fourni par l'utilisateur. */
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  scanStatus: ScanStatus;
  uploadedBy: string;
  createdAt: Date;
}

/** Données d'un document reconstitué depuis la base. */
export interface DocumentProps {
  id: string;
  ownerType: string;
  ownerId: string;
  title: string;
  category: string | null;
  status: DocumentStatus;
  currentVersionNumber: number;
  createdBy: string;
  version: number;
  createdAt: Date;
}

/**
 * Un document rattaché à un objet d'un autre contexte (type + identifiant, sans clé étrangère) : titre, catégorie,
 * état et numéro de la version courante. Les versions sont immuables ; on ajoute, on ne modifie pas.
 */
export class Document {
  private constructor(private props: DocumentProps) {}

  /** Nouveau document : actif avec sa première version (numéro 1). */
  static create(input: { id: string; ownerType: string; ownerId: string; title: string; category: string | null; createdBy: string; now: Date }): Document {
    const title = input.title.trim();
    if (title.length === 0 || title.length > MAX_TITLE_LENGTH) {
      throw new DomainError('VALIDATION', `Le titre est obligatoire (${MAX_TITLE_LENGTH} caractères au plus)`);
    }
    return new Document({
      id: input.id, ownerType: input.ownerType, ownerId: input.ownerId, title, category: input.category,
      status: DocumentStatus.Active, currentVersionNumber: 1, createdBy: input.createdBy, version: 1, createdAt: input.now,
    });
  }

  /** Reconstitue un document depuis la persistance (aucune règle rejouée). */
  static rehydrate(props: DocumentProps): Document {
    return new Document({ ...props });
  }

  get id(): string { return this.props.id; }
  get ownerType(): string { return this.props.ownerType; }
  get ownerId(): string { return this.props.ownerId; }
  get title(): string { return this.props.title; }
  get category(): string | null { return this.props.category; }
  get status(): DocumentStatus { return this.props.status; }
  get currentVersionNumber(): number { return this.props.currentVersionNumber; }
  get createdBy(): string { return this.props.createdBy; }
  get version(): number { return this.props.version; }
  get createdAt(): Date { return this.props.createdAt; }

  /** Vrai si le document est archivé (lecture seule : on n'y ajoute plus de version). */
  get isArchived(): boolean {
    return this.props.status === DocumentStatus.Archived;
  }

  /** Numéro de la prochaine version ; refusé si le document est archivé. */
  nextVersionNumber(): number {
    if (this.isArchived) throw new DomainError('CONFLICT', 'Ce document est archivé : on ne peut plus y ajouter de version');
    return this.props.currentVersionNumber + 1;
  }

  /** Enregistre l'ajout d'une version (la courante devient celle-là). */
  registerVersion(versionNumber: number): void {
    if (versionNumber !== this.nextVersionNumber()) throw new DomainError('INVARIANT_VIOLATION', 'Numéro de version inattendu');
    this.props.currentVersionNumber = versionNumber;
  }

  /** Archive le document (suppression logique, sans effet s'il l'est déjà). Les fichiers et versions sont conservés. */
  archive(): void {
    this.props.status = DocumentStatus.Archived;
  }
}
