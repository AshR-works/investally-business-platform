import { Inject, Injectable } from '@nestjs/common';
import { DomainError, Page } from '../../../shared-kernel';
import { decideFor } from '../../iam';
import type { AccessContext, Visibility } from '../../iam';
import { FACILITATOR_REPOSITORY, FacilitatorRepository } from '../domain/facilitator-repository';
import { FacilitatorView, toFacilitatorView } from './facilitator-view';

const MAX_PAGE_SIZE = 100;

/** Liste paginée des facilitateurs visibles par l'appelant (portée calculée depuis ses droits). */
@Injectable()
export class ListFacilitatorsHandler {
  constructor(@Inject(FACILITATOR_REPOSITORY) private readonly facilitators: FacilitatorRepository) {}

  async execute(query: { page: number; pageSize: number; search?: string; visibility: Visibility }): Promise<Page<FacilitatorView>> {
    const page = Math.max(1, Math.floor(query.page));
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(query.pageSize)));
    const result = await this.facilitators.list({
      page,
      pageSize,
      search: query.search?.trim() || undefined,
      ownerIds: query.visibility.unrestricted ? undefined : query.visibility.ownerIds,
    });
    return { ...result, items: result.items.map(toFacilitatorView) };
  }
}

/** Lecture d'un facilitateur : hors portée → « introuvable » (404), comme pour une entreprise (prévention d'IDOR). */
@Injectable()
export class GetFacilitatorHandler {
  constructor(@Inject(FACILITATOR_REPOSITORY) private readonly facilitators: FacilitatorRepository) {}

  async execute(query: { id: string; access: AccessContext }): Promise<FacilitatorView> {
    const facilitator = await this.facilitators.findById(query.id);
    if (!facilitator || !decideFor(query.access, 'bd.facilitator.read', facilitator.ownerUserId).allowed) {
      throw new DomainError('NOT_FOUND', 'Facilitateur introuvable');
    }
    return toFacilitatorView(facilitator);
  }
}
