import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { decideFor } from '../../iam';
import type { AccessContext } from '../../iam';
import { DOCUMENT_OWNER_REGISTRY } from '../../documents';
import type { DocumentOwnerRegistry, DocumentOwnerResolver } from '../../documents';
import { COMPANY_REPOSITORY, CompanyRepository } from '../domain/company-repository';

/** Type d'objet propriétaire déclaré au module Documents pour les entreprises. */
export const COMPANY_OWNER_TYPE = 'company';

/**
 * Résolveur des entreprises pour les documents : une entreprise n'est « résolue » que si elle existe ET que l'appelant
 * peut la lire (même règle de portée que la fiche entreprise). Les documents d'une entreprise ne sont donc jamais plus
 * visibles que l'entreprise elle-même.
 */
@Injectable()
export class CompanyDocumentOwnerResolver implements DocumentOwnerResolver, OnModuleInit {
  constructor(
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
    @Inject(DOCUMENT_OWNER_REGISTRY) private readonly registry: DocumentOwnerRegistry,
  ) {}

  /** Se déclare auprès du registre des documents au démarrage de l'application. */
  onModuleInit(): void {
    this.registry.register(COMPANY_OWNER_TYPE, this);
  }

  /** Propriétaire de l'entreprise si elle existe et est lisible par l'appelant, sinon `null`. */
  async resolve(ownerId: string, access: AccessContext): Promise<{ ownerUserId: string | null } | null> {
    const company = await this.companies.findById(ownerId);
    if (!company || !decideFor(access, 'bd.company.read', company.ownerUserId).allowed) return null;
    return { ownerUserId: company.ownerUserId };
  }
}
