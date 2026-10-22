import { Document, DocumentVersion } from '../domain/document';

/** Une version telle que l'utilisateur la voit (jamais la clé de stockage ni l'identifiant de l'auteur). */
export interface VersionView {
  number: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  /** `PENDING` tant que l'analyse antivirus n'existe pas (S7) : le fichier n'a pas été analysé. */
  scanStatus: string;
  uploadedAt: string;
}

/** Un document avec sa version courante (liste et détail). */
export interface DocumentView {
  id: string;
  ownerType: string;
  ownerId: string;
  title: string;
  category: string | null;
  status: string;
  createdAt: string;
  current: VersionView;
}

/** Détail d'un document : le document et TOUTES ses versions, de la plus récente à la plus ancienne. */
export interface DocumentDetailView extends DocumentView {
  versions: VersionView[];
}

/** Version du domaine → version affichable. */
export function toVersionView(version: DocumentVersion): VersionView {
  return {
    number: version.versionNumber,
    fileName: version.fileName,
    mimeType: version.mimeType,
    sizeBytes: version.sizeBytes,
    sha256: version.sha256,
    scanStatus: version.scanStatus,
    uploadedAt: version.createdAt.toISOString(),
  };
}

/** Document et version courante → vue publique (aucun objet interne n'est exposé). */
export function toDocumentView(document: Document, current: DocumentVersion): DocumentView {
  return {
    id: document.id,
    ownerType: document.ownerType,
    ownerId: document.ownerId,
    title: document.title,
    category: document.category,
    status: document.status,
    createdAt: document.createdAt.toISOString(),
    current: toVersionView(current),
  };
}
