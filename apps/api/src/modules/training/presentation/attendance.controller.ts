import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Put, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { actorContextFrom } from '../../../shared-kernel';
import { Access, CurrentActor, Protected } from '../../iam';
import type { AccessContext, AuthenticatedActor } from '../../iam';
import { GetAttendanceSheetHandler, RecordAttendanceUseCase } from '../application/attendance-use-cases';
import { RecordAttendanceDto } from './dto/attendance.dto';

/**
 * Présences aux séances d'une session (S5.3a, ADR-0016). Saisie et correction réservées au responsable Investudy (le formateur est externe,
 * sans accès à l'application, FD-11 B) ; figées dès que la session est clôturée. Lue aussi par la Direction (consultation).
 */
@ApiTags('sessions')
@Controller('sessions/:sessionId/attendance')
export class AttendanceController {
  constructor(
    private readonly record: RecordAttendanceUseCase,
    private readonly sheet: GetAttendanceSheetHandler,
  ) {}

  @Get() @Protected('training.attendance.read')
  get(@Param('sessionId', ParseUUIDPipe) sessionId: string) {
    return this.sheet.execute({ sessionId });
  }

  /** Saisit ou corrige la présence d'un inscrit confirmé pour un jour (idempotent : la même valeur ne réécrit rien). */
  @Put(':enrollmentId/:day') @HttpCode(200) @Protected('training.attendance.record')
  put(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('enrollmentId', ParseUUIDPipe) enrollmentId: string,
    @Param('day') day: string,
    @Body() dto: RecordAttendanceDto,
    @Access() access: AccessContext,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() req: Request,
  ) {
    return this.record.execute({ sessionId, enrollmentId, day, status: dto.status, access, actor: actorContextFrom(req, actor) });
  }
}
