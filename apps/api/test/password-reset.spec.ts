import { AuditAction } from '../src/modules/audit';
import { RoleCode } from '../src/modules/iam/domain/roles';
import { UserStatus } from '../src/modules/iam/domain/user';
import { actor } from './support/iam-fakes';
import { buildIamWorld } from './support/iam-world';

type World = ReturnType<typeof buildIamWorld>;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const NEW_PASSWORD = 'cheval agrafeuse nuage lointain 73';
const INVALID = 'Lien invalide ou expiré';

const mails = (w: World, address: string) => w.email.sent.filter((m) => m.to === address);
const tokenFrom = (text: string) => /#token=([\w-]+)/.exec(text)![1];
const resetMails = (w: World, address: string) => mails(w, address).filter((m) => m.subject.includes('Réinitialisation'));
const resetEvents = (w: World) => w.audit.filter((a) => a.action === AuditAction.PasswordReset);
const outcomes = (w: World) => resetEvents(w).map((a) => (a.newValue as { outcome?: string }).outcome);

/** Un utilisateur actif qui a oublié son mot de passe, avec une session ouverte. */
async function forgetful(w: World, email = 'marie@investally.test') {
  const user = await w.createDefaultUser([RoleCode.AccountManager], email);
  const login = await w.login.execute({ email, password: w.PASSWORD, actor: actor() });
  return { user, login, email };
}

async function requestLink(w: World, email: string) {
  await w.requestPasswordReset.execute({ email, actor: actor({ ipAddress: '203.0.113.9' }) });
  return tokenFrom(resetMails(w, email).at(-1)!.text);
}

