import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { actorContextFrom } from '../../../shared-kernel';
import { Access, CurrentActor, Protected } from '../../iam';
import type { AccessContext, AuthenticatedActor } from '../../iam';
import {
  GetEmployeeHandler, GetOrgChartHandler, ListDirectoryHandler, ListEmployeesHandler, ListHierarchyGapsHandler, ListLinkableUsersHandler, RegisterEmployeeUseCase, SetEmployeeStatusUseCase, UpdateEmployeeUseCase,
} from '../application/employee-use-cases';
import { ListDirectoryDto, ListEmployeesDto, RegisterEmployeeDto, SetEmployeeStatusDto, UpdateEmployeeDto } from './dto/employee.dto';

/**
 * Personnel (RH légère, ADR-0009). L'annuaire et l'organigramme (identité et contacts PROFESSIONNELS des employés actifs) sont lisibles de tout utilisateur
 * authentifié ; la fiche détaillée suit la portée du compte lié (la RH et la Direction voient tout) et sa lecture est tracée ; hors portée, un employé est
 * « introuvable », jamais « interdit ». Aucune donnée sensible n'existe dans ce module (D57).
 */
@ApiTags('hr')
@Controller('hr')
export class EmployeesController {
  constructor(
    private readonly registerEmployee: RegisterEmployeeUseCase,
    private readonly updateEmployee: UpdateEmployeeUseCase,
    private readonly setStatus: SetEmployeeStatusUseCase,
    private readonly getEmployee: GetEmployeeHandler,
    private readonly listEmployees: ListEmployeesHandler,
    private readonly listDirectory: ListDirectoryHandler,
    private readonly orgChart: GetOrgChartHandler,
    private readonly gaps: ListHierarchyGapsHandler,
    private readonly linkable: ListLinkableUsersHandler,
  ) {}

  /** Annuaire restreint : employés actifs, champs professionnels. */
  @Get('directory')
  @Protected('hr.directory.read')
  directory(@Query() query: ListDirectoryDto) {
    return this.listDirectory.execute(query);
  }

  /** Organigramme : tous les employés actifs, à plat, avec leur responsable RH. */
  @Get('org-chart')
  @Protected('hr.directory.read')
  chart() {
    return this.orgChart.execute();
  }

  /** Comptes auxquels on peut encore lier une fiche (nom seulement). */
  @Get('linkable-users')
  @Protected('hr.employee.update')
  linkableUsers(@Access() access: AccessContext) {
    return this.linkable.execute({ access });
  }

  /** Écarts entre l'organigramme RH et la hiérarchie des comptes : signalés, jamais corrigés. Portée Tous exigée dès la garde. */
  @Get('employees/hierarchy-gaps')
  @Protected('hr.employee.read', { minScope: 'ALL' })
  hierarchyGaps(@Access() access: AccessContext) {
    return this.gaps.execute({ access });
  }

  @Post('employees')
  @HttpCode(201)
  @Protected('hr.employee.create')
  register(@Body() dto: RegisterEmployeeDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.registerEmployee.execute({ ...dto, access, actor: actorContextFrom(req, actor) });
  }

  @Get('employees')
  @Protected('hr.employee.read')
  list(@Query() query: ListEmployeesDto, @Access() access: AccessContext) {
    return this.listEmployees.execute({ ...query, access });
  }

  @Get('employees/:id')
  @Protected('hr.employee.read')
  get(@Param('id', ParseUUIDPipe) id: string, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.getEmployee.execute({ id, access, actor: actorContextFrom(req, actor) });
  }

  @Put('employees/:id')
  @Protected('hr.employee.update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEmployeeDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.updateEmployee.execute({ ...dto, id, access, actor: actorContextFrom(req, actor) });
  }

  /** Archive (sortie du personnel, réversible) ou réactive l'employé ; jamais de suppression. */
  @Post('employees/:id/status')
  @HttpCode(200)
  @Protected('hr.employee.archive')
  changeStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetEmployeeStatusDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.setStatus.execute({ ...dto, id, access, actor: actorContextFrom(req, actor) });
  }
}
