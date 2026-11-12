import { ActorContext, DomainError } from '../../../../shared-kernel';
import { AuditAction, AuditRecord } from '../../../audit';
import { RoleCode, resolveGrants } from '../../domain/roles';
import type { AccessContext } from '../access-types';
import {
  AdminExportReader, DEFAULT_SESSION_DAYS, ExportAdminDataHandler, ExportedSessionRow, ExportedUserRow, MAX_SESSION_DAYS, MAX_SESSION_ROWS, MAX_USER_ROWS, sessionEnd,
} from './admin-exports';
import type { RoleView } from './user-view';

const NOW = new Date('2026-11-11T09:00:00Z');
const actor: ActorContext = { userId: 'sa', sessionId: 's-1', ipAddress: '10.0.0.1', device: 'jest' };
const as = (role: RoleCode): AccessContext => ({ actorId: 'u', grants: resolveGrants(role), teamMemberIds: [] });
const superAdmin = as(RoleCode.SuperAdmin);

const user = (over: Partial<ExportedUserRow> = {}): ExportedUserRow => ({
  id: 'u1', email: 'ada@demo.test', displayName: 'Ada Lovelace', status: 'ACTIVE', roles: ['HR', 'ACCOUNT_MANAGER'], managerEmail: 'chef@demo.test', mfaEnabled: true,
  lastLoginAt: new Date('2026-11-10T08:30:00Z'), createdAt: new Date('2026-10-01T08:00:00Z'), ...over,
});
const session = (over: Partial<ExportedSessionRow> = {}): ExportedSessionRow => ({
  id: 'ss1', userEmail: 'ada@demo.test', userName: 'Ada Lovelace', loggedInAt: new Date('2026-11-11T08:00:00Z'), lastSeenAt: new Date('2026-11-11T08:30:00Z'),
  expiresAt: new Date('2026-11-11T09:30:00Z'), absoluteExpiresAt: new Date('2026-11-11T20:00:00Z'), loggedOutAt: null, revokedAt: null, revokedReason: null,
  ipAddress: '10.0.0.7', device: 'Edge sur Windows', riskLevel: 'LOW', mfaVerified: true, ...over,
});
const roles: RoleView[] = [
  { code: 'HR', label: 'RH', description: 'd', mfaRequired: true, permissions: [{ code: 'hr.employee.read', scope: 'ALL' }, { code: 'hr.directory.read', scope: 'ALL' }] },
  { code: 'ACCOUNT_MANAGER', label: 'Chargé de compte', description: 'd', mfaRequired: true, permissions: [{ code: 'bd.company.read', scope: 'OWN' }, { code: 'bd.company.update', scope: 'TEAM' }] },
];

function build(data: { users?: ExportedUserRow[]; sessions?: ExportedSessionRow[]; auditFails?: boolean } = {}) {
  const audit: AuditRecord[] = [];
  const asked: { usersLimit?: number; since?: Date; sessionsLimit?: number } = {};
  const reader: AdminExportReader = {
    users: async (limit) => { asked.usersLimit = limit; return data.users ?? []; },
    sessions: async (since, limit) => { asked.since = since; asked.sessionsLimit = limit; return data.sessions ?? []; },
  };
  const handler = new ExportAdminDataHandler(reader, { list: async () => roles }, { record: async (r: AuditRecord) => { if (data.auditFails) throw new Error('audit indisponible'); audit.push(r); } }, { now: () => NOW });
  return { handler, audit, asked };
}
const lines = (csv: string) => csv.replace(/^﻿/, '').split('\r\n').filter(Boolean);
const rejects = async (promise: Promise<unknown>, code: string, message?: RegExp) => {
  const error = await promise.then(() => null, (e: unknown) => e);
  expect(error).toBeInstanceOf(DomainError);
  expect((error as DomainError).code).toBe(code);
  if (message) expect((error as DomainError).message).toMatch(message);
};

