import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import { APP_CONFIG, AppConfig, DomainError, actorContextFrom } from '../../../shared-kernel';
import { AuthenticatedActor } from '../application/authenticate-access-token.use-case';
import { ChangePasswordUseCase } from '../application/change-password.use-case';
import { LoginUseCase } from '../application/login.use-case';
import { LogoutUseCase } from '../application/logout.use-case';
import { RefreshSessionUseCase } from '../application/refresh-session.use-case';
import { AccessTokenGuard, CurrentActor } from './access-token.guard';
import { ChangePasswordDto, LoginDto } from './dto/auth.dto';

export const REFRESH_COOKIE = 'crm_refresh';
const AUTH_PATH = '/api/v1/auth';

/** 5 tentatives de connexion par minute et par couple IP + e-mail (SECURITY.md §2.4). */
const LOGIN_LIMIT = { default: { limit: 5, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshUseCase: RefreshSessionUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly changePasswordUseCase: ChangePasswordUseCase,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Post('login')
  @HttpCode(200)
  @Throttle(LOGIN_LIMIT)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.assertAllowedOrigin(req);
    noStore(res);
    const result = await this.loginUseCase.execute({ email: dto.email, password: dto.password, actor: actorContextFrom(req) });
    this.setRefreshCookie(res, result.refreshToken, result.refreshTokenExpiresAt);
    // Le jeton de rafraîchissement n'est JAMAIS dans le corps : uniquement dans le cookie HttpOnly.
    return {
      accessToken: result.accessToken,
      accessTokenExpiresAt: result.accessTokenExpiresAt,
      userId: result.userId,
      sessionId: result.sessionId,
      riskLevel: result.riskLevel,
      mfaRequired: result.mfaRequired,
      mfaVerified: result.mfaVerified,
    };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.assertAllowedOrigin(req);
    noStore(res);
    const cookie = (req.cookies as Record<string, unknown> | undefined)?.[REFRESH_COOKIE];
    if (typeof cookie !== 'string' || cookie.length === 0 || cookie.length > 512) {
      throw new DomainError('UNAUTHENTICATED', 'Session invalide ou expirée');
    }
    try {
      const result = await this.refreshUseCase.execute({ refreshToken: cookie, actor: actorContextFrom(req) });
      this.setRefreshCookie(res, result.refreshToken, result.refreshTokenExpiresAt);
      return { accessToken: result.accessToken, accessTokenExpiresAt: result.accessTokenExpiresAt, userId: result.userId, sessionId: result.sessionId };
    } catch (error) {
      if (error instanceof DomainError && error.code === 'UNAUTHENTICATED') this.clearRefreshCookie(res);
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(AccessTokenGuard)
  async logout(@CurrentActor() actor: AuthenticatedActor, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    this.assertAllowedOrigin(req);
    noStore(res);
    await this.logoutUseCase.execute({ sessionId: actor.sessionId, actor: actorContextFrom(req, actor) });
    this.clearRefreshCookie(res);
  }

  @Get('me')
  @UseGuards(AccessTokenGuard)
  me(@CurrentActor() actor: AuthenticatedActor, @Res({ passthrough: true }) res: Response) {
    noStore(res);
    return { userId: actor.userId, sessionId: actor.sessionId, mfaVerified: actor.mfaVerified };
  }

  @Post('change-password')
  @HttpCode(204)
  @UseGuards(AccessTokenGuard)
  async changePassword(@Body() dto: ChangePasswordDto, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    this.assertAllowedOrigin(req);
    noStore(res);
    await this.changePasswordUseCase.execute({
      userId: actor.userId,
      sessionId: actor.sessionId,
      currentPassword: dto.currentPassword,
      newPassword: dto.newPassword,
      actor: actorContextFrom(req, actor),
    });
  }

  /**
   * Défense CSRF en plus de `SameSite=Strict` : une requête navigateur dont l'en-tête Origin n'est pas
   * autorisé est refusée. Les clients non navigateur n'envoient pas d'Origin (ils ne sont pas exposés au CSRF).
   */
  private assertAllowedOrigin(req: Request): void {
    const origin = req.headers.origin;
    if (origin && !this.config.allowedOrigins.includes(origin)) {
      throw new DomainError('FORBIDDEN', 'Origine non autorisée');
    }
  }

  private cookieOptions(): CookieOptions {
    return { httpOnly: true, secure: this.config.cookieSecure, sameSite: 'strict', path: AUTH_PATH };
  }

  private setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
    res.cookie(REFRESH_COOKIE, token, { ...this.cookieOptions(), expires: expiresAt });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
  }
}

/** Les réponses d'authentification ne doivent jamais être mises en cache (jetons, identités). */
function noStore(res: Response): void {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
}
