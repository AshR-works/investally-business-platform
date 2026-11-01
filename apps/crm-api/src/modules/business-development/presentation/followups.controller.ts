import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { actorContextFrom } from '../../../shared-kernel';
import { Access, CurrentActor, Protected, visibilityFor } from '../../iam';
import type { AccessContext, AuthenticatedActor } from '../../iam';
import { CloseFollowupUseCase, FollowupClosing, GetFollowupHandler, ListFollowupsHandler, PlanFollowupUseCase, UpdateFollowupUseCase } from '../application/followup-use-cases';
import { CloseFollowupDto, ListFollowupsDto, PlanFollowupDto, UpdateFollowupDto } from './dto/followup.dto';

/**
 * Relances des offres. Chaque route est protégée (identité + MFA + permission) ; la PORTÉE est celle de l'entreprise de l'offre :
 * hors portée, une relance (ou son offre) est « introuvable », jamais « interdite ».
 */
@ApiTags('followups')
@Controller('followups')
export class FollowupsController {
  constructor(
    private readonly planFollowup: PlanFollowupUseCase,
    private readonly updateFollowup: UpdateFollowupUseCase,
    private readonly closeFollowup: CloseFollowupUseCase,
    private readonly getFollowup: GetFollowupHandler,
    private readonly listFollowups: ListFollowupsHandler,
  ) {}

  @Post()
  @HttpCode(201)
  @Protected('bd.followup.create')
  plan(@Body() dto: PlanFollowupDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.planFollowup.execute({ ...dto, access, actor: actorContextFrom(req, actor) });
  }

  /** La liste « À faire » : triée par échéance, filtrable par offre, état et échéance (en retard, aujourd'hui, à venir). */
  @Get()
  @Protected('bd.followup.read')
  list(@Query() query: ListFollowupsDto, @Access() access: AccessContext) {
    return this.listFollowups.execute({ ...query, access, visibility: visibilityFor(access, 'bd.followup.read') });
  }

  @Get(':id')
  @Protected('bd.followup.read')
  get(@Param('id', ParseUUIDPipe) id: string, @Access() access: AccessContext) {
    return this.getFollowup.execute({ id, access });
  }

  @Put(':id')
  @Protected('bd.followup.update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFollowupDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.updateFollowup.execute({ ...dto, id, access, actor: actorContextFrom(req, actor) });
  }

  /** Terminer la relance avec son résultat (obligatoire). */
  @Post(':id/complete')
  @HttpCode(200)
  @Protected('bd.followup.complete')
  complete(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CloseFollowupDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.close(id, dto, 'complete', access, actor, req);
  }

  /** Annuler la relance avec un motif (obligatoire). */
  @Post(':id/cancel')
  @HttpCode(200)
  @Protected('bd.followup.update')
  cancel(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CloseFollowupDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.close(id, dto, 'cancel', access, actor, req);
  }

  private close(id: string, dto: CloseFollowupDto, closing: FollowupClosing, access: AccessContext, actor: AuthenticatedActor, req: Request) {
    return this.closeFollowup.execute({ id, version: dto.version, text: dto.text, closing, access, actor: actorContextFrom(req, actor) });
  }
}
