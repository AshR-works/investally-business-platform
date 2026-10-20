import {
  Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { actorContextFrom } from '../../../shared-kernel';
import { InviteUserUseCase, ResendInvitationUseCase } from '../application/admin/invitations.use-cases';
import { ListOwnSessionsHandler, RevokeSessionUseCase, RevokeUserSessionsUseCase } from '../application/admin/session-management.use-cases';
import { AssignRolesUseCase, SetUserStatusUseCase, UpdateUserUseCase } from '../application/admin/user-management.use-cases';
import { GetUserHandler, ListRolesHandler, ListUsersHandler } from '../application/admin/user-queries';
import { AuthenticatedActor } from '../application/authenticate-access-token.use-case';
import { ResetMfaUseCase } from '../application/mfa-management.use-cases';
import type { AccessContext } from '../application/access-types';
import { CurrentActor } from './access-token.guard';
import { AssignRolesDto, InviteUserDto, ListUsersDto, UpdateUserDto } from './dto/admin.dto';
import { Access, Protected } from './protected.decorator';

/** Les réponses d'administration ne doivent jamais être mises en cache (données personnelles). */
function noStore(res: Response): void {
  res.setHeader('Cache-Control', 'no-store');
}

@ApiTags('admin')
@Controller('admin/users')
export class AdminUsersController {
  constructor(
    private readonly listUsers: ListUsersHandler,
    private readonly getUser: GetUserHandler,
    private readonly inviteUser: InviteUserUseCase,
    private readonly resendInvitation: ResendInvitationUseCase,
    private readonly updateUser: UpdateUserUseCase,
    private readonly setStatus: SetUserStatusUseCase,
    private readonly assignRoles: AssignRolesUseCase,
    private readonly resetMfa: ResetMfaUseCase,
    private readonly revokeSessions: RevokeUserSessionsUseCase,
  ) {}

  @Get()
  @Protected('iam.user.read')
  list(@Query() query: ListUsersDto, @Res({ passthrough: true }) res: Response) {
    noStore(res);
    return this.listUsers.execute({ page: query.page, pageSize: query.pageSize, search: query.search, status: query.status });
  }

  @Get(':id')
  @Protected('iam.user.read')
  get(@Param('id', ParseUUIDPipe) id: string, @Res({ passthrough: true }) res: Response) {
    noStore(res);
    return this.getUser.execute(id);
  }

  /** Crée un compte en attente et envoie le lien d'activation (48 h, usage unique). Attribue des rôles : MFA récent exigé. */
  @Post()
  @HttpCode(201)
  @Protected('iam.user.create', { stepUp: true })
  invite(@Body() dto: InviteUserDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.inviteUser.execute({ ...dto, access, actor: actorContextFrom(req, actor) });
  }

  @Post(':id/invitations')
  @HttpCode(200)
  @Protected('iam.user.create')
  resend(@Param('id', ParseUUIDPipe) id: string, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.resendInvitation.execute({ userId: id, actor: actorContextFrom(req, actor) });
  }

  @Patch(':id')
  @Protected('iam.user.update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.updateUser.execute({ userId: id, displayName: dto.displayName, managerId: dto.managerId, actor: actorContextFrom(req, actor) });
  }

  @Post(':id/disable')
  @HttpCode(200)
  @Protected('iam.user.disable', { stepUp: true })
  disable(@Param('id', ParseUUIDPipe) id: string, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.setStatus.execute({ userId: id, enabled: false, actor: actorContextFrom(req, actor) });
  }

  @Post(':id/enable')
  @HttpCode(200)
  @Protected('iam.user.disable', { stepUp: true })
  enable(@Param('id', ParseUUIDPipe) id: string, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.setStatus.execute({ userId: id, enabled: true, actor: actorContextFrom(req, actor) });
  }

  /** Remplace les rôles. Interdit pour soi-même ; exige un MFA récent. */
  @Put(':id/roles')
  @Protected('iam.user.assign_role', { stepUp: true })
  roles(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignRolesDto, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.assignRoles.execute({ userId: id, roles: dto.roles, actor: actorContextFrom(req, actor) });
  }

  /** Perte du téléphone : supprime le secret et les codes de secours, révoque toutes les sessions. */
  @Post(':id/mfa/reset')
  @HttpCode(204)
  @Protected('iam.user.reset_mfa', { stepUp: true })
  async resetUserMfa(@Param('id', ParseUUIDPipe) id: string, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request): Promise<void> {
    await this.resetMfa.execute({ targetUserId: id, actor: actorContextFrom(req, actor) });
  }

  /** Agit sur n'importe quel utilisateur : exige la portée « Tous » dès la garde (la portée « propre » ne suffit pas). */
  @Post(':id/sessions/revoke')
  @HttpCode(200)
  @Protected('iam.session.revoke', { stepUp: true, minScope: 'ALL' })
  revokeAll(@Param('id', ParseUUIDPipe) id: string, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.revokeSessions.execute({ targetUserId: id, access, actor: actorContextFrom(req, actor) });
  }
}

@ApiTags('admin')
@Controller('admin/roles')
export class AdminRolesController {
  constructor(private readonly listRoles: ListRolesHandler) {}

  @Get()
  @Protected('iam.role.read')
  list(@Res({ passthrough: true }) res: Response) {
    noStore(res);
    return this.listRoles.execute();
  }
}

/** Mes sessions : je vois et je révoque les miennes (un SuperAdmin, en portée Tous, peut révoquer celles des autres). */
@ApiTags('auth')
@Controller('auth/sessions')
export class SessionsController {
  constructor(
    private readonly listOwn: ListOwnSessionsHandler,
    private readonly revoke: RevokeSessionUseCase,
  ) {}

  @Get()
  @Protected('iam.session.read')
  list(@CurrentActor() actor: AuthenticatedActor, @Res({ passthrough: true }) res: Response) {
    noStore(res);
    return this.listOwn.execute(actor);
  }

  @Delete(':id')
  @HttpCode(204)
  @Protected('iam.session.revoke')
  async revokeOne(@Param('id', ParseUUIDPipe) id: string, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request): Promise<void> {
    await this.revoke.execute({ sessionId: id, access, actor: actorContextFrom(req, actor) });
  }
}
