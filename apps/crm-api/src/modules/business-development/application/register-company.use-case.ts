import { Inject, Injectable } from '@nestjs/common';
import {
  ActorContext, CLOCK, Clock, DomainError, ID_GENERATOR, IdGenerator, UNIT_OF_WORK, UnitOfWork,
} from '../../../shared-kernel';
import { AUDIT_RECORDER, AuditAction, AuditRecorder } from '../../audit';
import { decideFor } from '../../iam';
import type { AccessContext } from '../../iam';
import { Commission } from '../domain/commission';
import { Company } from '../domain/company';
import { CompanyName } from '../domain/company-name';
import { COMPANY_REPOSITORY, CompanyRepository } from '../domain/company-repository';
import { Facilitation } from '../domain/facilitation';
import { FACILITATOR_REPOSITORY, FacilitatorRepository } from '../domain/facilitator-repository';
import { CompanyView, toCompanyView } from './company-view';
import { toFacilitatorView } from './facilitator-view';
import { RegisterFacilitatorUseCase } from './register-facilitator.use-case';

/** Facilitateur à lier : un facilitateur existant (par identifiant) OU un nouveau, jamais les deux. */
export interface FacilitationInput {
  facilitatorId?: string;
  newFacilitator?: { lastName: string; firstName: string; phone: string; comment?: string | null };
  contactMethod: string;
  isCompanyEmployee?: boolean;
  commission?: { type: string; value: string | number; currency?: string | null };
}

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
    @Inject(FACILITATOR_REPOSITORY) private readonly facilitators: FacilitatorRepository,
    private readonly registerFacilitator: RegisterFacilitatorUseCase,
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

      const facilitation = command.facilitation ? await this.resolveFacilitation(command, command.facilitation) : null;
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

  /** Vérifie les droits de l'appelant, retrouve ou crée le facilitateur, construit le lien. */
  private async resolveFacilitation(command: RegisterCompanyCommand, input: FacilitationInput) {
    const access = command.access;
    if (!access) throw new DomainError('FORBIDDEN', "Droits de l'appelant manquants");
    if (Boolean(input.facilitatorId) === Boolean(input.newFacilitator)) {
      throw new DomainError('VALIDATION', 'Indiquez soit un facilitateur existant, soit un nouveau facilitateur');
    }
    Facilitation.assertMethod(input.contactMethod); // avant toute écriture : pas de facilitateur créé pour rien
    if (input.commission && !decideFor(access, 'bd.commission.manage', command.ownerUserId).allowed) {
      throw new DomainError('FORBIDDEN', "Vous n'avez pas le droit de définir une commission");
    }
    const commission = input.commission ? Commission.of(input.commission) : null;

    let facilitatorId: string;
    let facilitator;
    if (input.facilitatorId) {
      const existing = await this.facilitators.findById(input.facilitatorId);
      // Hors portée = introuvable (même réponse que pour un identifiant inexistant : prévention d'IDOR).
      if (!existing || !decideFor(access, 'bd.facilitator.read', existing.ownerUserId).allowed) {
        throw new DomainError('NOT_FOUND', 'Facilitateur introuvable');
      }
      facilitatorId = existing.id;
      facilitator = toFacilitatorView(existing);
    } else {
      if (!decideFor(access, 'bd.facilitator.create', command.ownerUserId).allowed) {
        throw new DomainError('FORBIDDEN', "Vous n'avez pas le droit de créer un facilitateur");
      }
      facilitator = await this.registerFacilitator.executeInTransaction({
        ...input.newFacilitator!,
        ownerUserId: command.ownerUserId,
        actor: command.actor,
      });
      facilitatorId = facilitator.id;
    }
    const link = Facilitation.of({
      facilitatorId,
      contactMethod: input.contactMethod,
      isCompanyEmployee: input.isCompanyEmployee,
      commission,
    });
    return { link, facilitator };
  }
}
