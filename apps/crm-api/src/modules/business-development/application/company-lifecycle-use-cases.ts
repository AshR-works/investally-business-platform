import { Inject, Injectable } from '@nestjs/common';
import { ActorContext, DomainError, UNIT_OF_WORK, UnitOfWork } from '../../../shared-kernel';
import { AUDIT_RECORDER, AuditAction, AuditRecorder } from '../../audit';
import { decideFor, visibilityFor } from '../../iam';
import type { AccessContext } from '../../iam';
import { Company } from '../domain/company';
import { COMPANY_REPOSITORY, CompanyRepository } from '../domain/company-repository';
import { CompanyStatus } from '../domain/company-status';
import { CONTACT_REPOSITORY, ContactRepository } from '../domain/contact-repository';
import { OWNER_DIRECTORY, OwnerDirectory, OwnerSummary } from '../domain/owner-directory';
import { CompanyView, toCompanyView } from './company-view';

export { CompanyStatus };

/** Une entreprise hors de la portée de l'appelant (pour la permission demandée) est « introuvable », comme une inexistante. */
async function loadInScope(companies: CompanyRepository, id: string, access: AccessContext, permission: string): Promise<Company> {
  const company = await companies.findById(id);
  if (!company || !decideFor(access, permission, company.ownerUserId).allowed) {
    throw new DomainError('NOT_FOUND', 'Entreprise introuvable');
  }
  return company;
}

function checkVersion(company: Company, version: number): void {
  if (company.version !== version) {
    throw new DomainError('CONFLICT', "L'entreprise a été modifiée par un autre utilisateur : rechargez la fiche avant de la modifier");
  }
}

async function ownerView(company: Company, owners: OwnerDirectory): Promise<CompanyView> {
  const name = company.ownerUserId ? ((await owners.names([company.ownerUserId])).get(company.ownerUserId) ?? null) : null;
  return toCompanyView(company, undefined, name);
}

export interface ChangeCompanyStatusCommand {
  id: string;
  version: number;
  status: CompanyStatus;
  access: AccessContext;
  actor: ActorContext;
}

/** Cas d'usage : changer le statut d'une entreprise à la main (CU-C-05), d'un cran, avec le droit de modification. */
@Injectable()
export class ChangeCompanyStatusUseCase {
  constructor(
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
    @Inject(CONTACT_REPOSITORY) private readonly contacts: ContactRepository,
    @Inject(OWNER_DIRECTORY) private readonly owners: OwnerDirectory,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: ChangeCompanyStatusCommand): Promise<CompanyView> {
    return this.unitOfWork.run(async () => {
      const company = await loadInScope(this.companies, command.id, command.access, 'bd.company.update');
      checkVersion(company, command.version);
      const before = company.status;
      company.changeStatus(command.status, { contactCount: await this.contacts.countByCompany(company.id) });
      await this.companies.save(company);
      await this.audit.record({
        actor: command.actor,
        module: 'business-development',
        entityType: 'Company',
        entityId: company.id,
        action: AuditAction.Update,
        oldValue: { status: before },
        newValue: { status: company.status },
      });
      return ownerView((await this.companies.findById(company.id)) ?? company, this.owners);
    });
  }
}

export interface ReassignCompanyCommand {
  id: string;
  version: number;
  ownerUserId: string;
  access: AccessContext;
  actor: ActorContext;
}

/**
 * Cas d'usage : confier une entreprise à un autre propriétaire (D17). Droit dédié `bd.company.reassign` ; le nouveau
 * propriétaire doit être un utilisateur actif au rôle commercial, DANS la portée de l'appelant (un Responsable commercial
 * ne confie qu'à son équipe). Ses opportunités, offres et rendez-vous suivent l'entreprise.
 */
@Injectable()
export class ReassignCompanyUseCase {
  constructor(
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
    @Inject(OWNER_DIRECTORY) private readonly owners: OwnerDirectory,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: ReassignCompanyCommand): Promise<CompanyView> {
    return this.unitOfWork.run(async () => {
      const company = await loadInScope(this.companies, command.id, command.access, 'bd.company.reassign');
      checkVersion(company, command.version);
      const eligible = await candidatesFor(this.owners, command.access);
      if (!eligible.some((o) => o.id === command.ownerUserId)) {
        throw new DomainError('VALIDATION', "Ce nouveau responsable n'est pas disponible : choisissez un utilisateur actif de votre périmètre");
      }
      const before = company.ownerUserId;
      company.reassign(command.ownerUserId);
      await this.companies.save(company);
      await this.audit.record({
        actor: command.actor,
        module: 'business-development',
        entityType: 'Company',
        entityId: company.id,
        action: AuditAction.Update,
        oldValue: { ownerUserId: before },
        newValue: { ownerUserId: company.ownerUserId },
      });
      return ownerView((await this.companies.findById(company.id)) ?? company, this.owners);
    });
  }
}

/** Les propriétaires possibles dans la portée de l'appelant (droit de réattribution). */
async function candidatesFor(owners: OwnerDirectory, access: AccessContext): Promise<OwnerSummary[]> {
  const visibility = visibilityFor(access, 'bd.company.reassign');
  return owners.candidates(visibility.unrestricted ? undefined : visibility.ownerIds);
}

/** Requête de lecture : à qui l'appelant peut-il confier une entreprise (liste du choix de la fenêtre de réattribution). */
@Injectable()
export class ListOwnerCandidatesHandler {
  constructor(@Inject(OWNER_DIRECTORY) private readonly owners: OwnerDirectory) {}

  execute(query: { access: AccessContext }): Promise<OwnerSummary[]> {
    return candidatesFor(this.owners, query.access);
  }
}