describe('Mot de passe oublié — demande (libre-service)', () => {
  it('compte actif : un lien de 60 minutes est envoyé, le jeton n\'est stocké ni en clair ni dans l\'audit', async () => {
    const w = buildIamWorld();
    const { user, email } = await forgetful(w);
    const t0 = w.clock.now().getTime();
    const token = await requestLink(w, email);

    const mail = resetMails(w, email)[0];
    expect(mail.text).toContain('https://crm.test/reset-password#token=');
    expect(mail.text).not.toContain('reset-password?token'); // jamais dans la requête (journaux, Referer)
    expect(mail.text).toContain('60 minutes');
    const record = [...w.invitations.items.values()][0];
    expect(record).toMatchObject({ userId: user.id, purpose: 'PASSWORD_RESET', createdBy: null, usedAt: null, revokedAt: null });
    expect(record.expiresAt.getTime() - t0).toBe(HOUR);
    expect(record.tokenHash).not.toContain(token);
    expect(JSON.stringify([...w.invitations.items.values()])).not.toContain(token);
    expect(JSON.stringify(w.audit)).not.toContain(token);
  });

  it('la demande est AUDITÉE avec l\'adresse IP et l\'appareil de l\'appelant', async () => {
    const w = buildIamWorld();
    const { user, email } = await forgetful(w);
    await requestLink(w, email);
    const entry = resetEvents(w)[0];
    expect(entry).toMatchObject({
      module: 'iam', entityType: 'User', entityId: user.id, action: AuditAction.PasswordReset,
      newValue: { event: 'password_reset_requested', outcome: 'ISSUED' },
      actor: { userId: null, ipAddress: '203.0.113.9' },
    });
  });

  it('adresse inconnue, mal formée, vide, compte en attente ou désactivé : rien n\'est envoyé, l\'appelant ne voit aucune différence', async () => {
    const w = buildIamWorld();
    await forgetful(w, 'actif@investally.test');
    const disabled = await w.createDefaultUser([RoleCode.Support], 'parti@investally.test');
    const stored = (await w.users.findById(disabled.id))!;
    stored.disable();
    await w.users.save(stored);
    const admin = await w.createDefaultUser([RoleCode.SuperAdmin], 'admin@investally.test');
    await w.inviteUser.execute({
      email: 'attente@investally.test', displayName: 'En Attente', roles: ['SUPPORT'], actor: actor({ userId: admin.id }),
      access: await w.authorization.contextFor(admin.id),
    });
    const before = w.email.sent.length;

    for (const email of ['inconnu@investally.test', 'pas-une-adresse', '', 'parti@investally.test', 'attente@investally.test']) {
      await expect(w.requestPasswordReset.execute({ email, actor: actor() })).resolves.toBeUndefined();
    }
    expect(w.email.sent.length).toBe(before);
    expect(outcomes(w)).toEqual(['UNKNOWN', 'UNKNOWN', 'UNKNOWN', 'INELIGIBLE', 'INELIGIBLE']);
  });

  it('une adresse inconnue n\'est JAMAIS écrite dans le journal d\'audit', async () => {
    const w = buildIamWorld();
    await w.requestPasswordReset.execute({ email: 'victime-imaginaire@investally.test', actor: actor() });
    await w.requestPasswordReset.execute({ email: '<script>alert(1)</script>', actor: actor() });
    expect(JSON.stringify(w.audit)).not.toContain('victime-imaginaire');
    expect(JSON.stringify(w.audit)).not.toContain('script');
  });

  it('la casse et les espaces de l\'adresse n\'empêchent pas la demande', async () => {
    const w = buildIamWorld();
    const { email } = await forgetful(w);
    await w.requestPasswordReset.execute({ email: `  ${email.toUpperCase()} `, actor: actor() });
    expect(resetMails(w, email)).toHaveLength(1);
  });

  it('plafond : 3 liens par heure et par compte, puis refus silencieux (audité) ; la limite se lève au bout d\'une heure', async () => {
    const w = buildIamWorld();
    const { email } = await forgetful(w);
    for (let i = 0; i < 5; i++) await w.requestPasswordReset.execute({ email, actor: actor() });
    expect(resetMails(w, email)).toHaveLength(3);
    expect(outcomes(w)).toEqual(['ISSUED', 'ISSUED', 'ISSUED', 'THROTTLED', 'THROTTLED']);

    w.clock.advance(HOUR - 1); // pile à une heure du premier lien : il compte encore
    await w.requestPasswordReset.execute({ email, actor: actor() });
    expect(resetMails(w, email)).toHaveLength(3);
    w.clock.advance(2);
    await w.requestPasswordReset.execute({ email, actor: actor() });
    expect(resetMails(w, email)).toHaveLength(4);
  });

  it('une nouvelle demande révoque le lien précédent', async () => {
    const w = buildIamWorld();
    const { email } = await forgetful(w);
    const first = await requestLink(w, email);
    const second = await requestLink(w, email);
    await expect(w.resetPassword.execute({ token: first, password: NEW_PASSWORD, actor: actor() })).rejects.toMatchObject({ message: INVALID });
    await expect(w.resetPassword.execute({ token: second, password: NEW_PASSWORD, actor: actor() })).resolves.toBeUndefined();
  });

  it('échec d\'envoi : jamais d\'erreur pour l\'appelant, mais l\'échec est audité', async () => {
    const w = buildIamWorld();
    const { email } = await forgetful(w);
    jest.spyOn(w.email, 'send').mockResolvedValueOnce({ ok: false, reason: 'UNAVAILABLE' });
    await expect(w.requestPasswordReset.execute({ email, actor: actor() })).resolves.toBeUndefined();
    expect(outcomes(w)).toEqual(['ISSUED', 'EMAIL_FAILED']);
  });

  it('une transaction qui échoue ne laisse aucun lien utilisable', async () => {
    const w = buildIamWorld();
    const { email } = await forgetful(w);
    jest.spyOn(w.invitations, 'save').mockRejectedValueOnce(new Error('base indisponible'));
    await expect(w.requestPasswordReset.execute({ email, actor: actor() })).rejects.toThrow('base indisponible');
    expect(resetMails(w, email)).toHaveLength(0);
  });
});

