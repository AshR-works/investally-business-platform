import 'reflect-metadata';
import { AuditAction } from '../src/modules/audit';
import { ConfirmMfaEnrollmentUseCase, StartMfaEnrollmentUseCase } from '../src/modules/iam/application/mfa-enrollment.use-cases';
import { RegenerateRecoveryCodesUseCase, ResetMfaUseCase } from '../src/modules/iam/application/mfa-management.use-cases';
import { RECOVERY_CODE_REPOSITORY, RecoveryCodeRepository, SECRET_CIPHER, SecretCipher } from '../src/modules/iam/application/mfa-ports';
import { CreateUserUseCase } from '../src/modules/iam/application/create-user.use-case';
import { LoginUseCase } from '../src/modules/iam/application/login.use-case';
import { VerifyMfaUseCase } from '../src/modules/iam/application/verify-mfa.use-case';
import { base32Decode } from '../src/modules/iam/domain/base32';
import { RoleCode } from '../src/modules/iam/domain/roles';
import { hotp, timeStepOf, totp } from '../src/modules/iam/domain/totp';
import { SYSTEM_ACTOR, TEST_PASSWORD, TestApp, startTestApp, uniqueEmail } from './support/test-app';

const describeDb = process.env.DATABASE_URL && process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;
const STEP_MS = 30_000;

