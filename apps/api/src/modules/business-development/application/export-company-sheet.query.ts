import { Inject, Injectable } from '@nestjs/common';
import { ActorContext, CLOCK, Clock, DomainError } from '../../../shared-kernel';
import { AUDIT_RECORDER, AuditAction, AuditRecorder } from '../../audit';
import { decideFor } from '../../iam';
import type { AccessContext } from '../../iam';
import { COMPANY_REPOSITORY, CompanyRepository } from '../domain/company-repository';
import { FACILITATOR_REPOSITORY, FacilitatorRepository } from '../domain/facilitator-repository';
import { renderCompanySheet, sheetReference } from './company-sheet';
import { toCompanyView } from './company-view';
import { toFacilitatorView } from './facilitator-view';

/**
 * Export de la fiche d'une entreprise. Règle de la direction produit : qui peut VOIR l'entreprise (selon sa portée) peut
 * exporter sa fiche, et chaque export est tracé dans l'audit (qui, quelle session, d'où, quand). Hors de la portée, la
 * fiche est « introuvable » (404 : prévention d'IDOR). Le document ne contient que ce que l'appelant a le droit de voir.
 * L'export n'est livré qu'une fois sa trace enregistrée : si l'audit échoue, rien n'est remis.
 */
@Injectable()
export class ExportCompanySheetHandler {
  constructor(
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
    @Inject(FACILITATOR_REPOSITORY) private readonly facilitators: FacilitatorRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(query: { id: string; access: AccessContext; actor: ActorContext }): Promise<{ html: string; fileName: string }> {
    const company = await this.companies.findById(query.id);
    if (!company || !decideFor(query.access, 'bd.company.read', company.ownerUserId).allowed) {
      throw new DomainError('NOT_FOUND', 'Entreprise introuvable');
    }
    const link = company.facilitation;
    const facilitator = link ? await this.facilitators.findById(link.facilitatorId) : null;
    const canSeeFacilitator = facilitator !== null && decideFor(query.access, 'bd.facilitator.read', facilitator.ownerUserId).allowed;
    const canReadCommission = decideFor(query.access, 'bd.commission.read', company.ownerUserId).allowed;
    const view = toCompanyView(company, { facilitator: canSeeFacilitator ? toFacilitatorView(facilitator) : null, canReadCommission });

    await this.audit.record({
      actor: query.actor,
      module: 'business-development',
      entityType: 'Company',
      entityId: company.id,
      action: AuditAction.Export,
      // On trace ce qui a été remis, jamais les données elles-mêmes.
      newValue: { document: 'fiche-entreprise', reference: sheetReference(view), includesFacilitator: canSeeFacilitator, includesCommission: canReadCommission && link !== null },
    });
    return { html: renderCompanySheet(view, this.clock.now()), fileName: `${sheetReference(view)}.html` };
  }
}
