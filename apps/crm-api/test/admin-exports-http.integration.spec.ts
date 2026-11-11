import 'reflect-metadata';
import { ADMIN_EXPORT_READER, AdminExportReader } from '../src/modules/iam/application/admin/admin-exports';
import { RoleCode } from '../src/modules/iam/domain/roles';
import { Api, createUserWithRoles, mfaSession, startRbacApp } from './support/rbac-http';
import { TestApp } from './support/test-app';

const describeDb = process.env.DATABASE_URL && process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;

/**
 * Lot C (décision D66) de bout en bout (HTTP + PostgreSQL) : exports d'administration en CSV, réservés au Super administrateur, second facteur récent exigé, chaque
 * export tracé dans l'audit, aucun secret dans le fichier, neutralisation des formules.
 */
describeDb('Exports d’administration (HTTP + PostgreSQL)', () => {
  let t: TestApp;
  let api: Api;
  let seq = 0;
  const ip = () => `10.97.${Math.floor(seq / 250)}.${(seq++ % 250) + 1}`;
  const BOM = '﻿';
  type As = { token: string; ip: string; sessionId: string; userId: string };

  beforeAll(async () => {
    ({ t, api } = await startRbacApp());
  }, 60_000);
  afterAll(() => t.close());

  const login = async (role: RoleCode, options: { name?: string; mfaAgeMs?: number } = {}): Promise<As & { email: string }> => {
    const user = await createUserWithRoles(t, [role], { name: options.name });
    const addr = ip();
    const session = await mfaSession(t, api, user.email, addr, options.mfaAgeMs ?? 0);
    return { token: session.token, ip: addr, sessionId: session.sessionId as string, userId: user.id, email: user.email };
  };
  const text = (res: { bytes: Buffer }) => res.bytes.toString('utf8');
  const lines = (csv: string) => csv.replace(BOM, '').split('\r\n').filter(Boolean);
  const exportOf = (as: As, kind: string, query = '') => api.call('GET', `/api/v1/admin/exports/${kind}${query}`, as);

  it('le Super administrateur télécharge les trois exports en CSV : en-têtes sûrs, jamais mis en cache, nom de fichier daté', async () => {
    const admin = await login(RoleCode.SuperAdmin);
    for (const [kind, fragment] of [['users', 'utilisateurs'], ['rights', 'droits'], ['sessions', 'sessions']] as const) {
      const res = await exportOf(admin, kind);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('text/csv; charset=utf-8');
      expect(res.headers.get('content-disposition')).toMatch(new RegExp(`^attachment; filename="investally-${fragment}-\\d{4}-\\d{2}-\\d{2}_\\d{2}h\\d{2}\\.csv"$`));
      expect(res.headers.get('cache-control')).toBe('no-store');
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('content-security-policy')).toContain("default-src 'none'");
      expect(text(res).startsWith(BOM)).toBe(true);
      expect(text(res).endsWith('\r\n')).toBe(true);
    }
  });

  it('utilisateurs : le compte exporté y figure avec ses rôles et son second facteur ; AUCUN secret (ni hachage, ni secret TOTP, ni jeton) n’est dans le fichier', async () => {
    const admin = await login(RoleCode.SuperAdmin);
    const hr = await login(RoleCode.Hr, { name: 'Zoé Exportée' });
    const csv = text(await exportOf(admin, 'users'));
    const row = lines(csv).find((l) => l.includes(hr.email))!;
    expect(row).toBeDefined();
    expect(row).toContain('Zoé Exportée');
    expect(row).toContain(';HR;RH;');
    expect(lines(csv)[0]).toBe('Identifiant;E-mail;Nom;Statut;Rôles;Rôles (libellés);Responsable (e-mail);Second facteur actif;Dernière connexion;Créé le');
    // Ce qui est sensible en base : le hachage du mot de passe, le secret du second facteur, les jetons.
    const secrets = await t.prisma.db.user.findMany({ select: { passwordHash: true, mfaSecretEnc: true } });
    for (const s of secrets) {
      if (s.passwordHash) expect(csv).not.toContain(s.passwordHash);
      if (s.mfaSecretEnc) expect(csv).not.toContain(s.mfaSecretEnc);
    }
    expect(csv).not.toMatch(/argon2|\$argon|v1:|Bearer |eyJ[A-Za-z0-9_-]{10,}\./);
  });

  it('utilisateurs : un nom qui ressemble à une formule est neutralisé (apostrophe en tête), les accents et les « ; » restent lisibles', async () => {
    const admin = await login(RoleCode.SuperAdmin);
    const evil = await login(RoleCode.Support, { name: '=HYPERLINK("http://mal.example","cliquez")' });
    const semi = await login(RoleCode.Support, { name: 'Dupont; Jean' });
    const csv = text(await exportOf(admin, 'users'));
    expect(lines(csv).find((l) => l.includes(evil.email))).toContain(`"'=HYPERLINK(""http://mal.example"",""cliquez"")"`);
    expect(lines(csv).find((l) => l.includes(semi.email))).toContain('"Dupont; Jean"');
    expect(csv).not.toMatch(/;=HYPERLINK/);
  });

  it('le lecteur borne sa lecture : au plus limite + 1 lignes, même quand la base en a davantage', async () => {
    await login(RoleCode.SuperAdmin);
    await login(RoleCode.Support);
    await login(RoleCode.Hr);
    const reader = t.get<AdminExportReader>(ADMIN_EXPORT_READER as never);
    expect(await reader.users(1)).toHaveLength(2);
    expect(await reader.sessions(new Date(0), 1)).toHaveLength(2);
    expect((await reader.users(1000)).length).toBeGreaterThan(2);
  });

  it('utilisateurs : un compte supprimé logiquement ne figure pas dans l’export', async () => {
    const admin = await login(RoleCode.SuperAdmin);
    const gone = await login(RoleCode.Support, { name: 'Compte Supprimé Export' });
    await t.prisma.db.user.update({ where: { id: gone.userId }, data: { deletedAt: new Date() } });
    const csv = text(await exportOf(admin, 'users'));
    expect(csv).not.toContain(gone.email);
    expect(csv).not.toContain('Compte Supprimé Export');
  });

  it('droits : une ligne par rôle et permission, lue en base ; le Super administrateur est le seul à porter l’export', async () => {
    const admin = await login(RoleCode.SuperAdmin);
    const csv = text(await exportOf(admin, 'rights'));
    const rows = lines(csv);
    expect(rows[0]).toBe('Rôle;Rôle (libellé);Second facteur exigé;Permission;Module;Ressource;Ressource (libellé);Action;Portée');
    const total = await t.prisma.db.rolePermission.count();
    expect(rows.length - 1).toBe(total);
    const holders = rows.filter((l) => l.split(';')[3] === 'iam.export.read').map((l) => l.split(';')[0]);
    expect(holders).toEqual(['SUPER_ADMIN']);
    expect(rows.find((l) => l.startsWith('SUPER_ADMIN;') && l.includes(';iam.export.read;'))).toContain(';Exports d’administration;read;Tous');
  });

  it('sessions : les connexions de la période, avec adresse, appareil et état ; la période se borne à 1 à 365 jours', async () => {
    const admin = await login(RoleCode.SuperAdmin);
    const other = await login(RoleCode.Support);
    await t.prisma.db.userSession.update({ where: { id: other.sessionId }, data: { revokedAt: new Date(), revokedReason: 'Appareil perdu' } });
    const csv = text(await exportOf(admin, 'sessions', '?days=30'));
    const row = lines(csv).find((l) => l.startsWith(`${other.sessionId};`))!;
    expect(row).toContain(other.email);
    expect(row).toContain('Révoquée : Appareil perdu');
    expect(lines(csv).find((l) => l.startsWith(`${admin.sessionId};`))).toContain(';Active;');
    // Une session très ancienne n'est pas dans une période courte.
    await t.prisma.db.userSession.update({ where: { id: other.sessionId }, data: { loggedInAt: new Date(Date.now() - 200 * 24 * 3_600_000) } });
    expect(text(await exportOf(admin, 'sessions', '?days=30'))).not.toContain(other.sessionId);
    expect(text(await exportOf(admin, 'sessions', '?days=365'))).toContain(other.sessionId);
    for (const bad of ['0', '366', '-3', 'abc', '1.5']) expect((await exportOf(admin, 'sessions', `?days=${bad}`)).status).toBe(400);
  });

  it('un type d’export inconnu est refusé (400), jamais exécuté', async () => {
    const admin = await login(RoleCode.SuperAdmin);
    for (const kind of ['inconnu', 'USERS', 'users.csv', 'passwords', 'audit']) expect((await exportOf(admin, kind)).status).toBe(400);
  });

  it('aucun autre rôle ne peut exporter : 403, quel que soit le rôle et le type d’export, sans trace d’export', async () => {
    const before = await t.prisma.db.auditLog.count({ where: { entityType: 'AdminExport' } });
    for (const role of Object.values(RoleCode).filter((r) => r !== RoleCode.SuperAdmin)) {
      const as = await login(role);
      for (const kind of ['users', 'rights', 'sessions']) {
        const res = await exportOf(as, kind);
        expect([role, kind, res.status]).toEqual([role, kind, 403]);
        expect(text(res)).not.toContain('@');
      }
    }
    expect(await t.prisma.db.auditLog.count({ where: { entityType: 'AdminExport' } })).toBe(before);
  });

  it('sans jeton : 401 ; second facteur non vérifié : MFA_REQUIRED ; MFA ancien : MFA_STEP_UP_REQUIRED ; rien n’est tracé dans ces cas', async () => {
    const before = await t.prisma.db.auditLog.count({ where: { entityType: 'AdminExport' } });
    expect((await api.call('GET', '/api/v1/admin/exports/users')).status).toBe(401);
    const stale = await login(RoleCode.SuperAdmin, { mfaAgeMs: 15 * 60_000 });
    const res = await exportOf(stale, 'users');
    expect(res.status).toBe(403);
    expect(res.body.title).toBe('MFA_STEP_UP_REQUIRED');
    expect(text(res)).not.toContain('@demo');
    expect(await t.prisma.db.auditLog.count({ where: { entityType: 'AdminExport' } })).toBe(before);
  });

  it('chaque export est tracé dans l’audit (qui, session, adresse, nature, lignes, nom du fichier) sans recopier le contenu', async () => {
    const admin = await login(RoleCode.SuperAdmin);
    const marker = await login(RoleCode.Support, { name: 'Marqueur Audit Export' });
    const users = await exportOf(admin, 'users');
    const rights = await exportOf(admin, 'rights');
    const sessions = await exportOf(admin, 'sessions', '?days=7');
    for (const res of [users, rights, sessions]) expect(res.status).toBe(200);
    const traces = await t.prisma.db.auditLog.findMany({ where: { entityType: 'AdminExport', userId: admin.userId }, orderBy: { createdAt: 'asc' } });
    expect(traces.map((x) => x.entityId)).toEqual(['users', 'rights', 'sessions']);
    for (const trace of traces) {
      expect(trace).toMatchObject({ action: 'EXPORT', module: 'iam', sessionId: admin.sessionId });
      expect(trace.ipAddress).toBeTruthy();
    }
    expect(traces[0]!.newValue).toMatchObject({ export: 'users', format: 'csv', rows: lines(text(users)).length - 1 });
    expect(traces[1]!.newValue).toMatchObject({ export: 'rights', rows: lines(text(rights)).length - 1 });
    expect(traces[2]!.newValue).toMatchObject({ export: 'sessions', days: 7 });
    expect(JSON.stringify(traces.map((x) => x.newValue))).not.toContain(marker.email);
    expect(JSON.stringify(traces.map((x) => x.newValue))).not.toContain('Marqueur Audit Export');
    expect((traces[0]!.newValue as { fileName: string }).fileName).toMatch(/^investally-utilisateurs-.*\.csv$/);
  });
});
