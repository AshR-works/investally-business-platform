import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../shared-kernel';
import { decideFor } from '../../iam';
import type { AccessContext } from '../../iam';
import { COMPANY_REPOSITORY, CompanyRepository } from '../domain/company-repository';
import { CompanyView, toCompanyView } from './company-view';

/**
 * Lecture d'une entreprise par identifiant. Hors portée → « introuvable » (404) et NON « interdit » (403) :
 * on ne révèle pas qu'une entreprise existe chez un collègue (prévention d'IDOR, OWASP A01).
 * Une entreprise sans propriétaire (antérieure à S3.3) n'est visible que de la portée « Tous ».
 */
@Injectable()
export class GetCompanyHandler {
  constructor(@Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository) {}

  async execute(query: { id: string; access: AccessContext }): Promise<CompanyView> {
    const company = await this.companies.findById(query.id);
    if (!company || !decideFor(query.access, 'bd.company.read', company.ownerUserId).allowed) {
      throw new DomainError('NOT_FOUND', 'Entreprise introuvable');
    }
    return toCompanyView(company);
  }
}
