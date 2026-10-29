import { Body, Controller, Get, Header, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { actorContextFrom } from '../../../shared-kernel';
import { Access, CurrentActor, Protected, visibilityFor } from '../../iam';
import type { AccessContext, AuthenticatedActor } from '../../iam';
import { ExportCompanySheetHandler } from '../application/export-company-sheet.query';
import { GetCompanyHandler } from '../application/get-company.query';
import { ListCompaniesHandler } from '../application/list-companies.query';
import { RegisterCompanyUseCase } from '../application/register-company.use-case';
import { UpdateCompanyUseCase } from '../application/update-company.use-case';
import { ListCompaniesDto } from './dto/list-companies.dto';
import { RegisterCompanyDto } from './dto/register-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

/**
 * Chaque route est protégée : identité + MFA vérifié + permission. La PORTÉE (Propre, Équipe, Tous) est ensuite
 * appliquée par les cas d'usage : la liste est filtrée, un objet hors portée est « introuvable ».
 */
@ApiTags('companies')
@Controller('companies')
export class CompaniesController {
  constructor(
    private readonly registerCompany: RegisterCompanyUseCase,
    private readonly updateCompany: UpdateCompanyUseCase,
    private readonly listCompanies: ListCompaniesHandler,
    private readonly getCompany: GetCompanyHandler,
    private readonly exportCompanySheet: ExportCompanySheetHandler,
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

  /**
   * Fiche imprimable. Qui peut voir l'entreprise peut en exporter la fiche ; chaque export est tracé. Document HTML autonome,
   * servi avec une politique de contenu qui interdit tout script et toute ressource externe.
   */
  @Get(':id/export')
  @Protected('bd.company.read')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'")
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Cache-Control', 'no-store')
  async export(@Param('id', ParseUUIDPipe) id: string, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    const sheet = await this.exportCompanySheet.execute({ id, access, actor: actorContextFrom(req, actor) });
    return sheet.html;
  }

  @Get(':id')
  @Protected('bd.company.read')
  get(@Param('id', ParseUUIDPipe) id: string, @Access() access: AccessContext) {
    return this.getCompany.execute({ id, access });
  }

  /** Modifie la fiche. Le propriétaire, le statut et l'identifiant ne se modifient pas ici (refusés par la validation). */
  @Put(':id')
  @Protected('bd.company.update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCompanyDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.updateCompany.execute({ ...dto, id, access, actor: actorContextFrom(req, actor) });
  }
}
