import { Inject, Injectable } from '@nestjs/common';
import { ActorContext } from '../../../shared-kernel';
import { AUDIT_RECORDER, AuditAction, AuditRecorder } from '../../audit';
import { FOLLOWUP_REPOSITORY, FollowupRepository } from '../domain/followup-repository';
import { Offer } from '../domain/offer';
import { toFollowupView } from './followup-view';

/**
 * Annule les relances encore à faire d'une offre qui n'est plus en cours (acceptée, refusée, retirée) : plus de relance après la
 * réponse du client ou le retrait. Chaque annulation est tracée dans l'audit, dans la transaction de l'appelant.
 */
@Injectable()
export class PlannedFollowupsCloser {
  constructor(
    @Inject(FOLLOWUP_REPOSITORY) private readonly followups: FollowupRepository,
    @Inject(AUDIT_RECORDER) private readonly audit: AuditRecorder,
  ) {}

  /** Annule les relances à faire de l'offre avec le motif donné ; renvoie leur nombre. */
  async cancelPlanned(offer: Offer, companyName: string, reason: string, actor: ActorContext, now: Date): Promise<number> {
    const planned = await this.followups.listPlannedByOffer(offer.id);
    for (const followup of planned) {
      const context = { offerReference: offer.reference, companyId: offer.companyId, companyName };
      const before = toFollowupView(followup, context, now);
      followup.cancel(reason, now);
      await this.followups.save(followup);
      const after = toFollowupView((await this.followups.findById(followup.id)) ?? followup, context, now);
      await this.audit.record({ actor, module: 'business-development', entityType: 'Followup', entityId: followup.id, action: AuditAction.Update, oldValue: { ...before }, newValue: { ...after } });
    }
    return planned.length;
  }
}
