import { Body, Controller, Get, Header, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { actorContextFrom } from '../../../shared-kernel';
import { Access, CurrentActor, Protected, visibilityFor } from '../../iam';
import type { AccessContext, AuthenticatedActor } from '../../iam';
import { ExportCompanySheetHandler } from '../application/export-company-sheet.query';
import { GetCompanyHandler } from '../application/get-company.query';
import { GetCompanyOverviewHandler } from '../application/get-company-overview.query';
import { ListCompaniesHandler } from '../application/list-companies.query';
import { RegisterCompanyUseCase } from '../application/register-company.use-case';
import { ChangeCompanyStatusUseCase, CompanyStatus, ListOwnerCandidatesHandler, ReassignCompanyUseCase } from '../application/company-lifecycle-use-cases';
import { UpdateCompanyUseCase } from '../application/update-company.use-case';
import { ChangeStatusDto, ReassignDto } from './dto/company-lifecycle.dto';
import { CompanyOverviewDto, ListCompaniesDto } from './dto/list-companies.dto';
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
    private readonly companyOverview: GetCompanyOverviewHandler,
    private readonly getCompany: GetCompanyHandler,
    private readonly exportCompanySheet: ExportCompanySheetHandler,
    private readonly changeStatus: ChangeCompanyStatusUseCase,
    private readonly reassign: ReassignCompanyUseCase,
    private readonly ownerCandidates: ListOwnerCandidatesHandler,
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

  /** Compteurs par statut et valeurs des filtres (pays, secteurs), dans la portée de l'appelant. Déclarée avant `:id`. */
  @Get('overview')
  @Protected('bd.company.read')
  overview(@Query() query: CompanyOverviewDto, @Access() access: AccessContext) {
    return this.companyOverview.execute({ ...query, visibility: visibilityFor(access, 'bd.company.read') });
  }

  /** Les personnes à qui l'appelant peut confier une entreprise (liste du choix de réattribution). Déclarée avant `:id`. */
  @Get('owners')
  @Protected('bd.company.reassign')
  owners(@Access() access: AccessContext) {
    return this.ownerCandidates.execute({ access });
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

  /** Change le statut à la main, d'un cran (CU-C-05) ; « Qualifiée » exige un contact. */
  @Post(':id/status')
  @HttpCode(200)
  @Protected('bd.company.update')
  status(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ChangeStatusDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.changeStatus.execute({ id, version: dto.version, status: dto.status as CompanyStatus, access, actor: actorContextFrom(req, actor) });
  }

  /** Confie l'entreprise à un autre propriétaire de la portée de l'appelant (D17). */
  @Post(':id/owner')
  @HttpCode(200)
  @Protected('bd.company.reassign')
  owner(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReassignDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.reassign.execute({ id, version: dto.version, ownerUserId: dto.ownerUserId, access, actor: actorContextFrom(req, actor) });
  }
}
