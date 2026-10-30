import 'reflect-metadata';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RoleCode } from '../src/modules/iam/domain/roles';
import { IDOR_ROUTES } from './support/idor-registry';
import { Api, ApiResponse, createUserWithRoles, mfaSession, startRbacApp } from './support/rbac-http';
import { TestApp } from './support/test-app';

const describeDb = process.env.DATABASE_URL && process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;
const NIL = '00000000-0000-7000-8000-000000000000';
const pdf = () => Buffer.from('%PDF-1.7\ncontrat idor\n%%EOF');

interface As { token: string; ip: string }
/** Identifiants visés par une sonde : les vrais (objet de Marie) ou inexistants (tous `NIL`). */
interface Ids { company: string; doc: string; session: string; facilitator: string }

/**
 * Une sonde par route « objet » : elle appelle la route avec les identifiants donnés, en tant que `as`.
 * Ajouter une route « objet » au registre sans écrire sa sonde fait échouer le premier test (qui ne dépend pas de la base).
 */
const PROBES: Record<string, (api: Api, as: As, ids: Ids) => Promise<ApiResponse>> = {
  'GET /companies/:id': (api, as, ids) => api.call('GET', `/api/v1/companies/${ids.company}`, as),
  'GET /companies/:id/export': (api, as, ids) => api.call('GET', `/api/v1/companies/${ids.company}/export`, as),
  'PUT /companies/:id': (api, as, ids) => api.call('PUT', `/api/v1/companies/${ids.company}`, { ...as, body: { version: 1, sector: 'Piège' } }),
  'GET /facilitators/:id': (api, as, ids) => api.call('GET', `/api/v1/facilitators/${ids.facilitator}`, as),
  'GET /documents': (api, as, ids) => api.call('GET', `/api/v1/documents?ownerType=company&ownerId=${ids.company}`, as),
  'POST /documents': (api, as, ids) =>
    api.call('POST', `/api/v1/documents?ownerType=company&ownerId=${ids.company}&title=Test&category=DECHARGE&fileName=a.pdf`, { ...as, raw: { type: 'application/octet-stream', data: pdf() } }),
  'GET /documents/:id': (api, as, ids) => api.call('GET', `/api/v1/documents/${ids.doc}`, as),
  'GET /documents/:id/download': (api, as, ids) => api.call('GET', `/api/v1/documents/${ids.doc}/download`, as),
  'POST /documents/:id/versions': (api, as, ids) =>
    api.call('POST', `/api/v1/documents/${ids.doc}/versions?fileName=b.pdf`, { ...as, raw: { type: 'application/octet-stream', data: pdf() } }),
  'POST /documents/:id/archive': (api, as, ids) => api.call('POST', `/api/v1/documents/${ids.doc}/archive`, as),
  'DELETE /auth/sessions/:id': (api, as, ids) => api.call('DELETE', `/api/v1/auth/sessions/${ids.session}`, as),
};

const objectRoutes = Object.entries(IDOR_ROUTES).filter(([, kind]) => kind === 'objet').map(([key]) => key).sort();

describe('Contrat anti-IDOR : chaque route « objet » a sa sonde', () => {
  it('les sondes couvrent exactement les routes « objet » du registre', () => {
    expect(Object.keys(PROBES).sort()).toEqual(objectRoutes);
  });
});

