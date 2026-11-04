import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { actorContextFrom } from '../../../shared-kernel';
import { Access, CurrentActor, Protected } from '../../iam';
import type { AccessContext, AuthenticatedActor } from '../../iam';
import { CloseApprovalUseCase, GetApprovalHandler, ListApprovalsHandler, ReceiveApprovalUseCase, RegisterApprovalUseCase } from '../application/approval-use-cases';
import { CloseApprovalDto, HonorApprovalDto, ListApprovalsDto, ReceiveApprovalDto, RegisterApprovalDto } from './dto/approval.dto';

/**
 * Agréments (promesses de paiement signées). Chaque route est protégée (identité + MFA + permission) ; la PORTÉE est celle de
 * l'entreprise : hors portée, un agrément (ou son opportunité) est « introuvable », jamais « interdit ».
 */
@ApiTags('approvals')
@Controller('approvals')
export class ApprovalsController {
  constructor(
    private readonly registerApproval: RegisterApprovalUseCase,
    private readonly receiveApproval: ReceiveApprovalUseCase,
    private readonly closeApproval: CloseApprovalUseCase,
    private readonly getApproval: GetApprovalHandler,
    private readonly listApprovals: ListApprovalsHandler,
  ) {}

  /** Enregistrer l'agrément d'une opportunité qui a franchi l'accord de principe : reçu (l'entreprise devient « Cliente ») ou seulement demandé. */
  @Post()
  @HttpCode(201)
  @Protected('bd.approval.create')
  register(@Body() dto: RegisterApprovalDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.registerApproval.execute({ ...dto, access, actor: actorContextFrom(req, actor) });
  }

  @Get()
  @Protected('bd.approval.read')
  list(@Query() query: ListApprovalsDto, @Access() access: AccessContext) {
    return this.listApprovals.execute({ ...query, access });
  }

  @Get(':id')
  @Protected('bd.approval.read')
  get(@Param('id', ParseUUIDPipe) id: string, @Access() access: AccessContext) {
    return this.getApproval.execute({ id, access });
  }

  /** La promesse est signée : l'agrément demandé devient reçu (l'entreprise devient « Cliente »). */
  @Post(':id/receive')
  @HttpCode(200)
  @Protected('bd.approval.create')
  receive(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReceiveApprovalDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.receiveApproval.execute({ id, version: dto.version, receivedOn: dto.receivedOn, access, actor: actorContextFrom(req, actor) });
  }

  /** Constater que la promesse a été tenue, c'est-à-dire que le paiement a eu lieu (réservé à qui peut honorer : la finance, D41). */
  @Post(':id/honor')
  @HttpCode(200)
  @Protected('bd.approval.honor')
  honor(@Param('id', ParseUUIDPipe) id: string, @Body() dto: HonorApprovalDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.closeApproval.execute({ id, version: dto.version, action: 'honor', access, actor: actorContextFrom(req, actor) });
  }

  /** Déclarer l'agrément expiré (motif obligatoire) : l'expiration est manuelle (D3). */
  @Post(':id/expire')
  @HttpCode(200)
  @Protected('bd.approval.cancel')
  expire(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CloseApprovalDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.closeApproval.execute({ id, version: dto.version, action: 'expire', reason: dto.reason, access, actor: actorContextFrom(req, actor) });
  }

  /** Annuler l'agrément (motif obligatoire). */
  @Post(':id/cancel')
  @HttpCode(200)
  @Protected('bd.approval.cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CloseApprovalDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.closeApproval.execute({ id, version: dto.version, action: 'cancel', reason: dto.reason, access, actor: actorContextFrom(req, actor) });
  }
}
