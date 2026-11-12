import { AuditAction } from '../src/modules/audit';
import { LoginOutcome } from '../src/modules/iam/domain/auth-repositories';
import { RoleCode } from '../src/modules/iam/domain/roles';
import { actor } from './support/iam-fakes';
import { buildIamWorld } from './support/iam-world';

const EMAIL = 'marie@investally.test';
const MINUTE = 60_000;
type World = ReturnType<typeof buildIamWorld>;

/** Utilisateur connecté (mot de passe seul), prêt à s'enrôler. */
async function loggedIn(roles: RoleCode[] = [RoleCode.AccountManager]) {
  const w = buildIamWorld();
  const { id } = await w.createDefaultUser(roles);
  const session = await w.login.execute({ email: EMAIL, password: w.PASSWORD, actor: actor() });
  const ctx = { userId: id, sessionId: session.sessionId, actor: actor({ userId: id, sessionId: session.sessionId }) };
  return { w, id, session, ctx };
}

/** Parcours complet jusqu'à un MFA activé et vérifié. */
async function enrolled() {
  const base = await loggedIn();
  const start = await base.w.startMfa.execute(base.ctx);
  base.w.clock.advance(1_000);
  const confirmed = await base.w.confirmMfa.execute({ ...base.ctx, code: base.w.codeNow(start.secret) });
  return { ...base, secret: start.secret, recoveryCodes: confirmed.recoveryCodes, confirmed };
}

/** Nouvelle connexion du même utilisateur (nouvelle session, MFA non vérifié). */
async function relogin(w: World, id: string) {
  w.clock.advance(31_000); // pas de temps TOTP différent du précédent
  const session = await w.login.execute({ email: EMAIL, password: w.PASSWORD, actor: actor() });
  return { session, ctx: { userId: id, sessionId: session.sessionId, actor: actor({ userId: id, sessionId: session.sessionId }) } };
}

