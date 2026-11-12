import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { actorContextFrom } from '../../../shared-kernel';
import { Access, CurrentActor, Protected } from '../../iam';
import type { AccessContext, AuthenticatedActor } from '../../iam';
import {
  CancelJourneyUseCase, CompleteJourneyTaskUseCase, GetJourneyHandler, LaunchJourneyUseCase, ListJourneyTemplatesHandler, ListJourneysHandler, ReopenJourneyTaskUseCase,
  UpdateJourneyTemplateUseCase,
} from '../application/journey-use-cases';
import { JourneyVersionDto, LaunchJourneyDto, ListJourneysDto, UpdateTemplateDto } from './dto/journey.dto';

/**
 * Parcours d'intégration et de départ (RH-3b, D67). Les modèles (un par nature) se modifient ; un parcours se lance à la main pour un employé, ses tâches sont copiées
 * du modèle et se cochent avec leur date et leur auteur. La RH et le Super administrateur gèrent tout ; la Direction lit tout ; un employé lit ses propres parcours ;
 * les responsables et les collègues ne voient rien. Hors périmètre, un parcours est « introuvable ». Aucune donnée sensible.
 */
@ApiTags('hr')
@Controller('hr/journeys')
export class JourneysController {
  constructor(
    private readonly listTemplates: ListJourneyTemplatesHandler,
    private readonly updateTemplate: UpdateJourneyTemplateUseCase,
    private readonly launch: LaunchJourneyUseCase,
    private readonly list: ListJourneysHandler,
    private readonly getJourney: GetJourneyHandler,
    private readonly complete: CompleteJourneyTaskUseCase,
    private readonly reopen: ReopenJourneyTaskUseCase,
    private readonly cancel: CancelJourneyUseCase,
  ) {}

  // ── Modèles : déclarés avant `:id` pour ne pas être pris pour un identifiant.
  @Get('templates')
  @Protected('hr.journey.read')
  templates(@Access() access: AccessContext) {
    return this.listTemplates.execute({ access });
  }

  @Put('templates/:kind')
  @Protected('hr.journey.manage')
  editTemplate(@Param('kind') kind: string, @Body() dto: UpdateTemplateDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.updateTemplate.execute({ ...dto, kind, access, actor: actorContextFrom(req, actor) });
  }

  // ── Parcours
  @Post()
  @HttpCode(201)
  @Protected('hr.journey.manage')
  start(@Body() dto: LaunchJourneyDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.launch.execute({ ...dto, access, actor: actorContextFrom(req, actor) });
  }

  @Get()
  @Protected('hr.journey.read')
  all(@Query() query: ListJourneysDto, @Access() access: AccessContext) {
    return this.list.execute({ ...query, access });
  }

  @Get(':id')
  @Protected('hr.journey.read')
  get(@Param('id', ParseUUIDPipe) id: string, @Access() access: AccessContext) {
    return this.getJourney.execute({ id, access });
  }

  @Post(':id/tasks/:taskId/complete')
  @HttpCode(200)
  @Protected('hr.journey.manage')
  check(@Param('id', ParseUUIDPipe) id: string, @Param('taskId', ParseUUIDPipe) taskId: string, @Body() dto: JourneyVersionDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.complete.execute({ ...dto, id, taskId, access, actor: actorContextFrom(req, actor) });
  }

  @Post(':id/tasks/:taskId/reopen')
  @HttpCode(200)
  @Protected('hr.journey.manage')
  uncheck(@Param('id', ParseUUIDPipe) id: string, @Param('taskId', ParseUUIDPipe) taskId: string, @Body() dto: JourneyVersionDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.reopen.execute({ ...dto, id, taskId, access, actor: actorContextFrom(req, actor) });
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @Protected('hr.journey.manage')
  stop(@Param('id', ParseUUIDPipe) id: string, @Body() dto: JourneyVersionDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.cancel.execute({ ...dto, id, access, actor: actorContextFrom(req, actor) });
  }
}
