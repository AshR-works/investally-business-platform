import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { actorContextFrom } from '../../../shared-kernel';
import { Access, CurrentActor, Protected } from '../../iam';
import type { AccessContext, AuthenticatedActor } from '../../iam';
import { ChangePayoutUseCase, GetPayoutHandler, ListPayoutsHandler } from '../application/commission-payout-use-cases';
import { FixPayoutAmountDto, ListPayoutsDto, PayPayoutDto, PayoutReasonDto, ReleasePayoutDto } from './dto/commission-payout.dto';

/**
 * Commissions à verser aux facilitateurs (flux F3). Chaque route est protégée (identité + MFA + permission) ; la PORTÉE est celle de
 * l'entreprise : hors portée, un versement est « introuvable », jamais « interdit ». Un versement naît à l'honneur d'un agrément : il n'y a
 * donc pas de route de création.
 */
@ApiTags('commissions')
@Controller('commissions')
export class CommissionPayoutsController {
  constructor(
    private readonly change: ChangePayoutUseCase,
    private readonly getPayout: GetPayoutHandler,
    private readonly listPayouts: ListPayoutsHandler,
  ) {}

  @Get()
  @Protected('bd.commission.read')
  list(@Query() query: ListPayoutsDto, @Access() access: AccessContext) {
    return this.listPayouts.execute({ ...query, access });
  }

  @Get(':id')
  @Protected('bd.commission.read')
  get(@Param('id', ParseUUIDPipe) id: string, @Access() access: AccessContext) {
    return this.getPayout.execute({ id, access });
  }

  /** Débloquer les fonds (la Finance, le DAF seul : pas de seconde validation, D41). */
  @Post(':id/release')
  @HttpCode(200)
  @Protected('bd.commission.release')
  release(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReleasePayoutDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.change.execute({ id, version: dto.version, action: 'release', access, actor: actorContextFrom(req, actor) });
  }

  /** Mettre en attente le déblocage, avec un motif (la Finance). */
  @Post(':id/hold')
  @HttpCode(200)
  @Protected('bd.commission.release')
  hold(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PayoutReasonDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.change.execute({ id, version: dto.version, action: 'hold', reason: dto.reason, access, actor: actorContextFrom(req, actor) });
  }

  /** Constater le versement : fonds débloqués et justificatif déposé (le chargé de compte, ou le Responsable commercial pour son équipe). */
  @Post(':id/pay')
  @HttpCode(200)
  @Protected('bd.commission.pay')
  pay(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PayPayoutDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.change.execute({ id, version: dto.version, action: 'pay', paidOn: dto.paidOn, access, actor: actorContextFrom(req, actor) });
  }

  /** Annuler la commission, avec un motif, avant son versement (le Responsable commercial). */
  @Post(':id/cancel')
  @HttpCode(200)
  @Protected('bd.commission.manage')
  cancel(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PayoutReasonDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.change.execute({ id, version: dto.version, action: 'cancel', reason: dto.reason, access, actor: actorContextFrom(req, actor) });
  }

  /** Fixer le montant d'un pourcentage dont l'agrément n'avait pas de montant (le Responsable commercial). */
  @Post(':id/amount')
  @HttpCode(200)
  @Protected('bd.commission.manage')
  amount(@Param('id', ParseUUIDPipe) id: string, @Body() dto: FixPayoutAmountDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.change.execute({ id, version: dto.version, action: 'amount', amount: dto.amount, access, actor: actorContextFrom(req, actor) });
  }
}
