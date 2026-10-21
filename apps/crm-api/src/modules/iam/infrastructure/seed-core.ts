import { PrismaService } from '../../../platform/prisma.service';
import { IdGenerator } from '../../../shared-kernel';
import { PERMISSIONS } from '../domain/permission-catalog';
import { ROLES, resolveGrants } from '../domain/roles';

/** Bilan du seed : permissions et rôles créés, droits ajoutés ou retirés. */
export interface SeedReport {
  permissions: number;
  permissionsRemoved: number;
  roles: number;
  grants: number;
  grantsRemoved: number;
}

/**
 * Synchronise la base sur le catalogue et la matrice du code (idempotent) :
 * crée ou met à jour permissions, rôles système et leurs droits ; supprime ce qui n'existe plus dans le code.
 * Ne crée AUCUN utilisateur : le premier SuperAdmin est amorcé en S3 (aucun mot de passe par défaut).
 */
export async function seedCore(prisma: PrismaService, ids: IdGenerator): Promise<SeedReport> {
  return prisma.run(async () => {
    const db = prisma.db;
    const report: SeedReport = { permissions: 0, permissionsRemoved: 0, roles: 0, grants: 0, grantsRemoved: 0 };

    const codes = PERMISSIONS.map((p) => p.code);
    const removed = await db.permission.deleteMany({ where: { code: { notIn: codes } } });
    report.permissionsRemoved = removed.count;

    const permissionIdByCode = new Map<string, string>();
    for (const p of PERMISSIONS) {
      const row = await db.permission.upsert({
        where: { code: p.code },
        create: { id: ids.next(), code: p.code, module: p.module, resource: p.resource, action: p.action, description: p.description },
        update: { module: p.module, resource: p.resource, action: p.action, description: p.description },
      });
      permissionIdByCode.set(p.code, row.id);
      report.permissions++;
    }

    for (const role of ROLES) {
      const row = await db.role.upsert({
        where: { code: role.code },
        create: { id: ids.next(), code: role.code, label: role.label, description: role.description, mfaRequired: role.mfaRequired, isSystem: true },
        update: { label: role.label, description: role.description, mfaRequired: role.mfaRequired },
      });
      report.roles++;

      const desired = new Map(resolveGrants(role.code).map((g) => [permissionIdByCode.get(g.permission)!, g.scope]));
      const existing = await db.rolePermission.findMany({ where: { roleId: row.id } });

      const stale = existing.filter((e) => !desired.has(e.permissionId));
      if (stale.length > 0) {
        await db.rolePermission.deleteMany({ where: { roleId: row.id, permissionId: { in: stale.map((s) => s.permissionId) } } });
        report.grantsRemoved += stale.length;
      }

      const existingById = new Map(existing.map((e) => [e.permissionId, e.scope]));
      const toCreate = [...desired].filter(([permissionId]) => !existingById.has(permissionId));
      if (toCreate.length > 0) {
        await db.rolePermission.createMany({
          data: toCreate.map(([permissionId, scope]) => ({ roleId: row.id, permissionId, scope })),
        });
      }
      for (const [permissionId, scope] of desired) {
        const current = existingById.get(permissionId);
        if (current && current !== scope) {
          await db.rolePermission.update({ where: { roleId_permissionId: { roleId: row.id, permissionId } }, data: { scope } });
        }
      }
      report.grants += desired.size;
    }
    return report;
  });
}
