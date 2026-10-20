import { Module } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../../shared-kernel';
import { AuditModule } from '../audit/audit.module';
import { AuthenticateAccessTokenUseCase } from './application/authenticate-access-token.use-case';
import { ChangePasswordUseCase } from './application/change-password.use-case';
import { CreateUserUseCase } from './application/create-user.use-case';
import { LoginUseCase } from './application/login.use-case';
import { LogoutUseCase } from './application/logout.use-case';
import { ACCESS_TOKEN_SERVICE, PASSWORD_HASHER, REFRESH_TOKEN_FACTORY } from './application/ports';
import { RefreshSessionUseCase } from './application/refresh-session.use-case';
import { SessionTokenService } from './application/session-token.service';
import {
  LOGIN_ATTEMPT_REPOSITORY, PASSWORD_HISTORY_REPOSITORY, REFRESH_TOKEN_REPOSITORY, SESSION_REPOSITORY, USER_REPOSITORY,
} from './domain/auth-repositories';
import { Argon2PasswordHasher } from './infrastructure/argon2-password-hasher';
import { Es256AccessTokenService } from './infrastructure/es256-access-token.service';
import { PrismaLoginAttemptRepository } from './infrastructure/prisma-login-attempt.repository';
import { PrismaPasswordHistoryRepository } from './infrastructure/prisma-password-history.repository';
import { PrismaRefreshTokenRepository } from './infrastructure/prisma-refresh-token.repository';
import { PrismaSessionRepository } from './infrastructure/prisma-session.repository';
import { PrismaUserRepository } from './infrastructure/prisma-user.repository';
import { Sha256RefreshTokenFactory } from './infrastructure/sha256-refresh-token-factory';
import { AccessTokenGuard } from './presentation/access-token.guard';
import { AuthController } from './presentation/auth.controller';

/** Composition root du module Identity & Access. */
@Module({
  imports: [AuditModule],
  controllers: [AuthController],
  providers: [
    CreateUserUseCase, LoginUseCase, RefreshSessionUseCase, LogoutUseCase, ChangePasswordUseCase,
    AuthenticateAccessTokenUseCase, SessionTokenService, AccessTokenGuard,
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
  exports: [AccessTokenGuard, AuthenticateAccessTokenUseCase, CreateUserUseCase],
})
export class IamModule {}
