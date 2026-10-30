import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { actorContextFrom } from '../../../shared-kernel';
import { Access, CurrentActor, Protected, visibilityFor } from '../../iam';
import type { AccessContext, AuthenticatedActor } from '../../iam';
import {
  ChangeOfferStatusUseCase, GetOfferHandler, ListOffersHandler, OfferAction, RegisterOfferUseCase, UpdateOfferUseCase,
} from '../application/offer-use-cases';
import { ListOffersDto, OfferTransitionDto, RegisterOfferDto, UpdateOfferDto } from './dto/offer.dto';

/**
 * Offres faites aux entreprises. Chaque route est protégée (identité + MFA + permission) ; la PORTÉE est celle de l'entreprise de
 * l'offre : hors portée, une offre (ou son entreprise) est « introuvable », jamais « interdite ».
 */
@ApiTags('offers')
@Controller('offers')
export class OffersController {
  constructor(
    private readonly registerOffer: RegisterOfferUseCase,
    private readonly updateOffer: UpdateOfferUseCase,
    private readonly changeStatus: ChangeOfferStatusUseCase,
    private readonly getOffer: GetOfferHandler,
    private readonly listOffers: ListOffersHandler,
  ) {}

  @Post()
  @HttpCode(201)
  @Protected('bd.offer.create')
  register(@Body() dto: RegisterOfferDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.registerOffer.execute({ ...dto, access, actor: actorContextFrom(req, actor) });
  }

  @Get()
  @Protected('bd.offer.read')
  list(@Query() query: ListOffersDto, @Access() access: AccessContext) {
    return this.listOffers.execute({ ...query, access, visibility: visibilityFor(access, 'bd.offer.read') });
  }

  @Get(':id')
  @Protected('bd.offer.read')
  get(@Param('id', ParseUUIDPipe) id: string, @Access() access: AccessContext) {
    return this.getOffer.execute({ id, access });
  }

  @Put(':id')
  @Protected('bd.offer.update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateOfferDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.updateOffer.execute({ ...dto, id, access, actor: actorContextFrom(req, actor) });
  }

  /** Déposer le brouillon chez l'entreprise. */
  @Post(':id/submit')
  @HttpCode(200)
  @Protected('bd.offer.update')
  submit(@Param('id', ParseUUIDPipe) id: string, @Body() dto: OfferTransitionDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.transition('submit', id, dto, access, actor, req);
  }

  /** Enregistrer l'acceptation de l'entreprise. */
  @Post(':id/accept')
  @HttpCode(200)
  @Protected('bd.offer.update')
  accept(@Param('id', ParseUUIDPipe) id: string, @Body() dto: OfferTransitionDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.transition('accept', id, dto, access, actor, req);
  }

  /** Enregistrer le refus de l'entreprise. */
  @Post(':id/refuse')
  @HttpCode(200)
  @Protected('bd.offer.update')
  refuse(@Param('id', ParseUUIDPipe) id: string, @Body() dto: OfferTransitionDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.transition('refuse', id, dto, access, actor, req);
  }

  /** Retirer l'offre (motif obligatoire). */
  @Post(':id/withdraw')
  @HttpCode(200)
  @Protected('bd.offer.withdraw')
  withdraw(@Param('id', ParseUUIDPipe) id: string, @Body() dto: OfferTransitionDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.transition('withdraw', id, dto, access, actor, req);
  }

  private transition(action: OfferAction, id: string, dto: OfferTransitionDto, access: AccessContext, actor: AuthenticatedActor, req: Request) {
    return this.changeStatus.execute({ id, action, version: dto.version, reason: dto.reason, access, actor: actorContextFrom(req, actor) });
  }
}
