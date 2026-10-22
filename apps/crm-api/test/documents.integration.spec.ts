import 'reflect-metadata';
import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RoleCode } from '../src/modules/iam/domain/roles';
import { Api, createUserWithRoles, mfaSession, startRbacApp } from './support/rbac-http';
import { TestApp } from './support/test-app';

const describeDb = process.env.DATABASE_URL && process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;
const NIL = '00000000-0000-7000-8000-000000000000';
const OCTET = 'application/octet-stream';

const pdf = (extra = '') => Buffer.from(`%PDF-1.7\n${extra}%%EOF`);
const png = () => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
const zip = (...names: string[]) => Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from(names.join('\u0000'))]);
const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const filesUnder = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? filesUnder(path) : [path];
});

describeDb('Documents (PostgreSQL + disque)', () => {
  const storageDir = mkdtempSync(join(tmpdir(), 'investally-docs-it-'));
  let t: TestApp;
  let api: Api;
  let seq = 0;
  const ip = () => `10.80.${Math.floor(seq / 250)}.${(seq++ % 250) + 1}`;

  beforeAll(async () => {
    process.env.DOCUMENTS_DIR = storageDir;
    ({ t, api } = await startRbacApp());
  }, 60_000);
  afterAll(async () => {
    await t.close();
    rmSync(storageDir, { recursive: true, force: true });
  });

  /** Acteurs du scénario : Marie (chargée de compte), son chef, Paul (autre équipe), la Direction et le Support. */
  async function world() {
    const chef = await createUserWithRoles(t, [RoleCode.HeadOfSales]);
    const marie = await createUserWithRoles(t, [RoleCode.AccountManager], { managerId: chef.id });
    const paul = await createUserWithRoles(t, [RoleCode.AccountManager]);
    const direction = await createUserWithRoles(t, [RoleCode.Direction]);
    const support = await createUserWithRoles(t, [RoleCode.Support]);
    const s = async (u: { email: string }) => {
      const addr = ip();
      const session = await mfaSession(t, api, u.email, addr);
      return { token: session.token, ip: addr };
    };
    const otherChef = await createUserWithRoles(t, [RoleCode.HeadOfSales]);
    const sessions = { chef: await s(chef), otherChef: await s(otherChef), marie: await s(marie), paul: await s(paul), direction: await s(direction), support: await s(support) };
    const company = async (as: { token: string; ip: string }, label: string) => {
      const res = await api.call('POST', '/api/v1/companies', { token: as.token, ip: as.ip, body: { name: `Société ${label} ${Math.random().toString(36).slice(2, 8)}` } });
      expect(res.status).toBe(201);
      return res.body.id as string;
    };
    return { sessions, marieCompany: await company(sessions.marie, 'Marie'), paulCompany: await company(sessions.paul, 'Paul') };
  }

  const upload = (as: { token: string; ip: string }, ownerId: string, bytes: Buffer, fileName = 'decharge.pdf', extra = '') =>
    api.call('POST', `/api/v1/documents?ownerType=company&ownerId=${ownerId}&title=${encodeURIComponent('Décharge signée')}&category=DECHARGE&fileName=${encodeURIComponent(fileName)}${extra}`, {
      token: as.token, ip: as.ip, raw: { type: OCTET, data: bytes },
    });

  describe('cycle complet', () => {
    it('envoi → liste → détail → téléchargement → nouvelle version → archivage, avec audit et fichiers sur disque', async () => {
      const w = await world();
      const v1 = pdf('première version');
      const created = await upload(w.sessions.marie, w.marieCompany, v1);
      expect(created.status).toBe(201);
      expect(created.body.current).toMatchObject({ number: 1, fileName: 'decharge.pdf', mimeType: 'application/pdf', sizeBytes: v1.length, sha256: sha256(v1), scanStatus: 'PENDING' });
      const id = created.body.id as string;

      const list = await api.call('GET', `/api/v1/documents?ownerType=company&ownerId=${w.marieCompany}`, w.sessions.marie);
      expect(list.status).toBe(200);
      expect((list.body as { id: string }[]).map((d) => d.id)).toEqual([id]);
      expect(list.headers.get('cache-control')).toBe('no-store');

      const dl = await api.call('GET', `/api/v1/documents/${id}/download`, w.sessions.marie);
      expect(dl.status).toBe(200);
      expect(dl.bytes.equals(v1)).toBe(true);
      expect(dl.headers.get('content-type')).toBe('application/pdf');
      expect(dl.headers.get('content-disposition')).toMatch(/^attachment; filename="decharge\.pdf"/);
      expect(dl.headers.get('x-content-type-options')).toBe('nosniff');
      expect(dl.headers.get('content-security-policy')).toBe("default-src 'none'; sandbox");
      expect(dl.headers.get('cache-control')).toBe('no-store');
      expect(dl.headers.get('x-document-sha256')).toBe(sha256(v1));
      expect(dl.headers.get('x-document-scan-status')).toBe('PENDING');

      const v2 = pdf('seconde version');
      const second = await api.call('POST', `/api/v1/documents/${id}/versions?fileName=decharge-v2.pdf`, { ...w.sessions.marie, raw: { type: OCTET, data: v2 } });
      expect(second.status).toBe(201);
      expect(second.body.current.number).toBe(2);
      const old = await api.call('GET', `/api/v1/documents/${id}/download?version=1`, w.sessions.marie);
      expect(old.bytes.equals(v1)).toBe(true);
      const detail = await api.call('GET', `/api/v1/documents/${id}`, w.sessions.marie);
      expect(detail.body.versions.map((v: { number: number }) => v.number)).toEqual([2, 1]);

      const archived = await api.call('POST', `/api/v1/documents/${id}/archive`, w.sessions.chef);
      expect(archived.status).toBe(204);
      const after = await api.call('GET', `/api/v1/documents?ownerType=company&ownerId=${w.marieCompany}`, w.sessions.marie);
      expect(after.body).toEqual([]);
      const withArchived = await api.call('GET', `/api/v1/documents?ownerType=company&ownerId=${w.marieCompany}&includeArchived=true`, w.sessions.marie);
      expect(withArchived.body).toHaveLength(1);
      const blocked = await api.call('POST', `/api/v1/documents/${id}/versions?fileName=x.pdf`, { ...w.sessions.marie, raw: { type: OCTET, data: pdf('x') } });
      expect(blocked.status).toBe(409);
      expect((await api.call('GET', `/api/v1/documents/${id}/download?version=2`, w.sessions.marie)).status).toBe(200);

      const rows = await t.prisma.db.auditLog.findMany({ where: { entityType: 'Document', entityId: id }, orderBy: { createdAt: 'asc' } });
      expect(rows.map((r) => r.action)).toEqual(['CREATE', 'DOWNLOAD', 'UPDATE', 'DOWNLOAD', 'DELETE', 'DOWNLOAD']);
      expect(rows.every((r) => r.module === 'docs')).toBe(true);
      const stored = await t.prisma.db.documentVersion.findMany({ where: { documentId: id } });
      for (const version of stored) {
        const path = join(storageDir, ...version.storageKey.split('/'));
        expect(sha256(readFileSync(path))).toBe(version.sha256);
        expect(version.storageKey).not.toMatch(/decharge/);
      }
    }, 90_000);

    it('le nom de fichier ne sort jamais du dossier de stockage (../ et séparateurs retirés)', async () => {
      const w = await world();
      const before = filesUnder(storageDir).length;
      const res = await upload(w.sessions.marie, w.marieCompany, pdf('x'), '../../evil.pdf');
      expect(res.status).toBe(201);
      expect(res.body.current.fileName).toBe('evil.pdf');
      expect(filesUnder(storageDir)).toHaveLength(before + 1);
      expect(filesUnder(storageDir).every((f) => f.startsWith(storageDir))).toBe(true);
    }, 60_000);
  });

  describe('droits et IDOR : un document n\'est jamais plus accessible que son entreprise', () => {
    it('une autre équipe reçoit « introuvable » partout, avec la même réponse que pour un identifiant qui n\'existe pas', async () => {
      const w = await world();
      const created = await upload(w.sessions.marie, w.marieCompany, pdf('secret'));
      const id = created.body.id as string;
      const calls: [string, string, Buffer | undefined][] = [
        ['GET', `/api/v1/documents?ownerType=company&ownerId=${w.marieCompany}`, undefined],
        ['GET', `/api/v1/documents/${id}`, undefined],
        ['GET', `/api/v1/documents/${id}/download`, undefined],
        ['POST', `/api/v1/documents/${id}/versions?fileName=x.pdf`, pdf('x')],
        ['POST', `/api/v1/documents?ownerType=company&ownerId=${w.marieCompany}&title=t&fileName=x.pdf`, pdf('x')],
      ];
      for (const [method, path, data] of calls) {
        const res = await api.call(method, path, { ...w.sessions.paul, raw: data ? { type: OCTET, data } : undefined });
        expect([method, path, res.status]).toEqual([method, path, 404]);
      }
      // L'archivage exige le droit de suppression (Paul n'en a pas : 403) ; un chef d'une AUTRE équipe en a le droit mais pas la portée : 404.
      expect((await api.call('POST', `/api/v1/documents/${id}/archive`, w.sessions.paul)).status).toBe(403);
      expect((await api.call('POST', `/api/v1/documents/${id}/archive`, w.sessions.otherChef)).status).toBe(404);
      const unknown = await api.call('GET', `/api/v1/documents/${NIL}`, w.sessions.paul);
      const hidden = await api.call('GET', `/api/v1/documents/${id}`, w.sessions.paul);
      expect(hidden.body).toEqual(unknown.body);
    }, 90_000);

    it('le chef d\'équipe voit et télécharge ; la Direction lit et télécharge mais ne peut ni envoyer ni archiver (403) ; le Support n\'a aucun droit documentaire (403)', async () => {
      const w = await world();
      const id = (await upload(w.sessions.marie, w.marieCompany, pdf('partagé'))).body.id as string;
      expect((await api.call('GET', `/api/v1/documents/${id}/download`, w.sessions.chef)).status).toBe(200);
      expect((await api.call('GET', `/api/v1/documents/${id}/download`, w.sessions.direction)).status).toBe(200);
      expect((await upload(w.sessions.direction, w.marieCompany, pdf('x'))).status).toBe(403);
      expect((await api.call('POST', `/api/v1/documents/${id}/archive`, w.sessions.direction)).status).toBe(403);
      for (const path of [`/api/v1/documents/${id}`, `/api/v1/documents/${id}/download`, '/api/v1/documents/meta']) {
        expect([path, (await api.call('GET', path, w.sessions.support)).status]).toEqual([path, 403]);
      }
      expect((await api.call('POST', `/api/v1/documents/${id}/archive`, w.sessions.marie)).status).toBe(403);
    }, 90_000);

    it('sans jeton : 401 ; jeton sans second facteur : 403', async () => {
      const w = await world();
      expect((await api.call('GET', '/api/v1/documents/meta', { ip: ip() })).status).toBe(401);
      const user = await createUserWithRoles(t, [RoleCode.AccountManager]);
      const addr = ip();
      const session = await mfaSession(t, api, user.email, addr);
      const res = await api.call('GET', '/api/v1/documents/meta', { token: session.passwordOnlyToken, ip: addr });
      expect([res.status, res.body.title]).toEqual([403, 'MFA_REQUIRED']);
      expect(w.marieCompany).toBeDefined();
    }, 60_000);
  });

  describe('contrôles du fichier', () => {
    it('refuse : mauvais type de contenu (415), vide, trop gros (413), format faux, extension trompeuse, macros, catégorie inconnue, paramètres invalides', async () => {
      const w = await world();
      const m = w.sessions.marie;
      const base = `/api/v1/documents?ownerType=company&ownerId=${w.marieCompany}&title=t`;
      const json = await api.call('POST', `${base}&fileName=a.pdf`, { ...m, body: { x: 1 } });
      expect(json.status).toBe(415);
      expect((await api.call('POST', `${base}&fileName=a.pdf`, { ...m, raw: { type: OCTET, data: Buffer.alloc(0) } })).status).toBe(400);
      expect((await upload(m, w.marieCompany, Buffer.from('MZ\u0090\u0000programme'), 'facture.pdf')).status).toBe(400);
      expect((await upload(m, w.marieCompany, png(), 'image.pdf')).status).toBe(400);
      expect((await upload(m, w.marieCompany, zip('[Content_Types].xml', 'word/document.xml', 'word/vbaProject.bin'), 'a.docx')).status).toBe(400);
      expect((await upload(m, w.marieCompany, pdf(), 'a.pdf', '&category=PIRATE')).status).toBe(400);
      expect((await api.call('POST', `/api/v1/documents?ownerType=company&ownerId=pas-un-uuid&title=t&fileName=a.pdf`, { ...m, raw: { type: OCTET, data: pdf() } })).status).toBe(400);
      expect((await api.call('POST', `/api/v1/documents?ownerType=offre&ownerId=${w.marieCompany}&title=t&fileName=a.pdf`, { ...m, raw: { type: OCTET, data: pdf() } })).status).toBe(400);
      expect((await api.call('POST', `/api/v1/documents?ownerType=company&ownerId=${w.marieCompany}&fileName=a.pdf`, { ...m, raw: { type: OCTET, data: pdf() } })).status).toBe(400);
      const big = Buffer.concat([pdf(), Buffer.alloc(10 * 1024 * 1024)]);
      expect((await upload(m, w.marieCompany, big)).status).toBe(413);
      expect((await api.call('GET', `/api/v1/documents/${NIL}/download?version=0`, m)).status).toBe(400);
    }, 120_000);

    it('un refus ne laisse aucun fichier ni aucune ligne', async () => {
      const w = await world();
      const files = filesUnder(storageDir).length;
      const documents = await t.prisma.db.document.count();
      await upload(w.sessions.marie, w.marieCompany, png(), 'image.pdf');
      await upload(w.sessions.paul, w.marieCompany, pdf('x'));
      expect(filesUnder(storageDir)).toHaveLength(files);
      expect(await t.prisma.db.document.count()).toBe(documents);
    }, 60_000);

    it('règles publiées par l\'API : taille maximale, extensions, catégories', async () => {
      const w = await world();
      const res = await api.call('GET', '/api/v1/documents/meta', w.sessions.marie);
      expect(res.body.maxBytes).toBe(10 * 1024 * 1024);
      expect(res.body.formats).toEqual(expect.arrayContaining(['pdf', 'jpg', 'jpeg', 'png', 'docx', 'xlsx']));
      expect(res.body.categories.map((c: { code: string }) => c.code)).toContain('DECHARGE');
    }, 60_000);
  });

  describe('intégrité et immutabilité', () => {
    it('un fichier altéré sur le disque n\'est jamais servi : refus, incident audité', async () => {
      const w = await world();
      const created = await upload(w.sessions.marie, w.marieCompany, pdf('intact'));
      const id = created.body.id as string;
      const version = await t.prisma.db.documentVersion.findFirstOrThrow({ where: { documentId: id } });
      writeFileSync(join(storageDir, ...version.storageKey.split('/')), pdf('ALTÉRÉ'));
      const res = await api.call('GET', `/api/v1/documents/${id}/download`, w.sessions.marie);
      expect(res.status).toBe(500);
      expect(res.bytes.toString()).not.toContain('ALTÉRÉ');
      const incident = await t.prisma.db.auditLog.findFirst({ where: { entityId: id, action: 'DOWNLOAD' }, orderBy: { createdAt: 'desc' } });
      expect(incident?.newValue).toMatchObject({ event: 'integrity_failed', version: 1 });
    }, 60_000);

    it('la base refuse de modifier le contenu d\'une version ou de la supprimer ; seul le résultat de l\'analyse antivirus peut évoluer', async () => {
      const w = await world();
      const id = (await upload(w.sessions.marie, w.marieCompany, pdf('figé'))).body.id as string;
      const version = await t.prisma.db.documentVersion.findFirstOrThrow({ where: { documentId: id } });
      await expect(t.prisma.db.documentVersion.update({ where: { id: version.id }, data: { sha256: 'f'.repeat(64) } })).rejects.toThrow(/immuable/);
      await expect(t.prisma.db.documentVersion.update({ where: { id: version.id }, data: { fileName: 'autre.pdf' } })).rejects.toThrow(/immuable/);
      await expect(t.prisma.db.documentVersion.delete({ where: { id: version.id } })).rejects.toThrow(/ne se supprime jamais/);
      const scanned = await t.prisma.db.documentVersion.update({ where: { id: version.id }, data: { scanStatus: 'CLEAN' } });
      expect(scanned.scanStatus).toBe('CLEAN');
    }, 60_000);

    it('ajouts de version simultanés : jamais deux versions de même numéro ; chacun réussit avec un numéro distinct ou reçoit un conflit', async () => {
      const w = await world();
      const id = (await upload(w.sessions.marie, w.marieCompany, pdf('base'))).body.id as string;
      const results = await Promise.all([1, 2, 3, 4].map((n) => api.call('POST', `/api/v1/documents/${id}/versions?fileName=v${n}.pdf`, { ...w.sessions.marie, raw: { type: OCTET, data: pdf(`concurrent ${n}`) } })));
      const statuses = results.map((r) => r.status);
      expect(statuses.every((s) => s === 201 || s === 409)).toBe(true);
      const created = statuses.filter((s) => s === 201).length;
      expect(created).toBeGreaterThanOrEqual(1);
      const numbers = (await t.prisma.db.documentVersion.findMany({ where: { documentId: id }, orderBy: { versionNumber: 'asc' } })).map((v) => v.versionNumber);
      expect(numbers).toEqual(Array.from({ length: created + 1 }, (_, i) => i + 1));
      expect((await t.prisma.db.document.findUniqueOrThrow({ where: { id } })).currentVersionNumber).toBe(created + 1);
      // Aucun fichier orphelin : chaque refus (409) a retiré le contenu qu'il venait d'écrire.
      const keys = (await t.prisma.db.documentVersion.findMany({ where: { documentId: id } })).map((v) => v.storageKey);
      expect(keys.every((key) => statSync(join(storageDir, ...key.split('/'))).isFile())).toBe(true);
    }, 90_000);
  });
});