/** MFA sur la vraie base : chiffrement AES-GCM réel, argon2id réel, verrous de ligne réels. */
describeDb('MFA (PostgreSQL)', () => {
  let t: TestApp;
  let createUser: CreateUserUseCase;
  let login: LoginUseCase;
  let start: StartMfaEnrollmentUseCase;
  let confirm: ConfirmMfaEnrollmentUseCase;
  let verify: VerifyMfaUseCase;
  let regenerate: RegenerateRecoveryCodesUseCase;
  let reset: ResetMfaUseCase;
  let cipher: SecretCipher;
  let recoveryRepo: RecoveryCodeRepository;

  beforeAll(async () => {
    t = await startTestApp();
    createUser = t.get(CreateUserUseCase);
    login = t.get(LoginUseCase);
    start = t.get(StartMfaEnrollmentUseCase);
    confirm = t.get(ConfirmMfaEnrollmentUseCase);
    verify = t.get(VerifyMfaUseCase);
    regenerate = t.get(RegenerateRecoveryCodesUseCase);
    reset = t.get(ResetMfaUseCase);
    cipher = t.get(SECRET_CIPHER as never);
    recoveryRepo = t.get(RECOVERY_CODE_REPOSITORY as never);
  }, 60_000);
  afterAll(() => t.close());

  const actorFor = (userId: string | null = null, sessionId: string | null = null, device = 'Navigateur A') => ({ ...SYSTEM_ACTOR, userId, sessionId, device });

  async function newUser(roles: RoleCode[] = [RoleCode.AccountManager]) {
    const email = uniqueEmail('mfa');
    const { id } = await createUser.execute({ email, displayName: 'Utilisateur Mfa', password: TEST_PASSWORD, roles, actor: SYSTEM_ACTOR });
    return { id, email };
  }
  async function session(email: string, id: string, device = 'Navigateur A') {
    const s = await login.execute({ email, password: TEST_PASSWORD, actor: actorFor(null, null, device) });
    return { sessionId: s.sessionId, ctx: { userId: id, sessionId: s.sessionId, actor: actorFor(id, s.sessionId, device) } };
  }
  /** Code valide pour le pas de temps COURANT + `offset` (la fenêtre accepte ±1). */
  const codeAt = (secret: string, offset = 0) => totp(base32Decode(secret), Date.now() + offset * STEP_MS);

  /** Enrôle l'utilisateur ; le code de confirmation consomme le pas de temps COURANT. */
  async function enrolled() {
    const { id, email } = await newUser();
    const s = await session(email, id);
    const { secret } = await start.execute(s.ctx);
    const { recoveryCodes } = await confirm.execute({ ...s.ctx, code: codeAt(secret) });
    return { id, email, secret, recoveryCodes, first: s };
  }
  const auditOf = (entityId: string) => t.prisma.db.auditLog.findMany({ where: { entityId } });

  describe('secret TOTP au repos (C2, C3)', () => {
    it('est stocké chiffré : jamais en clair en base, dans l\'audit ni dans les tentatives', async () => {
      const { id, email } = await newUser();
      const s = await session(email, id);
      const { secret } = await start.execute(s.ctx);
      const row = await t.prisma.db.user.findUniqueOrThrow({ where: { id } });

      expect(row.mfaEnabled).toBe(false);
      expect(row.mfaSecretEnc).toMatch(/^v1\./);
      expect(row.mfaSecretEnc).not.toContain(secret);
      expect(cipher.decrypt(row.mfaSecretEnc!, id)).toBe(secret);
      expect(() => cipher.decrypt(row.mfaSecretEnc!, '00000000-0000-7000-8000-000000000000')).toThrow();

      // Aucune trace du secret dans aucune table qui pourrait le recevoir
      const everywhere = JSON.stringify([
        await t.prisma.db.auditLog.findMany({ where: { userId: id } }),
        await t.prisma.db.loginAttempt.findMany({ where: { userId: id } }),
        await t.prisma.db.userSession.findMany({ where: { userId: id } }),
      ]);
      expect(everywhere).not.toContain(secret);
    });

    it("la base refuse un MFA activé sans secret, et un pas de temps négatif (contraintes CHECK)", async () => {
      const { id } = await newUser();
      await expect(t.prisma.db.$executeRaw`UPDATE iam.users SET mfa_enabled = true WHERE id = ${id}::uuid`).rejects.toThrow(/users_mfa_enabled_has_secret|check constraint/i);
      await expect(t.prisma.db.$executeRaw`UPDATE iam.users SET mfa_last_used_step = -1 WHERE id = ${id}::uuid`).rejects.toThrow(/users_mfa_step_nonneg|check constraint/i);
    });

    it('un secret copié sur un autre compte est inutilisable (liaison à l\'utilisateur)', async () => {
      const victim = await enrolled();
      const attacker = await newUser();
      const stolen = (await t.prisma.db.user.findUniqueOrThrow({ where: { id: victim.id } })).mfaSecretEnc!;
      // L'attaquant, administrateur de base de données, recopie le chiffré de la victime sur son propre compte…
      await t.prisma.db.$executeRaw`UPDATE iam.users SET mfa_secret_enc = ${stolen}, mfa_enabled = true WHERE id = ${attacker.id}::uuid`;
      const s = await session(attacker.email, attacker.id);
      // … la vérification échoue : le déchiffrement est lié à l'identifiant d'utilisateur.
      await expect(verify.execute({ ...s.ctx, code: codeAt(victim.secret) })).rejects.toBeDefined();
      expect((await t.prisma.db.user.findUniqueOrThrow({ where: { id: attacker.id } })).mfaLastUsedStep).toBeNull();
    });
  });

  describe('enrôlement', () => {
    it('active le MFA, délivre 10 codes de secours HACHÉS et marque la session vérifiée', async () => {
      const { id, recoveryCodes, first } = await enrolled();
      const row = await t.prisma.db.user.findUniqueOrThrow({ where: { id } });
      expect(row.mfaEnabled).toBe(true);
      expect(row.mfaLastUsedStep).not.toBeNull();

      const stored = await t.prisma.db.mfaRecoveryCode.findMany({ where: { userId: id } });
      expect(stored).toHaveLength(10);
      for (const code of stored) expect(code.codeHash).toMatch(/^\$argon2id\$/);
      const plain = recoveryCodes.map((c) => c.replace('-', ''));
      expect(JSON.stringify(stored)).not.toMatch(new RegExp(plain.join('|')));

      const sessionRow = await t.prisma.db.userSession.findUniqueOrThrow({ where: { id: first.sessionId } });
      expect(sessionRow.mfaVerified).toBe(true);
      expect(Math.abs(sessionRow.mfaVerifiedAt!.getTime() - Date.now())).toBeLessThan(15_000);
      const trail = JSON.stringify(await auditOf(id));
      for (const code of plain) expect(trail).not.toContain(code);
    });

    it('deux confirmations SIMULTANÉES avec le même code : un seul jeu de codes de secours, une seule réussit', async () => {
      const { id, email } = await newUser();
      const a = await session(email, id);
      const b = await session(email, id, 'Navigateur B');
      const { secret } = await start.execute(a.ctx);
      const code = codeAt(secret);

      const results = await Promise.allSettled([confirm.execute({ ...a.ctx, code }), confirm.execute({ ...b.ctx, code })]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(await t.prisma.db.mfaRecoveryCode.count({ where: { userId: id } })).toBe(10);
    }, 60_000);
  });

  describe('vérification et rejeu (C5)', () => {
    it('le même code TOTP, présenté en même temps depuis deux sessions : UNE seule réussit', async () => {
      const { id, email, secret } = await enrolled();
      const a = await session(email, id);
      const b = await session(email, id, 'Navigateur B');
      const computedAt = Date.now();
      const code = totp(base32Decode(secret), computedAt + STEP_MS); // pas suivant : valable (fenêtre ±1) et jamais utilisé

      const results = await Promise.allSettled([verify.execute({ ...a.ctx, code }), verify.execute({ ...b.ctx, code })]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const row = await t.prisma.db.user.findUniqueOrThrow({ where: { id } });
      expect(Number(row.mfaLastUsedStep)).toBe(timeStepOf(computedAt) + 1);
    }, 60_000);

    it('un code déjà utilisé (même pas), ou d\'un pas antérieur, est refusé ; un pas postérieur est accepté', async () => {
      const { id, email, secret } = await enrolled();
      // Déterministe : on part du pas RÉELLEMENT consommé par la confirmation, lu en base (pas de dépendance à l'horloge).
      const used = Number((await t.prisma.db.user.findUniqueOrThrow({ where: { id } })).mfaLastUsedStep);
      const raw = base32Decode(secret);
      const s = await session(email, id);

      await expect(verify.execute({ ...s.ctx, code: hotp(raw, used) })).rejects.toMatchObject({ code: 'UNAUTHENTICATED' }); // même pas : rejeu
      await expect(verify.execute({ ...s.ctx, code: hotp(raw, used - 1) })).rejects.toMatchObject({ code: 'UNAUTHENTICATED' }); // pas antérieur
      await expect(verify.execute({ ...s.ctx, code: hotp(raw, used + 1) })).resolves.toBeDefined(); // pas suivant, dans la fenêtre
    });

    it('les échecs MFA verrouillent le compte (compteur et verrou persistés) et sont audités', async () => {
      const { id, email } = await enrolled();
      const s = await session(email, id);
      for (let i = 0; i < 5; i++) await expect(verify.execute({ ...s.ctx, code: '000000' })).rejects.toMatchObject({ message: 'Code invalide' });

      const row = await t.prisma.db.user.findUniqueOrThrow({ where: { id } });
      expect(row.failedLoginCount).toBe(5);
      expect(row.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
      expect(await t.prisma.db.loginAttempt.count({ where: { userId: id, outcome: 'MFA_FAILED' } })).toBe(5);
      expect((await auditOf(id)).filter((a) => a.action === AuditAction.LoginFailed).length).toBeGreaterThanOrEqual(5);
    }, 60_000);

    it('12 vérifications fausses PARALLÈLES : aucun échec perdu, compte verrouillé', async () => {
      const { id, email } = await enrolled();
      const s = await session(email, id);
      await Promise.all(Array.from({ length: 12 }, () => verify.execute({ ...s.ctx, code: '111111' }).catch(() => undefined)));
      const row = await t.prisma.db.user.findUniqueOrThrow({ where: { id } });
      expect(row.failedLoginCount).toBeGreaterThanOrEqual(5);
      expect(row.lockedUntil).not.toBeNull();
      expect(await t.prisma.db.loginAttempt.count({ where: { userId: id, outcome: 'MFA_FAILED' } })).toBe(12);
    }, 60_000);
  });

  describe('codes de secours (C4)', () => {
    it('un code de secours connecte une fois ; le même code utilisé en SIMULTANÉ depuis deux sessions : une seule réussit', async () => {
      const { id, email, recoveryCodes } = await enrolled();
      const a = await session(email, id);
      const b = await session(email, id, 'Navigateur B');
      const code = recoveryCodes[3];

      const results = await Promise.allSettled([verify.execute({ ...a.ctx, code }), verify.execute({ ...b.ctx, code })]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(await recoveryRepo.countUnused(id)).toBe(9);
      const used = await t.prisma.db.mfaRecoveryCode.count({ where: { userId: id, usedAt: { not: null } } });
      expect(used).toBe(1);
    }, 60_000);

    it('la consommation du dépôt est atomique à elle seule (deux appels directs, un seul vrai)', async () => {
      const { id } = await enrolled();
      const [one] = await recoveryRepo.listUnused(id);
      const results = await Promise.all([recoveryRepo.consume(one.id, new Date()), recoveryRepo.consume(one.id, new Date())]);
      expect(results.filter(Boolean)).toHaveLength(1);
    });

    it('un code de secours régénéré remplace TOUS les anciens (invalides immédiatement)', async () => {
      const { id, email, recoveryCodes, first } = await enrolled();
      const fresh = await regenerate.execute(first.ctx);
      expect(fresh.recoveryCodes.some((c) => recoveryCodes.includes(c))).toBe(false);
      expect(await t.prisma.db.mfaRecoveryCode.count({ where: { userId: id } })).toBe(10);

      const s = await session(email, id);
      await expect(verify.execute({ ...s.ctx, code: recoveryCodes[0] })).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
      await expect(verify.execute({ ...s.ctx, code: fresh.recoveryCodes[0] })).resolves.toMatchObject({ recoveryCodesRemaining: 9 });
    });
  });

  describe('step-up', () => {
    it('la régénération exige un MFA récent : refusée si la vérification date de plus de 10 minutes', async () => {
      const { first } = await enrolled();
      await t.prisma.db.userSession.update({ where: { id: first.sessionId }, data: { mfaVerifiedAt: new Date(Date.now() - 11 * 60_000) } });
      await expect(regenerate.execute(first.ctx)).rejects.toMatchObject({ code: 'MFA_STEP_UP_REQUIRED' });
    });
  });

  describe('réinitialisation par un administrateur', () => {
    it('supprime secret et codes en base, révoque toutes les sessions, audite ; auto-réinitialisation interdite', async () => {
      const victim = await enrolled();
      const second = await session(victim.email, victim.id, 'Navigateur B');
      const admin = await newUser([RoleCode.SuperAdmin]);

      await expect(reset.execute({ targetUserId: admin.id, actor: actorFor(admin.id) })).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await reset.execute({ targetUserId: victim.id, actor: actorFor(admin.id) });

      const row = await t.prisma.db.user.findUniqueOrThrow({ where: { id: victim.id } });
      expect(row).toMatchObject({ mfaEnabled: false, mfaSecretEnc: null, mfaLastUsedStep: null });
      expect(await t.prisma.db.mfaRecoveryCode.count({ where: { userId: victim.id } })).toBe(0);
      for (const sessionId of [victim.first.sessionId, second.sessionId]) {
        expect((await t.prisma.db.userSession.findUniqueOrThrow({ where: { id: sessionId } })).revokedAt).not.toBeNull();
      }
      expect(await t.prisma.db.refreshToken.count({ where: { sessionId: { in: [victim.first.sessionId, second.sessionId] }, revokedAt: null } })).toBe(0);
      const event = (await auditOf(victim.id)).find((a) => (a.newValue as { event?: string } | null)?.event === 'reset_by_administrator')!;
      expect(event).toMatchObject({ userId: admin.id, action: AuditAction.MfaChange });
    }, 60_000);
  });

  describe('premier SuperAdmin (C6)', () => {
    it('crée un compte SUPER_ADMIN : rôle attribué, hachage argon2id, mot de passe nulle part en clair, audit', async () => {
      const email = uniqueEmail('superadmin');
      const password = 'cheval agrafeuse nuage lointain 73'; // ne contient ni l'e-mail ni un mot du nom affiché
      const created = await createUser.execute({
        email, displayName: 'Administrateur Principal', password, roles: [RoleCode.SuperAdmin],
        actor: { userId: null, sessionId: null, ipAddress: 'cli', device: 'cli:admin:create' },
      });

      const roles = await t.prisma.db.userRole.findMany({ where: { userId: created.id }, include: { role: true } });
      expect(roles.map((r) => r.role.code)).toEqual(['SUPER_ADMIN']);
      expect(roles[0].role.mfaRequired).toBe(true);
      const row = await t.prisma.db.user.findUniqueOrThrow({ where: { id: created.id } });
      expect(row.passwordHash).toMatch(/^\$argon2id\$/);
      expect(row.mfaEnabled).toBe(false); // à enrôler à la première connexion
      const everywhere = JSON.stringify([row, await auditOf(created.id), await t.prisma.db.passwordHistory.findMany({ where: { userId: created.id } })]);
      expect(everywhere).not.toContain(password);
      expect((await auditOf(created.id))[0]).toMatchObject({ ipAddress: 'cli', device: 'cli:admin:create', action: AuditAction.Create });
    });

    it('refuse un mot de passe faible pour le SuperAdmin comme pour les autres', async () => {
      await expect(
        createUser.execute({ email: uniqueEmail('faible'), displayName: 'Admin', password: 'password1234', roles: [RoleCode.SuperAdmin], actor: SYSTEM_ACTOR }),
      ).rejects.toMatchObject({ code: 'VALIDATION' });
    });
  });
});
