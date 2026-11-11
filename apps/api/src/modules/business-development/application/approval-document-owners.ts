import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { decideFor } from '../../iam';
import type { AccessContext } from '../../iam';
import { DOCUMENT_OWNER_REGISTRY } from '../../documents';
import type { DocumentOwnerRegistry, DocumentOwnerResolver } from '../../documents';
import { APPROVAL_REPOSITORY, ApprovalRepository } from '../domain/approval-repository';
import { COMPANY_REPOSITORY, CompanyRepository } from '../domain/company-repository';

/** Type d'objet propriétaire déclaré au module Documents pour les agréments (le document signé). */
export const APPROVAL_OWNER_TYPE = 'approval';

/**
 * Résolveur des agréments pour les documents : un agrément n'est « résolu » que s'il existe ET si l'appelant peut le lire. Ses
 * documents ne sont donc jamais plus visibles que l'agrément, donc que son entreprise.
 */
@Injectable()
export class ApprovalDocumentOwnerResolver implements DocumentOwnerResolver, OnModuleInit {
  constructor(
    @Inject(APPROVAL_REPOSITORY) private readonly approvals: ApprovalRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
    @Inject(DOCUMENT_OWNER_REGISTRY) private readonly registry: DocumentOwnerRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(APPROVAL_OWNER_TYPE, this);
  }

  async resolve(ownerId: string, access: AccessContext): Promise<{ ownerUserId: string | null } | null> {
    const approval = await this.approvals.findById(ownerId);
    const company = approval ? await this.companies.findById(approval.companyId) : null;
    if (!approval || !company || !decideFor(access, 'bd.approval.read', company.ownerUserId).allowed) return null;
    return { ownerUserId: company.ownerUserId };
  }
}
