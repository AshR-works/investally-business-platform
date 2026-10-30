import { Inject, Injectable } from '@nestjs/common';
import {
  ActorContext, CLOCK, Clock, DomainError, ID_GENERATOR, IdGenerator, UNIT_OF_WORK, UnitOfWork,
} from '../../../shared-kernel';
import { AUDIT_RECORDER, AuditAction, AuditRecorder } from '../../audit';
import { decideFor } from '../../iam';
import type { AccessContext } from '../../iam';
import { Company } from '../domain/company';
import { CompanyName } from '../domain/company-name';
import { COMPANY_REPOSITORY, CompanyRepository } from '../domain/company-repository';
import { CompanyView, toCompanyView } from './company-view';
import { FacilitationInput, FacilitationResolver } from './facilitation-resolver';

/**
 * Données d'enregistrement d'une entreprise cible ; le propriétaire vient de l'identité de l'appelant, jamais du
 * corps de la requête.
 */
export interface RegisterCompanyCommand {
  name: string;
  /** Propriétaire de l'entreprise (l'utilisateur qui la crée) : détermine la portée des droits. */
  ownerUserId: string;
  sector?: string | null;
  country?: string | null;
  email?: string | null;
  phone?: string | null;
  facilitation?: FacilitationInput;
  /** Droits de l'appelant : requis dès qu'un facilitateur ou une commission est fourni. */
  access?: AccessContext;
  actor: ActorContext;
}

/** Cas d'usage : enregistrer une entreprise cible, refuser un doublon de nom, tracer l'opération. */
@Injectable()
export class RegisterCompanyUseCase {
  constructor(
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
    private readonly facilitations: FacilitationResolver,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  /**
   * Crée l'entreprise, son éventuel facilitateur et leur audit dans une même transaction ; un nom déjà pris (sans
   * tenir compte de la casse ni des espaces) est un conflit.
   */
  async execute(command: RegisterCompanyCommand): Promise<CompanyView> {
    const name = CompanyName.of(command.name);

    return this.unitOfWork.run(async () => {
      if (await this.companies.existsByName(name)) {
        throw new DomainError('CONFLICT', `Une entreprise nommée « ${name.value} » existe déjà`);
      }

      let facilitation = null;
      if (command.facilitation) {
        if (!command.access) throw new DomainError('FORBIDDEN', "Droits de l'appelant manquants");
        facilitation = await this.facilitations.resolve(
          { access: command.access, actor: command.actor, companyOwnerId: command.ownerUserId, existing: null },
          command.facilitation,
        );
      }
      const company = Company.register({
        id: this.ids.next(),
        name: name.value,
        ownerUserId: command.ownerUserId,
        sector: command.sector,
        country: command.country,
        email: command.email,
        phone: command.phone,
        facilitation: facilitation?.link ?? null,
        now: this.clock.now(),
      });
      await this.companies.save(company);

      // L'audit garde tout, commission comprise : il n'est lisible que par les détenteurs de audit.log.read.
      const view = toCompanyView(company, { facilitator: facilitation?.facilitator ?? null, canReadCommission: true });
      await this.audit.record({
        actor: command.actor,
        module: 'business-development',
        entityType: 'Company',
        entityId: company.id,
        action: AuditAction.Create,
        newValue: { ...view },
      });
      // Réponse à l'appelant : la commission n'y figure que s'il y a droit.
      const canReadCommission = command.access ? decideFor(command.access, 'bd.commission.read', command.ownerUserId).allowed : false;
      return toCompanyView(company, { facilitator: facilitation?.facilitator ?? null, canReadCommission });
    });
  }
}
