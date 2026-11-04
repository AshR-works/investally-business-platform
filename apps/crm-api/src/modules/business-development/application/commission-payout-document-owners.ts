import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { decideFor } from '../../iam';
import type { AccessContext } from '../../iam';
import { DOCUMENT_OWNER_REGISTRY } from '../../documents';
import type { DocumentOwnerRegistry, DocumentOwnerResolver } from '../../documents';
import { COMMISSION_PAYOUT_REPOSITORY, CommissionPayoutRepository } from '../domain/commission-payout-repository';
import { COMPANY_REPOSITORY, CompanyRepository } from '../domain/company-repository';
import { PAYOUT_OWNER_TYPE } from './commission-payout-use-cases';

/**
 * Résolveur des versements de commission pour les documents (le justificatif : reçu de virement ou ordre de versement) : un versement n'est
 * « résolu » que s'il existe ET si l'appelant peut le lire. Ses documents ne sont donc jamais plus visibles que le versement.
 */
@Injectable()
export class PayoutDocumentOwnerResolver implements DocumentOwnerResolver, OnModuleInit {
  constructor(
    @Inject(COMMISSION_PAYOUT_REPOSITORY) private readonly payouts: CommissionPayoutRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
    @Inject(DOCUMENT_OWNER_REGISTRY) private readonly registry: DocumentOwnerRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(PAYOUT_OWNER_TYPE, this);
  }

  async resolve(ownerId: string, access: AccessContext): Promise<{ ownerUserId: string | null } | null> {
    const payout = await this.payouts.findById(ownerId);
    const company = payout ? await this.companies.findById(payout.companyId) : null;
    if (!payout || !company || !decideFor(access, 'bd.commission.read', company.ownerUserId).allowed) return null;
    return { ownerUserId: company.ownerUserId };
  }
}
