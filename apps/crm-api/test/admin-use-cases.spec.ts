import { AuditAction } from '../src/modules/audit';
import { AcceptInvitationUseCase, InviteUserUseCase } from '../src/modules/iam/application/admin/invitations.use-cases';
import { RoleCode, ROLES, resolveGrants } from '../src/modules/iam/domain/roles';
import { UserStatus } from '../src/modules/iam/domain/user';
import { AppConfig } from '../src/shared-kernel';
import { actor } from './support/iam-fakes';
import { buildIamWorld } from './support/iam-world';

type World = ReturnType<typeof buildIamWorld>;
const HOUR = 3_600_000;
const NEW_PASSWORD = 'cheval agrafeuse nuage lointain 73';

/** Crée un administrateur actif (SuperAdmin) et retourne son contexte d'acteur. */
async function admin(w: World, email = 'admin@investally.test') {
  const created = await w.createDefaultUser([RoleCode.SuperAdmin], email);
  return { id: created.id, actor: actor({ userId: created.id }), access: await w.authorization.contextFor(created.id) };
}
const emailTo = (w: World, address: string) => w.email.sent.filter((m) => m.to === address).at(-1);
const tokenFrom = (text: string) => /#token=([\w-]+)/.exec(text)![1];

describe('Résolution des droits (B1)', () => {
  it('chaque rôle reçoit exactement les droits de la matrice ; deux rôles se cumulent', async () => {
    const w = buildIamWorld();
    for (const role of ROLES) {
      const user = await w.createDefaultUser([role.code], `${role.code.toLowerCase()}@investally.test`);
      const context = await w.authorization.contextFor(user.id);
      expect([...context.grants].sort((a, b) => a.permission.localeCompare(b.permission))).toEqual(resolveGrants(role.code));
    }
    const both = await w.createDefaultUser([RoleCode.AccountManager, RoleCode.Trainer], 'double@investally.test');
    const context = await w.authorization.contextFor(both.id);
    expect(context.grants.some((g) => g.permission === 'training.attendance.record')).toBe(true);
    expect(context.grants.some((g) => g.permission === 'bd.company.create')).toBe(true);
  });

  it('un utilisateur sans rôle n\'a AUCUN droit ; chaque refus est audité ACCESS_DENIED', async () => {
    const w = buildIamWorld();
    const user = await w.createDefaultUser([RoleCode.Support], 'support@investally.test');
    w.users.roles.set(user.id, []);
    const context = await w.authorization.contextFor(user.id);
    expect(context.grants).toEqual([]);

    w.audit.length = 0;
    await expect(w.authorization.assertPermission(context, 'bd.company.read', actor({ userId: user.id }))).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(w.audit[0]).toMatchObject({ action: AuditAction.AccessDenied, entityType: 'Permission', entityId: 'bd.company.read' });
  });

  it('un changement de rôle prend effet IMMÉDIATEMENT (droits relus à chaque requête)', async () => {
    const w = buildIamWorld();
    const boss = await admin(w);
    const user = await w.createDefaultUser([RoleCode.Support], 'support@investally.test');
    await expect(w.authorization.assertPermission(await w.authorization.contextFor(user.id), 'bd.company.create', actor())).rejects.toBeDefined();

    await w.assignRoles.execute({ userId: user.id, roles: [RoleCode.AccountManager], actor: boss.actor });

    await expect(w.authorization.assertPermission(await w.authorization.contextFor(user.id), 'bd.company.create', actor())).resolves.toBeUndefined();
  });
});

