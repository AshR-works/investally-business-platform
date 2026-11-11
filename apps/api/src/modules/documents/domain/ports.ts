import { Document, DocumentVersion } from './document';

/** Port de persistance des documents et de leurs versions (aucune méthode ne supprime une version). */
export interface DocumentRepository {
  /** Crée un document et sa première version (même transaction). */
  createWithVersion(document: Document, version: DocumentVersion): Promise<void>;
  /** Ajoute une version et met à jour la version courante (verrou optimiste sur le document). */
  addVersion(document: Document, version: DocumentVersion): Promise<void>;
  /** Enregistre l'état du document (archivage) avec verrou optimiste. */
  save(document: Document): Promise<void>;
  findById(id: string): Promise<Document | null>;
  findVersion(documentId: string, versionNumber: number): Promise<DocumentVersion | null>;
  listVersions(documentId: string): Promise<DocumentVersion[]>;
  /** Documents d'un objet propriétaire, du plus récent au plus ancien ; les archivés seulement sur demande. */
  listByOwner(ownerType: string, ownerId: string, includeArchived: boolean): Promise<Document[]>;
  /** Dernière version de chaque document donné (pour l'affichage de la liste). */
  currentVersions(documentIds: readonly string[]): Promise<DocumentVersion[]>;
}
export const DOCUMENT_REPOSITORY = Symbol('DocumentRepository');

/**
 * Port de stockage des contenus : clé aléatoire → octets. Aucune méthode de suppression publique : un fichier ne
 * disparaît jamais (seul `removeOrphan` retire celui qu'on vient d'écrire quand l'enregistrement en base échoue).
 */
export interface ObjectStorage {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  /** Retire un objet qu'on vient d'écrire et qu'aucune ligne en base ne référence (annulation d'un envoi). */
  removeOrphan(key: string): Promise<void>;
}
export const OBJECT_STORAGE = Symbol('ObjectStorage');
