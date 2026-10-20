import { Body, Controller, Get, HttpCode, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { actorContextFrom } from '../../../shared-kernel';
import { RegisterCompanyUseCase } from '../application/register-company.use-case';
import { ListCompaniesHandler } from '../application/list-companies.query';
import { RegisterCompanyDto } from './dto/register-company.dto';
import { ListCompaniesDto } from './dto/list-companies.dto';

/**
 * S1 : pas encore d'authentification sur ces routes (le contrôle d'accès par permission arrive en S3.3).
 * L'API n'écoute que sur 127.0.0.1 ; NE PAS l'exposer hors poste de développement.
 */
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
    return this.registerCompany.execute({ ...dto, actor: actorContextFrom(req) });
  }

  @Get()
  list(@Query() query: ListCompaniesDto) {
    return this.listCompanies.execute(query);
  }
}
