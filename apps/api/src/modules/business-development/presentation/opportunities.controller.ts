import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { actorContextFrom } from '../../../shared-kernel';
import { Access, CurrentActor, Protected } from '../../iam';
import type { AccessContext, AuthenticatedActor } from '../../iam';
import {
  AdvanceOpportunityUseCase, CloseOpportunityUseCase, CreateOpportunityUseCase, GetOpportunityHandler, GrantWaiverUseCase, ListOpportunitiesHandler, UpdateOpportunityUseCase,
} from '../application/opportunity-use-cases';
import { AdvanceOpportunityDto, CloseLostDto, CloseWonDto, CreateOpportunityDto, ListOpportunitiesDto, UpdateOpportunityDto, WaiverDto } from './dto/opportunity.dto';

/**
 * Opportunités commerciales (pipeline). Chaque route est protégée (identité + MFA + permission) ; la PORTÉE est celle de
 * l'entreprise : hors portée, une opportunité (ou son entreprise) est « introuvable », jamais « interdite ».
 */
@ApiTags('opportunities')
@Controller('opportunities')
export class OpportunitiesController {
  constructor(
    private readonly createOpportunity: CreateOpportunityUseCase,
    private readonly updateOpportunity: UpdateOpportunityUseCase,
    private readonly advanceOpportunity: AdvanceOpportunityUseCase,
    private readonly grantWaiver: GrantWaiverUseCase,
    private readonly closeOpportunity: CloseOpportunityUseCase,
    private readonly getOpportunity: GetOpportunityHandler,
    private readonly listOpportunities: ListOpportunitiesHandler,
  ) {}

  @Post()
  @HttpCode(201)
  @Protected('bd.opportunity.create')
  create(@Body() dto: CreateOpportunityDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.createOpportunity.execute({ ...dto, access, actor: actorContextFrom(req, actor) });
  }

  /** Le pipeline : les opportunités visibles, la plus récemment modifiée d'abord ; filtrable par recherche, entreprise, état, étape. */
  @Get()
  @Protected('bd.opportunity.read')
  list(@Query() query: ListOpportunitiesDto, @Access() access: AccessContext) {
    return this.listOpportunities.execute({ ...query, access });
  }

  @Get(':id')
  @Protected('bd.opportunity.read')
  get(@Param('id', ParseUUIDPipe) id: string, @Access() access: AccessContext) {
    return this.getOpportunity.execute({ id, access });
  }

  @Put(':id')
  @Protected('bd.opportunity.update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateOpportunityDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.updateOpportunity.execute({ ...dto, id, access, actor: actorContextFrom(req, actor) });
  }

  /** Passer à l'étape suivante (accord de principe : rendez-vous décideur tenu ou dérogation). */
  @Post(':id/advance')
  @HttpCode(200)
  @Protected('bd.opportunity.advance')
  advance(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AdvanceOpportunityDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.advanceOpportunity.execute({ id, version: dto.version, access, actor: actorContextFrom(req, actor) });
  }

  /** Accorder la dérogation à la règle du rendez-vous décideur (Responsable commercial), avec une justification. */
  @Post(':id/waiver')
  @HttpCode(200)
  @Protected('bd.opportunity.override')
  waiver(@Param('id', ParseUUIDPipe) id: string, @Body() dto: WaiverDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.grantWaiver.execute({ id, version: dto.version, reason: dto.reason, access, actor: actorContextFrom(req, actor) });
  }

  /** Clore « perdue » avec un motif de la liste fermée (chargé de compte pour les siennes). */
  @Post(':id/close-lost')
  @HttpCode(200)
  @Protected('bd.opportunity.close_lost')
  closeLost(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CloseLostDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.closeOpportunity.execute({ id, version: dto.version, outcome: 'lost', reason: dto.reason, note: dto.note, access, actor: actorContextFrom(req, actor) });
  }

  /** Clore « gagnée » (Responsable commercial seulement, après l'accord de principe). */
  @Post(':id/close-won')
  @HttpCode(200)
  @Protected('bd.opportunity.close_won')
  closeWon(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CloseWonDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.closeOpportunity.execute({ id, version: dto.version, outcome: 'won', access, actor: actorContextFrom(req, actor) });
  }
}
