import { Injectable } from '@nestjs/common';
import type { AccessContext } from '../../iam';

/**
 * Résout l'objet propriétaire d'un document (entreprise, offre, opportunité…) : renvoie le propriétaire de CET objet
 * s'il existe ET si l'appelant peut le voir, sinon `null` (introuvable : on ne révèle pas son existence). Chaque module
 * métier fournit le sien ; un type sans résolveur est refusé (refus par défaut).
 */
export interface DocumentOwnerResolver {
  resolve(ownerId: string, access: AccessContext): Promise<{ ownerUserId: string | null } | null>;
}

/** Registre où chaque module métier déclare le résolveur de ses objets (`register('company', …)`). */
export interface DocumentOwnerRegistry {
  register(ownerType: string, resolver: DocumentOwnerResolver): void;
  resolver(ownerType: string): DocumentOwnerResolver | null;
  types(): string[];
}
export const DOCUMENT_OWNER_REGISTRY = Symbol('DocumentOwnerRegistry');

/** Registre en mémoire : un seul résolveur par type d'objet (un doublon est une erreur de composition). */
@Injectable()
export class InMemoryDocumentOwnerRegistry implements DocumentOwnerRegistry {
  private readonly resolvers = new Map<string, DocumentOwnerResolver>();

  /** Déclare le résolveur d'un type d'objet propriétaire ; refuse un doublon. */
  register(ownerType: string, resolver: DocumentOwnerResolver): void {
    if (this.resolvers.has(ownerType)) throw new Error(`Résolveur de propriétaire déjà déclaré pour « ${ownerType} »`);
    this.resolvers.set(ownerType, resolver);
  }

  /** Résolveur d'un type, ou `null` si le type n'est pas déclaré (refus par défaut). */
  resolver(ownerType: string): DocumentOwnerResolver | null {
    return this.resolvers.get(ownerType) ?? null;
  }

  /** Types d'objets propriétaires déclarés. */
  types(): string[] {
    return [...this.resolvers.keys()];
  }
}
