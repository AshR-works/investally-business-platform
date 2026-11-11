import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { actorContextFrom } from '../../../shared-kernel';
import { Access, CurrentActor, Protected } from '../../iam';
import type { AccessContext, AuthenticatedActor } from '../../iam';
import {
  AdjustContractUseCase, CreateContractTypeUseCase, CreateContractUseCase, EndContractUseCase, GetContractHandler, ListContractsHandler, ListContractTypesHandler, ListDeadlinesHandler,
  UpdateContractTypeUseCase,
} from '../application/contract-use-cases';
import { AdjustContractDto, CreateContractDto, CreateContractTypeDto, DeadlinesQueryDto, EndContractDto, ListContractsDto, ListContractTypesDto, UpdateContractTypeDto } from './dto/contract.dto';

/**
 * Contrats du personnel (RH-3, D67). La RH et le Super administrateur gèrent tout ; la Direction lit tout ; un employé lit son propre contrat ; les responsables et les
 * collègues ne voient rien. Hors périmètre, un contrat est « introuvable », jamais « interdit ». Aucun salaire, aucun document, aucune donnée sensible.
 */
@ApiTags('hr')
@Controller('hr/contracts')
export class ContractsController {
  constructor(
    private readonly listTypes: ListContractTypesHandler,
    private readonly createType: CreateContractTypeUseCase,
    private readonly updateType: UpdateContractTypeUseCase,
    private readonly create: CreateContractUseCase,
    private readonly adjust: AdjustContractUseCase,
    private readonly end: EndContractUseCase,
    private readonly getContract: GetContractHandler,
    private readonly list: ListContractsHandler,
    private readonly deadlines: ListDeadlinesHandler,
  ) {}

  // ── Types (RH)
  @Get('types')
  @Protected('hr.contract.read')
  types(@Query() query: ListContractTypesDto, @Access() access: AccessContext) {
    return this.listTypes.execute({ ...query, access });
  }

  @Post('types')
  @HttpCode(201)
  @Protected('hr.contract.manage')
  newType(@Body() dto: CreateContractTypeDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.createType.execute({ ...dto, access, actor: actorContextFrom(req, actor) });
  }

  @Put('types/:id')
  @Protected('hr.contract.manage')
  editType(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateContractTypeDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.updateType.execute({ ...dto, id, access, actor: actorContextFrom(req, actor) });
  }

  // ── Échéances (RH, Direction) : déclarée avant `:id` pour ne pas être prise pour un identifiant.
  @Get('deadlines')
  @Protected('hr.contract.read')
  upcoming(@Query() query: DeadlinesQueryDto, @Access() access: AccessContext) {
    return this.deadlines.execute({ ...query, access });
  }

  // ── Contrats
  @Post()
  @HttpCode(201)
  @Protected('hr.contract.manage')
  add(@Body() dto: CreateContractDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.create.execute({ ...dto, access, actor: actorContextFrom(req, actor) });
  }

  @Get()
  @Protected('hr.contract.read')
  all(@Query() query: ListContractsDto, @Access() access: AccessContext) {
    return this.list.execute({ ...query, access });
  }

  @Get(':id')
  @Protected('hr.contract.read')
  get(@Param('id', ParseUUIDPipe) id: string, @Access() access: AccessContext) {
    return this.getContract.execute({ id, access });
  }

  @Put(':id')
  @Protected('hr.contract.manage')
  edit(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AdjustContractDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.adjust.execute({ ...dto, id, access, actor: actorContextFrom(req, actor) });
  }

  @Post(':id/end')
  @HttpCode(200)
  @Protected('hr.contract.manage')
  finish(@Param('id', ParseUUIDPipe) id: string, @Body() dto: EndContractDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.end.execute({ ...dto, id, access, actor: actorContextFrom(req, actor) });
  }
}
