import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Access, Protected } from '../../iam';
import type { AccessContext } from '../../iam';
import { GetAmbassadorSuggestionsHandler } from '../application/certification-use-cases';

/** Suggestions d'ambassadeur (CU-I-62, S8) : jamais de lecture des certifications ; le chargé de compte décide seul de créer l'ambassadeur. */
@ApiTags('ambassadors')
@Controller('ambassador-suggestions')
export class AmbassadorSuggestionsController {
  constructor(private readonly suggestions: GetAmbassadorSuggestionsHandler) {}

  @Get() @Protected('bd.ambassador.read')
  get(@Access() access: AccessContext) {
    return this.suggestions.execute({ access });
  }
}
