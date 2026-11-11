import { AuditAction, AuditEntry } from '../src/modules/audit/domain/audit-entry';
import { AuditRepository, LoginEventQuery } from '../src/modules/audit/domain/audit-repository';
import {
  DefaultAuditReader, LOGIN_HISTORY_DEFAULT_LIMIT, LOGIN_HISTORY_MAX_LIMIT, LOGIN_HISTORY_WINDOW_DAYS, toLoginEvent,
} from '../src/modules/audit/application/audit-reader';
import { actor } from './support/iam-fakes';
import { buildIamWorld } from './support/iam-world';

const DAY = 24 * 60 * 60 * 1000;

const entry = (overrides: Partial<AuditEntry> & { at?: string; reason?: string }): AuditEntry => ({
  id: overrides.id ?? 'e1',
  actor: { userId: 'u1', sessionId: 's1', ipAddress: '10.0.0.1', device: 'Mozilla/5.0 Firefox' },
  module: 'iam',
  entityType: 'UserSession',
  entityId: 's1',
  action: overrides.action ?? AuditAction.Login,
  oldValue: null,
  newValue: overrides.reason ? { reason: overrides.reason } : { riskLevel: 'LOW' },
  createdAt: new Date(overrides.at ?? '2026-10-22T08:00:00.000Z'),
});

describe('toLoginEvent — ce que l\'intéressé voit d\'une connexion', () => {
  it('une réussite : date, adresse IP, appareil, aucun motif', () => {
    expect(toLoginEvent(entry({}))).toEqual({
      id: 'e1', at: '2026-10-22T08:00:00.000Z', result: 'SUCCESS', ipAddress: '10.0.0.1', device: 'Mozilla/5.0 Firefox',
    });
  });
  it('un échec de mot de passe, de compte verrouillé ou inactif est un seul et même « échec à l\'étape du mot de passe »', () => {
    for (const reason of ['BAD_PASSWORD', 'LOCKED', 'NOT_ACTIVE']) {
      const event = toLoginEvent(entry({ action: AuditAction.LoginFailed, reason }));
      expect([event.result, event.stage]).toEqual(['FAILED', 'PASSWORD']);
    }
  });
  it('un échec du second facteur est signalé à son étape', () => {
    const event = toLoginEvent(entry({ action: AuditAction.LoginFailed, reason: 'MFA_BAD_CODE' }));
    expect([event.result, event.stage]).toEqual(['FAILED', 'SECOND_FACTOR']);
  });
  it('ne laisse fuiter ni le motif précis, ni l\'identifiant de session, ni les valeurs d\'audit', () => {
    const json = JSON.stringify(toLoginEvent(entry({ action: AuditAction.LoginFailed, reason: 'LOCKED' })));
    expect(json).not.toMatch(/LOCKED|BAD_PASSWORD|s1|sessionId|newValue|oldValue|reason/);
  });
});

/** Dépôt d'audit de test : mémorise la requête reçue et renvoie des lignes préparées. */
class FakeAudit implements AuditRepository {
  lastQuery: LoginEventQuery | undefined;
  constructor(private readonly rows: AuditEntry[]) {}
  async append(): Promise<void> { /* inutile ici */ }
  async listByEntity(): Promise<AuditEntry[]> { return []; }
  async listLoginEvents(query: LoginEventQuery): Promise<AuditEntry[]> {
    this.lastQuery = query;
    return this.rows.slice(0, query.limit);
  }
}

