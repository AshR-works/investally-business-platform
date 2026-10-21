import { AuditRecord } from '../../src/modules/audit';
import { AcceptInvitationUseCase, InviteUserUseCase, ResendInvitationUseCase } from '../../src/modules/iam/application/admin/invitations.use-cases';
import { IssuePasswordResetUseCase, RequestPasswordResetUseCase, ResetPasswordUseCase } from '../../src/modules/iam/application/admin/password-reset.use-cases';
import { ListOwnSessionsHandler, RevokeOtherSessionsUseCase, RevokeSessionUseCase, RevokeUserSessionsUseCase } from '../../src/modules/iam/application/admin/session-management.use-cases';
import { AssignRolesUseCase, SetUserStatusUseCase, UpdateUserUseCase } from '../../src/modules/iam/application/admin/user-management.use-cases';
import { GetUserHandler, ListRolesHandler, ListUsersHandler } from '../../src/modules/iam/application/admin/user-queries';
import { AuthorizationService } from '../../src/modules/iam/application/authorization.service';
import { LogEmailSender } from '../../src/modules/notifications/infrastructure/log-email-sender';
import { AppConfig } from '../../src/shared-kernel';
import { ConfirmMfaEnrollmentUseCase, StartMfaEnrollmentUseCase } from '../../src/modules/iam/application/mfa-enrollment.use-cases';
import { RegenerateRecoveryCodesUseCase, ResetMfaUseCase } from '../../src/modules/iam/application/mfa-management.use-cases';
import { VerifyMfaUseCase } from '../../src/modules/iam/application/verify-mfa.use-case';
import { base32Decode } from '../../src/modules/iam/domain/base32';
import { totp } from '../../src/modules/iam/domain/totp';
import { AesGcmSecretCipher } from '../../src/modules/iam/infrastructure/aes-gcm-secret-cipher';
import { CryptoRecoveryCodeGenerator, CryptoTotpGenerator } from '../../src/modules/iam/infrastructure/crypto-generators';
import { AuthenticateAccessTokenUseCase } from '../../src/modules/iam/application/authenticate-access-token.use-case';
import { ChangePasswordUseCase } from '../../src/modules/iam/application/change-password.use-case';
import { CreateUserUseCase } from '../../src/modules/iam/application/create-user.use-case';
import { LoginUseCase } from '../../src/modules/iam/application/login.use-case';
import { LogoutUseCase } from '../../src/modules/iam/application/logout.use-case';
import { RefreshSessionUseCase } from '../../src/modules/iam/application/refresh-session.use-case';
import { SessionTokenService } from '../../src/modules/iam/application/session-token.service';
import { RoleCode } from '../../src/modules/iam/domain/roles';
import {
  FakeAccessTokens, FakeHasher, FakeRefreshFactory, InMemoryAttempts, InMemoryHistory, InMemoryRefreshTokens,
  FakeGrantReader, FakeRoleCatalog, InMemoryInvitations, InMemoryRecoveryCodes, InMemorySessions, InMemoryUsers, MutableClock,
  SequentialIds, actor,
} from './iam-fakes';