describe('export des utilisateurs', () => {
  it('une ligne par compte : identité, statut, rôles (codes et libellés), responsable, second facteur, dates', async () => {
    const { handler } = build({ users: [user()] });
    const out = await handler.execute({ kind: 'users', access: superAdmin, actor });
    expect(out.rows).toBe(1);
    expect(lines(out.csv)).toEqual([
      'Identifiant;E-mail;Nom;Statut;Rôles;Rôles (libellés);Responsable (e-mail);Second facteur actif;Dernière connexion;Créé le',
      'u1;ada@demo.test;Ada Lovelace;Actif;ACCOUNT_MANAGER | HR;Chargé de compte | RH;chef@demo.test;oui;2026-11-10T08:30:00.000Z;2026-10-01T08:00:00.000Z',
    ]);
  });

  it('dit les statuts en français et laisse vides le responsable et la dernière connexion absents', async () => {
    const { handler } = build({ users: [user({ status: 'PENDING', managerEmail: null, lastLoginAt: null, mfaEnabled: false, roles: [] }), user({ id: 'u2', status: 'LOCKED' }), user({ id: 'u3', status: 'DISABLED' })] });
    const body = lines((await handler.execute({ kind: 'users', access: superAdmin, actor })).csv).slice(1);
    expect(body[0]).toBe('u1;ada@demo.test;Ada Lovelace;Invitation en attente;;;;non;;2026-10-01T08:00:00.000Z');
    expect(body[1]).toContain(';Verrouillé;');
    expect(body[2]).toContain(';Désactivé;');
  });

  it('ne contient AUCUN secret, même si le lecteur en remettait par erreur : seules les colonnes prévues sont écrites', async () => {
    const leaky = { ...user(), passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$SECRET', mfaSecretEnc: 'v1:SECRETTOTP', mfaLastUsedStep: 123456, failedLoginCount: 4, recoveryCodes: ['AAAAA-BBBBB'], refreshToken: 'jeton-secret' } as unknown as ExportedUserRow;
    const { handler } = build({ users: [leaky] });
    const csv = (await handler.execute({ kind: 'users', access: superAdmin, actor })).csv;
    for (const secret of ['argon2', 'SECRET', 'SECRETTOTP', '123456', 'AAAAA-BBBBB', 'jeton-secret']) expect(csv).not.toContain(secret);
    expect(lines(csv)[0]).not.toMatch(/mot de passe|hach|secret|jeton|code de secours/i);
  });

  it('neutralise l’injection de formule dans un nom ou une adresse', async () => {
    const { handler } = build({ users: [user({ displayName: '=HYPERLINK("http://mal.example","cliquez")', email: '+evil@demo.test' })] });
    const row = lines((await handler.execute({ kind: 'users', access: superAdmin, actor })).csv)[1]!;
    expect(row).toContain(`"'=HYPERLINK(""http://mal.example"",""cliquez"")"`);
    expect(row).toContain("'+evil@demo.test");
    expect(row).not.toMatch(/;=HYPERLINK/);
  });

  it('un nom avec un « ; » reste dans sa cellule', async () => {
    const { handler } = build({ users: [user({ displayName: 'Dupont; Jean' })] });
    expect(lines((await handler.execute({ kind: 'users', access: superAdmin, actor })).csv)[1]).toContain('"Dupont; Jean"');
  });

  it('refuse plutôt que de tronquer au-delà de la limite, et demande la limite + 1 au lecteur', async () => {
    const many = Array.from({ length: MAX_USER_ROWS + 1 }, (_, i) => user({ id: `u${i}` }));
    const { handler, asked } = build({ users: many });
    await rejects(handler.execute({ kind: 'users', access: superAdmin, actor }), 'VALIDATION', /refusé plutôt que tronqué/);
    expect(asked.usersLimit).toBe(MAX_USER_ROWS);
  });

  it('accepte exactement la limite (10 000 comptes) : seul le dépassement est refusé', async () => {
    const exact = Array.from({ length: MAX_USER_ROWS }, (_, i) => user({ id: `u${i}` }));
    const out = await build({ users: exact }).handler.execute({ kind: 'users', access: superAdmin, actor });
    expect(out.rows).toBe(MAX_USER_ROWS);
  });

  it('une base sans compte donne un fichier avec son seul en-tête', async () => {
    const { handler } = build();
    const out = await handler.execute({ kind: 'users', access: superAdmin, actor });
    expect(out.rows).toBe(0);
    expect(lines(out.csv)).toHaveLength(1);
  });
});

describe('export des droits', () => {
  it('une ligne par rôle et par permission, triée, avec le module, la ressource, l’action et la portée en français', async () => {
    const { handler } = build();
    const out = await handler.execute({ kind: 'rights', access: superAdmin, actor });
    expect(out.rows).toBe(4);
    expect(lines(out.csv)).toEqual([
      'Rôle;Rôle (libellé);Second facteur exigé;Permission;Module;Ressource;Ressource (libellé);Action;Portée',
      'HR;RH;oui;hr.directory.read;hr;directory;Annuaire du personnel;read;Tous',
      'HR;RH;oui;hr.employee.read;hr;employee;Personnel;read;Tous',
      'ACCOUNT_MANAGER;Chargé de compte;oui;bd.company.read;bd;company;Entreprises;read;Propre',
      'ACCOUNT_MANAGER;Chargé de compte;oui;bd.company.update;bd;company;Entreprises;update;Équipe',
    ]);
  });

  it('une permission inconnue du catalogue garde son code et laisse le libellé vide ; une action composée est conservée', async () => {
    const { audit, handler } = build();
    const odd = new ExportAdminDataHandler({ users: async () => [], sessions: async () => [] }, { list: async () => [{ code: 'X', label: 'Rôle X', description: 'd', mfaRequired: false, permissions: [{ code: 'zz.chose.faire.vite', scope: 'ALL' }] }] }, { record: async (r: AuditRecord) => { audit.push(r); } }, { now: () => NOW });
    expect(lines((await odd.execute({ kind: 'rights', access: superAdmin, actor })).csv)[1]).toBe('X;Rôle X;non;zz.chose.faire.vite;zz;chose;;faire.vite;Tous');
    expect(handler).toBeDefined();
  });
});

describe('export des sessions', () => {
  it('une ligne par session : personne, dates, fin ou état, adresse, appareil, risque, second facteur', async () => {
    const { handler } = build({ sessions: [session()] });
    const out = await handler.execute({ kind: 'sessions', access: superAdmin, actor });
    expect(lines(out.csv)).toEqual([
      'Session;E-mail;Nom;Connexion;Dernière activité;Fin;État ou motif de fin;Adresse IP;Appareil;Niveau de risque;Second facteur vérifié',
      'ss1;ada@demo.test;Ada Lovelace;2026-11-11T08:00:00.000Z;2026-11-11T08:30:00.000Z;;Active;10.0.0.7;Edge sur Windows;LOW;oui',
    ]);
  });

  it('dit comment chaque session a fini : déconnexion, révocation (avec son motif), expiration, ou toujours active', () => {
    const base = session();
    expect(sessionEnd(base, NOW)).toEqual({ endedAt: null, reason: 'Active' });
    expect(sessionEnd({ ...base, loggedOutAt: new Date('2026-11-11T08:45:00Z') }, NOW)).toEqual({ endedAt: new Date('2026-11-11T08:45:00Z'), reason: 'Déconnexion' });
    expect(sessionEnd({ ...base, revokedAt: new Date('2026-11-11T08:50:00Z'), revokedReason: 'Appareil perdu' }, NOW)).toEqual({ endedAt: new Date('2026-11-11T08:50:00Z'), reason: 'Révoquée : Appareil perdu' });
    expect(sessionEnd({ ...base, revokedAt: new Date('2026-11-11T08:50:00Z'), revokedReason: null }, NOW).reason).toBe('Révoquée');
    expect(sessionEnd({ ...base, expiresAt: new Date('2026-11-11T08:59:00Z') }, NOW)).toEqual({ endedAt: new Date('2026-11-11T08:59:00Z'), reason: 'Expirée' });
    // L'expiration absolue l'emporte sur l'inactivité quand elle vient plus tôt ; juste à l'heure de l'export, la session est expirée.
    expect(sessionEnd({ ...base, expiresAt: new Date('2026-11-11T12:00:00Z'), absoluteExpiresAt: new Date('2026-11-11T08:00:00Z') }, NOW)).toEqual({ endedAt: new Date('2026-11-11T08:00:00Z'), reason: 'Expirée' });
    expect(sessionEnd({ ...base, expiresAt: NOW }, NOW).reason).toBe('Expirée');
    // Une déconnexion prime sur une révocation.
    expect(sessionEnd({ ...base, loggedOutAt: new Date('2026-11-11T08:45:00Z'), revokedAt: new Date('2026-11-11T08:50:00Z') }, NOW).reason).toBe('Déconnexion');
  });

  it('couvre 90 jours par défaut, et la période demandée sinon (1 à 365)', async () => {
    const a = build();
    await a.handler.execute({ kind: 'sessions', access: superAdmin, actor });
    expect(a.asked.since).toEqual(new Date(NOW.getTime() - DEFAULT_SESSION_DAYS * 24 * 3_600_000));
    expect(a.asked.sessionsLimit).toBe(MAX_SESSION_ROWS);
    const b = build();
    await b.handler.execute({ kind: 'sessions', days: 30, access: superAdmin, actor });
    expect(b.asked.since).toEqual(new Date('2026-10-12T09:00:00Z'));
    for (const days of [0, -1, MAX_SESSION_DAYS + 1, 1.5, Number.NaN]) {
      await rejects(build().handler.execute({ kind: 'sessions', days, access: superAdmin, actor }), 'VALIDATION', /1 à 365 jours/);
    }
    await expect(build().handler.execute({ kind: 'sessions', days: 1, access: superAdmin, actor })).resolves.toBeDefined();
    await expect(build().handler.execute({ kind: 'sessions', days: MAX_SESSION_DAYS, access: superAdmin, actor })).resolves.toBeDefined();
  });

  it('la période ne s’applique pas aux autres exports', async () => {
    await expect(build().handler.execute({ kind: 'users', days: 9999, access: superAdmin, actor })).resolves.toBeDefined();
  });

  it('refuse plutôt que de tronquer au-delà de la limite', async () => {
    const many = Array.from({ length: MAX_SESSION_ROWS + 1 }, (_, i) => session({ id: `s${i}` }));
    await rejects(build({ sessions: many }).handler.execute({ kind: 'sessions', access: superAdmin, actor }), 'VALIDATION', /réduisez la période/);
  });

  it('accepte exactement la limite (50 000 sessions) : seul le dépassement est refusé', async () => {
    const exact = Array.from({ length: MAX_SESSION_ROWS }, (_, i) => session({ id: `s${i}` }));
    const out = await build({ sessions: exact }).handler.execute({ kind: 'sessions', access: superAdmin, actor });
    expect(out.rows).toBe(MAX_SESSION_ROWS);
  });

  it('ne contient ni jeton ni secret : une session n’expose que ce qui sert à l’audit', async () => {
    const leaky = { ...session(), refreshTokenHash: 'HASH-SECRET', accessToken: 'JWT-SECRET' } as unknown as ExportedSessionRow;
    const csv = (await build({ sessions: [leaky] }).handler.execute({ kind: 'sessions', access: superAdmin, actor })).csv;
    expect(csv).not.toContain('SECRET');
  });
});

describe('qui peut exporter, et la trace de chaque export', () => {
  it('seul le Super administrateur exporte : tout autre rôle est refusé, quel que soit le type d’export', async () => {
    for (const role of Object.values(RoleCode).filter((r) => r !== RoleCode.SuperAdmin)) {
      for (const kind of ['users', 'rights', 'sessions'] as const) {
        await rejects(build().handler.execute({ kind, access: as(role), actor }), 'FORBIDDEN', /réservés au Super administrateur/);
      }
    }
  });

  it('une permission accordée en portée Propre ou Équipe seulement ne suffit pas : il faut la portée Tous', async () => {
    for (const scope of ['OWN', 'TEAM'] as const) {
      const partial: AccessContext = { actorId: 'u', grants: [{ permission: 'iam.export.read', scope }] as never, teamMemberIds: [] };
      await rejects(build().handler.execute({ kind: 'users', access: partial, actor }), 'FORBIDDEN');
    }
    const none: AccessContext = { actorId: 'u', grants: [], teamMemberIds: [] };
    await rejects(build().handler.execute({ kind: 'users', access: none, actor }), 'FORBIDDEN');
  });

  it('trace chaque export (qui, session, d’où, nature, nombre de lignes, nom du fichier, période) sans jamais recopier le contenu', async () => {
    const { handler, audit } = build({ users: [user(), user({ id: 'u2', email: 'bob@demo.test' })], sessions: [session()] });
    await handler.execute({ kind: 'users', access: superAdmin, actor });
    await handler.execute({ kind: 'sessions', days: 30, access: superAdmin, actor });
    await handler.execute({ kind: 'rights', access: superAdmin, actor });
    expect(audit).toHaveLength(3);
    expect(audit[0]).toMatchObject({
      action: AuditAction.Export, module: 'iam', entityType: 'AdminExport', entityId: 'users', actor: { userId: 'sa', sessionId: 's-1', ipAddress: '10.0.0.1' },
      newValue: { export: 'users', format: 'csv', rows: 2, fileName: 'investally-utilisateurs-2026-11-11_09h00.csv' },
    });
    expect(audit[0]!.newValue).not.toHaveProperty('days');
    expect(audit[1]).toMatchObject({ entityId: 'sessions', newValue: { export: 'sessions', rows: 1, days: 30, fileName: 'investally-sessions-2026-11-11_09h00.csv' } });
    expect(audit[2]).toMatchObject({ entityId: 'rights', newValue: { export: 'rights', fileName: 'investally-droits-2026-11-11_09h00.csv' } });
    expect(JSON.stringify(audit)).not.toContain('ada@demo.test');
  });

  it('si la trace échoue, rien n’est remis', async () => {
    await expect(build({ users: [user()], auditFails: true }).handler.execute({ kind: 'users', access: superAdmin, actor })).rejects.toThrow('audit indisponible');
  });

  it('un export refusé ne laisse pas de trace d’export', async () => {
    const { handler, audit } = build();
    await rejects(handler.execute({ kind: 'users', access: as(RoleCode.Direction), actor }), 'FORBIDDEN');
    await rejects(handler.execute({ kind: 'sessions', days: 0, access: superAdmin, actor }), 'VALIDATION');
    expect(audit).toHaveLength(0);
  });
});
