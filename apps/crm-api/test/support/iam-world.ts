import { AuditRecord } from '../../src/modules/audit';
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
  InMemorySessions, InMemoryUsers, MutableClock, SequentialIds, actor,
} from './iam-fakes';

/** Assemble tous les cas d'usage d'authentification sur des faux en mémoire (aucune base, aucun réseau). */
export function buildIamWorld() {
  const users = new InMemoryUsers();
  const history = new InMemoryHistory();
  const sessions = new InMemorySessions();
  const refreshTokens = new InMemoryRefreshTokens();
  const attempts = new InMemoryAttempts();
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

  const PASSWORD = 'phrase de passe tres longue 42';
  async function createDefaultUser(roles: RoleCode[] = [RoleCode.AccountManager], email = 'marie@investally.test', password = PASSWORD) {
    return createUser.execute({ email, displayName: 'Marie Kamga', password, roles, actor: actor() });
  }

  return {
    users, history, sessions, refreshTokens, attempts, hasher, clock, ids, audit,
    createUser, login, refresh, logout, authenticate, changePassword, createDefaultUser, PASSWORD,
  };
}