describe('DefaultAuditReader — borne, pagination et fenêtre', () => {
  const now = new Date('2026-10-22T12:00:00.000Z');
  const clock = { now: () => now };
  const rows = (n: number) => Array.from({ length: n }, (_, i) => entry({ id: `e${i}`, at: new Date(now.getTime() - i * 60_000).toISOString() }));

  it('demande uniquement les événements de l\'utilisateur, dans une fenêtre de 90 jours', async () => {
    const repo = new FakeAudit([]);
    await new DefaultAuditReader(repo, clock).loginHistory({ userId: 'u1' });
    expect(repo.lastQuery!.userId).toBe('u1');
    expect(repo.lastQuery!.since.getTime()).toBe(now.getTime() - LOGIN_HISTORY_WINDOW_DAYS * DAY);
    expect(LOGIN_HISTORY_WINDOW_DAYS).toBe(90);
  });
  it('taille par défaut et plafond : jamais plus de 100 lignes, jamais moins de 1', async () => {
    const repo = new FakeAudit([]);
    const reader = new DefaultAuditReader(repo, clock);
    await reader.loginHistory({ userId: 'u1' });
    expect(repo.lastQuery!.limit).toBe(LOGIN_HISTORY_DEFAULT_LIMIT + 1);
    await reader.loginHistory({ userId: 'u1', limit: 5000 });
    expect(repo.lastQuery!.limit).toBe(LOGIN_HISTORY_MAX_LIMIT + 1);
    await reader.loginHistory({ userId: 'u1', limit: -3 });
    expect(repo.lastQuery!.limit).toBe(2);
  });
  it('page suivante : le curseur est la date du dernier élément de la page, seulement s\'il en reste', async () => {
    const full = await new DefaultAuditReader(new FakeAudit(rows(6)), clock).loginHistory({ userId: 'u1', limit: 5 });
    expect(full.items).toHaveLength(5);
    expect(full.nextBefore).toBe(full.items[4].at);
    const last = await new DefaultAuditReader(new FakeAudit(rows(5)), clock).loginHistory({ userId: 'u1', limit: 5 });
    expect(last.items).toHaveLength(5);
    expect(last.nextBefore).toBeNull();
    const empty = await new DefaultAuditReader(new FakeAudit([]), clock).loginHistory({ userId: 'u1' });
    expect(empty).toEqual({ items: [], nextBefore: null, windowDays: 90 });
  });
  it('transmet le curseur « before » tel quel', async () => {
    const repo = new FakeAudit([]);
    const before = new Date('2026-10-20T00:00:00.000Z');
    await new DefaultAuditReader(repo, clock).loginHistory({ userId: 'u1', before });
    expect(repo.lastQuery!.before).toEqual(before);
  });
});

describe('RevokeOtherSessionsUseCase — déconnecter mes autres appareils', () => {
  it('coupe les autres sessions de l\'appelant et leurs jetons, garde la courante, trace l\'action', async () => {
    const w = buildIamWorld();
    const user = await w.createDefaultUser();
    const s1 = await w.login.execute({ email: 'marie@investally.test', password: w.PASSWORD, actor: actor({ ipAddress: '10.0.0.1' }) });
    const s2 = await w.login.execute({ email: 'marie@investally.test', password: w.PASSWORD, actor: actor({ ipAddress: '10.0.0.2' }) });
    const s3 = await w.login.execute({ email: 'marie@investally.test', password: w.PASSWORD, actor: actor({ ipAddress: '10.0.0.3' }) });

    const result = await w.revokeOtherSessions.execute({ userId: user.id, sessionId: s1.sessionId, actor: actor({ userId: user.id, sessionId: s1.sessionId }) });
    expect(result).toEqual({ revoked: 2 });

    const active = await w.sessions.listActiveOf(user.id, w.clock.now());
    expect(active.map((s) => s.id)).toEqual([s1.sessionId]);
    const record = w.audit.at(-1)!;
    expect(record.newValue).toMatchObject({ event: 'other_sessions_revoked', count: 2, byOwner: true });
    expect(record.entityId).toBe(user.id);
  });
  it('ne touche jamais les sessions d\'un autre utilisateur', async () => {
    const w = buildIamWorld();
    const marie = await w.createDefaultUser();
    const paul = await w.createDefaultUser(undefined, 'paul@investally.test');
    const m1 = await w.login.execute({ email: 'marie@investally.test', password: w.PASSWORD, actor: actor() });
    const m2 = await w.login.execute({ email: 'marie@investally.test', password: w.PASSWORD, actor: actor({ ipAddress: '10.0.0.9' }) });
    const p1 = await w.login.execute({ email: 'paul@investally.test', password: w.PASSWORD, actor: actor({ ipAddress: '10.0.0.8' }) });
    await w.revokeOtherSessions.execute({ userId: marie.id, sessionId: m1.sessionId, actor: actor({ userId: marie.id, sessionId: m1.sessionId }) });
    expect((await w.sessions.listActiveOf(paul.id, w.clock.now())).map((s) => s.id)).toEqual([p1.sessionId]);
  });
  it('sans autre session : zéro révoquée, la courante reste ouverte', async () => {
    const w = buildIamWorld();
    const user = await w.createDefaultUser();
    const s1 = await w.login.execute({ email: 'marie@investally.test', password: w.PASSWORD, actor: actor() });
    const result = await w.revokeOtherSessions.execute({ userId: user.id, sessionId: s1.sessionId, actor: actor({ userId: user.id, sessionId: s1.sessionId }) });
    expect(result).toEqual({ revoked: 0 });
    expect(await w.sessions.listActiveOf(user.id, w.clock.now())).toHaveLength(1);
  });
});
