import { Body, Controller, Get, Put, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { actorContextFrom } from '../../../shared-kernel';
import { Access, CurrentActor, Protected } from '../../iam';
import type { AccessContext, AuthenticatedActor } from '../../iam';
import { GetTrainingThresholdsHandler, UpdateTrainingThresholdsUseCase } from '../application/evaluation-use-cases';
import { UpdateTrainingThresholdsDto } from './dto/evaluation.dto';

/** Seuils d'éligibilité à un certificat ou une attestation (S5, D31) : une seule ligne, valeurs de départ « à confirmer », paramétrables. */
@ApiTags('training')
@Controller('training/thresholds')
export class TrainingThresholdsController {
  constructor(
    private readonly getThresholds: GetTrainingThresholdsHandler,
    private readonly updateThresholds: UpdateTrainingThresholdsUseCase,
  ) {}

  @Get() @Protected('training.evaluation.read')
  get(@Access() access: AccessContext) {
    return this.getThresholds.execute({ access });
  }

  @Put() @Protected('training.evaluation.manage')
  edit(@Body() dto: UpdateTrainingThresholdsDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.updateThresholds.execute({ ...dto, access, actor: actorContextFrom(req, actor) });
  }
}
