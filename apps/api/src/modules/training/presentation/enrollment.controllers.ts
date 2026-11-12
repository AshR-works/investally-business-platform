import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { actorContextFrom } from '../../../shared-kernel';
import { Access, CurrentActor, Protected } from '../../iam';
import type { AccessContext, AuthenticatedActor } from '../../iam';
import {
  CancelEnrollmentUseCase, ConfirmEnrollmentUseCase, EnrollLearnerUseCase, GetEnrollmentHandler, ListApprovalOptionsHandler, ListEnrollmentsHandler, ReplaceEnrollmentUseCase,
} from '../application/enrollment-use-cases';
import { DeleteLearnerUseCase, GetLearnerHandler, ListLearnersHandler, RegisterLearnerUseCase, UpdateLearnerUseCase } from '../application/learner-use-cases';
import {
  ApprovalOptionsDto, CancelEnrollmentDto, ConfirmEnrollmentDto, CreateLearnerDto, DeleteLearnerDto, EnrollDto, ListEnrollmentsDto, ListLearnersDto, ReplaceEnrollmentDto, UpdateLearnerDto,
} from './dto/enrollment.dto';

/*
 * Apprenants et inscriptions. Ils n'ont pas de propriétaire propre : la PORTÉE est celle de l'entreprise de l'apprenant (chargé de compte :
 * les siennes ; Responsable commercial : son équipe ; Investudy, Direction, Support, Finance : lecture « Tous »). Hors portée, un apprenant ou
 * une inscription est « introuvable », jamais « interdit ». Confirmer, annuler et replacer relèvent du Responsable Investudy (D47).
 */

@ApiTags('learners')
@Controller('learners')
export class LearnersController {
  constructor(
    private readonly register: RegisterLearnerUseCase,
    private readonly update: UpdateLearnerUseCase,
    private readonly remove: DeleteLearnerUseCase,
    private readonly getOne: GetLearnerHandler,
    private readonly listAll: ListLearnersHandler,
  ) {}

  @Post() @HttpCode(201) @Protected('training.learner.create')
  create(@Body() dto: CreateLearnerDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.register.execute({ ...dto, access, actor: actorContextFrom(req, actor) });
  }

  @Get() @Protected('training.learner.read')
  list(@Query() query: ListLearnersDto, @Access() access: AccessContext) {
    return this.listAll.execute({ ...query, access });
  }

  @Get(':id') @Protected('training.learner.read')
  get(@Param('id', ParseUUIDPipe) id: string, @Access() access: AccessContext) {
    return this.getOne.execute({ id, access });
  }

  @Put(':id') @Protected('training.learner.update')
  edit(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLearnerDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.update.execute({ ...dto, id, access, actor: actorContextFrom(req, actor) });
  }

  /** Suppression logique (Responsable Investudy) : refusée si l'apprenant a une inscription confirmée. */
  @Delete(':id') @HttpCode(204) @Protected('training.learner.delete')
  async delete(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DeleteLearnerDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    await this.remove.execute({ id, version: dto.version, access, actor: actorContextFrom(req, actor) });
  }
}

@ApiTags('enrollments')
@Controller('enrollments')
export class EnrollmentsController {
  constructor(
    private readonly enroll: EnrollLearnerUseCase,
    private readonly confirm: ConfirmEnrollmentUseCase,
    private readonly cancel: CancelEnrollmentUseCase,
    private readonly replace: ReplaceEnrollmentUseCase,
    private readonly getOne: GetEnrollmentHandler,
    private readonly listAll: ListEnrollmentsHandler,
    private readonly approvalOptions: ListApprovalOptionsHandler,
  ) {}

  @Post() @HttpCode(201) @Protected('training.enrollment.create')
  register(@Body() dto: EnrollDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.enroll.execute({ ...dto, access, actor: actorContextFrom(req, actor) });
  }

  @Get() @Protected('training.enrollment.read')
  list(@Query() query: ListEnrollmentsDto, @Access() access: AccessContext) {
    return this.listAll.execute({ ...query, access });
  }

  /** Les agréments de l'entreprise de l'apprenant, avec ce qui les empêche de couvrir cette inscription. Déclaré avant `:id`. */
  @Get('approval-options') @Protected('training.enrollment.create')
  options(@Query() query: ApprovalOptionsDto, @Access() access: AccessContext) {
    return this.approvalOptions.execute({ ...query, access });
  }

  @Get(':id') @Protected('training.enrollment.read')
  get(@Param('id', ParseUUIDPipe) id: string, @Access() access: AccessContext) {
    return this.getOne.execute({ id, access });
  }

  @Post(':id/confirm') @HttpCode(200) @Protected('training.enrollment.update')
  confirmEnrollment(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ConfirmEnrollmentDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.confirm.execute({ ...dto, id, access, actor: actorContextFrom(req, actor) });
  }

  @Post(':id/cancel') @HttpCode(200) @Protected('training.enrollment.cancel')
  cancelEnrollment(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelEnrollmentDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.cancel.execute({ ...dto, id, access, actor: actorContextFrom(req, actor) });
  }

  /** Replace l'inscription sur une autre session ouverte ; l'ancienne est annulée et liée à la nouvelle. */
  @Post(':id/replace') @HttpCode(201) @Protected('training.enrollment.cancel')
  replaceEnrollment(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReplaceEnrollmentDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.replace.execute({ ...dto, id, access, actor: actorContextFrom(req, actor) });
  }
}
