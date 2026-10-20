import 'reflect-metadata';
import { PERMISSIONS } from '../src/modules/iam/domain/permission-catalog';
import { ROLES, resolveGrants } from '../src/modules/iam/domain/roles';
import { seedCore } from '../src/modules/iam/infrastructure/seed-core';
import { PrismaService } from '../src/platform/prisma.service';
import { UuidV7Generator } from '../src/platform/uuid-v7-generator';

/**
 * Nécessite une base PostgreSQL migrée et JETABLE (voir scripts/test-db.mjs). Ignoré sinon.
 */
const describeDb = process.env.DATABASE_URL && process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;

describeDb('Schéma Core (PostgreSQL)', () => {
  const prisma = new PrismaService();
  const ids = new UuidV7Generator();
  const db = () => prisma.db;
  const stamp = Date.now();

  async function newUser(overrides: Record<string, unknown> = {}) {
    const email = `u${stamp}-${ids.next().slice(-8)}@example.test`;
    return db().user.create({
      data: { id: ids.next(), email, emailKey: email.toLowerCase(), displayName: 'Utilisateur Test', ...overrides },
    });
  }

  afterAll(() => prisma.onModuleDestroy());

  describe('seed Core', () => {
    it('crée toutes les permissions, tous les rôles et leurs droits', async () => {
      const report = await seedCore(prisma, ids);
      expect(report.permissions).toBe(PERMISSIONS.length);
      expect(report.roles).toBe(ROLES.length);
      expect(await db().permission.count()).toBe(PERMISSIONS.length);
      expect(await db().role.count()).toBe(ROLES.length);
    });

    it('est idempotent : un second passage ne change ni les identifiants ni les effectifs', async () => {
      const before = await db().rolePermission.count();
      const idsBefore = (await db().permission.findMany({ select: { id: true }, orderBy: { code: 'asc' } })).map((p) => p.id);
      const report = await seedCore(prisma, ids);
      expect(report.permissionsRemoved).toBe(0);
      expect(report.grantsRemoved).toBe(0);
      expect(await db().rolePermission.count()).toBe(before);
      expect((await db().permission.findMany({ select: { id: true }, orderBy: { code: 'asc' } })).map((p) => p.id)).toEqual(idsBefore);
    });

    it('stocke en base exactement la matrice du code, rôle par rôle', async () => {
      for (const role of ROLES) {
        const rows = await db().rolePermission.findMany({
          where: { role: { code: role.code } },
          include: { permission: true },
        });
        const fromDb = rows.map((r) => `${r.permission.code}:${r.scope}`).sort();
        const fromCode = resolveGrants(role.code).map((g) => `${g.permission}:${g.scope}`).sort();
        expect(fromDb).toEqual(fromCode);
      }
    });

    it('retire ce qui a disparu du code (permission obsolète et droit révoqué)', async () => {
      const role = await db().role.findUniqueOrThrow({ where: { code: 'SUPPORT' } });
      const obsolete = await db().permission.create({
        data: { id: ids.next(), code: 'zz.obsolete.thing', module: 'zz', resource: 'obsolete', action: 'thing', description: 'à supprimer' },
      });
      await db().rolePermission.create({ data: { roleId: role.id, permissionId: obsolete.id, scope: 'ALL' } });

      const report = await seedCore(prisma, ids);

      expect(report.permissionsRemoved).toBe(1);
      expect(await db().permission.findUnique({ where: { code: 'zz.obsolete.thing' } })).toBeNull();
    });

    it("corrige une portée modifiée à la main (dérive de configuration)", async () => {
      const row = await db().rolePermission.findFirstOrThrow({
        where: { role: { code: 'ACCOUNT_MANAGER' }, permission: { code: 'bd.company.read' } },
      });
      await db().rolePermission.update({
        where: { roleId_permissionId: { roleId: row.roleId, permissionId: row.permissionId } },
        data: { scope: 'ALL' },
      });
      await seedCore(prisma, ids);
      const fixed = await db().rolePermission.findUniqueOrThrow({
        where: { roleId_permissionId: { roleId: row.roleId, permissionId: row.permissionId } },
      });
      expect(fixed.scope).toBe('OWN');
    });
  });

  describe("journal d'audit partitionné", () => {
    const entry = (createdAt: Date) => ({
      id: ids.next(), module: 'test', entityType: 'T', entityId: 'e1', action: 'CREATE' as const,
      ipAddress: '127.0.0.1', device: 'jest', createdAt,
    });

    it('range une ligne courante dans la partition du mois, pas dans la partition de secours', async () => {
      const row = entry(new Date());
      await db().auditLog.create({ data: row });
      const [found] = await db().$queryRaw<{ part: string }[]>`
        SELECT tableoid::regclass::text AS part FROM audit.audit_logs WHERE id = ${row.id}::uuid`;
      expect(found.part).toMatch(/^audit\.audit_logs_\d{4}_\d{2}$/);
    });

    it('ne perd pas une ligne hors partition : elle tombe dans la partition de secours', async () => {
      const row = entry(new Date('2099-06-15T00:00:00Z'));
      await db().auditLog.create({ data: row });
      const [found] = await db().$queryRaw<{ part: string }[]>`
        SELECT tableoid::regclass::text AS part FROM audit.audit_logs WHERE id = ${row.id}::uuid`;
      expect(found.part).toBe('audit.audit_logs_default');
    });

    it('ensure_audit_partitions est idempotent', async () => {
      const [first] = await db().$queryRaw<{ n: number }[]>`SELECT audit.ensure_audit_partitions(12) AS n`;
      expect(first.n).toBe(0);
    });

    it('refuse UPDATE, DELETE et TRUNCATE', async () => {
      await expect(db().$executeRaw`UPDATE audit.audit_logs SET module = 'x'`).rejects.toThrow(/append-only/);
      await expect(db().$executeRaw`DELETE FROM audit.audit_logs`).rejects.toThrow(/append-only/);
      await expect(db().$executeRawUnsafe('TRUNCATE audit.audit_logs')).rejects.toThrow(/append-only/);
    });
  });

  describe('utilisateurs et sessions', () => {
    it("refuse deux comptes actifs de même e-mail, mais autorise la réutilisation après suppression douce", async () => {
      const first = await newUser();
      await expect(
        db().user.create({ data: { id: ids.next(), email: first.email, emailKey: first.emailKey, displayName: 'Doublon' } }),
      ).rejects.toThrow(/users_email_key_active_uq|Unique constraint/i);

      await db().user.update({ where: { id: first.id }, data: { deletedAt: new Date() } });
      await expect(
        db().user.create({ data: { id: ids.next(), email: first.email, emailKey: first.emailKey, displayName: 'Réutilisation' } }),
      ).resolves.toBeDefined();
    });

    it("refuse un e-mail normalisé qui n'est pas en minuscules", async () => {
      await expect(
        db().user.create({ data: { id: ids.next(), email: 'A@B.test', emailKey: 'A@B.test', displayName: 'x' } }),
      ).rejects.toThrow(/users_email_key_lowercase|check constraint/i);
    });

    it('refuse qu\'un utilisateur soit son propre responsable', async () => {
      const user = await newUser();
      await expect(db().user.update({ where: { id: user.id }, data: { managerId: user.id } })).rejects.toThrow(
        /users_not_own_manager|check constraint/i,
      );
    });

    it("refuse une session dont l'expiration dépasse l'expiration absolue", async () => {
      const user = await newUser();
      const now = Date.now();
      await expect(
        db().userSession.create({
          data: {
            id: ids.next(), userId: user.id, ipAddress: '10.0.0.1', device: 'jest',
            expiresAt: new Date(now + 9 * 3600_000), absoluteExpiresAt: new Date(now + 3600_000),
          },
        }),
      ).rejects.toThrow(/user_sessions_expiry_order|check constraint/i);
    });

    it('supprime sessions et jetons avec l\'utilisateur (cascade)', async () => {
      const user = await newUser();
      const session = await db().userSession.create({
        data: { id: ids.next(), userId: user.id, ipAddress: '10.0.0.1', device: 'jest', expiresAt: new Date(Date.now() + 3600_000), absoluteExpiresAt: new Date(Date.now() + 7200_000) },
      });
      await db().refreshToken.create({
        data: { id: ids.next(), sessionId: session.id, familyId: ids.next(), tokenHash: `h-${ids.next()}`.slice(0, 64), expiresAt: new Date(Date.now() + 3600_000) },
      });
      await db().user.delete({ where: { id: user.id } });
      expect(await db().userSession.count({ where: { userId: user.id } })).toBe(0);
      expect(await db().refreshToken.count({ where: { sessionId: session.id } })).toBe(0);
    });

    it('interdit de supprimer un rôle encore attribué (Restrict)', async () => {
      const user = await newUser();
      const role = await db().role.findUniqueOrThrow({ where: { code: 'TRAINER' } });
      await db().userRole.create({ data: { userId: user.id, roleId: role.id } });
      await expect(db().role.delete({ where: { id: role.id } })).rejects.toThrow();
    });

    it('refuse un jeton de rafraîchissement dupliqué (hash unique)', async () => {
      const user = await newUser();
      const session = await db().userSession.create({
        data: { id: ids.next(), userId: user.id, ipAddress: '10.0.0.1', device: 'jest', expiresAt: new Date(Date.now() + 3600_000), absoluteExpiresAt: new Date(Date.now() + 7200_000) },
      });
      const hash = `dup-${ids.next()}`.slice(0, 64);
      const make = () => db().refreshToken.create({ data: { id: ids.next(), sessionId: session.id, familyId: ids.next(), tokenHash: hash, expiresAt: new Date(Date.now() + 3600_000) } });
      await make();
      await expect(make()).rejects.toThrow();
    });
  });

  describe('documents', () => {
    async function newDocument() {
      return db().document.create({
        data: { id: ids.next(), ownerType: 'Company', ownerId: ids.next(), title: 'Offre', createdBy: ids.next() },
      });
    }
    const version = (documentId: string, n: number, sha = 'a'.repeat(64)) => ({
      id: ids.next(), documentId, versionNumber: n, storageKey: `k-${ids.next()}`, fileName: 'offre.pdf',
      mimeType: 'application/pdf', sizeBytes: BigInt(1024), sha256: sha, uploadedBy: ids.next(),
    });

    it('refuse une empreinte qui n\'est pas un SHA-256 hexadécimal minuscule', async () => {
      const doc = await newDocument();
      await expect(db().documentVersion.create({ data: version(doc.id, 1, 'Z'.repeat(64)) })).rejects.toThrow(/document_versions_sha256_hex|check constraint/i);
    });

    it('refuse deux versions de même numéro pour un document', async () => {
      const doc = await newDocument();
      await db().documentVersion.create({ data: version(doc.id, 1) });
      await expect(db().documentVersion.create({ data: version(doc.id, 1) })).rejects.toThrow();
    });

    it("refuse de supprimer un document qui a des versions (Restrict)", async () => {
      const doc = await newDocument();
      await db().documentVersion.create({ data: version(doc.id, 1) });
      await expect(db().document.delete({ where: { id: doc.id } })).rejects.toThrow();
    });
  });

  describe('frontières entre contextes', () => {
    it("n'a aucune clé étrangère entre deux schémas PostgreSQL différents", async () => {
      const crossing = await db().$queryRaw<{ constraint: string }[]>`
        SELECT con.conname AS constraint
        FROM pg_constraint con
        JOIN pg_class src ON src.oid = con.conrelid
        JOIN pg_class dst ON dst.oid = con.confrelid
        WHERE con.contype = 'f' AND src.relnamespace <> dst.relnamespace`;
      expect(crossing).toEqual([]);
    });
  });
});
