import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { actorContextFrom } from '../../../shared-kernel';
import { Access, CurrentActor, Protected, visibilityFor } from '../../iam';
import type { AccessContext, AuthenticatedActor } from '../../iam';
import { GetCompanyHandler } from '../application/get-company.query';
import { ListCompaniesHandler } from '../application/list-companies.query';
import { RegisterCompanyUseCase } from '../application/register-company.use-case';
import { ListCompaniesDto } from './dto/list-companies.dto';
import { RegisterCompanyDto } from './dto/register-company.dto';

/**
 * Chaque route est protégée : identité + MFA vérifié + permission. La PORTÉE (Propre, Équipe, Tous) est ensuite
 * appliquée par les cas d'usage : la liste est filtrée, un objet hors portée est « introuvable ».
 */
@ApiTags('companies')
@Controller('companies')
export class CompaniesController {
  constructor(
    private readonly registerCompany: RegisterCompanyUseCase,
    private readonly listCompanies: ListCompaniesHandler,
    private readonly getCompany: GetCompanyHandler,
  ) {}

  /** L'utilisateur qui crée l'entreprise en devient le propriétaire. */
  @Post()
  @HttpCode(201)
  @Protected('bd.company.create')
  register(@Body() dto: RegisterCompanyDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.registerCompany.execute({ ...dto, ownerUserId: access.actorId, access, actor: actorContextFrom(req, actor) });
  }

  @Get()
  @Protected('bd.company.read')
  list(@Query() query: ListCompaniesDto, @Access() access: AccessContext) {
    return this.listCompanies.execute({ ...query, visibility: visibilityFor(access, 'bd.company.read') });
  }

  @Get(':id')
  @Protected('bd.company.read')
  get(@Param('id', ParseUUIDPipe) id: string, @Access() access: AccessContext) {
    return this.getCompany.execute({ id, access });
  }
}