describe('Mot de passe oublié — choix du nouveau mot de passe', () => {
  it('succès : nouveau mot de passe actif, ancien refusé, historique tenu à jour', async () => {
    const w = buildIamWorld();
    const { email } = await forgetful(w);
    const token = await requestLink(w, email);
    await w.resetPassword.execute({ token, password: NEW_PASSWORD, actor: actor({ ipAddress: '198.51.100.7' }) });

    await expect(w.login.execute({ email, password: w.PASSWORD, actor: actor() })).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    await expect(w.login.execute({ email, password: NEW_PASSWORD, actor: actor() })).resolves.toMatchObject({ mfaRequired: true });
    expect(await w.history.recentHashes((await w.users.lockByEmailKey(email))!.id, 5)).toContain(`hash(${NEW_PASSWORD})`);
  });

  it('toutes les sessions et tous les jetons de rafraîchissement sont coupés', async () => {
    const w = buildIamWorld();
    const { user, login, email } = await forgetful(w);
    const second = await w.login.execute({ email, password: w.PASSWORD, actor: actor({ ipAddress: '10.9.9.9' }) });
    const token = await requestLink(w, email);
    await w.resetPassword.execute({ token, password: NEW_PASSWORD, actor: actor() });

    expect(await w.sessions.listActiveOf(user.id, w.clock.now())).toHaveLength(0);
    expect(await w.authenticate.execute(login.accessToken)).toBeNull();
    expect(await w.authenticate.execute(second.accessToken)).toBeNull();
    await expect(w.refresh.execute({ refreshToken: login.refreshToken, actor: actor() })).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('le MFA est CONSERVÉ : le lien ne donne aucun accès à lui seul', async () => {
    const w = buildIamWorld();
    const { user, login, email } = await forgetful(w);
    const start = await w.startMfa.execute({ userId: user.id, sessionId: login.sessionId, actor: actor() });
    await w.confirmMfa.execute({ userId: user.id, sessionId: login.sessionId, code: w.codeNow(start.secret), actor: actor() });
    w.clock.advance(31_000);

    const token = await requestLink(w, email);
    await w.resetPassword.execute({ token, password: NEW_PASSWORD, actor: actor() });

    expect((await w.users.findById(user.id))!.mfaEnabled).toBe(true);
    const next = await w.login.execute({ email, password: NEW_PASSWORD, actor: actor() });
    expect(next).toMatchObject({ mfaEnrolled: true, mfaVerified: false });
  });

  it('lève un verrouillage en cours (compteur d\'échecs remis à zéro)', async () => {
    const w = buildIamWorld();
    const { user, email } = await forgetful(w);
    for (let i = 0; i < 5; i++) await w.login.execute({ email, password: 'mauvais mot de passe', actor: actor() }).catch(() => undefined);
    expect((await w.users.findById(user.id))!.isLocked(w.clock.now())).toBe(true);

    const token = await requestLink(w, email);
    await w.resetPassword.execute({ token, password: NEW_PASSWORD, actor: actor() });
    expect((await w.users.findById(user.id))!.isLocked(w.clock.now())).toBe(false);
    await expect(w.login.execute({ email, password: NEW_PASSWORD, actor: actor() })).resolves.toBeDefined();
  });

  it('l\'opération est AUDITÉE (terminée, sessions coupées, IP) et le titulaire reçoit un e-mail de confirmation', async () => {
    const w = buildIamWorld();
    const { user, email } = await forgetful(w);
    const token = await requestLink(w, email);
    await w.resetPassword.execute({ token, password: NEW_PASSWORD, actor: actor({ ipAddress: '198.51.100.7' }) });

    const done = resetEvents(w).find((a) => (a.newValue as { event: string }).event === 'password_reset_completed')!;
    expect(done).toMatchObject({ entityId: user.id, actor: { userId: user.id, ipAddress: '198.51.100.7' }, newValue: { sessionsRevoked: 1 } });
    const notice = mails(w, email).at(-1)!;
    expect(notice.subject).toContain('a été modifié');
    expect(notice.text).toContain('198.51.100.7');
    expect(notice.text).not.toContain(NEW_PASSWORD);
    expect(JSON.stringify(w.audit)).not.toContain(NEW_PASSWORD);
    expect(JSON.stringify(w.audit)).not.toContain(token);
  });

  it('usage unique : un second essai avec le même lien est refusé', async () => {
    const w = buildIamWorld();
    const { email } = await forgetful(w);
    const token = await requestLink(w, email);
    await w.resetPassword.execute({ token, password: NEW_PASSWORD, actor: actor() });
    await expect(w.resetPassword.execute({ token, password: 'une autre phrase de passe 99', actor: actor() })).rejects.toMatchObject({ message: INVALID });
  });

  it('deux utilisations simultanées du même lien : une seule aboutit', async () => {
    const w = buildIamWorld();
    const { email } = await forgetful(w);
    const token = await requestLink(w, email);
    const results = await Promise.allSettled([
      w.resetPassword.execute({ token, password: NEW_PASSWORD, actor: actor() }),
      w.resetPassword.execute({ token, password: 'une autre phrase de passe 99', actor: actor() }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('mot de passe faible, contenant l\'identité, ou déjà utilisé : refusé SANS consommer le lien', async () => {
    const w = buildIamWorld();
    const { email } = await forgetful(w);
    const token = await requestLink(w, email);
    for (const bad of ['court', 'Marie Kamga 2026 !!', w.PASSWORD]) {
      await expect(w.resetPassword.execute({ token, password: bad, actor: actor() })).rejects.toMatchObject({ code: 'VALIDATION' });
    }
    await expect(w.resetPassword.execute({ token, password: w.PASSWORD, actor: actor() })).rejects.toMatchObject({ message: expect.stringContaining('déjà été utilisé') });
    await expect(w.resetPassword.execute({ token, password: NEW_PASSWORD, actor: actor() })).resolves.toBeUndefined();
  });

  it('expiration : valable 60 minutes exactement ; au-delà, même refus générique', async () => {
    const w = buildIamWorld();
    const { email } = await forgetful(w);
    const token = await requestLink(w, email);
    w.clock.advance(HOUR - 1);
    const ok = await requestLink(w, email); // renouvelé juste avant l'échéance du premier
    w.clock.advance(HOUR);
    await expect(w.resetPassword.execute({ token: ok, password: NEW_PASSWORD, actor: actor() })).rejects.toMatchObject({ message: INVALID });
    await expect(w.resetPassword.execute({ token, password: NEW_PASSWORD, actor: actor() })).rejects.toMatchObject({ message: INVALID });
  });

  it('TOUS les liens non valides produisent le même refus, sans rien révéler', async () => {
    const w = buildIamWorld();
    const { email, user } = await forgetful(w);
    const used = await requestLink(w, email);
    await w.resetPassword.execute({ token: used, password: NEW_PASSWORD, actor: actor() });
    const messages = new Set<string>();
    for (const token of ['', 'inconnu', used, 'x'.repeat(500)]) {
      await w.resetPassword.execute({ token, password: 'une autre phrase de passe 99', actor: actor() }).catch((e) => messages.add(`${e.code}|${e.message}`));
    }
    expect([...messages]).toEqual([`VALIDATION|${INVALID}`]);
    expect(user.id).toBeDefined();
  });

  it('un lien d\'INVITATION ne réinitialise pas un mot de passe, et un lien de réinitialisation n\'active pas un compte', async () => {
    const w = buildIamWorld();
    const admin = await w.createDefaultUser([RoleCode.SuperAdmin], 'admin@investally.test');
    const context = await w.authorization.contextFor(admin.id);
    await w.inviteUser.execute({ email: 'recrue@investally.test', displayName: 'Recrue Test', roles: ['SUPPORT'], actor: actor({ userId: admin.id }), access: context });
    const invitationToken = tokenFrom(mails(w, 'recrue@investally.test')[0].text);

    const { email } = await forgetful(w);
    const resetToken = await requestLink(w, email);

    await expect(w.resetPassword.execute({ token: invitationToken, password: NEW_PASSWORD, actor: actor() })).rejects.toMatchObject({ message: INVALID });
    await expect(w.acceptInvitation.execute({ token: resetToken, password: NEW_PASSWORD, actor: actor() })).rejects.toMatchObject({ message: INVALID });
    // les deux liens restent utilisables pour leur propre usage
    await expect(w.resetPassword.execute({ token: resetToken, password: NEW_PASSWORD, actor: actor() })).resolves.toBeUndefined();
    await expect(w.acceptInvitation.execute({ token: invitationToken, password: NEW_PASSWORD, actor: actor() })).resolves.toBeUndefined();
  });

  it("défense en profondeur : un lien d'INVITATION rattaché à un compte ACTIF ne réinitialise pas son mot de passe", async () => {
    const w = buildIamWorld();
    const { user } = await forgetful(w);
    const now = w.clock.now();
    await w.invitations.save({
      id: 'inv-x', userId: user.id, tokenHash: w.refreshFactory.hashOf('jeton-invitation'), purpose: 'INVITATION',
      createdBy: null, createdAt: now, expiresAt: new Date(now.getTime() + HOUR), usedAt: null, revokedAt: null,
    });
    await expect(w.resetPassword.execute({ token: 'jeton-invitation', password: NEW_PASSWORD, actor: actor() })).rejects.toMatchObject({ message: INVALID });
    await expect(w.login.execute({ email: 'marie@investally.test', password: w.PASSWORD, actor: actor() })).resolves.toBeDefined(); // mot de passe inchangé
    expect(w.audit.some((a) => (a.newValue as { reason?: string }).reason === 'WRONG_PURPOSE')).toBe(true);
  });

  it('compte désactivé entre la demande et l\'usage : lien refusé', async () => {
    const w = buildIamWorld();
    const { user, email } = await forgetful(w);
    const token = await requestLink(w, email);
    const stored = (await w.users.findById(user.id))!;
    stored.disable();
    await w.users.save(stored);
    await expect(w.resetPassword.execute({ token, password: NEW_PASSWORD, actor: actor() })).rejects.toMatchObject({ message: INVALID });
    expect((await w.users.findById(user.id))!.status).toBe(UserStatus.Disabled);
  });

  it('les refus sont audités sans le jeton', async () => {
    const w = buildIamWorld();
    await w.resetPassword.execute({ token: 'jeton-secret-invente', password: NEW_PASSWORD, actor: actor() }).catch(() => undefined);
    const denied = w.audit.filter((a) => a.action === AuditAction.AccessDenied);
    expect(denied).toHaveLength(1);
    expect(denied[0].newValue).toMatchObject({ reason: 'UNKNOWN', flow: 'password_reset' });
    expect(JSON.stringify(w.audit)).not.toContain('jeton-secret-invente');
  });
});

describe('Mot de passe oublié — déclenché par un administrateur', () => {
  async function setup() {
    const w = buildIamWorld();
    const admin = await w.createDefaultUser([RoleCode.SuperAdmin], 'admin@investally.test');
    const { user, email } = await forgetful(w);
    return { w, admin, adminActor: actor({ userId: admin.id, ipAddress: '10.1.1.1' }), user, email };
  }

  it('envoie un lien de 48 h, audité avec l\'identité de l\'administrateur', async () => {
    const { w, admin, adminActor, user, email } = await setup();
    const t0 = w.clock.now().getTime();
    await expect(w.issuePasswordReset.execute({ userId: user.id, actor: adminActor })).resolves.toEqual({ emailSent: true });

    const mail = resetMails(w, email)[0];
    expect(mail.text).toContain('Un administrateur a demandé');
    expect(mail.text).toContain('48 heures');
    const record = [...w.invitations.items.values()][0];
    expect(record).toMatchObject({ purpose: 'PASSWORD_RESET', createdBy: admin.id });
    expect(record.expiresAt.getTime() - t0).toBe(48 * HOUR);
    expect(resetEvents(w)[0]).toMatchObject({ entityId: user.id, actor: { userId: admin.id }, newValue: { event: 'password_reset_issued_by_administrator' } });
    expect(JSON.stringify(w.audit)).not.toContain(tokenFrom(mail.text));

    // et le lien fonctionne
    await expect(w.resetPassword.execute({ token: tokenFrom(mail.text), password: NEW_PASSWORD, actor: actor() })).resolves.toBeUndefined();
  });

  it('INTERDIT pour soi-même', async () => {
    const { w, adminActor, admin } = await setup();
    await expect(w.issuePasswordReset.execute({ userId: admin.id, actor: adminActor })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('refuse un compte inconnu, en attente ou désactivé', async () => {
    const { w, adminActor, admin } = await setup();
    await expect(w.issuePasswordReset.execute({ userId: '00000000-0000-7000-8000-000000000000', actor: adminActor })).rejects.toMatchObject({ code: 'NOT_FOUND' });

    await w.inviteUser.execute({
      email: 'attente@investally.test', displayName: 'En Attente', roles: ['SUPPORT'], actor: adminActor, access: await w.authorization.contextFor(admin.id),
    });
    const pending = (await w.users.list({ page: 1, pageSize: 50, search: 'attente' })).items[0];
    await expect(w.issuePasswordReset.execute({ userId: pending.id, actor: adminActor })).rejects.toMatchObject({ code: 'CONFLICT', message: expect.stringContaining("renvoyez l'invitation") });

    const gone = await w.createDefaultUser([RoleCode.Support], 'parti@investally.test');
    const stored = (await w.users.findById(gone.id))!;
    stored.disable();
    await w.users.save(stored);
    await expect(w.issuePasswordReset.execute({ userId: gone.id, actor: adminActor })).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('un nouvel envoi révoque l\'ancien lien ; l\'échec d\'envoi est signalé (emailSent=false) et audité', async () => {
    const { w, adminActor, user, email } = await setup();
    await w.issuePasswordReset.execute({ userId: user.id, actor: adminActor });
    const first = tokenFrom(resetMails(w, email)[0].text);
    jest.spyOn(w.email, 'send').mockResolvedValueOnce({ ok: false, reason: 'UNAVAILABLE' });
    await expect(w.issuePasswordReset.execute({ userId: user.id, actor: adminActor })).resolves.toEqual({ emailSent: false });
    await expect(w.resetPassword.execute({ token: first, password: NEW_PASSWORD, actor: actor() })).rejects.toMatchObject({ message: INVALID });
    expect(resetEvents(w).some((a) => (a.newValue as { event: string }).event === 'password_reset_email_failed')).toBe(true);
  });
});