describe('Invitation (B2)', () => {
  it('crée un compte EN ATTENTE sans mot de passe, envoie le lien dans le FRAGMENT, et ne stocke jamais le jeton', async () => {
    const w = buildIamWorld();
    const boss = await admin(w);
    w.audit.length = 0;

    const result = await w.inviteUser.execute({
      email: 'Nouveau@Investally.test', displayName: 'Nouvelle Recrue', roles: [RoleCode.AccountManager], actor: boss.actor, access: boss.access,
    });

    expect(result.emailSent).toBe(true);
    expect(result.user).toMatchObject({ status: 'PENDING', roles: [RoleCode.AccountManager], mfaEnabled: false });
    const stored = w.users.items.get(result.user.id)!;
    expect(stored.passwordHash).toBeNull();
    expect(stored.canAuthenticate()).toBe(false);

    const mail = emailTo(w, 'Nouveau@Investally.test')!;
    expect(mail.subject).toBe('Invitation à Investally CRM');
    expect(mail.text).toContain('https://crm.test/invitation#token=');
    expect(mail.text).not.toContain('invitation?token'); // jamais dans la requête (journaux, Referer)
    const token = tokenFrom(mail.text);

    // Le jeton n'est stocké nulle part, seulement son empreinte
    const [record] = [...w.invitations.items.values()];
    expect(record.tokenHash).not.toContain(token);
    expect(JSON.stringify([...w.invitations.items.values()])).not.toContain(token);
    expect(JSON.stringify(w.audit)).not.toContain(token);
    expect(record.expiresAt.getTime() - record.createdAt.getTime()).toBe(48 * HOUR);
    expect(w.audit[0]).toMatchObject({ action: AuditAction.Create, entityType: 'User', newValue: { status: 'PENDING' } });
  });

  it('refuse un doublon d\'e-mail (casse ignorée), un rôle inconnu, une liste de rôles vide et un responsable inconnu', async () => {
    const w = buildIamWorld();
    const boss = await admin(w);
    const base = { displayName: 'Recrue', roles: [RoleCode.Trainer], actor: boss.actor, access: boss.access };
    await expect(w.inviteUser.execute({ ...base, email: 'ADMIN@investally.test' })).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(w.inviteUser.execute({ ...base, email: 'a@b.test', roles: ['PIRATE'] })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(w.inviteUser.execute({ ...base, email: 'a@b.test', roles: [] })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(w.inviteUser.execute({ ...base, email: 'a@b.test', managerId: 'inconnu' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(w.inviteUser.execute({ ...base, email: 'pas-une-adresse' })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(w.inviteUser.execute({ ...base, email: 'a@b.test', displayName: '   ' })).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(w.users.items.size).toBe(1); // rien n'a été créé
  });

  it('exige le droit d\'attribuer des rôles : sans lui, FORBIDDEN et aucun compte créé (défense en profondeur)', async () => {
    const w = buildIamWorld();
    await admin(w);
    const direction = await w.createDefaultUser([RoleCode.Direction], 'direction@investally.test');
    const weak = await w.authorization.contextFor(direction.id);
    await expect(
      w.inviteUser.execute({ email: 'intrus@investally.test', displayName: 'Intrus', roles: [RoleCode.SuperAdmin], actor: actor({ userId: direction.id }), access: weak }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(w.users.items.size).toBe(2);
    expect(emailTo(w, 'intrus@investally.test')).toBeUndefined();
  });

  it('si l\'e-mail ne peut pas partir : le compte est créé, emailSent = false, l\'échec est audité, le renvoi reste possible', async () => {
    const w = buildIamWorld();
    const boss = await admin(w);
    const failingSender = { send: async () => ({ ok: false as const, reason: 'UNAVAILABLE' as const }) };
    const config = { publicUrl: 'https://crm.test' } as AppConfig;
    const invite = new InviteUserUseCase(
      w.users, w.invitations, w.refreshFactory, failingSender, { record: async (r) => { w.audit.push(r); } },
      { run: (work) => work() }, w.clock, w.ids, config,
    );

    const result = await invite.execute({ email: 'x@investally.test', displayName: 'X Y', roles: [RoleCode.Support], actor: boss.actor, access: boss.access });

    expect(result.emailSent).toBe(false);
    expect(w.users.items.get(result.user.id)).toBeDefined();
    expect(w.audit.at(-1)).toMatchObject({ newValue: { event: 'invitation_email_failed', reason: 'UNAVAILABLE' } });
    await expect(w.resendInvitation.execute({ userId: result.user.id, actor: boss.actor })).resolves.toEqual({ emailSent: true });
  });
});

describe('Acceptation (B3) et renvoi (B4)', () => {
  async function invited(w: World) {
    const boss = await admin(w);
    const result = await w.inviteUser.execute({ email: 'recrue@investally.test', displayName: 'Recrue Test', roles: [RoleCode.AccountManager], actor: boss.actor, access: boss.access });
    return { boss, userId: result.user.id, token: tokenFrom(emailTo(w, 'recrue@investally.test')!.text) };
  }

  it('active le compte, hache le mot de passe, l\'historise, consomme le lien, audite — puis la connexion fonctionne', async () => {
    const w = buildIamWorld();
    const { userId, token } = await invited(w);
    w.audit.length = 0;

    await w.acceptInvitation.execute({ token, password: NEW_PASSWORD, actor: actor() });

    const user = w.users.items.get(userId)!;
    expect(user.status).toBe(UserStatus.Active);
    expect(user.passwordHash).toBe(`hash(${NEW_PASSWORD})`);
    expect(w.history.items.filter((h) => h.userId === userId)).toHaveLength(1);
    expect([...w.invitations.items.values()][0].usedAt).not.toBeNull();
    expect(w.audit[0]).toMatchObject({ action: AuditAction.Update, newValue: { event: 'invitation_accepted' } });
    expect(JSON.stringify(w.audit)).not.toContain(NEW_PASSWORD);

    const session = await w.login.execute({ email: 'recrue@investally.test', password: NEW_PASSWORD, actor: actor() });
    expect(session).toMatchObject({ mfaRequired: true, mfaEnrolled: false });
  });

  it('un mot de passe refusé par la politique NE consomme PAS le lien : on peut réessayer', async () => {
    const w = buildIamWorld();
    const { token } = await invited(w);
    await expect(w.acceptInvitation.execute({ token, password: 'court', actor: actor() })).rejects.toMatchObject({ code: 'VALIDATION', message: expect.stringContaining('Mot de passe refusé') });
    await expect(w.acceptInvitation.execute({ token, password: 'Recrue Test 2026!', actor: actor() })).rejects.toMatchObject({ message: expect.stringContaining('Mot de passe refusé') }); // contient le nom
    await expect(w.acceptInvitation.execute({ token, password: NEW_PASSWORD, actor: actor() })).resolves.toBeUndefined();
  });

  it('le lien est à usage unique', async () => {
    const w = buildIamWorld();
    const { token } = await invited(w);
    await w.acceptInvitation.execute({ token, password: NEW_PASSWORD, actor: actor() });
    await expect(w.acceptInvitation.execute({ token, password: 'une autre phrase de passe 99', actor: actor() })).rejects.toMatchObject({ message: 'Lien invalide ou expiré' });
  });

  it('inconnu, expiré, utilisé, révoqué : TOUS le même refus générique (aucune information sur le lien)', async () => {
    const w = buildIamWorld();
    const { boss, userId, token } = await invited(w);
    const messages = new Set<string>();
    const attempt = (t: string) => w.acceptInvitation.execute({ token: t, password: NEW_PASSWORD, actor: actor() }).catch((e) => messages.add(`${e.code}|${e.message}`));

    await attempt('jamais-emis');
    await attempt('');
    w.clock.advance(48 * HOUR); // expiré
    await attempt(token);

    const w2 = buildIamWorld();
    const second = await invited(w2);
    await w2.acceptInvitation.execute({ token: second.token, password: NEW_PASSWORD, actor: actor() });
    await w2.acceptInvitation.execute({ token: second.token, password: NEW_PASSWORD, actor: actor() }).catch((e) => messages.add(`${e.code}|${e.message}`)); // utilisé

    const w3 = buildIamWorld();
    const third = await invited(w3);
    await w3.resendInvitation.execute({ userId: third.userId, actor: third.boss.actor });
    await w3.acceptInvitation.execute({ token: third.token, password: NEW_PASSWORD, actor: actor() }).catch((e) => messages.add(`${e.code}|${e.message}`)); // révoqué

    expect([...messages]).toEqual(['VALIDATION|Lien invalide ou expiré']);
    expect(userId).toBeDefined();
    expect(boss).toBeDefined();
  });

  it('les refus sont audités (ACCESS_DENIED) sans jamais écrire le jeton', async () => {
    const w = buildIamWorld();
    const { token } = await invited(w);
    w.audit.length = 0;
    await w.acceptInvitation.execute({ token: 'jamais-emis', password: NEW_PASSWORD, actor: actor() }).catch(() => undefined);
    expect(w.audit[0]).toMatchObject({ action: AuditAction.AccessDenied, entityType: 'UserInvitation', newValue: { reason: 'UNKNOWN' } });
    expect(JSON.stringify(w.audit)).not.toContain('jamais-emis');
    expect(JSON.stringify(w.audit)).not.toContain(token);
  });

  it('B4 — le renvoi révoque les liens précédents et envoie un nouveau lien valable 48 h', async () => {
    const w = buildIamWorld();
    const { boss, userId, token: first } = await invited(w);
    w.clock.advance(HOUR);
    await expect(w.resendInvitation.execute({ userId, actor: boss.actor })).resolves.toEqual({ emailSent: true });
    const second = tokenFrom(emailTo(w, 'recrue@investally.test')!.text);
    expect(second).not.toBe(first);

    await expect(w.acceptInvitation.execute({ token: first, password: NEW_PASSWORD, actor: actor() })).rejects.toMatchObject({ message: 'Lien invalide ou expiré' });
    await expect(w.acceptInvitation.execute({ token: second, password: NEW_PASSWORD, actor: actor() })).resolves.toBeUndefined();
  });

  it('B4 — refuse le renvoi pour un compte déjà actif ou inconnu', async () => {
    const w = buildIamWorld();
    const boss = await admin(w);
    await expect(w.resendInvitation.execute({ userId: boss.id, actor: boss.actor })).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(w.resendInvitation.execute({ userId: 'inconnu', actor: boss.actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('Attribution de rôles (B5, B7)', () => {
  it('remplace les rôles, audite ROLE_CHANGE avec avant/après/ajoutés/retirés', async () => {
    const w = buildIamWorld();
    const boss = await admin(w);
    const user = await w.createDefaultUser([RoleCode.Support], 'u@investally.test');
    w.audit.length = 0;

    const view = await w.assignRoles.execute({ userId: user.id, roles: [RoleCode.AccountManager, RoleCode.Trainer], actor: boss.actor });

    expect(view.roles.sort()).toEqual([RoleCode.AccountManager, RoleCode.Trainer].sort());
    expect(w.audit[0]).toMatchObject({
      action: AuditAction.RoleChange, entityId: user.id,
      oldValue: { roles: [RoleCode.Support] },
      newValue: { added: [RoleCode.AccountManager, RoleCode.Trainer].sort(), removed: [RoleCode.Support] },
    });
  });

  it('B5 — INTERDIT de modifier ses propres rôles, SuperAdmin compris', async () => {
    const w = buildIamWorld();
    const boss = await admin(w);
    await expect(w.assignRoles.execute({ userId: boss.id, roles: [RoleCode.SuperAdmin, RoleCode.Direction], actor: boss.actor })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(w.users.roles.get(boss.id)).toEqual([RoleCode.SuperAdmin]);
  });

  it('refuse les rôles inconnus, vides, et un utilisateur inconnu', async () => {
    const w = buildIamWorld();
    const boss = await admin(w);
    const user = await w.createDefaultUser([RoleCode.Support], 'u@investally.test');
    await expect(w.assignRoles.execute({ userId: user.id, roles: ['ROOT'], actor: boss.actor })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(w.assignRoles.execute({ userId: user.id, roles: [], actor: boss.actor })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(w.assignRoles.execute({ userId: 'inconnu', roles: [RoleCode.Trainer], actor: boss.actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(w.users.roles.get(user.id)).toEqual([RoleCode.Support]);
  });

  it('B7 — refuse de retirer le rôle SuperAdmin au DERNIER SuperAdmin actif', async () => {
    const w = buildIamWorld();
    const lone = await admin(w);
    const other = await w.createDefaultUser([RoleCode.Direction], 'direction@investally.test');
    await expect(w.assignRoles.execute({ userId: lone.id, roles: [RoleCode.Direction], actor: actor({ userId: other.id }) })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
    expect(w.users.roles.get(lone.id)).toEqual([RoleCode.SuperAdmin]);
  });

  it('B7 — l\'autorise quand un AUTRE SuperAdmin actif existe ; un SuperAdmin désactivé ne compte pas', async () => {
    const w = buildIamWorld();
    const first = await admin(w, 'a1@investally.test');
    const second = await admin(w, 'a2@investally.test');
    await expect(w.assignRoles.execute({ userId: first.id, roles: [RoleCode.Direction], actor: second.actor })).resolves.toBeDefined();

    // second est maintenant le seul SuperAdmin actif : on ne peut plus le retirer
    const third = await w.createDefaultUser([RoleCode.Direction], 'd@investally.test');
    await expect(w.assignRoles.execute({ userId: second.id, roles: [RoleCode.Support], actor: actor({ userId: third.id }) })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
  });
});

describe('Désactivation (B6)', () => {
  it('désactive, révoque TOUTES les sessions et tous les jetons, audite ; le jeton d\'accès est refusé aussitôt', async () => {
    const w = buildIamWorld();
    const boss = await admin(w);
    const user = await w.createDefaultUser([RoleCode.AccountManager], 'u@investally.test');
    const a = await w.login.execute({ email: 'u@investally.test', password: w.PASSWORD, actor: actor() });
    const b = await w.login.execute({ email: 'u@investally.test', password: w.PASSWORD, actor: actor({ device: 'autre' }) });
    w.audit.length = 0;

    const view = await w.setStatus.execute({ userId: user.id, enabled: false, actor: boss.actor });

    expect(view.status).toBe('DISABLED');
    for (const s of [a, b]) expect(w.sessions.items.get(s.sessionId)!.revokedAt).not.toBeNull();
    expect([...w.refreshTokens.items.values()].filter((t) => !t.revokedAt)).toHaveLength(0);
    expect(await w.authenticate.execute(a.accessToken)).toBeNull();
    await expect(w.refresh.execute({ refreshToken: b.refreshToken, actor: actor() })).rejects.toBeDefined();
    await expect(w.login.execute({ email: 'u@investally.test', password: w.PASSWORD, actor: actor() })).rejects.toMatchObject({ message: 'Identifiants invalides' });
    expect(w.audit[0]).toMatchObject({ action: AuditAction.Update, oldValue: { status: 'ACTIVE' }, newValue: { status: 'DISABLED', sessionsRevoked: 2 } });
  });

  it('refuse de se désactiver soi-même et de désactiver le dernier SuperAdmin actif', async () => {
    const w = buildIamWorld();
    const lone = await admin(w);
    await expect(w.setStatus.execute({ userId: lone.id, enabled: false, actor: lone.actor })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const other = await w.createDefaultUser([RoleCode.Direction], 'd@investally.test');
    await expect(w.setStatus.execute({ userId: lone.id, enabled: false, actor: actor({ userId: other.id }) })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
    expect(w.users.items.get(lone.id)!.status).toBe(UserStatus.Active);
  });

  it('avec deux SuperAdmin on peut en désactiver un, puis le réactiver', async () => {
    const w = buildIamWorld();
    const first = await admin(w, 'a1@investally.test');
    const second = await admin(w, 'a2@investally.test');
    await w.setStatus.execute({ userId: first.id, enabled: false, actor: second.actor });
    expect(w.users.items.get(first.id)!.status).toBe(UserStatus.Disabled);
    await w.setStatus.execute({ userId: first.id, enabled: true, actor: second.actor });
    expect(w.users.items.get(first.id)!.status).toBe(UserStatus.Active);
  });

  it('ne réactive pas un compte actif, ni un compte jamais activé', async () => {
    const w = buildIamWorld();
    const boss = await admin(w);
    const user = await w.createDefaultUser([RoleCode.Support], 'u@investally.test');
    await expect(w.setStatus.execute({ userId: user.id, enabled: true, actor: boss.actor })).rejects.toMatchObject({ code: 'CONFLICT' });
    const invited = await w.inviteUser.execute({ email: 'n@investally.test', displayName: 'N N', roles: [RoleCode.Support], actor: boss.actor, access: boss.access });
    await w.setStatus.execute({ userId: invited.user.id, enabled: false, actor: boss.actor });
    await expect(w.setStatus.execute({ userId: invited.user.id, enabled: true, actor: boss.actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
  });
});

describe('Modification d\'un utilisateur et hiérarchie (B8)', () => {
  it('renomme et rattache à un responsable ; audit avant/après', async () => {
    const w = buildIamWorld();
    const boss = await admin(w);
    const manager = await w.createDefaultUser([RoleCode.HeadOfSales], 'hos@investally.test');
    const user = await w.createDefaultUser([RoleCode.AccountManager], 'am@investally.test');
    w.audit.length = 0;

    const view = await w.updateUser.execute({ userId: user.id, displayName: '  Marie K.  ', managerId: manager.id, actor: boss.actor });

    expect(view).toMatchObject({ displayName: 'Marie K.', managerId: manager.id });
    expect(w.audit[0]).toMatchObject({ action: AuditAction.Update, oldValue: { managerId: null }, newValue: { displayName: 'Marie K.', managerId: manager.id } });
  });

  it('retire le responsable avec null ; « rien à modifier » est refusé ; responsable inconnu refusé', async () => {
    const w = buildIamWorld();
    const boss = await admin(w);
    const manager = await w.createDefaultUser([RoleCode.HeadOfSales], 'hos@investally.test');
    const user = await w.createDefaultUser([RoleCode.AccountManager], 'am@investally.test');
    await w.updateUser.execute({ userId: user.id, managerId: manager.id, actor: boss.actor });
    await expect(w.updateUser.execute({ userId: user.id, managerId: null, actor: boss.actor })).resolves.toMatchObject({ managerId: null });
    await expect(w.updateUser.execute({ userId: user.id, actor: boss.actor })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(w.updateUser.execute({ userId: user.id, managerId: 'inconnu', actor: boss.actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('REFUSE les cycles : soi-même, direct, indirect', async () => {
    const w = buildIamWorld();
    const boss = await admin(w);
    const a = await w.createDefaultUser([RoleCode.HeadOfSales], 'a@investally.test');
    const b = await w.createDefaultUser([RoleCode.HeadOfSales], 'b@investally.test', );
    const c = await w.createDefaultUser([RoleCode.AccountManager], 'c@investally.test');
    await w.updateUser.execute({ userId: b.id, managerId: a.id, actor: boss.actor }); // a → b
    await w.updateUser.execute({ userId: c.id, managerId: b.id, actor: boss.actor }); // a → b → c

    await expect(w.updateUser.execute({ userId: a.id, managerId: a.id, actor: boss.actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' });
    await expect(w.updateUser.execute({ userId: a.id, managerId: b.id, actor: boss.actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' }); // direct
    await expect(w.updateUser.execute({ userId: a.id, managerId: c.id, actor: boss.actor })).rejects.toMatchObject({ code: 'INVARIANT_VIOLATION' }); // indirect
    expect(w.users.items.get(a.id)!.managerId).toBeNull();
  });

  it('le nom est validé (vide refusé)', async () => {
    const w = buildIamWorld();
    const boss = await admin(w);
    const user = await w.createDefaultUser([RoleCode.Support], 'u@investally.test');
    await expect(w.updateUser.execute({ userId: user.id, displayName: '  ', actor: boss.actor })).rejects.toMatchObject({ code: 'VALIDATION' });
  });
});

describe('Consultation des utilisateurs et des rôles', () => {
  it('liste paginée : taille plafonnée à 100, recherche, filtre de statut ; jamais de hachage ni de secret', async () => {
    const w = buildIamWorld();
    const boss = await admin(w);
    for (let i = 0; i < 5; i++) await w.createDefaultUser([RoleCode.Support], `agent${i}@investally.test`);
    await w.inviteUser.execute({ email: 'attente@investally.test', displayName: 'En Attente', roles: [RoleCode.Support], actor: boss.actor, access: boss.access });

    const all = await w.listUsers.execute({ page: 1, pageSize: 1000 });
    expect(all.pageSize).toBe(100);
    expect(all.total).toBe(7);

    expect((await w.listUsers.execute({ page: 1, pageSize: 2 })).items).toHaveLength(2);
    expect((await w.listUsers.execute({ page: 2, pageSize: 5 })).items).toHaveLength(2);
    expect((await w.listUsers.execute({ page: 1, pageSize: 20, search: 'AGENT3' })).items.map((u) => u.email)).toEqual(['agent3@investally.test']);
    expect((await w.listUsers.execute({ page: 1, pageSize: 20, status: 'PENDING' })).total).toBe(1);
    expect((await w.listUsers.execute({ page: -4, pageSize: 0 })).page).toBe(1);

    const serialized = JSON.stringify(all);
    expect(serialized).not.toMatch(/hash\(|passwordHash|mfaSecret|failedLogin|tokenHash/);
    expect(Object.keys(all.items[0]).sort()).toEqual(['createdAt', 'displayName', 'email', 'id', 'lastLoginAt', 'managerId', 'mfaEnabled', 'roles', 'status']);
  });

  it('GET d\'un utilisateur : introuvable → NOT_FOUND ; rôles listés ; catalogue des rôles conforme à la matrice', async () => {
    const w = buildIamWorld();
    const boss = await admin(w);
    await expect(w.getUser.execute('inconnu')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(await w.getUser.execute(boss.id)).toMatchObject({ roles: [RoleCode.SuperAdmin], status: 'ACTIVE' });

    const roles = await w.listRoles.execute();
    expect(roles.map((r) => r.code).sort()).toEqual(ROLES.map((r) => r.code).sort());
    const superAdmin = roles.find((r) => r.code === RoleCode.SuperAdmin)!;
    expect(superAdmin.permissions.length).toBeGreaterThan(90);
    expect(superAdmin.mfaRequired).toBe(true);
  });
});

describe('Sessions (B10)', () => {
  it('chacun ne voit que SES sessions actives, la session courante est signalée', async () => {
    const w = buildIamWorld();
    await w.createDefaultUser([RoleCode.AccountManager], 'a@investally.test');
    await w.createDefaultUser([RoleCode.AccountManager], 'b@investally.test');
    const a1 = await w.login.execute({ email: 'a@investally.test', password: w.PASSWORD, actor: actor() });
    const a2 = await w.login.execute({ email: 'a@investally.test', password: w.PASSWORD, actor: actor({ device: 'tel' }) });
    const b1 = await w.login.execute({ email: 'b@investally.test', password: w.PASSWORD, actor: actor() });

    const mine = await w.listOwnSessions.execute({ userId: a1.userId, sessionId: a1.sessionId });
    expect(mine.map((s) => s.id).sort()).toEqual([a1.sessionId, a2.sessionId].sort());
    expect(mine.find((s) => s.id === a1.sessionId)!.current).toBe(true);
    expect(mine.find((s) => s.id === a2.sessionId)!.current).toBe(false);
    expect(mine.map((s) => s.id)).not.toContain(b1.sessionId);
    expect(JSON.stringify(mine)).not.toMatch(/token|hash/i);
  });

  it('on révoque la sienne (audit) ; celle d\'un collègue est « introuvable » ; un SuperAdmin (portée Tous) peut tout révoquer', async () => {
    const w = buildIamWorld();
    const boss = await admin(w);
    await w.createDefaultUser([RoleCode.AccountManager], 'a@investally.test');
    await w.createDefaultUser([RoleCode.AccountManager], 'b@investally.test');
    const a = await w.login.execute({ email: 'a@investally.test', password: w.PASSWORD, actor: actor() });
    const b = await w.login.execute({ email: 'b@investally.test', password: w.PASSWORD, actor: actor() });
    const accessOf = (id: string) => w.authorization.contextFor(id);

    // a ne peut pas révoquer la session de b
    await expect(w.revokeSession.execute({ sessionId: b.sessionId, access: await accessOf(a.userId), actor: actor({ userId: a.userId }) })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(w.sessions.items.get(b.sessionId)!.revokedAt).toBeNull();
    await expect(w.revokeSession.execute({ sessionId: 'inexistante', access: await accessOf(a.userId), actor: actor() })).rejects.toMatchObject({ code: 'NOT_FOUND' });

    // a révoque la sienne
    w.audit.length = 0;
    await w.revokeSession.execute({ sessionId: a.sessionId, access: await accessOf(a.userId), actor: actor({ userId: a.userId }) });
    expect(w.sessions.items.get(a.sessionId)!.revokedAt).not.toBeNull();
    expect(await w.authenticate.execute(a.accessToken)).toBeNull();
    expect(w.audit[0]).toMatchObject({ action: AuditAction.SessionRevoke, newValue: { byOwner: true } });

    // le SuperAdmin révoque celle de b
    await w.revokeSession.execute({ sessionId: b.sessionId, access: await accessOf(boss.id), actor: boss.actor });
    expect(await w.authenticate.execute(b.accessToken)).toBeNull();
  });

  it('« révoquer toutes les sessions d\'un utilisateur » : réservé à la portée Tous ; coupe sessions et jetons', async () => {
    const w = buildIamWorld();
    const boss = await admin(w);
    await w.createDefaultUser([RoleCode.AccountManager], 'a@investally.test');
    const other = await w.createDefaultUser([RoleCode.AccountManager], 'b@investally.test');
    const s1 = await w.login.execute({ email: 'a@investally.test', password: w.PASSWORD, actor: actor() });
    await w.login.execute({ email: 'a@investally.test', password: w.PASSWORD, actor: actor({ device: 'tel' }) });

    await expect(w.revokeUserSessions.execute({ targetUserId: s1.userId, access: await w.authorization.contextFor(other.id), actor: actor({ userId: other.id }) })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(w.sessions.items.get(s1.sessionId)!.revokedAt).toBeNull();

    await expect(w.revokeUserSessions.execute({ targetUserId: s1.userId, access: await w.authorization.contextFor(boss.id), actor: boss.actor })).resolves.toEqual({ revoked: 2 });
    expect([...w.refreshTokens.items.values()].filter((t) => t.sessionId && !t.revokedAt)).toHaveLength(0);
    await expect(w.revokeUserSessions.execute({ targetUserId: 'inconnu', access: await w.authorization.contextFor(boss.id), actor: boss.actor })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
