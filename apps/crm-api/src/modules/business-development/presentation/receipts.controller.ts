import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { actorContextFrom } from '../../../shared-kernel';
import { Access, CurrentActor, Protected } from '../../iam';
import type { AccessContext, AuthenticatedActor } from '../../iam';
import { CancelReceiptUseCase, GetReceiptHandler, ListReceiptsHandler, RegisterReceiptUseCase } from '../application/receipt-use-cases';
import { CancelReceiptDto, ListReceiptsDto, RegisterReceiptDto } from './dto/receipt.dto';

/**
 * Décharges signées des offres. Chaque route est protégée (identité + MFA + permission) ; la PORTÉE est celle de l'entreprise de
 * l'offre : hors portée, une décharge (ou son offre) est « introuvable », jamais « interdite ».
 */
@ApiTags('receipts')
@Controller('receipts')
export class ReceiptsController {
  constructor(
    private readonly registerReceipt: RegisterReceiptUseCase,
    private readonly cancelReceipt: CancelReceiptUseCase,
    private readonly getReceipt: GetReceiptHandler,
    private readonly listReceipts: ListReceiptsHandler,
  ) {}

  @Post()
  @HttpCode(201)
  @Protected('bd.receipt.create')
  register(@Body() dto: RegisterReceiptDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.registerReceipt.execute({ ...dto, access, actor: actorContextFrom(req, actor) });
  }

  @Get()
  @Protected('bd.receipt.read')
  list(@Query() query: ListReceiptsDto, @Access() access: AccessContext) {
    return this.listReceipts.execute({ offerId: query.offerId, access });
  }

  @Get(':id')
  @Protected('bd.receipt.read')
  get(@Param('id', ParseUUIDPipe) id: string, @Access() access: AccessContext) {
    return this.getReceipt.execute({ id, access });
  }

  /** Annuler la décharge (motif obligatoire) : l'offre redevient « déposée ». */
  @Post(':id/cancel')
  @HttpCode(200)
  @Protected('bd.receipt.update')
  cancel(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelReceiptDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.cancelReceipt.execute({ id, version: dto.version, reason: dto.reason, access, actor: actorContextFrom(req, actor) });
  }
}
