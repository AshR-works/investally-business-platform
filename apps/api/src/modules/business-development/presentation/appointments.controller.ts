import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { actorContextFrom } from '../../../shared-kernel';
import { Access, CurrentActor, Protected } from '../../iam';
import type { AccessContext, AuthenticatedActor } from '../../iam';
import {
  AppointmentTransition, GetAppointmentHandler, ListAppointmentsHandler, PlanAppointmentUseCase, TransitionAppointmentUseCase, UpdateAppointmentUseCase,
} from '../application/appointment-use-cases';
import { ListAppointmentsDto, PlanAppointmentDto, TransitionAppointmentDto, UpdateAppointmentDto } from './dto/appointment.dto';

/**
 * Agenda : rendez-vous (DAF, décideur) et visites. Chaque route est protégée (identité + MFA + permission) ; la PORTÉE est celle
 * de l'entreprise : hors portée, un rendez-vous (ou son entreprise) est « introuvable », jamais « interdit ». Le droit exact
 * (rendez-vous ou visite) dépend du type et est contrôlé dans le cas d'usage.
 */
@ApiTags('appointments')
@Controller('appointments')
export class AppointmentsController {
  constructor(
    private readonly planAppointment: PlanAppointmentUseCase,
    private readonly updateAppointment: UpdateAppointmentUseCase,
    private readonly transitionAppointment: TransitionAppointmentUseCase,
    private readonly getAppointment: GetAppointmentHandler,
    private readonly listAppointments: ListAppointmentsHandler,
  ) {}

  /** Planifie ; la réponse porte `conflicts` si l'organisateur a déjà un rendez-vous sur le créneau (avertissement). */
  @Post()
  @HttpCode(201)
  @Protected('bd.appointment.create')
  plan(@Body() dto: PlanAppointmentDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.planAppointment.execute({ ...dto, access, actor: actorContextFrom(req, actor) });
  }

  /** L'agenda sur une fenêtre de temps, trié par heure de début. */
  @Get()
  @Protected('bd.appointment.read')
  list(@Query() query: ListAppointmentsDto, @Access() access: AccessContext) {
    return this.listAppointments.execute({ ...query, access });
  }

  @Get(':id')
  @Protected('bd.appointment.read')
  get(@Param('id', ParseUUIDPipe) id: string, @Access() access: AccessContext) {
    return this.getAppointment.execute({ id, access });
  }

  @Put(':id')
  @Protected('bd.appointment.update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAppointmentDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.updateAppointment.execute({ ...dto, id, access, actor: actorContextFrom(req, actor) });
  }

  /** Reporter à une autre heure, avec un motif (obligatoire). */
  @Post(':id/postpone')
  @HttpCode(200)
  @Protected('bd.appointment.update')
  postpone(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TransitionAppointmentDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.transition(id, dto, 'postpone', access, actor, req);
  }

  /** Marquer tenu, avec le compte rendu (obligatoire). */
  @Post(':id/hold')
  @HttpCode(200)
  @Protected('bd.appointment.update')
  hold(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TransitionAppointmentDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.transition(id, dto, 'hold', access, actor, req);
  }

  /** Annuler, avec un motif (obligatoire). */
  @Post(':id/cancel')
  @HttpCode(200)
  @Protected('bd.appointment.cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TransitionAppointmentDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.transition(id, dto, 'cancel', access, actor, req);
  }

  private transition(id: string, dto: TransitionAppointmentDto, transition: AppointmentTransition, access: AccessContext, actor: AuthenticatedActor, req: Request) {
    return this.transitionAppointment.execute({ id, version: dto.version, startsAt: dto.startsAt, text: dto.text, transition, access, actor: actorContextFrom(req, actor) });
  }
}
