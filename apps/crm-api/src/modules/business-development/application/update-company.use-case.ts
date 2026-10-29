import { Inject, Injectable } from '@nestjs/common';
import { ActorContext, DomainError, UNIT_OF_WORK, UnitOfWork } from '../../../shared-kernel';
import { AUDIT_RECORDER, AuditAction, AuditRecorder } from '../../audit';
import { decideFor } from '../../iam';
import type { AccessContext } from '../../iam';
import { CompanyName } from '../domain/company-name';
import { COMPANY_REPOSITORY, CompanyRepository } from '../domain/company-repository';
import { FACILITATOR_REPOSITORY, FacilitatorRepository } from '../domain/facilitator-repository';
import { CompanyView, toCompanyView } from './company-view';
import { FacilitationInput, FacilitationResolver } from './facilitation-resolver';
import { toFacilitatorView } from './facilitator-view';

/**
 * Modification d'une fiche d'entreprise. Un champ absent reste inchangé ; `facilitation` : absente = inchangée, `null` =
 * lien retiré. `version` est celle que l'appelant a lue : si l'entreprise a changé entre-temps, c'est un conflit.
 */
export interface UpdateCompanyCommand {
  id: string;
  version: number;
  name?: string;
  sector?: string | null;
  country?: string | null;
  email?: string | null;
  phone?: string | null;
  facilitation?: FacilitationInput | null;
  access: AccessContext;
  actor: ActorContext;
}

/**
 * Cas d'usage : modifier une entreprise. Hors de la portée de l'appelant (droit de modification), elle est « introuvable »
 * (404, même réponse qu'un identifiant inexistant : prévention d'IDOR). Modification et audit (ancienne et nouvelle valeur,
 * commission comprise) dans une même transaction.
 */
@Injectable()
export class UpdateCompanyUseCase {
  constructor(
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
    @Inject(FACILITATOR_REPOSITORY) private readonly facilitators: FacilitatorRepository,
    private readonly facilitations: FacilitationResolver,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: UpdateCompanyCommand): Promise<CompanyView> {
    return this.unitOfWork.run(async () => {
      const company = await this.companies.findById(command.id);
      if (!company || !decideFor(command.access, 'bd.company.update', company.ownerUserId).allowed) {
        throw new DomainError('NOT_FOUND', 'Entreprise introuvable');
      }
      if (company.version !== command.version) {
        throw new DomainError('CONFLICT', "L'entreprise a été modifiée par un autre utilisateur : rechargez la fiche avant de la modifier");
      }
      const before = await this.fullView(company);

      if (command.name !== undefined) {
        const name = CompanyName.of(command.name);
        if (name.normalized !== company.name.normalized && (await this.companies.existsByName(name))) {
          throw new DomainError('CONFLICT', `Une entreprise nommée « ${name.value} » existe déjà`);
        }
      }

      let facilitation;
      let facilitator = null;
      if (command.facilitation === null) {
        // Retirer le lien supprime aussi la commission : même droit que pour la définir.
        if (company.facilitation?.commission && !decideFor(command.access, 'bd.commission.manage', company.ownerUserId).allowed) {
          throw new DomainError('FORBIDDEN', "Vous n'avez pas le droit de retirer une commission");
        }
        facilitation = null;
      } else if (command.facilitation !== undefined) {
        const resolved = await this.facilitations.resolve(
          { access: command.access, actor: command.actor, companyOwnerId: company.ownerUserId ?? command.access.actorId, existing: company.facilitation },
          command.facilitation,
        );
        facilitation = resolved.link;
        facilitator = resolved.facilitator;
      }

      company.update({ name: command.name, sector: command.sector, country: command.country, email: command.email, phone: command.phone, facilitation });
      await this.companies.save(company);

      const after = await this.fullView(company, facilitator);
      await this.audit.record({
        actor: command.actor,
        module: 'business-development',
        entityType: 'Company',
        entityId: company.id,
        action: AuditAction.Update,
        oldValue: { ...before },
        newValue: { ...after },
      });
      // Réponse à l'appelant : facilitateur et commission seulement s'il y a droit.
      const refreshed = (await this.companies.findById(company.id)) ?? company;
      const link = refreshed.facilitation;
      const visible = link ? await this.facilitators.findById(link.facilitatorId) : null;
      return toCompanyView(refreshed, {
        facilitator: visible && decideFor(command.access, 'bd.facilitator.read', visible.ownerUserId).allowed ? toFacilitatorView(visible) : null,
        canReadCommission: decideFor(command.access, 'bd.commission.read', refreshed.ownerUserId).allowed,
      });
    });
  }

  /** Vue complète (commission comprise) pour l'audit : lisible des seuls détenteurs de `audit.log.read`. */
  private async fullView(company: Parameters<typeof toCompanyView>[0], known: ReturnType<typeof toFacilitatorView> | null = null): Promise<CompanyView> {
    const link = company.facilitation;
    const facilitator = known ?? (link ? await this.facilitators.findById(link.facilitatorId).then((f) => (f ? toFacilitatorView(f) : null)) : null);
    return toCompanyView(company, { facilitator, canReadCommission: true });
  }
}
