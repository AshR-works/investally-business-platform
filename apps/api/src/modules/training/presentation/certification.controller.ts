import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { actorContextFrom } from '../../../shared-kernel';
import { Access, CurrentActor, Protected } from '../../iam';
import type { AccessContext, AuthenticatedActor } from '../../iam';
import { GetCertificationSheetHandler, IssueCertificationUseCase, RevokeCertificationUseCase } from '../application/certification-use-cases';
import { IssueCertificationDto, RevokeCertificationDto } from './dto/certification.dto';

/**
 * Certificats et attestations d'une session (S5.3c, CU-I-60/61). Délivrance et révocation réservées au responsable Investudy et au
 * Super administrateur ; seulement une fois la session clôturée, et seulement si les seuils le permettent. Lue aussi par la
 * Direction (consultation). Une délivrance à un apprenant d'entreprise crée une suggestion d'ambassadeur (lecture séparée).
 */
@ApiTags('sessions')
@Controller('sessions/:sessionId/certifications')
export class CertificationController {
  constructor(
    private readonly issue: IssueCertificationUseCase,
    private readonly revoke: RevokeCertificationUseCase,
    private readonly sheet: GetCertificationSheetHandler,
  ) {}

  @Get() @Protected('training.certification.read')
  get(@Param('sessionId', ParseUUIDPipe) sessionId: string, @Access() access: AccessContext) {
    return this.sheet.execute({ sessionId, access });
  }

  @Post(':enrollmentId') @HttpCode(201) @Protected('training.certification.issue')
  post(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('enrollmentId', ParseUUIDPipe) enrollmentId: string,
    @Body() dto: IssueCertificationDto,
    @Access() access: AccessContext,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() req: Request,
  ) {
    return this.issue.execute({ sessionId, enrollmentId, kind: dto.kind, access, actor: actorContextFrom(req, actor) });
  }

  /** Révoque la délivrance de cet inscrit, avec justification obligatoire. */
  @Post(':enrollmentId/revoke') @HttpCode(200) @Protected('training.certification.revoke')
  postRevoke(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('enrollmentId', ParseUUIDPipe) enrollmentId: string,
    @Body() dto: RevokeCertificationDto,
    @Access() access: AccessContext,
    @CurrentActor() actor: AuthenticatedActor,
    @Req() req: Request,
  ) {
    return this.revoke.execute({ sessionId, enrollmentId, reason: dto.reason, access, actor: actorContextFrom(req, actor) });
  }
}
