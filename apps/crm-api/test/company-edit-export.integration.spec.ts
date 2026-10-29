import 'reflect-metadata';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RoleCode } from '../src/modules/iam/domain/roles';
import { Api, createUserWithRoles, mfaSession, startRbacApp } from './support/rbac-http';
import { TestApp } from './support/test-app';

const describeDb = process.env.DATABASE_URL && process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;

/** Modification et export de la fiche d'une entreprise : HTTP + PostgreSQL (droits, portée, version, audit, sécurité du document). */
describeDb('Modifier et exporter une fiche d\'entreprise (HTTP + PostgreSQL)', () => {
  const storageDir = mkdtempSync(join(tmpdir(), 'investally-edit-it-'));
  let t: TestApp;
  let api: Api;
  let seq = 0;
  const ip = () => `10.92.${Math.floor(seq / 250)}.${(seq++ % 250) + 1}`;

  beforeAll(async () => {
    process.env.DOCUMENTS_DIR = storageDir;
    ({ t, api } = await startRbacApp());
  }, 60_000);
  afterAll(async () => {
    await t.close();
    rmSync(storageDir, { recursive: true, force: true });
  });

  const login = async (user: { email: string }) => {
    const addr = ip();
    const session = await mfaSession(t, api, user.email, addr);
    return { token: session.token, ip: addr, sessionId: session.sessionId as string };
  };
  const unique = () => Math.random().toString(36).slice(2, 8);

  /** Une équipe : un chef, son chargé de compte (propriétaire de l'entreprise), un autre chargé de compte, un Support. */
  async function team() {
    const chefUser = await createUserWithRoles(t, [RoleCode.HeadOfSales]);
    const amUser = await createUserWithRoles(t, [RoleCode.AccountManager], { managerId: chefUser.id });
    const otherUser = await createUserWithRoles(t, [RoleCode.AccountManager]);
    const supportUser = await createUserWithRoles(t, [RoleCode.Support]);
    const chef = await login(chefUser);
    const am = await login(amUser);
    const other = await login(otherUser);
    const support = await login(supportUser);
    const created = await api.call('POST', '/api/v1/companies', {
      ...am, body: { name: `Société ${unique()}`, sector: 'Banque', country: 'Cameroun', facilitation: { newFacilitator: { lastName: 'Mbarga', firstName: 'Paul', phone: '+237 699 00 11 22', comment: 'Connaît le DAF' }, contactMethod: 'EMAIL' } },
    });
    expect(created.status).toBe(201);
    return { chef, am, other, support, company: created.body, id: created.body.id as string };
  }

  it('le propriétaire modifie sa fiche : la version augmente et la lecture reflète le changement', async () => {
    const { am, id, company } = await team();
    const res = await api.call('PUT', `/api/v1/companies/${id}`, { ...am, body: { version: company.version, sector: 'Assurance', phone: '+237 222 33 44 55', email: 'Contact@Acme.CM' } });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ sector: 'Assurance', country: 'Cameroun', email: 'contact@acme.cm', version: company.version + 1 });
    const read = await api.call('GET', `/api/v1/companies/${id}`, am);
    expect(read.body).toMatchObject({ sector: 'Assurance', phone: '+237 222 33 44 55', version: company.version + 1 });
  }, 90_000);

  it('verrou optimiste : une version périmée est refusée (409) et rien n\'est modifié', async () => {
    const { am, id, company } = await team();
    const first = await api.call('PUT', `/api/v1/companies/${id}`, { ...am, body: { version: company.version, sector: 'A' } });
    expect(first.status).toBe(200);
    const stale = await api.call('PUT', `/api/v1/companies/${id}`, { ...am, body: { version: company.version, sector: 'B' } });
    expect(stale.status).toBe(409);
    expect((await api.call('GET', `/api/v1/companies/${id}`, am)).body.sector).toBe('A');
  }, 90_000);

  it('un nom déjà pris est refusé (409) ; le propriétaire et le statut ne peuvent pas être modifiés (400)', async () => {
    const { am, id, company } = await team();
    const other = await api.call('POST', '/api/v1/companies', { ...am, body: { name: `Autre ${unique()}` } });
    const dup = await api.call('PUT', `/api/v1/companies/${id}`, { ...am, body: { version: company.version, name: other.body.name.toUpperCase() } });
    expect(dup.status).toBe(409);
    for (const forbidden of [{ ownerUserId: '00000000-0000-7000-8000-000000000001' }, { status: 'CLIENT' }, { id: '00000000-0000-7000-8000-000000000002' }]) {
      const res = await api.call('PUT', `/api/v1/companies/${id}`, { ...am, body: { version: company.version, ...forbidden } });
      expect([forbidden, res.status]).toEqual([forbidden, 400]);
    }
    const unchanged = (await api.call('GET', `/api/v1/companies/${id}`, am)).body;
    expect(unchanged).toMatchObject({ ownerUserId: company.ownerUserId, status: 'TARGET' });
  }, 90_000);

  it('portée : l\'autre chargé de compte reçoit 404 (comme pour un identifiant inexistant) ; le Support 403 ; le chef d\'équipe peut modifier', async () => {
    const { am, chef, other, support, id, company } = await team();
    const foreign = await api.call('PUT', `/api/v1/companies/${id}`, { ...other, body: { version: company.version, sector: 'Piège' } });
    const missing = await api.call('PUT', '/api/v1/companies/00000000-0000-7000-8000-000000000000', { ...other, body: { version: 1, sector: 'Piège' } });
    expect([foreign.status, foreign.body]).toEqual([missing.status, missing.body]);
    expect(foreign.status).toBe(404);
    expect((await api.call('PUT', `/api/v1/companies/${id}`, { ...support, body: { version: company.version, sector: 'X' } })).status).toBe(403);
    expect((await api.call('PUT', `/api/v1/companies/${id}`, { ...chef, body: { version: company.version, sector: 'Énergie' } })).status).toBe(200);
    expect((await api.call('GET', `/api/v1/companies/${id}`, am)).body.sector).toBe('Énergie');
  }, 90_000);

  it('commission : seul le chef la définit ; une modification du chargé de compte la conserve ; lui ne peut ni la changer ni la retirer', async () => {
    const { am, chef, id, company } = await team();
    const set = await api.call('PUT', `/api/v1/companies/${id}`, { ...chef, body: { version: company.version, facilitation: { commission: { type: 'PERCENT', value: '7.5' } } } });
    expect(set.status).toBe(200);
    expect(set.body.facilitation.commission).toEqual({ type: 'PERCENT', value: '7.50', currency: null });

    const edit = await api.call('PUT', `/api/v1/companies/${id}`, { ...am, body: { version: set.body.version, phone: '+237 600 00 00 09', facilitation: { contactMethod: 'MEETING' } } });
    expect(edit.status).toBe(200);
    expect(edit.body.facilitation.commission).toEqual({ type: 'PERCENT', value: '7.50', currency: null });
    expect(edit.body.facilitation.contactMethod).toBe('MEETING');

    for (const facilitation of [{ commission: { type: 'PERCENT', value: '1' } }, { commission: null }, null]) {
      const refused = await api.call('PUT', `/api/v1/companies/${id}`, { ...am, body: { version: edit.body.version, facilitation } });
      expect([facilitation, refused.status]).toEqual([facilitation, 403]);
    }
    const after = (await api.call('GET', `/api/v1/companies/${id}`, am)).body;
    expect(after.facilitation.commission).toEqual({ type: 'PERCENT', value: '7.50', currency: null });
  }, 120_000);

  it('retirer puis remplacer le facilitateur est bien enregistré en base', async () => {
    const { chef, id, company } = await team();
    const removed = await api.call('PUT', `/api/v1/companies/${id}`, { ...chef, body: { version: company.version, facilitation: null } });
    expect(removed.status).toBe(200);
    expect(removed.body.facilitation).toBeNull();
    expect(await t.prisma.db.companyFacilitation.count({ where: { companyId: id } })).toBe(0);
    const added = await api.call('PUT', `/api/v1/companies/${id}`, { ...chef, body: { version: removed.body.version, facilitation: { newFacilitator: { lastName: 'Eto', firstName: 'Anne', phone: '+237 677 00 11 22' }, contactMethod: 'WHATSAPP_MESSAGE', isCompanyEmployee: true, commission: { type: 'FIXED', value: '250000' } } } });
    expect(added.status).toBe(200);
    expect(added.body.facilitation).toMatchObject({ contactMethod: 'WHATSAPP_MESSAGE', isCompanyEmployee: true, commission: { type: 'FIXED', value: '250000.00', currency: 'XAF' } });
    expect(await t.prisma.db.companyFacilitation.count({ where: { companyId: id } })).toBe(1);
  }, 120_000);

  it('audit : la modification est tracée avec l\'ancienne et la nouvelle valeur', async () => {
    const { am, id, company } = await team();
    await api.call('PUT', `/api/v1/companies/${id}`, { ...am, body: { version: company.version, sector: 'Télécoms' } });
    const logs = await t.prisma.db.auditLog.findMany({ where: { entityId: id, action: 'UPDATE' } });
    expect(logs).toHaveLength(1);
    expect(JSON.stringify(logs[0].oldValue)).toContain('Banque');
    expect(JSON.stringify(logs[0].newValue)).toContain('Télécoms');
  }, 90_000);

  describe('export de la fiche', () => {
    it('le propriétaire reçoit un document HTML autonome, aux en-têtes sûrs, et l\'export est tracé avec sa session', async () => {
      const { am, id, company } = await team();
      const res = await api.call('GET', `/api/v1/companies/${id}/export`, am);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');
      expect(res.headers.get('content-security-policy')).toContain("default-src 'none'");
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('cache-control')).toBe('no-store');
      const html = res.bytes.toString('utf8');
      expect(html).toContain(company.name);
      expect(html).toContain('Paul Mbarga');
      expect(html).not.toMatch(/<script|src=|href=/i);

      const logs = await t.prisma.db.auditLog.findMany({ where: { entityId: id, action: 'EXPORT' } });
      expect(logs).toHaveLength(1);
      expect(logs[0].sessionId).toBe(am.sessionId);
      expect(JSON.stringify(logs[0].newValue)).not.toContain('Mbarga');
    }, 90_000);

    it('IDOR : le collègue reçoit la réponse d\'un identifiant inexistant, et aucune trace d\'export n\'est écrite', async () => {
      const { other, id } = await team();
      const foreign = await api.call('GET', `/api/v1/companies/${id}/export`, other);
      const missing = await api.call('GET', '/api/v1/companies/00000000-0000-7000-8000-000000000000/export', other);
      expect([foreign.status, foreign.body]).toEqual([missing.status, missing.body]);
      expect(foreign.status).toBe(404);
      expect(await t.prisma.db.auditLog.count({ where: { entityId: id, action: 'EXPORT' } })).toBe(0);
    }, 90_000);

    it('le Support exporte la fiche (il peut la voir) mais le document ne contient ni facilitateur ni commission', async () => {
      const { chef, support, id, company } = await team();
      await api.call('PUT', `/api/v1/companies/${id}`, { ...chef, body: { version: company.version, facilitation: { commission: { type: 'PERCENT', value: '7.5' } } } });
      const res = await api.call('GET', `/api/v1/companies/${id}/export`, support);
      expect(res.status).toBe(200);
      const html = res.bytes.toString('utf8');
      expect(html).not.toContain('Mbarga');
      expect(html).not.toContain('Commission');
      expect(html).not.toContain('7,50');
    }, 90_000);

    it('un nom d\'entreprise piégé est neutralisé dans le document', async () => {
      const { am } = await team();
      const evil = await api.call('POST', '/api/v1/companies', { ...am, body: { name: `<script>alert(1)</script> ${unique()}` } });
      expect(evil.status).toBe(201);
      const res = await api.call('GET', `/api/v1/companies/${evil.body.id}/export`, am);
      const html = res.bytes.toString('utf8');
      expect(html).not.toContain('<script>alert(1)');
      expect(html).toContain('&lt;script&gt;alert(1)');
    }, 90_000);
  });
});
