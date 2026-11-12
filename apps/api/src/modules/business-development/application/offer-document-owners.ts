import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { decideFor } from '../../iam';
import type { AccessContext } from '../../iam';
import { DOCUMENT_OWNER_REGISTRY } from '../../documents';
import type { DocumentOwnerRegistry, DocumentOwnerResolver } from '../../documents';
import { COMPANY_REPOSITORY, CompanyRepository } from '../domain/company-repository';
import { OFFER_REPOSITORY, OfferRepository } from '../domain/offer-repository';
import { RECEIPT_REPOSITORY, ReceiptRepository } from '../domain/receipt-repository';

/** Types d'objets propriétaires déclarés au module Documents pour les offres et leurs décharges. */
export const OFFER_OWNER_TYPE = 'offer';
export const RECEIPT_OWNER_TYPE = 'receipt';

/**
 * Résolveur des offres pour les documents (le fichier de l'offre envoyé au client) : une offre n'est « résolue » que si elle existe
 * ET si l'appelant peut la lire. Ses documents ne sont donc jamais plus visibles que l'offre, donc que son entreprise.
 */
@Injectable()
export class OfferDocumentOwnerResolver implements DocumentOwnerResolver, OnModuleInit {
  constructor(
    @Inject(OFFER_REPOSITORY) private readonly offers: OfferRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
    @Inject(DOCUMENT_OWNER_REGISTRY) private readonly registry: DocumentOwnerRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(OFFER_OWNER_TYPE, this);
  }

  async resolve(ownerId: string, access: AccessContext): Promise<{ ownerUserId: string | null } | null> {
    const offer = await this.offers.findById(ownerId);
    const company = offer ? await this.companies.findById(offer.companyId) : null;
    if (!offer || !company || !decideFor(access, 'bd.offer.read', company.ownerUserId).allowed) return null;
    return { ownerUserId: company.ownerUserId };
  }
}

/** Résolveur des décharges pour les documents (la décharge signée) : même règle, par le droit de lire les décharges. */
@Injectable()
export class ReceiptDocumentOwnerResolver implements DocumentOwnerResolver, OnModuleInit {
  constructor(
    @Inject(RECEIPT_REPOSITORY) private readonly receipts: ReceiptRepository,
    @Inject(OFFER_REPOSITORY) private readonly offers: OfferRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
    @Inject(DOCUMENT_OWNER_REGISTRY) private readonly registry: DocumentOwnerRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(RECEIPT_OWNER_TYPE, this);
  }

  async resolve(ownerId: string, access: AccessContext): Promise<{ ownerUserId: string | null } | null> {
    const receipt = await this.receipts.findById(ownerId);
    const offer = receipt ? await this.offers.findById(receipt.offerId) : null;
    const company = offer ? await this.companies.findById(offer.companyId) : null;
    if (!receipt || !offer || !company || !decideFor(access, 'bd.receipt.read', company.ownerUserId).allowed) return null;
    return { ownerUserId: company.ownerUserId };
  }
}
