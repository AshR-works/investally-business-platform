import { Inject, Injectable } from '@nestjs/common';
import { ActorContext, CLOCK, Clock } from '../../../shared-kernel';
import { AUDIT_RECORDER, AuditAction, AuditRecorder } from '../../audit';
import type { AccessContext } from '../../iam';
import { COMPANY_REPOSITORY, CompanyRepository } from '../domain/company-repository';
import { OFFER_REPOSITORY, OfferRepository } from '../domain/offer-repository';
import { offerInScope } from './offer-use-cases';
import { renderOfferSheet } from './offer-sheet';
import { toOfferView } from './offer-view';

/**
 * Export imprimable d'une offre. Même règle que la fiche d'entreprise : qui peut VOIR l'offre (la visibilité suit celle de son entreprise)
 * peut l'exporter, hors portée elle est « introuvable » (prévention d'IDOR), et chaque export est tracé dans l'audit avant d'être remis.
 */
@Injectable()
export class ExportOfferSheetHandler {
  constructor(
    @Inject(OFFER_REPOSITORY) private readonly offers: OfferRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(query: { id: string; access: AccessContext; actor: ActorContext }): Promise<{ html: string; fileName: string }> {
    const { offer, company } = await offerInScope(this.offers, this.companies, query.id, query.access, 'bd.offer.read');
    const view = toOfferView(offer, company.name.value);
    await this.audit.record({
      actor: query.actor,
      module: 'business-development',
      entityType: 'Offer',
      entityId: offer.id,
      action: AuditAction.Export,
      // On trace ce qui a été remis (référence et état), jamais le contenu de l'offre.
      newValue: { document: 'offre', reference: offer.reference, status: offer.status },
    });
    return { html: renderOfferSheet(view, this.clock.now()), fileName: `${offer.reference}.html` };
  }
}