describeDb('Contrat anti-IDOR : un acteur sans portée reçoit la réponse d\'un objet inexistant (PostgreSQL)', () => {
  const storageDir = mkdtempSync(join(tmpdir(), 'investally-idor-it-'));
  let t: TestApp;
  let api: Api;
  let seq = 0;
  const ip = () => `10.90.${Math.floor(seq / 250)}.${(seq++ % 250) + 1}`;

  beforeAll(async () => {
    process.env.DOCUMENTS_DIR = storageDir;
    ({ t, api } = await startRbacApp());
  }, 60_000);
  afterAll(async () => {
    await t.close();
    rmSync(storageDir, { recursive: true, force: true });
  });

  const login = async (user: { email: string }): Promise<As & { sessionId: string }> => {
    const addr = ip();
    const session = await mfaSession(t, api, user.email, addr);
    return { token: session.token, ip: addr, sessionId: session.sessionId };
  };

  /** Marie possède une entreprise, un document et une seconde session ; deux attaquants ont des droits mais pas la portée. */
  async function world() {
    const chef = await createUserWithRoles(t, [RoleCode.HeadOfSales]);
    const marie = await createUserWithRoles(t, [RoleCode.AccountManager], { managerId: chef.id });
    const paul = await createUserWithRoles(t, [RoleCode.AccountManager]); // autre équipe, portée « propres objets »
    const autreChef = await createUserWithRoles(t, [RoleCode.HeadOfSales]); // autre équipe, portée « équipe »
    const m = await login(marie);
    const chefSession = await login(chef);
    const company = await api.call('POST', '/api/v1/companies', { ...m, body: { name: `Société IDOR ${Math.random().toString(36).slice(2, 8)}` } });
    expect(company.status).toBe(201);
    const facilitator = await api.call('POST', '/api/v1/facilitators', { ...m, body: { lastName: 'Mbarga', firstName: 'Paul', phone: '+237 699 00 11 22', comment: 'Secret-IDOR' } });
    expect(facilitator.status).toBe(201);
    const doc = await api.call('POST', `/api/v1/documents?ownerType=company&ownerId=${company.body.id}&title=Pi%C3%A8ce&category=DECHARGE&fileName=piece.pdf`, {
      ...m, raw: { type: 'application/octet-stream', data: pdf() },
    });
    expect(doc.status).toBe(201);
    const second = await login(marie);
    return {
      marie: m,
      chef: chefSession,
      attackers: { paul: await login(paul), autreChef: await login(autreChef) },
      real: { company: company.body.id as string, doc: doc.body.id as string, session: second.sessionId, facilitator: facilitator.body.id as string } satisfies Ids,
      nil: { company: NIL, doc: NIL, session: NIL, facilitator: NIL } satisfies Ids,
      secondSession: second,
    };
  }

  it.each(objectRoutes)('%s : réponse identique pour un objet étranger et pour un objet inexistant, et l\'objet reste intact', async (key) => {
    const w = await world();
    const probe = PROBES[key];
    for (const [name, attacker] of Object.entries(w.attackers)) {
      const onForeign = await probe(api, attacker, w.real);
      const onMissing = await probe(api, attacker, w.nil);
      // Même statut ET même corps : aucun indice sur l'existence de l'objet.
      expect([name, onForeign.status, onForeign.body]).toEqual([name, onMissing.status, onMissing.body]);
      expect([name, onForeign.status < 400]).toEqual([name, false]);
      // Aucune donnée de l'objet ne fuit.
      expect(onForeign.bytes.toString('utf8')).not.toContain('piece.pdf');
      expect(onForeign.bytes.toString('utf8')).not.toContain(w.real.company);
      expect(onForeign.bytes.toString('utf8')).not.toContain('Secret-IDOR');
    }
    // Contrôle positif : le propriétaire, lui, réussit (le test n'est pas vide), puis les dégâts éventuels sont vérifiés.
    // L'archivage exige le droit de suppression, que Marie n'a pas : c'est son chef (même équipe) qui l'exerce.
    const owner = key === 'POST /documents/:id/archive' ? w.chef : w.marie;
    const ok = await probe(api, owner, w.real);
    expect([key, ok.status < 300]).toEqual([key, true]);
  }, 60_000);

  it('aucune écriture n\'a lieu quand l\'attaquant échoue : ni version, ni archivage, ni révocation', async () => {
    const w = await world();
    for (const attacker of Object.values(w.attackers)) {
      await PROBES['POST /documents/:id/versions'](api, attacker, w.real);
      await PROBES['POST /documents/:id/archive'](api, attacker, w.real);
      await PROBES['DELETE /auth/sessions/:id'](api, attacker, w.real);
      await PROBES['POST /documents'](api, attacker, w.real);
    }
    // La fiche de Marie n'a pas été modifiée non plus par les tentatives de modification.
    expect((await api.call('GET', `/api/v1/companies/${w.real.company}`, w.marie)).body.sector).toBeNull();
    const detail = await api.call('GET', `/api/v1/documents/${w.real.doc}`, w.marie);
    expect(detail.status).toBe(200);
    expect(detail.body.versions).toHaveLength(1);
    expect(detail.body.status).not.toBe('ARCHIVED');
    const list = await api.call('GET', `/api/v1/documents?ownerType=company&ownerId=${w.real.company}`, w.marie);
    expect(list.body).toHaveLength(1);
    const revoked = await t.prisma.db.userSession.findUnique({ where: { id: w.real.session } });
    expect(revoked?.revokedAt).toBeNull();
  }, 60_000);

  it("lier une entreprise au facilitateur d'un collègue : même réponse que pour un facilitateur inexistant, et rien n'est créé", async () => {
    const w = await world();
    const attempt = (facilitatorId: string, name: string) =>
      api.call('POST', '/api/v1/companies', { ...w.attackers.paul, body: { name, facilitation: { facilitatorId, contactMethod: 'EMAIL' } } });
    const foreign = await attempt(w.real.facilitator, 'Piège A');
    const missing = await attempt(NIL, 'Piège B');
    expect(foreign.status).toBe(404);
    expect([foreign.status, foreign.body.message]).toEqual([missing.status, missing.body.message]);
    expect(foreign.bytes.toString('utf8')).not.toContain('Secret-IDOR');
    const list = await api.call('GET', '/api/v1/companies?pageSize=100&search=Pi%C3%A8ge', w.attackers.paul);
    expect(list.body.total).toBe(0);
  }, 60_000);

  it('la liste des facilitateurs ne montre à chacun que les siens', async () => {
    const w = await world();
    const list = await api.call('GET', '/api/v1/facilitators?pageSize=100', w.attackers.paul);
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).not.toContain(w.real.facilitator);
  }, 60_000);

  it('la liste des entreprises ne montre à chaque chargé de compte que les siennes', async () => {
    const w = await world();
    const list = await api.call('GET', '/api/v1/companies?pageSize=100', w.attackers.paul);
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).not.toContain(w.real.company);
  }, 60_000);
});
