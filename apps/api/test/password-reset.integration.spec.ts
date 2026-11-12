import 'reflect-metadata';
import { EMAIL_SENDER } from '../src/modules/notifications';
import { LogEmailSender } from '../src/modules/notifications/infrastructure/log-email-sender';
import { RoleCode } from '../src/modules/iam/domain/roles';
import { Api, createUserWithRoles, mfaSession, startRbacApp } from './support/rbac-http';
import { TEST_PASSWORD, TestApp } from './support/test-app';

const describeDb = process.env.DATABASE_URL && process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;
const NEW_PASSWORD = 'cheval agrafeuse nuage lointain 73';
const ANSWER = "Si un compte correspond à cette adresse, un e-mail contenant un lien de réinitialisation vient d'être envoyé.";
const tokenFrom = (text: string) => /#token=([\w-]+)/.exec(text)![1];
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** « Mot de passe oublié » sur l'application réelle (HTTP, PostgreSQL, journal d'audit, limitation de débit). */
describeDb('Mot de passe oublié (HTTP + PostgreSQL)', () => {
  jest.setTimeout(30_000); // le traitement se poursuit après la réponse : les tests attendent l'e-mail ou l'audit
  let t: TestApp;
  let api: Api;
  let mailbox: LogEmailSender;
  beforeAll(async () => {
    ({ t, api } = await startRbacApp());
    mailbox = t.get(EMAIL_SENDER as never) as LogEmailSender;
  }, 60_000);
  afterAll(() => t.close());

  /** La réponse HTTP part avant la fin du traitement (anti-énumération par le temps) : on attend l'e-mail ou l'audit. */
  async function resetMailFor(email: string, since = 0) {
    for (let i = 0; i < 60; i++) {
      const mail = mailbox.sent.filter((m) => m.to === email && m.subject.includes('Réinitialisation')).slice(since).at(-1);
      if (mail) return mail;
      await wait(50);
    }
    return undefined;
  }
  /** Le traitement se poursuit après la réponse : on attend (jusqu'à 15 s) que `expected` entrées soient écrites. */
  async function auditOutcomes(entityId?: string, expected = 1) {
    let rows: { newValue: unknown }[] = [];
    for (let i = 0; i < 150; i++) {
      rows = await t.prisma.db.auditLog.findMany({ where: { action: 'PASSWORD_RESET', ...(entityId ? { entityId } : {}) }, orderBy: { createdAt: 'asc' } });
      if (rows.length >= expected) break;
      await wait(100);
    }
    return rows.map((r) => (r.newValue as { outcome?: string; event?: string }).outcome ?? (r.newValue as { event: string }).event);
  }

  it('parcours complet : demande → e-mail → nouveau mot de passe → sessions coupées → connexion avec le nouveau seulement', async () => {
    const user = await createUserWithRoles(t, [RoleCode.AccountManager]);
    const session = await mfaSession(t, api, user.email, '10.90.0.1');

    const asked = await api.call('POST', '/api/v1/auth/password-reset/request', { body: { email: user.email }, ip: '10.90.0.2' });
    expect(asked.status).toBe(202);
    expect(asked.body).toEqual({ message: ANSWER });
    expect(asked.headers.get('cache-control')).toBe('no-store');

    const mail = (await resetMailFor(user.email))!;
    expect(mail.text).toContain('/reset-password#token=');
    const token = tokenFrom(mail.text);
    // seule l'empreinte est en base
    const stored = await t.prisma.db.userInvitation.findMany({ where: { userId: user.id } });
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ purpose: 'PASSWORD_RESET', createdBy: null });
    expect(JSON.stringify(stored)).not.toContain(token);

    const done = await api.call('POST', '/api/v1/auth/password-reset/accept', { body: { token, password: NEW_PASSWORD }, ip: '10.90.0.3' });
    expect(done.status).toBe(204);

    // l'ancienne session est coupée, l'ancien mot de passe refusé, le nouveau accepté (MFA toujours exigé ensuite)
    expect((await api.call('GET', '/api/v1/auth/me', { token: session.token })).status).toBe(401);
    expect((await api.call('POST', '/api/v1/auth/login', { body: { email: user.email, password: TEST_PASSWORD }, ip: '10.90.0.4' })).status).toBe(401);
    const login = await api.call('POST', '/api/v1/auth/login', { body: { email: user.email, password: NEW_PASSWORD }, ip: '10.90.0.5' });
    expect(login.status).toBe(200);
    expect(login.body).toMatchObject({ mfaRequired: true, mfaVerified: false });

    // traçabilité : demande, émission, usage ; jamais le jeton ni le mot de passe
    expect(await auditOutcomes(user.id, 2)).toEqual(['ISSUED', 'password_reset_completed']);
    const all = JSON.stringify(await t.prisma.db.auditLog.findMany({ where: { entityId: user.id } }));
    expect(all).not.toContain(token);
    expect(all).not.toContain(NEW_PASSWORD);
    // le titulaire est prévenu
    expect(mailbox.sent.some((m) => m.to === user.email && m.subject.includes('a été modifié'))).toBe(true);
  });

  it('réponse STRICTEMENT identique pour un compte existant et inexistant (statut, corps, en-têtes utiles), sans rien dans l\'audit pour l\'adresse saisie', async () => {
    const user = await createUserWithRoles(t, [RoleCode.Support]);
    const known = await api.call('POST', '/api/v1/auth/password-reset/request', { body: { email: user.email }, ip: '10.91.0.1' });
    const typed = `fantome-${Date.now()}@investally.test`;
    const unknown = await api.call('POST', '/api/v1/auth/password-reset/request', { body: { email: typed }, ip: '10.91.0.2' });
    const malformed = await api.call('POST', '/api/v1/auth/password-reset/request', { body: { email: 'pas une adresse' }, ip: '10.91.0.3' });

    for (const res of [unknown, malformed]) {
      expect(res.status).toBe(known.status);
      expect(res.body).toEqual(known.body);
      expect(res.headers.get('content-type')).toBe(known.headers.get('content-type'));
      expect(res.headers.get('cache-control')).toBe(known.headers.get('cache-control'));
    }
    await auditOutcomes(undefined, 3); // les trois demandes sont traitées
    expect(JSON.stringify(await t.prisma.db.auditLog.findMany({ where: { action: 'PASSWORD_RESET' } }))).not.toContain(typed);
    expect(mailbox.sent.some((m) => m.to === typed)).toBe(false);
  });

  it('limitation : au plus 3 demandes par minute et par couple IP + adresse (429 ensuite) ; une autre IP n\'est pas touchée', async () => {
    const email = `limite-${Date.now()}@investally.test`;
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) statuses.push((await api.call('POST', '/api/v1/auth/password-reset/request', { body: { email }, ip: '10.92.0.1' })).status);
    expect(statuses).toEqual([202, 202, 202, 429, 429]);
    expect((await api.call('POST', '/api/v1/auth/password-reset/request', { body: { email }, ip: '10.92.0.2' })).status).toBe(202);
  });

  it('plafond par compte : 3 liens par heure même depuis des IP différentes ; les refus sont audités (THROTTLED)', async () => {
    const user = await createUserWithRoles(t, [RoleCode.Support]);
    for (let i = 0; i < 5; i++) await api.call('POST', '/api/v1/auth/password-reset/request', { body: { email: user.email }, ip: `10.93.0.${i + 1}` });
    const outcomes = await auditOutcomes(user.id, 5);
    expect(outcomes.filter((o) => o === 'ISSUED')).toHaveLength(3);
    expect(outcomes.filter((o) => o === 'THROTTLED')).toHaveLength(2);
    expect(mailbox.sent.filter((m) => m.to === user.email && m.subject.includes('Réinitialisation'))).toHaveLength(3);
  });

  it('lien invalide, inconnu, rejoué, vide ou démesuré : toujours le même refus 400 ; entrées mal formées rejetées', async () => {
    const user = await createUserWithRoles(t, [RoleCode.Support]);
    await api.call('POST', '/api/v1/auth/password-reset/request', { body: { email: user.email }, ip: '10.94.0.1' });
    const token = tokenFrom((await resetMailFor(user.email))!.text);
    expect((await api.call('POST', '/api/v1/auth/password-reset/accept', { body: { token, password: NEW_PASSWORD }, ip: '10.94.0.2' })).status).toBe(204);

    const details = new Set<string>();
    for (const bad of [token, 'inconnu', 'x'.repeat(150)]) {
      const res = await api.call('POST', '/api/v1/auth/password-reset/accept', { body: { token: bad, password: NEW_PASSWORD }, ip: '10.94.0.3' });
      expect(res.status).toBe(400);
      details.add(res.body.detail);
    }
    expect([...details]).toEqual(['Lien invalide ou expiré']);
    expect((await api.call('POST', '/api/v1/auth/password-reset/accept', { body: { token: 'x'.repeat(201), password: 'p' }, ip: '10.94.0.4' })).status).toBe(400);
    expect((await api.call('POST', '/api/v1/auth/password-reset/accept', { body: { password: 'p' }, ip: '10.94.0.5' })).status).toBe(400);
    expect((await api.call('POST', '/api/v1/auth/password-reset/request', { body: { email: 42 }, ip: '10.94.0.6' })).status).toBe(400);
  });

  it('mot de passe refusé par la politique : 400 avec le détail, le lien reste utilisable', async () => {
    const user = await createUserWithRoles(t, [RoleCode.Support]);
    await api.call('POST', '/api/v1/auth/password-reset/request', { body: { email: user.email }, ip: '10.95.0.1' });
    const token = tokenFrom((await resetMailFor(user.email))!.text);
    const weak = await api.call('POST', '/api/v1/auth/password-reset/accept', { body: { token, password: 'court' }, ip: '10.95.0.2' });
    expect(weak.status).toBe(400);
    expect(weak.body.detail).toContain('Mot de passe refusé');
    expect((await api.call('POST', '/api/v1/auth/password-reset/accept', { body: { token, password: NEW_PASSWORD }, ip: '10.95.0.3' })).status).toBe(204);
  });

  it('deux utilisations simultanées du même lien : une seule aboutit (course testée sur la base)', async () => {
    const user = await createUserWithRoles(t, [RoleCode.Support]);
    await api.call('POST', '/api/v1/auth/password-reset/request', { body: { email: user.email }, ip: '10.96.0.1' });
    const token = tokenFrom((await resetMailFor(user.email))!.text);
    const [a, b] = await Promise.all([
      api.call('POST', '/api/v1/auth/password-reset/accept', { body: { token, password: NEW_PASSWORD }, ip: '10.96.0.2' }),
      api.call('POST', '/api/v1/auth/password-reset/accept', { body: { token, password: 'une autre phrase de passe 99' }, ip: '10.96.0.3' }),
    ]);
    expect([a.status, b.status].sort()).toEqual([204, 400]);
    const history = await t.prisma.db.passwordHistory.findMany({ where: { userId: user.id } });
    expect(history).toHaveLength(2); // mot de passe initial + un seul nouveau
  });

  describe('déclenché par un administrateur', () => {
    it('SuperAdmin + MFA récent : lien de 48 h ; refus pour soi-même ; MFA périmé = step-up exigé ; rôle sans droit = 403', async () => {
      const admin = await createUserWithRoles(t, [RoleCode.SuperAdmin]);
      const target = await createUserWithRoles(t, [RoleCode.Support]);
      const sa = await mfaSession(t, api, admin.email, '10.97.0.1');

      const sent = await api.call('POST', `/api/v1/admin/users/${target.id}/password-reset`, { token: sa.token, ip: '10.97.0.1' });
      expect(sent.status).toBe(200);
      expect(sent.body).toEqual({ emailSent: true });
      const record = (await t.prisma.db.userInvitation.findMany({ where: { userId: target.id, purpose: 'PASSWORD_RESET' } }))[0];
      expect(record.createdBy).toBe(admin.id);
      expect(Math.round((record.expiresAt.getTime() - record.createdAt.getTime()) / 3_600_000)).toBe(48);
      expect(await auditOutcomes(target.id, 1)).toContain('password_reset_issued_by_administrator');

      expect((await api.call('POST', `/api/v1/admin/users/${admin.id}/password-reset`, { token: sa.token, ip: '10.97.0.1' })).status).toBe(403);

      const stale = await mfaSession(t, api, admin.email, '10.97.0.2', 11 * 60_000);
      const refused = await api.call('POST', `/api/v1/admin/users/${target.id}/password-reset`, { token: stale.token, ip: '10.97.0.2' });
      expect(refused.status).toBe(403);
      expect(refused.body.title).toBe('MFA_STEP_UP_REQUIRED');

      const support = await createUserWithRoles(t, [RoleCode.Support]);
      const ss = await mfaSession(t, api, support.email, '10.97.0.3');
      expect((await api.call('POST', `/api/v1/admin/users/${target.id}/password-reset`, { token: ss.token, ip: '10.97.0.3' })).status).toBe(403);
      expect((await api.call('POST', `/api/v1/admin/users/${target.id}/password-reset`, { ip: '10.97.0.4' })).status).toBe(401);
    });
  });

  it('un lien d\'invitation ne réinitialise pas un mot de passe (usage croisé refusé)', async () => {
    const admin = await createUserWithRoles(t, [RoleCode.SuperAdmin]);
    const sa = await mfaSession(t, api, admin.email, '10.98.0.1');
    const email = `croise-${Date.now()}@investally.test`;
    await api.call('POST', '/api/v1/admin/users', { token: sa.token, ip: '10.98.0.1', body: { email, displayName: 'Recrue Croisee', roles: ['SUPPORT'] } });
    const invitation = tokenFrom(mailbox.sent.filter((m) => m.to === email).at(-1)!.text);
    const res = await api.call('POST', '/api/v1/auth/password-reset/accept', { body: { token: invitation, password: NEW_PASSWORD }, ip: '10.98.0.2' });
    expect(res.status).toBe(400);
    expect(res.body.detail).toBe('Lien invalide ou expiré');
    // le lien reste bon pour l'activation
    expect((await api.call('POST', '/api/v1/auth/invitation/accept', { body: { token: invitation, password: NEW_PASSWORD }, ip: '10.98.0.3' })).status).toBe(204);
  });
});
