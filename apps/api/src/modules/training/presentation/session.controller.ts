import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { actorContextFrom } from '../../../shared-kernel';
import { Access, CurrentActor, Protected } from '../../iam';
import type { AccessContext, AuthenticatedActor } from '../../iam';
import {
  CancelSessionUseCase, CloseSessionUseCase, GetSessionHandler, ListSessionsHandler, OpenSessionUseCase, PlanSessionUseCase, PostponeSessionUseCase, ReopenSessionUseCase, UpdateSessionUseCase,
} from '../application/session-use-cases';
import { CancelSessionDto, CloseSessionDto, ListSessionsDto, OpenSessionDto, PlanSessionDto, PostponeSessionDto, ReopenSessionDto, UpdateSessionDto } from './dto/session.dto';

/*
 * Sessions de formation. Les écritures (planifier, modifier, ouvrir, reporter, annuler) sont réservées aux rôles qui détiennent la permission
 * en portée « Tous » (Responsable Investudy, Super administrateur) : le contrat anti-IDOR les classe « référentiel ». La LECTURE a une
 * portée : le formateur (« Propre ») ne voit que les sessions dont le formateur est lié à son compte ; hors portée, une session est
 * « introuvable », jamais « interdite » (classe « objet »).
 */
@ApiTags('sessions')
@Controller('sessions')
export class SessionsController {
  constructor(
    private readonly plan: PlanSessionUseCase,
    private readonly update: UpdateSessionUseCase,
    private readonly open: OpenSessionUseCase,
    private readonly postpone: PostponeSessionUseCase,
    private readonly cancel: CancelSessionUseCase,
    private readonly close: CloseSessionUseCase,
    private readonly reopen: ReopenSessionUseCase,
    private readonly getOne: GetSessionHandler,
    private readonly listAll: ListSessionsHandler,
  ) {}

  @Post() @HttpCode(201) @Protected('training.session.create')
  register(@Body() dto: PlanSessionDto, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.plan.execute({ ...dto, actor: actorContextFrom(req, actor) });
  }

  @Get() @Protected('training.session.read')
  list(@Query() query: ListSessionsDto, @Access() access: AccessContext) {
    return this.listAll.execute({ ...query, access });
  }

  @Get(':id') @Protected('training.session.read')
  get(@Param('id', ParseUUIDPipe) id: string, @Access() access: AccessContext) {
    return this.getOne.execute({ id, access });
  }

  @Put(':id') @Protected('training.session.update')
  edit(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSessionDto, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.update.execute({ ...dto, id, actor: actorContextFrom(req, actor) });
  }

  /** Ouvre la session aux inscriptions. */
  @Post(':id/open') @HttpCode(200) @Protected('training.session.update')
  openRegistrations(@Param('id', ParseUUIDPipe) id: string, @Body() dto: OpenSessionDto, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.open.execute({ ...dto, id, actor: actorContextFrom(req, actor) });
  }

  /** Reporte la session à une autre date de début ; les inscrits sont conservés. */
  @Post(':id/postpone') @HttpCode(200) @Protected('training.session.update')
  reschedule(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PostponeSessionDto, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.postpone.execute({ ...dto, id, actor: actorContextFrom(req, actor) });
  }

  @Post(':id/cancel') @HttpCode(200) @Protected('training.session.cancel')
  abort(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelSessionDto, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.cancel.execute({ ...dto, id, actor: actorContextFrom(req, actor) });
  }

  /** Clôture la session (S5.3a) : les présences sont alors figées. */
  @Post(':id/close') @HttpCode(200) @Protected('training.session.close')
  closeSession(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CloseSessionDto, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.close.execute({ ...dto, id, actor: actorContextFrom(req, actor) });
  }

  /** Rouvre une session clôturée (permission dédiée, motif obligatoire, S7). */
  @Post(':id/reopen') @HttpCode(200) @Protected('training.session.reopen')
  reopenSession(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReopenSessionDto, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.reopen.execute({ ...dto, id, actor: actorContextFrom(req, actor) });
  }
}
