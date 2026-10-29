import { Inject, Injectable } from '@nestjs/common';
import { ActorContext, CLOCK, Clock, ID_GENERATOR, IdGenerator, UNIT_OF_WORK, UnitOfWork } from '../../../shared-kernel';
import { AUDIT_RECORDER, AuditAction, AuditRecorder } from '../../audit';
import { Facilitator } from '../domain/facilitator';
import { FACILITATOR_REPOSITORY, FacilitatorRepository } from '../domain/facilitator-repository';
import { FacilitatorView, toFacilitatorView } from './facilitator-view';

export interface RegisterFacilitatorCommand {
  lastName: string;
  firstName: string;
  phone: string;
  comment?: string | null;
  /** Créateur du facilitateur (identité de l'appelant, jamais le corps de la requête). */
  ownerUserId: string;
  actor: ActorContext;
}

/** Cas d'usage : enregistrer un facilitateur réutilisable et tracer l'opération. */
@Injectable()
export class RegisterFacilitatorUseCase {
  constructor(
    @Inject(FACILITATOR_REPOSITORY) private readonly facilitators: FacilitatorRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(command: RegisterFacilitatorCommand): Promise<FacilitatorView> {
    return this.unitOfWork.run(() => this.executeInTransaction(command));
  }

  /** Corps du cas d'usage, appelable depuis une transaction déjà ouverte (création d'entreprise avec facilitateur). */
  async executeInTransaction(command: RegisterFacilitatorCommand): Promise<FacilitatorView> {
    const facilitator = Facilitator.register({ ...command, id: this.ids.next(), now: this.clock.now() });
    await this.facilitators.save(facilitator);
    const view = toFacilitatorView(facilitator);
    await this.audit.record({
      actor: command.actor,
      module: 'business-development',
      entityType: 'Facilitator',
      entityId: facilitator.id,
      action: AuditAction.Create,
      newValue: { ...view },
    });
    return view;
  }
}
