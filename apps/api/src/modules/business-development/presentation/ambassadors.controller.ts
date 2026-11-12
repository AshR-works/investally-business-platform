import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { actorContextFrom } from '../../../shared-kernel';
import { Access, CurrentActor, Protected, visibilityFor } from '../../iam';
import type { AccessContext, AuthenticatedActor } from '../../iam';
import { GetAmbassadorHandler, ListAmbassadorsHandler, RegisterAmbassadorUseCase, SetAmbassadorStatusUseCase, UpdateAmbassadorUseCase } from '../application/ambassador-use-cases';
import { ListAmbassadorsDto, RegisterAmbassadorDto, SetAmbassadorStatusDto, UpdateAmbassadorDto } from './dto/ambassador.dto';

/**
 * Ambassadeurs (clients ou apprenants devenus relais commerciaux). Chaque route est protégée (identité + MFA + permission) ; la PORTÉE
 * est celle du créateur de l'ambassadeur : hors portée, il est « introuvable », jamais « interdit ». La création est toujours manuelle.
 */
@ApiTags('ambassadors')
@Controller('ambassadors')
export class AmbassadorsController {
  constructor(
    private readonly registerAmbassador: RegisterAmbassadorUseCase,
    private readonly updateAmbassador: UpdateAmbassadorUseCase,
    private readonly setStatus: SetAmbassadorStatusUseCase,
    private readonly getAmbassador: GetAmbassadorHandler,
    private readonly listAmbassadors: ListAmbassadorsHandler,
  ) {}

  /** Le chargé de compte qui crée l'ambassadeur en devient le responsable. */
  @Post()
  @HttpCode(201)
  @Protected('bd.ambassador.create')
  register(@Body() dto: RegisterAmbassadorDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.registerAmbassador.execute({ ...dto, access, actor: actorContextFrom(req, actor) });
  }

  @Get()
  @Protected('bd.ambassador.read')
  list(@Query() query: ListAmbassadorsDto, @Access() access: AccessContext) {
    return this.listAmbassadors.execute({ ...query, access, visibility: visibilityFor(access, 'bd.ambassador.read') });
  }

  @Get(':id')
  @Protected('bd.ambassador.read')
  get(@Param('id', ParseUUIDPipe) id: string, @Access() access: AccessContext) {
    return this.getAmbassador.execute({ id, access });
  }

  /** Archive (réversible) ou réactive l'ambassadeur ; jamais de suppression. */
  @Post(':id/status')
  @HttpCode(200)
  @Protected('bd.ambassador.update')
  changeStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetAmbassadorStatusDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.setStatus.execute({ ...dto, id, access, actor: actorContextFrom(req, actor) });
  }

  @Put(':id')
  @Protected('bd.ambassador.update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAmbassadorDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.updateAmbassador.execute({ ...dto, id, access, actor: actorContextFrom(req, actor) });
  }
}
