import { Body, Controller, Delete, Get, HttpCode, Param, Put, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { actorContextFrom } from '../../../shared-kernel';
import { Access, CurrentActor, Protected } from '../../iam';
import type { AccessContext, AuthenticatedActor } from '../../iam';
import { DeclarePresenceUseCase, GetPresenceBoardHandler, RemovePresenceUseCase } from '../application/presence-use-cases';
import { DeclarePresenceDto, PresenceBoardDto, PresenceTargetDto } from './dto/presence.dto';

/**
 * Présences déclaratives (RH-4a, D69) : chacun déclare où il travaille un jour donné (sur site, télétravail, déplacement) ; ni heure, ni lieu, ni retard.
 * La RH (portée Tous) peut déclarer pour n'importe qui ; un employé seulement pour lui, dans une fenêtre courte. Le tableau montre le personnel en poste (RH et
 * Direction) ou la ligne de l'employé et celles de ses subordonnés directs. Hors périmètre, un employé est « introuvable ».
 */
@ApiTags('hr')
@Controller('hr/presences')
export class PresencesController {
  constructor(
    private readonly declare: DeclarePresenceUseCase,
    private readonly remove: RemovePresenceUseCase,
    private readonly board: GetPresenceBoardHandler,
  ) {}

  @Get()
  @Protected('hr.presence.read')
  all(@Query() query: PresenceBoardDto, @Access() access: AccessContext) {
    return this.board.execute({ ...query, access });
  }

  /** Déclare ou change la présence d'un jour (idempotent). `employeeId` en paramètre de requête : absent = soi-même. */
  @Put(':day')
  @HttpCode(200)
  @Protected('hr.presence.declare')
  put(@Param('day') day: string, @Query() target: PresenceTargetDto, @Body() dto: DeclarePresenceDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.declare.execute({ employeeId: target.employeeId, day, mode: dto.mode, access, actor: actorContextFrom(req, actor) });
  }

  @Delete(':day')
  @HttpCode(204)
  @Protected('hr.presence.declare')
  async delete(@Param('day') day: string, @Query() target: PresenceTargetDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    await this.remove.execute({ employeeId: target.employeeId, day, access, actor: actorContextFrom(req, actor) });
  }
}
