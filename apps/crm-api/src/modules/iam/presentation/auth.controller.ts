import { Body, Controller, Get, HttpCode, Inject, Logger, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import { APP_CONFIG, AppConfig, DomainError, actorContextFrom } from '../../../shared-kernel';
import { AuthenticatedActor } from '../application/authenticate-access-token.use-case';
import { GetProfileHandler } from '../application/get-profile.handler';
import { AcceptInvitationUseCase } from '../application/admin/invitations.use-cases';
import { RequestPasswordResetUseCase, ResetPasswordUseCase } from '../application/admin/password-reset.use-cases';
import { ChangePasswordUseCase } from '../application/change-password.use-case';
import { ConfirmMfaEnrollmentUseCase, StartMfaEnrollmentUseCase } from '../application/mfa-enrollment.use-cases';
import { RegenerateRecoveryCodesUseCase } from '../application/mfa-management.use-cases';
import { VerifyMfaUseCase } from '../application/verify-mfa.use-case';
import { LoginUseCase } from '../application/login.use-case';
import { LogoutUseCase } from '../application/logout.use-case';
import { RefreshSessionUseCase } from '../application/refresh-session.use-case';
import { AccessTokenGuard, CurrentActor } from './access-token.guard';
import { AcceptInvitationDto, RequestPasswordResetDto, ResetPasswordDto } from './dto/admin.dto';
import { ChangePasswordDto, LoginDto, MfaCodeDto } from './dto/auth.dto';
import { RequireRecentMfaGuard } from './mfa.guards';

export const REFRESH_COOKIE = 'crm_refresh';
const AUTH_PATH = '/api/v1/auth';

/** 5 tentatives de connexion par minute et par couple IP + e-mail (SECURITY.md §2.4). */
const LOGIN_LIMIT = { default: { limit: 5, ttl: 60_000 } };
/** 5 vérifications MFA par minute et par session (le verrouillage du compte est la vraie protection contre la force brute). */
const MFA_LIMIT = { default: { limit: 5, ttl: 60_000 } };
/** 10 tentatives d'activation par minute et par IP (les jetons de 256 bits ne se devinent pas ; limite contre l'abus). */
const INVITATION_LIMIT = { default: { limit: 10, ttl: 60_000 } };
/** 3 demandes de « mot de passe oublié » par minute et par couple IP + adresse ; le plafond par compte (3/heure) est dans le cas d'usage. */
const RESET_REQUEST_LIMIT = { default: { limit: 3, ttl: 60_000 } };
/** Réponse unique, identique que le compte existe ou non. */
const RESET_REQUEST_ANSWER = { message: "Si un compte correspond à cette adresse, un e-mail contenant un lien de réinitialisation vient d'être envoyé." };

/**
 * Routes d'authentification : connexion, rafraîchissement, déconnexion, MFA, mot de passe oublié, activation
 * d'invitation, profil. Le jeton de rafraîchissement n'existe que dans un cookie HttpOnly.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshUseCase: RefreshSessionUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly changePasswordUseCase: ChangePasswordUseCase,
    private readonly startMfaUseCase: StartMfaEnrollmentUseCase,
    private readonly confirmMfaUseCase: ConfirmMfaEnrollmentUseCase,
    private readonly verifyMfaUseCase: VerifyMfaUseCase,
    private readonly regenerateCodesUseCase: RegenerateRecoveryCodesUseCase,
    private readonly acceptInvitationUseCase: AcceptInvitationUseCase,
    private readonly profileHandler: GetProfileHandler,
    private readonly requestResetUseCase: RequestPasswordResetUseCase,
    private readonly resetPasswordUseCase: ResetPasswordUseCase,
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
      mfaEnrolled: result.mfaEnrolled,
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
    return { userId: actor.userId, sessionId: actor.sessionId, mfaVerified: actor.mfaVerified, hasFreshMfa: actor.hasFreshMfa };
  }

  /** Profil et droits de l'utilisateur connecté, pour construire l'interface (le serveur re-contrôle chaque requête). */
  @Get('me/profile')
  @UseGuards(AccessTokenGuard)
  profile(@CurrentActor() actor: AuthenticatedActor, @Res({ passthrough: true }) res: Response) {
    noStore(res);
    return this.profileHandler.execute(actor.userId);
  }

  /** Démarre l'enrôlement : renvoie le secret (affiché une seule fois) et l'URI à transformer en QR code. */
  @Post('mfa/enroll/start')
  @HttpCode(200)
  @UseGuards(AccessTokenGuard)
  async startMfa(@CurrentActor() actor: AuthenticatedActor, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.assertAllowedOrigin(req);
    noStore(res);
    return this.startMfaUseCase.execute({ userId: actor.userId, sessionId: actor.sessionId, actor: actorContextFrom(req, actor) });
  }

  /** Confirme l'enrôlement avec le premier code : renvoie les codes de secours (UNE seule fois) et un jeton vérifié par MFA. */
  @Post('mfa/enroll/confirm')
  @HttpCode(200)
  @Throttle(MFA_LIMIT)
  @UseGuards(AccessTokenGuard)
  async confirmMfa(@Body() dto: MfaCodeDto, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.assertAllowedOrigin(req);
    noStore(res);
    return this.confirmMfaUseCase.execute({ userId: actor.userId, sessionId: actor.sessionId, code: dto.code, actor: actorContextFrom(req, actor) });
  }

  /** Vérifie le second facteur (code TOTP ou code de secours) : à la connexion, et pour un step-up. */
  @Post('mfa/verify')
  @HttpCode(200)
  @Throttle(MFA_LIMIT)
  @UseGuards(AccessTokenGuard)
  async verifyMfa(@Body() dto: MfaCodeDto, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.assertAllowedOrigin(req);
    noStore(res);
    return this.verifyMfaUseCase.execute({ userId: actor.userId, sessionId: actor.sessionId, code: dto.code, actor: actorContextFrom(req, actor) });
  }

  /** Régénère les 10 codes de secours ; exige un MFA vérifié depuis moins de 10 minutes. */
  @Post('mfa/recovery-codes/regenerate')
  @HttpCode(200)
  @UseGuards(AccessTokenGuard, RequireRecentMfaGuard)
  async regenerateRecoveryCodes(@CurrentActor() actor: AuthenticatedActor, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.assertAllowedOrigin(req);
    noStore(res);
    return this.regenerateCodesUseCase.execute({ userId: actor.userId, sessionId: actor.sessionId, actor: actorContextFrom(req, actor) });
  }

  /**
   * Activation d'un compte invité : l'utilisateur choisit son mot de passe avec le jeton du lien (fragment d'URL).
   * Public (il n'a pas encore de compte actif) ; tout lien non valide produit le même refus.
   */
  @Post('invitation/accept')
  @HttpCode(204)
  @Throttle(INVITATION_LIMIT)
  async acceptInvitation(@Body() dto: AcceptInvitationDto, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    this.assertAllowedOrigin(req);
    noStore(res);
    await this.acceptInvitationUseCase.execute({ token: dto.token, password: dto.password, actor: actorContextFrom(req) });
  }

  /**
   * « Mot de passe oublié » (public). Répond TOUJOURS la même chose, tout de suite : le traitement (recherche du compte,
   * envoi de l'e-mail) se poursuit après la réponse, donc ni le contenu ni le temps de réponse ne révèlent si l'adresse
   * existe. Chaque demande est auditée par le cas d'usage.
   */
  @Post('password-reset/request')
  @HttpCode(202)
  @Throttle(RESET_REQUEST_LIMIT)
  requestPasswordReset(@Body() dto: RequestPasswordResetDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.assertAllowedOrigin(req);
    noStore(res);
    this.requestResetUseCase
      .execute({ email: dto.email, actor: actorContextFrom(req) })
      .catch((error: unknown) => this.logger.error(`Demande de réinitialisation en échec : ${error instanceof Error ? error.name : 'erreur inconnue'}`));
    return RESET_REQUEST_ANSWER;
  }

  /** Choix du nouveau mot de passe avec le lien reçu (public) ; tout lien non valide produit le même refus. */
  @Post('password-reset/accept')
  @HttpCode(204)
  @Throttle(INVITATION_LIMIT)
  async acceptPasswordReset(@Body() dto: ResetPasswordDto, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    this.assertAllowedOrigin(req);
    noStore(res);
    await this.resetPasswordUseCase.execute({ token: dto.token, password: dto.password, actor: actorContextFrom(req) });
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

  /**
   * Options du cookie de rafraîchissement : HttpOnly, SameSite=Strict, Secure en production, limité au chemin
   * d'authentification.
   */
  private cookieOptions(): CookieOptions {
    return { httpOnly: true, secure: this.config.cookieSecure, sameSite: 'strict', path: AUTH_PATH };
  }

  /** Pose le cookie de rafraîchissement avec son échéance. */
  private setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
    res.cookie(REFRESH_COOKIE, token, { ...this.cookieOptions(), expires: expiresAt });
  }

  /** Efface le cookie de rafraîchissement (déconnexion ou jeton refusé). */
  private clearRefreshCookie(res: Response): void {
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
  }
}

/** Les réponses d'authentification ne doivent jamais être mises en cache (jetons, identités). */
function noStore(res: Response): void {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
}