describe('Enrôlement (B1, B2)', () => {
  it("B1 — stocke le secret CHIFFRÉ, lié à l'utilisateur ; le MFA n'est pas encore actif ; l'audit ne contient jamais le secret", async () => {
    const { w, id, ctx } = await loggedIn();
    const start = await w.startMfa.execute(ctx);

    expect(start.secret).toMatch(/^[A-Z2-7]{32}$/); // 160 bits en base32
    expect(start.otpauthUri).toContain(`secret=${start.secret}`);
    expect(start.otpauthUri).toContain('issuer=Investally+CRM');

    const user = w.users.items.get(id)!;
    expect(user.mfaEnabled).toBe(false);
    expect(user.mfaSecretEnc).toMatch(/^v1\./);
    expect(user.mfaSecretEnc).not.toContain(start.secret);
    expect(w.cipher.decrypt(user.mfaSecretEnc!, id)).toBe(start.secret);
    expect(() => w.cipher.decrypt(user.mfaSecretEnc!, 'un-autre-utilisateur')).toThrow();

    const trail = JSON.stringify(w.audit);
    expect(trail).not.toContain(start.secret);
    expect(w.audit.at(-1)).toMatchObject({ action: AuditAction.MfaChange, newValue: { event: 'enrollment_started' } });
  });

  it("B2 — le bon code active le MFA, délivre 10 codes de secours et un jeton portant `otp`", async () => {
    const { w, id, ctx } = await loggedIn();
    const start = await w.startMfa.execute(ctx);
    w.clock.advance(1_000);
    const confirmed = await w.confirmMfa.execute({ ...ctx, code: w.codeNow(start.secret) });

    expect(w.users.items.get(id)!.mfaEnabled).toBe(true);
    expect(confirmed.recoveryCodes).toHaveLength(10);
    for (const code of confirmed.recoveryCodes) expect(code).toMatch(/^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/);
    expect(new Set(confirmed.recoveryCodes).size).toBe(10);
    expect(w.sessions.items.get(ctx.sessionId)!.mfaVerified).toBe(true);
    expect(confirmed.accessToken).toContain('|pwd,otp|');
    expect(await w.authenticate.execute(confirmed.accessToken)).toMatchObject({ mfaVerified: true, hasFreshMfa: true });

    // Les codes de secours ne sont JAMAIS stockés en clair, ni dans l'audit
    for (const item of w.recoveryCodes.items) expect(confirmed.recoveryCodes.join(' ')).not.toContain(item.hash);
    expect(w.recoveryCodes.items.map((i) => i.hash).join(' ')).not.toMatch(/[A-HJ-NP-Z2-9]{10}(?!\))/);
    const trail = JSON.stringify(w.audit);
    for (const code of confirmed.recoveryCodes) expect(trail).not.toContain(code.replace('-', ''));
  });

  it('refuse un mauvais code : le MFA reste inactif, message générique, échec compté et audité', async () => {
    const { w, id, ctx } = await loggedIn();
    await w.startMfa.execute(ctx);
    await expect(w.confirmMfa.execute({ ...ctx, code: '000000' })).rejects.toMatchObject({ code: 'UNAUTHENTICATED', message: 'Code invalide' });

    expect(w.users.items.get(id)!.mfaEnabled).toBe(false);
    expect(w.users.items.get(id)!.failedLoginCount).toBe(1);
    expect(w.attempts.items.at(-1)).toMatchObject({ outcome: LoginOutcome.MfaFailed });
    expect(w.audit.at(-1)).toMatchObject({ action: AuditAction.LoginFailed });
  });

  it('exige de démarrer l\'enrôlement avant de le confirmer', async () => {
    const { w, ctx } = await loggedIn();
    await expect(w.confirmMfa.execute({ ...ctx, code: '123456' })).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it("ne permet PAS de remplacer un MFA actif (une session détournée ne peut pas se réenrôler)", async () => {
    const { w, ctx } = await enrolled();
    await expect(w.startMfa.execute(ctx)).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(w.confirmMfa.execute({ ...ctx, code: '123456' })).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('refuse une session invalide, expirée ou appartenant à un autre utilisateur', async () => {
    const { w, ctx } = await loggedIn();
    await expect(w.startMfa.execute({ ...ctx, userId: 'inconnu' })).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    await w.startMfa.execute(ctx);
    w.clock.advance(9 * 60 * MINUTE);
    await expect(w.confirmMfa.execute({ ...ctx, code: '123456' })).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });
});

describe('Vérification à la connexion (B3, B4)', () => {
  it('B3 — un compte avec MFA se connecte non vérifié ; le bon code ajoute `otp` au jeton', async () => {
    const { w, id, secret } = await enrolled();
    const { session, ctx } = await relogin(w, id);
    expect(session).toMatchObject({ mfaEnrolled: true, mfaVerified: false, mfaRequired: true });
    expect(await w.authenticate.execute(session.accessToken)).toMatchObject({ mfaVerified: false, hasFreshMfa: false });

    const verified = await w.verifyMfa.execute({ ...ctx, code: w.codeNow(secret) });
    expect(verified.accessToken).toContain('|pwd,otp|');
    expect(await w.authenticate.execute(verified.accessToken)).toMatchObject({ mfaVerified: true, hasFreshMfa: true });
    // L'ancien jeton (mot de passe seul) reste « non vérifié » : la preuve est dans le NOUVEAU jeton.
    expect(await w.authenticate.execute(session.accessToken)).toMatchObject({ mfaVerified: false });
  });

  it('B4 — REJEU : le même code ne passe pas deux fois', async () => {
    const { w, id, secret } = await enrolled();
    const a = await relogin(w, id);
    const code = w.codeNow(secret);
    await w.verifyMfa.execute({ ...a.ctx, code });
    const b = await relogin(w, id);
    w.clock.advance(-31_000); // revient dans le même pas de temps que le code déjà utilisé
    await expect(w.verifyMfa.execute({ ...b.ctx, code })).rejects.toMatchObject({ code: 'UNAUTHENTICATED', message: 'Code invalide' });
  });

  it('B4 — après 5 mauvais codes le compte est verrouillé comme pour les mots de passe ; le bon code est alors refusé', async () => {
    const { w, id, secret } = await enrolled();
    const { ctx } = await relogin(w, id);
    for (let i = 0; i < 5; i++) {
      await expect(w.verifyMfa.execute({ ...ctx, code: '000000' })).rejects.toMatchObject({ message: 'Code invalide' });
    }
    expect(w.users.items.get(id)!.isLocked(w.clock.now())).toBe(true);

    w.audit.length = 0;
    await expect(w.verifyMfa.execute({ ...ctx, code: w.codeNow(secret) })).rejects.toMatchObject({ message: 'Code invalide' });
    expect(w.audit[0]).toMatchObject({ newValue: { reason: 'MFA_LOCKED' } });
    // Le verrou bloque aussi la connexion par mot de passe : un seul compteur, un seul verrou.
    await expect(w.login.execute({ email: EMAIL, password: w.PASSWORD, actor: actor() })).rejects.toMatchObject({ message: 'Identifiants invalides' });

    w.clock.advance(61_000);
    await expect(w.verifyMfa.execute({ ...ctx, code: w.codeNow(secret) })).resolves.toBeDefined();
    expect(w.users.items.get(id)!.failedLoginCount).toBe(0);
  });

  it('refuse un format de code absurde sans erreur technique', async () => {
    const { w, id } = await enrolled();
    const { ctx } = await relogin(w, id);
    for (const code of ['', '12345', '1234567', 'abcdef', '12 34 56', undefined as unknown as string, '😀'.repeat(6)]) {
      await expect(w.verifyMfa.execute({ ...ctx, code })).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    }
  });

  it("refuse la vérification si le MFA n'est pas activé (il faut d'abord s'enrôler)", async () => {
    const { w, ctx } = await loggedIn();
    await expect(w.verifyMfa.execute({ ...ctx, code: '123456' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it("refuse la session d'un autre utilisateur et une session déconnectée", async () => {
    const { w, id, ctx, secret } = await enrolled();
    const other = await relogin(w, id);
    await expect(w.verifyMfa.execute({ ...other.ctx, userId: 'quelquun-d-autre', code: w.codeNow(secret) })).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    await w.logout.execute({ sessionId: ctx.sessionId, actor: actor() });
    await expect(w.verifyMfa.execute({ ...ctx, code: w.codeNow(secret) })).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });
});

describe('Codes de secours (B5)', () => {
  it('un code de secours valide connecte UNE fois, accepte casse et tirets, audite et compte les restants', async () => {
    const { w, id, recoveryCodes } = await enrolled();
    const { ctx } = await relogin(w, id);
    const code = recoveryCodes[0];

    const result = await w.verifyMfa.execute({ ...ctx, code: code.toLowerCase().replace('-', ' ') });
    expect(result.accessToken).toContain('|pwd,otp|');
    expect(result.recoveryCodesRemaining).toBe(9);
    expect(w.audit.at(-1)).toMatchObject({ action: AuditAction.MfaChange, newValue: { method: 'recovery_code', recoveryCodesRemaining: 9 } });

    const again = await relogin(w, id);
    await expect(w.verifyMfa.execute({ ...again.ctx, code })).rejects.toMatchObject({ code: 'UNAUTHENTICATED' }); // déjà consommé
    await expect(w.verifyMfa.execute({ ...again.ctx, code: recoveryCodes[1] })).resolves.toMatchObject({ recoveryCodesRemaining: 8 });
  });

  it('refuse un code de secours inconnu ou mal formé, en comptant l\'échec', async () => {
    const { w, id } = await enrolled();
    const { ctx } = await relogin(w, id);
    for (const code of ['AAAAA-AAAAA', 'ZZZZZ-ZZZZZ', 'ABCDE-FGH', 'pas un code !!']) {
      await expect(w.verifyMfa.execute({ ...ctx, code })).rejects.toMatchObject({ message: 'Code invalide' });
    }
    expect(w.users.items.get(id)!.failedLoginCount).toBe(4);
  });

  it('un code de secours ne peut pas être confondu avec un code TOTP (six chiffres exclusivement)', async () => {
    const { w, id } = await enrolled();
    const { ctx } = await relogin(w, id);
    const dummyBefore = w.hasher.dummyCalls;
    await expect(w.verifyMfa.execute({ ...ctx, code: 'ABC' })).rejects.toBeDefined();
    expect(w.hasher.dummyCalls).toBe(dummyBefore + 1); // calcul factice : pas de distinction de temps
  });
});

describe('Step-up (B6)', () => {
  it('le MFA reste récent 10 minutes ; ensuite la session reste vérifiée mais plus « fraîche » ; un step-up la rafraîchit', async () => {
    const { w, ctx, secret, confirmed } = await enrolled();
    expect(await w.authenticate.execute(confirmed.accessToken)).toMatchObject({ mfaVerified: true, hasFreshMfa: true });

    w.clock.advance(9 * MINUTE);
    expect(await w.authenticate.execute(confirmed.accessToken)).toMatchObject({ hasFreshMfa: true });

    w.clock.advance(2 * MINUTE); // 11 minutes après la vérification (le jeton d'accès, lui, dure 15 minutes)
    expect(await w.authenticate.execute(confirmed.accessToken)).toMatchObject({ mfaVerified: true, hasFreshMfa: false });

    // Step-up sur la MÊME session : nouveau code, horodatage rafraîchi, nouveau jeton « frais »
    const stepUp = await w.verifyMfa.execute({ ...ctx, code: w.codeNow(secret) });
    expect(stepUp.mfaVerifiedAt).toEqual(w.clock.now());
    expect(await w.authenticate.execute(stepUp.accessToken)).toMatchObject({ mfaVerified: true, hasFreshMfa: true });
  });

  it('frontière exacte : à 10 min pile le MFA est encore récent, à 10 min et 1 ms il ne l\'est plus', async () => {
    const { w, ctx, confirmed } = await enrolled();
    const session = w.sessions.items.get(ctx.sessionId)!;
    const at = session.mfaVerifiedAt!;
    expect(session.hasFreshMfa(new Date(at.getTime() + 10 * MINUTE))).toBe(true);
    expect(session.hasFreshMfa(new Date(at.getTime() + 10 * MINUTE + 1))).toBe(false);
    expect(session.hasFreshMfa(new Date(at.getTime() - 1))).toBe(false); // horodatage dans le futur : jamais frais
    expect(confirmed.accessToken).toBeTruthy();
  });
});

describe('Régénération des codes (B7)', () => {
  it('invalide les anciens codes et délivre 10 nouveaux, avec un MFA récent', async () => {
    const { w, ctx, recoveryCodes, id } = await enrolled();
    const fresh = await w.regenerateCodes.execute(ctx);

    expect(fresh.recoveryCodes).toHaveLength(10);
    expect(fresh.recoveryCodes.some((c) => recoveryCodes.includes(c))).toBe(false);
    expect(w.audit.at(-1)).toMatchObject({ action: AuditAction.MfaChange, newValue: { event: 'recovery_codes_regenerated' } });

    const next = await relogin(w, id);
    await expect(w.verifyMfa.execute({ ...next.ctx, code: recoveryCodes[0] })).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    await expect(w.verifyMfa.execute({ ...next.ctx, code: fresh.recoveryCodes[0] })).resolves.toBeDefined();
  });

  it('exige un step-up : MFA_STEP_UP_REQUIRED si la dernière vérification date de plus de 10 minutes', async () => {
    const { w, ctx } = await enrolled();
    w.clock.advance(10 * MINUTE + 1_000);
    await expect(w.regenerateCodes.execute(ctx)).rejects.toMatchObject({ code: 'MFA_STEP_UP_REQUIRED' });
  });

  it('refuse sans MFA actif', async () => {
    const { w, ctx } = await loggedIn();
    await expect(w.regenerateCodes.execute(ctx)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('Réinitialisation par un administrateur (B8, B9)', () => {
  it('supprime secret et codes, révoque TOUTES les sessions, audite ; le compte devra se réenrôler', async () => {
    const { w, id, ctx, recoveryCodes } = await enrolled();
    const second = await relogin(w, id);
    const admin = await w.createDefaultUser([RoleCode.SuperAdmin], 'admin@investally.test');
    w.audit.length = 0;

    await w.resetMfa.execute({ targetUserId: id, actor: actor({ userId: admin.id }) });

    const user = w.users.items.get(id)!;
    expect(user).toMatchObject({ mfaEnabled: false, mfaSecretEnc: null, mfaLastUsedStep: null });
    expect(w.recoveryCodes.items.filter((i) => i.userId === id)).toHaveLength(0);
    expect(w.sessions.items.get(ctx.sessionId)!.revokedAt).not.toBeNull();
    expect(w.sessions.items.get(second.ctx.sessionId)!.revokedAt).not.toBeNull();
    expect(await w.authenticate.execute(second.session.accessToken)).toBeNull();
    expect(w.audit[0]).toMatchObject({ action: AuditAction.MfaChange, newValue: { event: 'reset_by_administrator', sessionsRevoked: 2 } });

    // Ancien code de secours inutilisable ; réenrôlement possible
    const fresh = await relogin(w, id);
    await expect(w.verifyMfa.execute({ ...fresh.ctx, code: recoveryCodes[0] })).rejects.toMatchObject({ code: 'FORBIDDEN' }); // MFA non activé
    await expect(w.startMfa.execute(fresh.ctx)).resolves.toBeDefined();
  });

  it('B9 — interdit l\'auto-réinitialisation : une session compromise ne peut pas désactiver son propre MFA', async () => {
    const { w, id } = await enrolled();
    await expect(w.resetMfa.execute({ targetUserId: id, actor: actor({ userId: id }) })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(w.users.items.get(id)!.mfaEnabled).toBe(true);
  });

  it('refuse un utilisateur inconnu', async () => {
    const { w } = await loggedIn();
    await expect(w.resetMfa.execute({ targetUserId: 'inconnu', actor: actor() })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
