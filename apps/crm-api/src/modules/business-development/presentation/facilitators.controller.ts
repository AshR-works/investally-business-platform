import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { actorContextFrom } from '../../../shared-kernel';
import { Access, CurrentActor, Protected, visibilityFor } from '../../iam';
import type { AccessContext, AuthenticatedActor } from '../../iam';
import { GetFacilitatorHandler, ListFacilitatorsHandler } from '../application/facilitator-queries';
import { RegisterFacilitatorUseCase } from '../application/register-facilitator.use-case';
import { ListCompaniesDto } from './dto/list-companies.dto';
import { NewFacilitatorDto } from './dto/register-company.dto';

/** Facilitateurs : personnes qui mettent en relation avec une entreprise. La portée est appliquée par les cas d'usage. */
@ApiTags('facilitators')
@Controller('facilitators')
export class FacilitatorsController {
  constructor(
    private readonly registerFacilitator: RegisterFacilitatorUseCase,
    private readonly listFacilitators: ListFacilitatorsHandler,
    private readonly getFacilitator: GetFacilitatorHandler,
  ) {}

  /** L'utilisateur qui crée le facilitateur en devient le propriétaire. */
  @Post()
  @HttpCode(201)
  @Protected('bd.facilitator.create')
  register(@Body() dto: NewFacilitatorDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.registerFacilitator.execute({ ...dto, ownerUserId: access.actorId, actor: actorContextFrom(req, actor) });
  }

  @Get()
  @Protected('bd.facilitator.read')
  list(@Query() query: ListCompaniesDto, @Access() access: AccessContext) {
    return this.listFacilitators.execute({ ...query, visibility: visibilityFor(access, 'bd.facilitator.read') });
  }

  @Get(':id')
  @Protected('bd.facilitator.read')
  get(@Param('id', ParseUUIDPipe) id: string, @Access() access: AccessContext) {
    return this.getFacilitator.execute({ id, access });
  }
}