/** Assemble tous les cas d'usage d'authentification sur des faux en mémoire (aucune base, aucun réseau). */
export function buildIamWorld() {
  const users = new InMemoryUsers();
  const history = new InMemoryHistory();
  const sessions = new InMemorySessions();
  const refreshTokens = new InMemoryRefreshTokens();
  const attempts = new InMemoryAttempts();
  const recoveryCodes = new InMemoryRecoveryCodes();
  const cipher = new AesGcmSecretCipher(Buffer.alloc(32, 9));
  const totpGenerator = new CryptoTotpGenerator();
  const recoveryGenerator = new CryptoRecoveryCodeGenerator();
  const hasher = new FakeHasher();
  const accessTokens = new FakeAccessTokens();
  const refreshFactory = new FakeRefreshFactory();
  const clock = new MutableClock();
  const ids = new SequentialIds();
  const audit: AuditRecord[] = [];
  const auditRecorder = { record: async (r: AuditRecord) => { audit.push(r); } };
  const unitOfWork = { run: <T>(work: () => Promise<T>) => work() };

  const tokens = new SessionTokenService(accessTokens, refreshFactory, refreshTokens, ids);
  const createUser = new CreateUserUseCase(users, history, hasher, auditRecorder, unitOfWork, clock, ids);
  const login = new LoginUseCase(users, sessions, attempts, hasher, auditRecorder, unitOfWork, clock, ids, tokens);
  const refresh = new RefreshSessionUseCase(refreshTokens, sessions, users, refreshFactory, auditRecorder, unitOfWork, clock, tokens);
  const logout = new LogoutUseCase(sessions, refreshTokens, auditRecorder, unitOfWork, clock);
  const authenticate = new AuthenticateAccessTokenUseCase(accessTokens, sessions, users, clock);
  const changePassword = new ChangePasswordUseCase(users, history, sessions, refreshTokens, hasher, auditRecorder, unitOfWork, clock, ids);

  const startMfa = new StartMfaEnrollmentUseCase(users, totpGenerator, cipher, auditRecorder, unitOfWork, clock);
  const confirmMfa = new ConfirmMfaEnrollmentUseCase(users, sessions, attempts, recoveryCodes, recoveryGenerator, cipher, hasher, accessTokens, auditRecorder, unitOfWork, clock, ids);
  const verifyMfa = new VerifyMfaUseCase(users, sessions, attempts, recoveryCodes, cipher, hasher, accessTokens, auditRecorder, unitOfWork, clock, ids);
  const regenerateCodes = new RegenerateRecoveryCodesUseCase(sessions, users, recoveryCodes, recoveryGenerator, hasher, auditRecorder, unitOfWork, clock, ids);
  const resetMfa = new ResetMfaUseCase(users, sessions, refreshTokens, recoveryCodes, auditRecorder, unitOfWork, clock);

  /** Code TOTP valide à l'instant courant de l'horloge de test, pour un secret en base32. */
  const codeNow = (secretBase32: string) => totp(base32Decode(secretBase32), clock.now().getTime());

  const invitations = new InMemoryInvitations();
  const email = new LogEmailSender();
  const config = { publicUrl: 'https://crm.test' } as AppConfig;
  const authorization = new AuthorizationService(new FakeGrantReader(users), auditRecorder);
  const inviteUser = new InviteUserUseCase(users, invitations, refreshFactory, email, auditRecorder, unitOfWork, clock, ids, config);
  const resendInvitation = new ResendInvitationUseCase(users, invitations, refreshFactory, email, auditRecorder, unitOfWork, clock, ids, config);
  const acceptInvitation = new AcceptInvitationUseCase(users, invitations, history, refreshFactory, hasher, auditRecorder, unitOfWork, clock, ids);
  const requestPasswordReset = new RequestPasswordResetUseCase(users, invitations, refreshFactory, email, auditRecorder, unitOfWork, clock, ids, config);
  const issuePasswordReset = new IssuePasswordResetUseCase(users, invitations, refreshFactory, email, auditRecorder, unitOfWork, clock, ids, config);
  const resetPassword = new ResetPasswordUseCase(users, invitations, history, sessions, refreshTokens, refreshFactory, hasher, email, auditRecorder, unitOfWork, clock, ids);
  const updateUser = new UpdateUserUseCase(users, auditRecorder, unitOfWork);
  const setStatus = new SetUserStatusUseCase(users, sessions, refreshTokens, auditRecorder, unitOfWork, clock);
  const assignRoles = new AssignRolesUseCase(users, auditRecorder, unitOfWork);
  const listUsers = new ListUsersHandler(users);
  const getUser = new GetUserHandler(users);
  const listRoles = new ListRolesHandler(new FakeRoleCatalog());
  const listOwnSessions = new ListOwnSessionsHandler(sessions, clock);
  const revokeSession = new RevokeSessionUseCase(sessions, refreshTokens, auditRecorder, unitOfWork, clock);
  const revokeUserSessions = new RevokeUserSessionsUseCase(users, sessions, refreshTokens, auditRecorder, unitOfWork, clock);
  const revokeOtherSessions = new RevokeOtherSessionsUseCase(sessions, refreshTokens, auditRecorder, unitOfWork, clock);

  const PASSWORD = 'phrase de passe tres longue 42';
  async function createDefaultUser(roles: RoleCode[] = [RoleCode.AccountManager], email = 'marie@investally.test', password = PASSWORD) {
    return createUser.execute({ email, displayName: 'Marie Kamga', password, roles, actor: actor() });
  }

  return {
    users, history, sessions, refreshTokens, attempts, hasher, clock, ids, audit,
    createUser, login, refresh, logout, authenticate, changePassword, createDefaultUser, PASSWORD,
    recoveryCodes, cipher, startMfa, confirmMfa, verifyMfa, regenerateCodes, resetMfa, codeNow,
    requestPasswordReset, issuePasswordReset, resetPassword,
    invitations, email, authorization, inviteUser, resendInvitation, acceptInvitation, updateUser, setStatus, assignRoles,
    listUsers, getUser, listRoles, listOwnSessions, revokeSession, revokeUserSessions, revokeOtherSessions, refreshFactory,
  };
}
