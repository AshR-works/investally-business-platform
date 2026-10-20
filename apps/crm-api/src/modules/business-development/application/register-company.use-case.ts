import { Inject, Injectable } from '@nestjs/common';
import {
  ActorContext, CLOCK, Clock, DomainError, ID_GENERATOR, IdGenerator, UNIT_OF_WORK, UnitOfWork,
} from '../../../shared-kernel';
import { AUDIT_RECORDER, AuditAction, AuditRecorder } from '../../audit';
import { Company } from '../domain/company';
import { CompanyName } from '../domain/company-name';
import { COMPANY_REPOSITORY, CompanyRepository } from '../domain/company-repository';
import { CompanyView, toCompanyView } from './company-view';

export interface RegisterCompanyCommand {
  name: string;
  sector?: string | null;
  country?: string | null;
  actor: ActorContext;
}

@Injectable()
export class RegisterCompanyUseCase {
  constructor(
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(command: RegisterCompanyCommand): Promise<CompanyView> {
    const name = CompanyName.of(command.name);

    return this.unitOfWork.run(async () => {
      if (await this.companies.existsByName(name)) {
        throw new DomainError('CONFLICT', `Une entreprise nommée « ${name.value} » existe déjà`);
      }

      const company = Company.register({
        id: this.ids.next(),
        name: name.value,
        sector: command.sector,
        country: command.country,
        now: this.clock.now(),
      });
      await this.companies.save(company);

      const view = toCompanyView(company);
      await this.audit.record({
        actor: command.actor,
        module: 'business-development',
        entityType: 'Company',
        entityId: company.id,
        action: AuditAction.Create,
        newValue: { ...view },
      });
      return view;
    });
  }
}
