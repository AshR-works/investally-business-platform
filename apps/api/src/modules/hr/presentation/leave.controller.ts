import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { actorContextFrom } from '../../../shared-kernel';
import { Access, CurrentActor, Protected } from '../../iam';
import type { AccessContext, AuthenticatedActor } from '../../iam';
import {
  AddHolidayUseCase, AdjustBalanceUseCase, CancelLeaveUseCase, CreateLeaveTypeUseCase, DecideLeaveUseCase, GetLeaveBalanceHandler, GetLeaveRequestHandler, GetLeaveSettingsHandler,
  GetTeamCalendarHandler, ListAdjustmentsHandler, ListHolidaysHandler, ListLeaveRequestsHandler, ListLeaveTypesHandler, RemoveHolidayUseCase, RequestLeaveUseCase,
  UpdateLeaveSettingsUseCase, UpdateLeaveTypeUseCase,
} from '../application/leave-use-cases';
import type { ListLeaveRequestsQuery } from '../application/leave-use-cases';
import {
  AddHolidayDto, AdjustBalanceDto, CancelLeaveDto, CreateLeaveTypeDto, DecideLeaveDto, HolidaysQueryDto, LeaveBalanceDto, ListAdjustmentsDto, ListLeaveRequestsDto, ListLeaveTypesDto,
  RequestLeaveDto, TeamCalendarDto, UpdateLeaveSettingsDto, UpdateLeaveTypeDto,
} from './dto/leave.dto';

/**
 * Absences et congés (RH-2, D64). Chaque demande suit une portée : l'employé voit les siennes, son responsable de l'organigramme celles de son équipe directe (et les
 * valide), la RH et la Direction toutes. Hors périmètre, une demande est « introuvable », jamais « interdite ». Aucune donnée de santé : un type « maladie » ne porte
 * ni diagnostic ni pièce. Les règles (jours par an, jours fériés, types) sont des paramètres de la RH, pas du code.
 */
@ApiTags('hr')
@Controller('hr/leave')
export class LeaveController {
  constructor(
    private readonly requestLeave: RequestLeaveUseCase,
    private readonly decide: DecideLeaveUseCase,
    private readonly cancel: CancelLeaveUseCase,
    private readonly getRequest: GetLeaveRequestHandler,
    private readonly listRequests: ListLeaveRequestsHandler,
    private readonly balance: GetLeaveBalanceHandler,
    private readonly calendar: GetTeamCalendarHandler,
    private readonly listTypes: ListLeaveTypesHandler,
    private readonly createType: CreateLeaveTypeUseCase,
    private readonly updateType: UpdateLeaveTypeUseCase,
    private readonly getSettings: GetLeaveSettingsHandler,
    private readonly updateSettings: UpdateLeaveSettingsUseCase,
    private readonly listHolidays: ListHolidaysHandler,
    private readonly addHoliday: AddHolidayUseCase,
    private readonly removeHoliday: RemoveHolidayUseCase,
    private readonly adjust: AdjustBalanceUseCase,
    private readonly listAdjustments: ListAdjustmentsHandler,
  ) {}

  // ── Demandes
  @Post('requests')
  @HttpCode(201)
  @Protected('hr.leave.create')
  request(@Body() dto: RequestLeaveDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.requestLeave.execute({ ...dto, access, actor: actorContextFrom(req, actor) });
  }

  @Get('requests')
  @Protected('hr.leave.read')
  list(@Query() query: ListLeaveRequestsDto, @Access() access: AccessContext) {
    return this.listRequests.execute({ ...query, status: query.status as ListLeaveRequestsQuery['status'], access });
  }

  @Get('requests/:id')
  @Protected('hr.leave.read')
  get(@Param('id', ParseUUIDPipe) id: string, @Access() access: AccessContext) {
    return this.getRequest.execute({ id, access });
  }

  /** Valider ou refuser (refus motivé) : le responsable direct de l'employé ou la RH, jamais sa propre demande. */
  @Post('requests/:id/decision')
  @HttpCode(200)
  @Protected('hr.leave.approve')
  decision(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DecideLeaveDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.decide.execute({ ...dto, id, access, actor: actorContextFrom(req, actor) });
  }

  @Post('requests/:id/cancel')
  @HttpCode(200)
  @Protected('hr.leave.read')
  cancelRequest(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelLeaveDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.cancel.execute({ ...dto, id, access, actor: actorContextFrom(req, actor) });
  }

  // ── Soldes et calendrier
  @Get('balance')
  @Protected('hr.leave.read')
  getBalance(@Query() query: LeaveBalanceDto, @Access() access: AccessContext) {
    return this.balance.execute({ ...query, access });
  }

  @Get('calendar')
  @Protected('hr.leave.read')
  teamCalendar(@Query() query: TeamCalendarDto, @Access() access: AccessContext) {
    return this.calendar.execute({ ...query, access });
  }

  // ── Paramétrage (RH)
  @Get('types')
  @Protected('hr.leave.read')
  types(@Query() query: ListLeaveTypesDto, @Access() access: AccessContext) {
    return this.listTypes.execute({ ...query, access });
  }

  @Post('types')
  @HttpCode(201)
  @Protected('hr.leave.manage')
  newType(@Body() dto: CreateLeaveTypeDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.createType.execute({ ...dto, access, actor: actorContextFrom(req, actor) });
  }

  @Put('types/:id')
  @Protected('hr.leave.manage')
  editType(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLeaveTypeDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.updateType.execute({ ...dto, id, access, actor: actorContextFrom(req, actor) });
  }

  @Get('settings')
  @Protected('hr.leave.read')
  settings(@Access() access: AccessContext) {
    return this.getSettings.execute({ access });
  }

  @Put('settings')
  @Protected('hr.leave.manage')
  editSettings(@Body() dto: UpdateLeaveSettingsDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.updateSettings.execute({ ...dto, access, actor: actorContextFrom(req, actor) });
  }

  @Get('holidays')
  @Protected('hr.leave.read')
  holidays(@Query() query: HolidaysQueryDto, @Access() access: AccessContext) {
    return this.listHolidays.execute({ year: query.year, access });
  }

  @Post('holidays')
  @HttpCode(201)
  @Protected('hr.leave.manage')
  newHoliday(@Body() dto: AddHolidayDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.addHoliday.execute({ ...dto, access, actor: actorContextFrom(req, actor) });
  }

  @Delete('holidays/:id')
  @HttpCode(204)
  @Protected('hr.leave.manage')
  async deleteHoliday(@Param('id', ParseUUIDPipe) id: string, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    await this.removeHoliday.execute({ id, access, actor: actorContextFrom(req, actor) });
  }

  /** Ajustement de solde (report, correction) : RH seulement, motif obligatoire, ajout seul. */
  @Post('adjustments')
  @HttpCode(201)
  @Protected('hr.leave.manage')
  newAdjustment(@Body() dto: AdjustBalanceDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.adjust.execute({ ...dto, access, actor: actorContextFrom(req, actor) });
  }

  @Get('adjustments')
  @Protected('hr.leave.manage')
  adjustments(@Query() query: ListAdjustmentsDto, @Access() access: AccessContext) {
    return this.listAdjustments.execute({ ...query, access });
  }
}
