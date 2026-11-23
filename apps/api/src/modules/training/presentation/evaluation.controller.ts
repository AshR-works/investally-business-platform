import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Put, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { actorContextFrom } from '../../../shared-kernel';
import { Access, CurrentActor, Protected } from '../../iam';
import type { AccessContext, AuthenticatedActor } from '../../iam';
import { GetEvaluationSheetHandler, RecordEvaluationUseCase } from '../application/evaluation-use-cases';
import { RecordEvaluationDto } from './dto/evaluation.dto';

/**
 * Évaluations des inscrits d'une session (S5.3b). Saisie et correction réservées au responsable Investudy (le formateur est externe,
 * sans accès à l'application, FD-11 B, même règle que les présences) ; figées dès que la session est clôturée. Lue aussi par la
 * Direction (consultation). La feuille calcule une suggestion d'éligibilité (CU-I-60) ; elle ne délivre rien (lot c).
 */
@ApiTags('sessions')
@Controller('sessions/:sessionId/evaluations')
export class EvaluationController {
  constructor(
    private readonly record: RecordEvaluationUseCase,
    private readonly sheet: GetEvaluationSheetHandler,
  ) {}

  @Get() @Protected('training.evaluation.read')
  get(@Param('sessionId', ParseUUIDPipe) sessionId: string) {
    return this.sheet.execute({ sessionId });
  }

  /** Saisit ou corrige la note d'un inscrit confirmé (idempotent : la même valeur ne réécrit rien). */
  @Put(':enrollmentId') @HttpCode(200) @Protected('training.evaluation.record')
  put(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('enrollmentId', ParseUUIDPipe) enrollmentId: string,
    @Body() dto: RecordEvaluationDto,
    @Access() access: AccessContext,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() req: Request,
  ) {
    return this.record.execute({ sessionId, enrollmentId, score: dto.score, access, actor: actorContextFrom(req, actor) });
  }
}
