import { Module } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../../shared-kernel';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AcceptInvitationUseCase, InviteUserUseCase, ResendInvitationUseCase } from './application/admin/invitations.use-cases';
import { ListOwnSessionsHandler, RevokeSessionUseCase, RevokeUserSessionsUseCase } from './application/admin/session-management.use-cases';
import { AssignRolesUseCase, SetUserStatusUseCase, UpdateUserUseCase } from './application/admin/user-management.use-cases';
import { GetUserHandler, ListRolesHandler, ListUsersHandler } from './application/admin/user-queries';
import { ROLE_CATALOG_READER } from './application/admin/user-view';
import { AuthenticateAccessTokenUseCase } from './application/authenticate-access-token.use-case';
import { GetProfileHandler } from './application/get-profile.handler';
import { AuthorizationService } from './application/authorization.service';
import { ChangePasswordUseCase } from './application/change-password.use-case';
import { ConfirmMfaEnrollmentUseCase, StartMfaEnrollmentUseCase } from './application/mfa-enrollment.use-cases';
import { RegenerateRecoveryCodesUseCase, ResetMfaUseCase } from './application/mfa-management.use-cases';
import { RECOVERY_CODE_GENERATOR, RECOVERY_CODE_REPOSITORY, SECRET_CIPHER, TOTP_GENERATOR } from './application/mfa-ports';
import { VerifyMfaUseCase } from './application/verify-mfa.use-case';
import { CreateUserUseCase } from './application/create-user.use-case';
import { LoginUseCase } from './application/login.use-case';
import { LogoutUseCase } from './application/logout.use-case';
import { ACCESS_TOKEN_SERVICE, INVITATION_TOKEN_FACTORY, PASSWORD_HASHER, REFRESH_TOKEN_FACTORY } from './application/ports';
import { RefreshSessionUseCase } from './application/refresh-session.use-case';
import { SessionTokenService } from './application/session-token.service';
import {
  GRANT_READER, INVITATION_REPOSITORY, LOGIN_ATTEMPT_REPOSITORY, PASSWORD_HISTORY_REPOSITORY, REFRESH_TOKEN_REPOSITORY,
  SESSION_REPOSITORY, USER_REPOSITORY,
} from './domain/auth-repositories';
import { AesGcmSecretCipher } from './infrastructure/aes-gcm-secret-cipher';
import { Argon2PasswordHasher } from './infrastructure/argon2-password-hasher';
import { CryptoRecoveryCodeGenerator, CryptoTotpGenerator } from './infrastructure/crypto-generators';
import { PrismaRecoveryCodeRepository } from './infrastructure/prisma-recovery-code.repository';
import { Es256AccessTokenService } from './infrastructure/es256-access-token.service';
import { PrismaGrantReader, PrismaRoleCatalogReader } from './infrastructure/prisma-grant-reader.repository';
import { PrismaInvitationRepository } from './infrastructure/prisma-invitation.repository';
import { PrismaLoginAttemptRepository } from './infrastructure/prisma-login-attempt.repository';
import { PrismaPasswordHistoryRepository } from './infrastructure/prisma-password-history.repository';
import { PrismaRefreshTokenRepository } from './infrastructure/prisma-refresh-token.repository';
import { PrismaSessionRepository } from './infrastructure/prisma-session.repository';
import { PrismaUserRepository } from './infrastructure/prisma-user.repository';
import { Sha256RefreshTokenFactory } from './infrastructure/sha256-refresh-token-factory';
import { AccessTokenGuard } from './presentation/access-token.guard';
import { AdminRolesController, AdminUsersController, SessionsController } from './presentation/admin.controllers';
import { AuthController } from './presentation/auth.controller';
import { PermissionGuard } from './presentation/protected.decorator';
import { RequireMfaGuard, RequireRecentMfaGuard } from './presentation/mfa.guards';

/** Composition root du module Identity & Access. */
@Module({
  imports: [AuditModule, NotificationsModule],
  controllers: [AuthController, AdminUsersController, AdminRolesController, SessionsController],
  providers: [
    CreateUserUseCase, LoginUseCase, RefreshSessionUseCase, LogoutUseCase, ChangePasswordUseCase,
    AuthenticateAccessTokenUseCase, SessionTokenService, AccessTokenGuard, RequireMfaGuard, RequireRecentMfaGuard,
    AuthorizationService, GetProfileHandler, PermissionGuard,
    InviteUserUseCase, ResendInvitationUseCase, AcceptInvitationUseCase, UpdateUserUseCase, SetUserStatusUseCase, AssignRolesUseCase,
    ListUsersHandler, GetUserHandler, ListRolesHandler, ListOwnSessionsHandler, RevokeSessionUseCase, RevokeUserSessionsUseCase,
    { provide: GRANT_READER, useClass: PrismaGrantReader },
    { provide: ROLE_CATALOG_READER, useClass: PrismaRoleCatalogReader },
    { provide: INVITATION_REPOSITORY, useClass: PrismaInvitationRepository },
    { provide: INVITATION_TOKEN_FACTORY, useClass: Sha256RefreshTokenFactory },
    StartMfaEnrollmentUseCase, ConfirmMfaEnrollmentUseCase, VerifyMfaUseCase, RegenerateRecoveryCodesUseCase, ResetMfaUseCase,
    { provide: RECOVERY_CODE_REPOSITORY, useClass: PrismaRecoveryCodeRepository },
    { provide: RECOVERY_CODE_GENERATOR, useClass: CryptoRecoveryCodeGenerator },
    { provide: TOTP_GENERATOR, useClass: CryptoTotpGenerator },
    { provide: SECRET_CIPHER, inject: [APP_CONFIG], useFactory: (config: AppConfig) => AesGcmSecretCipher.fromConfig(config) },
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: SESSION_REPOSITORY, useClass: PrismaSessionRepository },
    { provide: REFRESH_TOKEN_REPOSITORY, useClass: PrismaRefreshTokenRepository },
    { provide: LOGIN_ATTEMPT_REPOSITORY, useClass: PrismaLoginAttemptRepository },
    { provide: PASSWORD_HISTORY_REPOSITORY, useClass: PrismaPasswordHistoryRepository },
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
    { provide: REFRESH_TOKEN_FACTORY, useClass: Sha256RefreshTokenFactory },
    {
      provide: ACCESS_TOKEN_SERVICE,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => Es256AccessTokenService.create(config),
    },
  ],
  // S3.3 : les modules métier utiliseront ce garde et ce cas d'usage pour exiger une identité.
  // Les modules métier utilisent `@Protected(...)` : leurs contrôleurs ont besoin de ces gardes et de ce service.
  exports: [AccessTokenGuard, RequireMfaGuard, RequireRecentMfaGuard, PermissionGuard, AuthorizationService, AuthenticateAccessTokenUseCase, CreateUserUseCase, ResetMfaUseCase],
})
export class IamModule {}
