import { Injectable } from '@nestjs/common';
import { ActorContext, DomainError } from '../../../shared-kernel';
import { decideFor } from '../../iam';
import type { AccessContext } from '../../iam';
import { Commission } from '../domain/commission';
import { Facilitation } from '../domain/facilitation';
import { FACILITATOR_REPOSITORY, FacilitatorRepository } from '../domain/facilitator-repository';
import { Inject } from '@nestjs/common';
import { FacilitatorView, toFacilitatorView } from './facilitator-view';
import { RegisterFacilitatorUseCase } from './register-facilitator.use-case';

/**
 * Facilitateur à lier : un facilitateur existant (par identifiant) OU un nouveau, jamais les deux. À la modification,
 * l'un et l'autre peuvent être omis pour conserver le facilitateur actuel (et ne changer que la méthode, l'appartenance
 * ou la commission). `commission` : absente = inchangée ; `null` = retirée ; objet = remplacée.
 */
export interface FacilitationInput {
  facilitatorId?: string;
  newFacilitator?: { lastName: string; firstName: string; phone: string; comment?: string | null };
  contactMethod?: string;
  isCompanyEmployee?: boolean;
  commission?: { type: string; value: string | number; currency?: string | null } | null;
}

export interface FacilitationContext {
  access: AccessContext;
  actor: ActorContext;
  /** Propriétaire de l'entreprise : la portée du droit de définir une commission se mesure sur lui. */
  companyOwnerId: string;
  /** Lien actuel (modification) ; `null` à la création. */
  existing: Facilitation | null;
}

/**
 * Règles communes à la création et à la modification d'une entreprise : droits de l'appelant (facilitateur, commission),
 * facilitateur retrouvé dans sa portée (sinon « introuvable », prévention d'IDOR) ou créé, validations faites AVANT toute
 * écriture.
 */
@Injectable()
export class FacilitationResolver {
  constructor(
    @Inject(FACILITATOR_REPOSITORY) private readonly facilitators: FacilitatorRepository,
    private readonly registerFacilitator: RegisterFacilitatorUseCase,
  ) {}

  async resolve(context: FacilitationContext, input: FacilitationInput): Promise<{ link: Facilitation; facilitator: FacilitatorView | null }> {
    const { access, existing } = context;
    if (Boolean(input.facilitatorId) && Boolean(input.newFacilitator)) {
      throw new DomainError('VALIDATION', 'Indiquez soit un facilitateur existant, soit un nouveau facilitateur, pas les deux');
    }
    if (!input.facilitatorId && !input.newFacilitator && !existing) {
      throw new DomainError('VALIDATION', 'Indiquez soit un facilitateur existant, soit un nouveau facilitateur');
    }
    const method = input.contactMethod ?? existing?.contactMethod;
    if (!method) throw new DomainError('VALIDATION', 'La méthode de prise de contact est obligatoire');
    Facilitation.assertMethod(method); // avant toute écriture : pas de facilitateur créé pour rien

    const canManageCommission = decideFor(access, 'bd.commission.manage', context.companyOwnerId).allowed;
    let commission: Commission | null;
    if (input.commission === undefined) {
      commission = existing?.commission ?? null;
    } else {
      if (!canManageCommission && (input.commission !== null || existing?.commission)) {
        throw new DomainError('FORBIDDEN', "Vous n'avez pas le droit de définir une commission");
      }
      commission = input.commission === null ? null : Commission.of(input.commission);
    }

    let facilitatorId: string;
    let facilitator: FacilitatorView | null;
    if (input.facilitatorId) {
      const found = await this.facilitators.findById(input.facilitatorId);
      // Hors portée = introuvable (même réponse que pour un identifiant inexistant : prévention d'IDOR).
      if (!found || !decideFor(access, 'bd.facilitator.read', found.ownerUserId).allowed) {
        throw new DomainError('NOT_FOUND', 'Facilitateur introuvable');
      }
      facilitatorId = found.id;
      facilitator = toFacilitatorView(found);
    } else if (input.newFacilitator) {
      if (!decideFor(access, 'bd.facilitator.create', access.actorId).allowed) {
        throw new DomainError('FORBIDDEN', "Vous n'avez pas le droit de créer un facilitateur");
      }
      facilitator = await this.registerFacilitator.executeInTransaction({ ...input.newFacilitator, ownerUserId: access.actorId, actor: context.actor });
      facilitatorId = facilitator.id;
    } else {
      // Modification sans changer de facilitateur : on le relit, visible seulement si la portée de l'appelant le permet.
      facilitatorId = existing!.facilitatorId;
      const current = await this.facilitators.findById(facilitatorId);
      facilitator = current && decideFor(access, 'bd.facilitator.read', current.ownerUserId).allowed ? toFacilitatorView(current) : null;
    }
    const link = Facilitation.of({
      facilitatorId,
      contactMethod: method,
      isCompanyEmployee: input.isCompanyEmployee ?? existing?.isCompanyEmployee ?? false,
      commission,
    });
    return { link, facilitator };
  }
}
