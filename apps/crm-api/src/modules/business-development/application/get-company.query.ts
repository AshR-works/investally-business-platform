import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../shared-kernel';
import { decideFor } from '../../iam';
import type { AccessContext } from '../../iam';
import { COMPANY_REPOSITORY, CompanyRepository } from '../domain/company-repository';
import { FACILITATOR_REPOSITORY, FacilitatorRepository } from '../domain/facilitator-repository';
import { CompanyView, toCompanyView } from './company-view';
import { toFacilitatorView } from './facilitator-view';

/**
 * Lecture d'une entreprise par identifiant. Hors portée → « introuvable » (404) et NON « interdit » (403) :
 * on ne révèle pas qu'une entreprise existe chez un collègue (prévention d'IDOR, OWASP A01).
 * Une entreprise sans propriétaire (antérieure à S3.3) n'est visible que de la portée « Tous ».
 * Le facilitateur n'est détaillé que si l'appelant peut le voir, et la commission que s'il détient la permission
 * « Commissions » sur cette entreprise.
 */
@Injectable()
export class GetCompanyHandler {
  constructor(
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
    @Inject(FACILITATOR_REPOSITORY) private readonly facilitators: FacilitatorRepository,
  ) {}

  /**
   * Lit une entreprise. Hors de la portée de l'appelant, elle est « introuvable » (404) : on ne révèle pas son
   * existence.
   */
  async execute(query: { id: string; access: AccessContext }): Promise<CompanyView> {
    const company = await this.companies.findById(query.id);
    if (!company || !decideFor(query.access, 'bd.company.read', company.ownerUserId).allowed) {
      throw new DomainError('NOT_FOUND', 'Entreprise introuvable');
    }
    const link = company.facilitation;
    const facilitator = link ? await this.facilitators.findById(link.facilitatorId) : null;
    const canSeeFacilitator = facilitator !== null && decideFor(query.access, 'bd.facilitator.read', facilitator.ownerUserId).allowed;
    return toCompanyView(company, {
      facilitator: canSeeFacilitator ? toFacilitatorView(facilitator) : null,
      canReadCommission: decideFor(query.access, 'bd.commission.read', company.ownerUserId).allowed,
    });
  }
}
