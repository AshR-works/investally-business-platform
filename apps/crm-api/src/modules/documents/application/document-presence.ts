import { Inject, Injectable } from '@nestjs/common';
import { DOCUMENT_REPOSITORY, DocumentRepository } from '../domain/ports';

/**
 * Question posée par un module métier au module Documents : l'objet a-t-il au moins un document (non archivé) de cette catégorie ?
 * Sert, par exemple, à refuser le constat d'un versement de commission sans justificatif.
 */
export interface DocumentPresence {
  has(ownerType: string, ownerId: string, category: string): Promise<boolean>;
}
export const DOCUMENT_PRESENCE = Symbol('DocumentPresence');

@Injectable()
export class RepositoryDocumentPresence implements DocumentPresence {
  constructor(@Inject(DOCUMENT_REPOSITORY) private readonly documents: DocumentRepository) {}

  async has(ownerType: string, ownerId: string, category: string): Promise<boolean> {
    const found = await this.documents.listByOwner(ownerType, ownerId, false);
    return found.some((d) => d.category === category);
  }
}
