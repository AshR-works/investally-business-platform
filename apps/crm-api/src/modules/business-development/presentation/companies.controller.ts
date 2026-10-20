import { Body, Controller, Get, HttpCode, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { ActorContext } from '../../../shared-kernel';
import { RegisterCompanyUseCase } from '../application/register-company.use-case';
import { ListCompaniesHandler } from '../application/list-companies.query';
import { RegisterCompanyDto } from './dto/register-company.dto';
import { ListCompaniesDto } from './dto/list-companies.dto';

/**
 * S1 : pas d'authentification (arrive en S3). L'acteur est anonyme ; l'IP et l'appareil
 * sont déjà capturés pour l'audit. NE PAS exposer cette API hors poste de développement.
 */
function actorFrom(req: Request): ActorContext {
  return {
    userId: null,
    sessionId: null,
    ipAddress: req.ip ?? 'unknown',
    device: String(req.headers['user-agent'] ?? 'unknown').slice(0, 300),
  };
}

@ApiTags('companies')
@Controller('companies')
export class CompaniesController {
  constructor(
    private readonly registerCompany: RegisterCompanyUseCase,
    private readonly listCompanies: ListCompaniesHandler,
  ) {}

  @Post()
  @HttpCode(201)
  register(@Body() dto: RegisterCompanyDto, @Req() req: Request) {
    return this.registerCompany.execute({ ...dto, actor: actorFrom(req) });
  }

  @Get()
  list(@Query() query: ListCompaniesDto) {
    return this.listCompanies.execute(query);
  }
}
